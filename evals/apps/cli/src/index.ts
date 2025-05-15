console.log("***** CLI STARTED: If you see this, stdout is working *****")
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

import pMap from "p-map"
// Set up log file location: evals/logs/test-run-<timestamp>.log
const logsDir = path.resolve(__dirname, "../../logs")
if (!fs.existsSync(logsDir)) {
	fs.mkdirSync(logsDir, { recursive: true })
}
const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15)
const defaultLogFile = path.join(logsDir, `test-run-${timestamp}.log`)
const LOG_FILE_PATH = process.env.TEST_LOG_FILE || defaultLogFile
// Helper to log to both console and file
import pWaitFor from "p-wait-for"
import { execa, parseCommandString } from "execa"
import { build, filesystem, GluegunPrompt, GluegunToolbox } from "gluegun"
// Helper to log to both console and file
function logToConsoleAndFile(message: string, isError = false) {
	try {
		fs.appendFileSync(LOG_FILE_PATH, message + "\n")
	} catch (e) {
		console.error("Failed to write to log file:", e)
	}
	if (isError) {
		console.error(message)
	} else {
		console.log(message)
	}
}
import psTree from "ps-tree"

import {
	type ExerciseLanguage,
	exerciseLanguages,
	RooCodeEventName,
	IpcOrigin,
	IpcMessageType,
	TaskCommandName,
	rooCodeDefaults,
	EvalEventName,
} from "@evals/types"
import {
	type Run,
	findRun,
	createRun,
	finishRun,
	type Task,
	createTask,
	getTasks,
	updateTask,
	createTaskMetrics,
	updateTaskMetrics,
	createToolError,
} from "@evals/db"
import { IpcServer, IpcClient } from "@evals/ipc"

import { __dirname, extensionDevelopmentPath, exercisesPath } from "./paths.js"
import { getExercises } from "./exercises.js"

type TaskResult = { success: boolean }
type TaskPromise = Promise<TaskResult>

const TASK_START_DELAY = 10 * 1_000
const TASK_TIMEOUT = 5 * 60 * 1_000
const UNIT_TEST_TIMEOUT = 2 * 60 * 1_000

const testCommands: Record<ExerciseLanguage, { commands: string[]; timeout?: number; cwd?: string }> = {
	go: { commands: ["go test"] }, // timeout 15s bash -c "cd '$dir' && go test > /dev/null 2>&1"
	java: {
		commands: [
			(() => {
				const platform = os.platform()
				const command = platform === "win32" ? "gradlew.bat test" : "./gradlew test"
				console.log(
					`${Date.now()} [cli#testCommands] Generated Java command: "${command}" (platform: ${platform})`,
				)
				return command
			})(),
		],
	}, // timeout --foreground 15s bash -c "cd '$dir' && ./gradlew test > /dev/null 2>&1"
	javascript: { commands: ["pnpm install", "pnpm test"] }, // timeout 15s bash -c "cd '$dir' && pnpm install >/dev/null 2>&1 && pnpm test >/dev/null 2>&1"
	python: {
		commands: [
			// Use python on Windows, python3 on other platforms
			(() => {
				const platform = os.platform()
				const command = `uv run ${platform === "win32" ? "python" : "python3"} -m pytest -o markers=task .`
				console.log(`${Date.now()} [cli#testCommands] Generated command: "${command}" (platform: ${platform})`)
				return command
			})(),
		],
	}, // timeout 15s bash -c "cd '$dir' && uv run python3 -m pytest -o markers=task *_test.py"
	rust: { commands: ["cargo test"] }, // timeout 15s bash -c "cd '$dir' && cargo test > /dev/null 2>&1"
}

const run = async (toolbox: GluegunToolbox) => {
	const { config, prompt } = toolbox

	let { language, exercise } = config

	if (![undefined, ...exerciseLanguages, "all"].includes(language)) {
		throw new Error(`Language is invalid: ${language}`)
	}

	if (!["undefined", "string"].includes(typeof exercise)) {
		throw new Error(`Exercise is invalid: ${exercise}`)
	}

	const id = config.runId ? Number(config.runId) : undefined
	let run: Run

	if (id) {
		run = await findRun(id)
	} else {
		run = await createRun({
			model: rooCodeDefaults.openRouterModelId!,
			pid: process.pid,
			socketPath: path.resolve(os.tmpdir(), `roo-code-evals-${crypto.randomUUID().slice(0, 8)}.sock`),
		})

		if (language === "all") {
			for (const language of exerciseLanguages) {
				const exercises = getExercises()[language as ExerciseLanguage]

				await pMap(exercises, (exercise) => createTask({ runId: run.id, language, exercise }), {
					concurrency: run.concurrency,
				})
			}
		} else if (exercise === "all") {
			const exercises = getExercises()[language as ExerciseLanguage]
			await pMap(exercises, (exercise) => createTask({ runId: run.id, language, exercise }), {
				concurrency: run.concurrency,
			})
		} else {
			language = language || (await askLanguage(prompt))
			exercise = exercise || (await askExercise(prompt, language))
			await createTask({ runId: run.id, language, exercise })
		}
	}

	const tasks = await getTasks(run.id)

	if (!tasks[0]) {
		throw new Error("No tasks found.")
	}

	await execa({ cwd: exercisesPath })`git config user.name "Roo Code"`
	await execa({ cwd: exercisesPath })`git config user.email "support@roocode.com"`
	await execa({ cwd: exercisesPath })`git checkout -f`
	await execa({ cwd: exercisesPath })`git clean -fd`
	await execa({ cwd: exercisesPath })`git checkout -b runs/${run.id}-${crypto.randomUUID().slice(0, 8)} main`

	fs.writeFileSync(
		path.resolve(exercisesPath, "settings.json"),
		JSON.stringify({ ...rooCodeDefaults, ...run.settings }, null, 2),
	)

	const server = new IpcServer(run.socketPath, () => {})
	server.listen()

	const runningPromises: TaskPromise[] = []

	const processTask = async (task: Task, delay = 0) => {
		if (task.finishedAt === null) {
			await new Promise((resolve) => setTimeout(resolve, delay))
			await runExercise({ run, task, server })
		}

		if (task.passed === null) {
			const passed = await runUnitTest({ task })
			await updateTask(task.id, { passed })

			server.broadcast({
				type: IpcMessageType.TaskEvent,
				origin: IpcOrigin.Server,
				data: { eventName: passed ? EvalEventName.Pass : EvalEventName.Fail, taskId: task.id },
			})

			return { success: passed }
		} else {
			return { success: task.passed }
		}
	}

	const processTaskResult = async (task: Task, promise: TaskPromise) => {
		const index = runningPromises.indexOf(promise)

		if (index > -1) {
			runningPromises.splice(index, 1)
		}
	}

	let delay = TASK_START_DELAY

	for (const task of tasks) {
		const promise = processTask(task, delay)
		delay = delay + TASK_START_DELAY
		runningPromises.push(promise)
		promise.then(() => processTaskResult(task, promise))

		if (runningPromises.length >= run.concurrency) {
			delay = 0
			await Promise.race(runningPromises)
		}
	}

	await Promise.all(runningPromises)

	const result = await finishRun(run.id)
	console.log(`${Date.now()} [cli#run]`, result)

	await execa({ cwd: exercisesPath })`git add .`
	await execa({ cwd: exercisesPath })`git commit -m ${`Run #${run.id}`} --no-verify`
}

const runExercise = async ({ run, task, server }: { run: Run; task: Task; server: IpcServer }): TaskPromise => {
	const { language, exercise } = task
	const prompt = fs.readFileSync(path.resolve(exercisesPath, `prompts/${language}.md`), "utf-8")
	const dirname = path.dirname(run.socketPath)
	const workspacePath = path.resolve(exercisesPath, language, exercise)
	// Ensure socket path is properly formatted for the OS
	let taskSocketPath
	if (os.platform() === "win32") {
		// On Windows, use a pipe name format
		taskSocketPath = path.join(dirname, `task-${task.id}.sock`)
	} else {
		// On Unix systems, use the original format
		taskSocketPath = path.resolve(dirname, `${dirname}/task-${task.id}.sock`)
	}

	// If debugging:
	// Use --wait --log trace or --verbose.
	// Don't await execa and store result as subprocess.
	// subprocess.stdout.pipe(process.stdout)

	console.log(`${Date.now()} [cli#runExercise] Opening new VS Code window at ${workspacePath}`)

	await execa({
		env: {
			ROO_CODE_IPC_SOCKET_PATH: taskSocketPath,
		},
		shell: os.platform() === "win32" ? true : "/bin/bash", // Use appropriate shell based on OS
	})`code --disable-workspace-trust -n ${workspacePath}`

	// Give VSCode some time to spawn before connecting to its unix socket.
	await new Promise((resolve) => setTimeout(resolve, 3_000))
	console.log(`${Date.now()} [cli#runExercise] Connecting to ${taskSocketPath}`)
	const client = new IpcClient(taskSocketPath)

	try {
		await pWaitFor(() => client.isReady, { interval: 250, timeout: 5_000 })
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (error) {
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] unable to connect`)
		client.disconnect()
		return { success: false }
	}

	let taskStartedAt = Date.now()
	let taskFinishedAt: number | undefined
	let taskMetricsId: number | undefined
	let rooTaskId: string | undefined
	let isClientDisconnected = false

	const ignoreEvents: Record<"broadcast" | "log", (RooCodeEventName | EvalEventName)[]> = {
		broadcast: [RooCodeEventName.Message],
		log: [RooCodeEventName.Message, RooCodeEventName.TaskTokenUsageUpdated, RooCodeEventName.TaskAskResponded],
	}

	client.on(IpcMessageType.TaskEvent, async (taskEvent) => {
		const { eventName, payload } = taskEvent

		if (!ignoreEvents.broadcast.includes(eventName)) {
			server.broadcast({
				type: IpcMessageType.TaskEvent,
				origin: IpcOrigin.Server,
				relayClientId: client.clientId!,
				data: { ...taskEvent, taskId: task.id },
			})
		}

		if (!ignoreEvents.log.includes(eventName)) {
			console.log(
				`${Date.now()} [cli#runExercise | ${language} / ${exercise}] taskEvent -> ${eventName}`,
				payload,
			)
		}

		if (eventName === RooCodeEventName.TaskStarted) {
			taskStartedAt = Date.now()

			const taskMetrics = await createTaskMetrics({
				cost: 0,
				tokensIn: 0,
				tokensOut: 0,
				tokensContext: 0,
				duration: 0,
				cacheWrites: 0,
				cacheReads: 0,
			})

			await updateTask(task.id, { taskMetricsId: taskMetrics.id, startedAt: new Date() })

			taskStartedAt = Date.now()
			taskMetricsId = taskMetrics.id
			rooTaskId = payload[0]
		}

		if (eventName === RooCodeEventName.TaskToolFailed) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const [_taskId, toolName, error] = payload
			await createToolError({ taskId: task.id, toolName, error })
		}

		if (
			(eventName === RooCodeEventName.TaskTokenUsageUpdated || eventName === RooCodeEventName.TaskCompleted) &&
			taskMetricsId
		) {
			const duration = Date.now() - taskStartedAt

			const { totalCost, totalTokensIn, totalTokensOut, contextTokens, totalCacheWrites, totalCacheReads } =
				payload[1]

			await updateTaskMetrics(taskMetricsId, {
				cost: totalCost,
				tokensIn: totalTokensIn,
				tokensOut: totalTokensOut,
				tokensContext: contextTokens,
				duration,
				cacheWrites: totalCacheWrites ?? 0,
				cacheReads: totalCacheReads ?? 0,
			})
		}

		if (eventName === RooCodeEventName.TaskCompleted && taskMetricsId) {
			const toolUsage = payload[2]
			await updateTaskMetrics(taskMetricsId, { toolUsage })
		}

		if (eventName === RooCodeEventName.TaskAborted || eventName === RooCodeEventName.TaskCompleted) {
			taskFinishedAt = Date.now()
			await updateTask(task.id, { finishedAt: new Date() })
		}
	})

	client.on(IpcMessageType.Disconnect, async () => {
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] disconnect`)
		isClientDisconnected = true
	})

	console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] starting task`)

	client.sendMessage({
		type: IpcMessageType.TaskCommand,
		origin: IpcOrigin.Client,
		clientId: client.clientId!,
		data: {
			commandName: TaskCommandName.StartNewTask,
			data: {
				configuration: {
					...rooCodeDefaults,
					openRouterApiKey: process.env.OPENROUTER_API_KEY!,
					...run.settings,
				},
				text: prompt,
				newTab: true,
			},
		},
	})

	try {
		await pWaitFor(() => !!taskFinishedAt || isClientDisconnected, { interval: 1_000, timeout: TASK_TIMEOUT })
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (error) {
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] time limit reached`)

		// Cancel the task.
		if (rooTaskId && !isClientDisconnected) {
			client.sendMessage({
				type: IpcMessageType.TaskCommand,
				origin: IpcOrigin.Client,
				clientId: client.clientId!,
				data: { commandName: TaskCommandName.CancelTask, data: rooTaskId },
			})

			// Allow some time for the task to cancel.
			await new Promise((resolve) => setTimeout(resolve, 5_000))
		}

		await updateTask(task.id, { finishedAt: new Date() })
	}

	if (!isClientDisconnected) {
		if (rooTaskId) {
			client.sendMessage({
				type: IpcMessageType.TaskCommand,
				origin: IpcOrigin.Client,
				clientId: client.clientId!,
				data: { commandName: TaskCommandName.CloseTask, data: rooTaskId },
			})

			// Allow some time for the window to close.
			await new Promise((resolve) => setTimeout(resolve, 2_000))
		}

		// Pause before disconnecting to allow user to see logs
		if (process.env.PAUSE_ON_EXIT === "1") {
			const readline = await import("node:readline")
			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			})
			await new Promise((resolve) => {
				rl.question("***** Press Enter to close this window and finish the test... *****", () => {
					rl.close()
					resolve(void 0)
				})
			})
		}
		client.disconnect()
	}

	return { success: !!taskFinishedAt }
}

const runUnitTest = async ({ task }: { task: Task }) => {
	const cmd = testCommands[task.language]
	const exercisePath = path.resolve(exercisesPath, task.language, task.exercise)
	const cwd = cmd.cwd ? path.resolve(exercisePath, cmd.cwd) : exercisePath
	const commands = cmd.commands.map((cs) => {
		const parsed = parseCommandString(cs)
		logToConsoleAndFile(
			`${Date.now()} [cli#runUnitTest] Original command: "${cs}", Parsed command: "${parsed.join(" ")}"`,
		)
		return parsed
	})

	let passed = true

	for (const command of commands) {
		try {
			logToConsoleAndFile(
				`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] running "${command.join(" ")}"`,
			)
			// Log relevant environment variables for debugging (always log)
			logToConsoleAndFile(`Full process.env: ${JSON.stringify(process.env, null, 2)}`)

			const subprocess = execa({ cwd, shell: true, reject: false })`${command}`

			const timeout = setTimeout(async () => {
				const descendants = await new Promise<number[]>((resolve, reject) => {
					psTree(subprocess.pid!, (err, children) => {
						if (err) {
							reject(err)
						}

						resolve(children.map((p) => parseInt(p.PID)))
					})
				})

				logToConsoleAndFile(
					`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] "${command.join(" ")}": unit tests timed out, killing ${subprocess.pid} + ${JSON.stringify(descendants)}`,
				)

				if (descendants.length > 0) {
					for (const descendant of descendants) {
						try {
							logToConsoleAndFile(
								`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] killing ${descendant}`,
							)
							if (os.platform() === "win32") {
								await execa`taskkill /PID ${descendant} /T /F`
							} else {
								await execa`kill -9 ${descendant}`
							}
						} catch (error) {
							logToConsoleAndFile(
								`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] Error killing descendant processes:\n${error}`,
								true,
							)
						}
					}
				}

				logToConsoleAndFile(
					`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] killing ${subprocess.pid}`,
				)

				try {
					if (os.platform() === "win32") {
						await execa`taskkill /PID ${subprocess.pid!} /T /F`
					} else {
						await execa`kill -9 ${subprocess.pid!}`
					}
				} catch (error) {
					logToConsoleAndFile(
						`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] Error killing process:\n${error}`,
						true,
					)
				}
			}, UNIT_TEST_TIMEOUT)

			const result = await subprocess

			logToConsoleAndFile(
				`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] "${command.join(" ")}" result -> ${JSON.stringify(result)}`,
			)

			clearTimeout(timeout)

			if (result.failed) {
				logToConsoleAndFile(
					`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] Command failed: "${command.join(" ")}"\n` +
						`Exit code: ${result.exitCode}\n` +
						`stdout:\n${result.stdout}\n` +
						`stderr:\n${result.stderr}`,
					true,
				)
				passed = false
				break
			} else {
				logToConsoleAndFile(
					`***** [cli#runUnitTest | ${task.language} / ${task.exercise}] Command succeeded: "${command.join(" ")}" *****\n` +
						`***** Exit code: ${result.exitCode} *****\n` +
						`***** stdout:\n${result.stdout}\n` +
						`***** stderr:\n${result.stderr}\n` +
						`*****`,
				)
			}
		} catch (error) {
			logToConsoleAndFile(`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] ${error}`, true)
			passed = false
			break
		}
	}

	return passed
}

const askLanguage = async (prompt: GluegunPrompt) => {
	const { language } = await prompt.ask<{ language: ExerciseLanguage }>({
		type: "select",
		name: "language",
		message: "Which language?",
		choices: [...exerciseLanguages],
	})

	return language
}

const askExercise = async (prompt: GluegunPrompt, language: ExerciseLanguage) => {
	const exercises = filesystem.subdirectories(path.join(exercisesPath, language))

	if (exercises.length === 0) {
		throw new Error(`No exercises found for ${language}`)
	}

	const { exercise } = await prompt.ask<{ exercise: string }>({
		type: "select",
		name: "exercise",
		message: "Which exercise?",
		choices: exercises.map((exercise) => path.basename(exercise)).filter((exercise) => !exercise.startsWith(".")),
	})

	return exercise
}

const main = async () => {
	const cli = build()
		.brand("cli")
		.src(__dirname)
		.help()
		.version()
		.command({
			name: "run",
			description: "Run an eval",
			run: ({ config, parameters }) => {
				config.language = parameters.first
				config.exercise = parameters.second

				if (parameters.options["runId"]) {
					config.runId = parameters.options["runId"]
				}
			},
		})
		.defaultCommand()
		.create()

	const toolbox = await cli.run(process.argv)
	const { command } = toolbox

	switch (command?.name) {
		case "run":
			await run(toolbox)
			break
	}

	process.exit(0)
}

if (!fs.existsSync(extensionDevelopmentPath)) {
	console.error(`"extensionDevelopmentPath" does not exist.`)
	process.exit(1)
}

if (!fs.existsSync(exercisesPath)) {
	console.error(
		`Exercises path does not exist. Please run "git clone https://github.com/cte/Roo-Code-Benchmark.git exercises".`,
	)
	process.exit(1)
}

main()
