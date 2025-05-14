"use server"

import { spawn } from "child_process"
import path from "path"
import os from "os"
import fs from "fs"
import { fileURLToPath } from "url"
import { execSync } from "child_process"

import { revalidatePath } from "next/cache"
import pMap from "p-map"

import { ExerciseLanguage, exerciseLanguages } from "@evals/types"
import * as db from "@evals/db"

import { CreateRun } from "@/lib/schemas"
import { getExercisesForLanguage } from "./exercises"
// Get the project root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Navigate up from /apps/web/src/lib/server to the project root
const ROOT_DIR = path.resolve(__dirname, "../../../../../")
// Create logs directory path
const LOGS_DIR = path.join(ROOT_DIR, "data", "logs")
// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
	fs.mkdirSync(LOGS_DIR, { recursive: true })
}

export async function createRun({ suite, exercises = [], ...values }: CreateRun) {
	const run = await db.createRun({
		...values,
		socketPath: path.join(os.tmpdir(), `roo-code-evals-${crypto.randomUUID()}.sock`),
	})

	if (suite === "partial") {
		for (const path of exercises) {
			const [language, exercise] = path.split("/")

			if (!language || !exercise) {
				throw new Error("Invalid exercise path: " + path)
			}

			await db.createTask({ ...values, runId: run.id, language: language as ExerciseLanguage, exercise })
		}
	} else {
		for (const language of exerciseLanguages) {
			const exercises = await getExercisesForLanguage(language)

			await pMap(exercises, (exercise) => db.createTask({ ...values, runId: run.id, language, exercise }), {
				concurrency: 10,
			})
		}
	}

	revalidatePath("/runs")

	try {
		// Check if pnpm is available
		let pnpmPath = "pnpm"
		// On Windows, we need to handle the executable differently
		if (os.platform() === "win32") {
			try {
				// Try to find pnpm in the PATH
				execSync("where pnpm", { stdio: "ignore" })
			} catch (e) {
				// If pnpm is not in PATH, try to use npx to run it
				console.log("pnpm not found in PATH, trying with npx...")
				pnpmPath = "npx"
			}
		}
		const logFile = fs.openSync(path.join(LOGS_DIR, `roo-code-evals-${run.id}.log`), "a")

		// Construct command arguments based on whether we're using pnpm directly or via npx
		const args =
			pnpmPath === "npx"
				? ["pnpm", "--filter", "@evals/cli", "dev", "run", "all", "--runId", run.id.toString()]
				: ["--filter", "@evals/cli", "dev", "run", "all", "--runId", run.id.toString()]
		console.log(`Spawning process: ${pnpmPath} ${args.join(" ")}`)
		const process = spawn(pnpmPath, args, {
			detached: true,
			stdio: ["ignore", logFile, logFile],
			shell: os.platform() === "win32", // Use shell on Windows for better compatibility
		})

		// Check if process was created successfully
		if (!process.pid) {
			throw new Error("Failed to get process PID")
		}
		console.log(`Process spawned with PID: ${process.pid}`)
		process.unref()
		await db.updateRun(run.id, { pid: process.pid })
	} catch (error) {
		console.error("Error spawning process:", error)
	}

	return run
}

export async function deleteRun(runId: number) {
	await db.deleteRun(runId)
	revalidatePath("/runs")
}
