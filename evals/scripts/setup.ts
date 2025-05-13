import os from "os"
import fs from "fs"
import inquirer from "inquirer"
import { spawnSync } from "cross-spawn"
import axios from "axios"
import path from "path"

function getOS(): "macOS" | "Linux" | "Windows" {
	const platform = os.platform()
	if (platform === "darwin") return "macOS"
	if (platform === "linux") return "Linux"
	if (platform === "win32") return "Windows"
	throw new Error("Unsupported OS")
}

function installPowerShell(os: string): void {
	if (os === "Windows") return // PowerShell pre-installed on Windows
	if (spawnSync("pwsh", ["--version"]).status !== 0) {
		console.log("Installing PowerShell Core...")
		if (os === "macOS") {
			spawnSync(
				"/bin/bash",
				["-c", "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"],
				{ stdio: "inherit" },
			)
			spawnSync("brew", ["install", "powershell"], { stdio: "inherit" })
		} else if (os === "Linux") {
			spawnSync("sudo", ["apt-get", "update"], { stdio: "inherit" })
			spawnSync("sudo", ["apt-get", "install", "-y", "wget"], { stdio: "inherit" })
			spawnSync(
				"wget",
				["-q", "https://packages.microsoft.com/config/ubuntu/20.04/packages-microsoft-prod.deb"],
				{ stdio: "inherit" },
			)
			spawnSync("sudo", ["dpkg", "-i", "packages-microsoft-prod.deb"], { stdio: "inherit" })
			spawnSync("sudo", ["apt-get", "update"], { stdio: "inherit" })
			spawnSync("sudo", ["apt-get", "install", "-y", "powershell"], { stdio: "inherit" })
			spawnSync("rm", ["packages-microsoft-prod.deb"], { stdio: "inherit" })
		}
	}
}

function installPackageManager(os: string): void {
	if (os === "macOS" && spawnSync("brew", ["--version"]).status !== 0) {
		spawnSync(
			"/bin/bash",
			["-c", "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"],
			{ stdio: "inherit" },
		)
	} else if (os === "Linux") {
		spawnSync("sudo", ["apt", "update"], { stdio: "inherit" })
		spawnSync("sudo", ["apt", "install", "-y", "curl", "git"], { stdio: "inherit" })
	} else if (os === "Windows" && spawnSync("winget", ["--version"]).status !== 0) {
		spawnSync(
			"powershell",
			["Add-AppxPackage", "-RegisterByFamilyName", "-MainPackage", "Microsoft.DesktopAppInstaller_8wekyb3d8bbwe"],
			{ stdio: "inherit", shell: true },
		)
	}
}

function installAsdf(os: string): boolean {
	if (os === "Windows") {
		console.log("Using winget for Windows runtime management.")
		return false
	}
	if (spawnSync("asdf", ["--version"]).status !== 0) {
		if (os === "macOS") {
			spawnSync("brew", ["install", "asdf"], { stdio: "inherit" })
		} else if (os === "Linux") {
			spawnSync(
				"git",
				["clone", "https://github.com/asdf-vm/asdf.git", `${os.homedir()}/.asdf`, "--branch", "v0.14.1"],
				{ stdio: "inherit" },
			)
		}
		const shellConfig = os === "macOS" ? ".zshrc" : ".bashrc"
		const asdfLine = `. $HOME/.asdf/asdf.sh`
		if (
			!fs.existsSync(`${os.homedir()}/${shellConfig}`) ||
			!fs.readFileSync(`${os.homedir()}/${shellConfig}`, "utf8").includes(asdfLine)
		) {
			fs.appendFileSync(`${os.homedir()}/${shellConfig}`, `\n${asdfLine}\n`)
		}
	}
	return true
}

async function selectLanguages(): Promise<string[]> {
	const choices = [
		{ name: "Node.js (20.18.1)", value: "nodejs 20.18.1", checked: true },
		{ name: "Python (3.13.2)", value: "python 3.13.2", checked: true },
		{ name: "Go (1.24.2)", value: "golang 1.24.2", checked: true },
		{ name: "Rust (1.85.1)", value: "rust 1.85.1", checked: true },
		{ name: "Java (openjdk-17)", value: "java openjdk-17", checked: true },
		{ name: ".NET (8.0.401)", value: "dotnet 8.0.401", checked: true },
	]
	const { selected } = await inquirer.prompt([
		{ type: "checkbox", name: "selected", message: "Select eval types:", choices },
	])
	if (getOS() !== "Windows") {
		fs.writeFileSync("../.tool-versions", selected.join("\n") + "\n")
	} else {
		fs.writeFileSync(
			"../runtimes.json",
			JSON.stringify(
				selected.map((s) => s.split(" ")),
				null,
				2,
			),
		)
	}
	return selected
}

function installRuntimesAndTools(os: string, selected: string[]): void {
	const runtimes = [
		{
			plugin: "python",
			winget: "Python.Python.3.13",
			version: "3.13.2",
			url: "https://github.com/danhper/asdf-python.git",
		},
		{
			plugin: "golang",
			winget: "GoLang.Go",
			version: "1.24.2",
			url: "https://github.com/asdf-community/asdf-golang.git",
		},
		{
			plugin: "rust",
			winget: "Rustlang.Rust",
			version: "1.85.1",
			url: "https://github.com/asdf-community/asdf-rust.git",
		},
		{
			plugin: "java",
			winget: "EclipseAdoptium.Temurin.17.JDK",
			version: "openjdk-17",
			url: "https://github.com/halcyon/asdf-java.git",
		},
		{
			plugin: "dotnet",
			winget: "Microsoft.DotNet.SDK.8",
			version: "8.0.401",
			url: "https://github.com/hensou/asdf-dotnet.git",
		},
	]
	const tools = [
		{
			plugin: "pnpm",
			winget: "pnpm.pnpm",
			version: "latest",
			url: "https://github.com/jonathanmorley/asdf-pnpm.git",
		},
		{ plugin: "gh", winget: "GitHub.cli", version: "latest", url: "https://github.com/younke/asdf-gh.git" },
	]
	if (os !== "Windows" && installAsdf(os)) {
		for (const runtime of runtimes) {
			if (selected.some((s) => s.includes(runtime.plugin))) {
				spawnSync("asdf", ["plugin", "add", runtime.plugin, runtime.url], { stdio: "inherit" })
			}
		}
		for (const tool of tools) {
			spawnSync("asdf", ["plugin", "add", tool.plugin, tool.url], { stdio: "inherit" })
		}
		if (selected.some((s) => s.includes("python"))) {
			spawnSync("asdf", ["plugin", "add", "uv", "https://github.com/owenthereal/asdf-uv.git"], {
				stdio: "inherit",
			})
		}
		spawnSync("asdf", ["install"], { stdio: "inherit" })
		spawnSync("asdf", ["global", ...selected.map((s) => s.split(" ")[0])], { stdio: "inherit" })
	} else {
		for (const runtime of runtimes) {
			if (selected.some((s) => s.includes(runtime.plugin))) {
				const result = spawnSync(
					"winget",
					[
						"install",
						runtime.winget,
						"--version",
						runtime.version,
						"--silent",
						"--accept-package-agreements",
					],
					{ stdio: "inherit", shell: true },
				)
				if (result.status !== 0) {
					console.log(`⚠️ ${runtime.plugin} version ${runtime.version} not found. Installing latest...`)
					spawnSync("winget", ["install", runtime.winget, "--silent", "--accept-package-agreements"], {
						stdio: "inherit",
						shell: true,
					})
				}
			}
		}
		for (const tool of tools) {
			spawnSync("winget", ["install", tool.winget, "--silent", "--accept-package-agreements"], {
				stdio: "inherit",
				shell: true,
			})
		}
		if (selected.some((s) => s.includes("python"))) {
			console.log("Installing uv via pip...")
			spawnSync("pip", ["install", "uv"], { stdio: "inherit", shell: true })
		}
	}
}

function installVSCodeExtensions(): void {
	if (spawnSync("code", ["--version"]).status !== 0) {
		throw new Error("VS Code CLI not found. Please install Visual Studio Code.")
	}
	const extensions = [
		"golang.go",
		"dbaeumer.vscode-eslint",
		"redhat.java",
		"ms-python.python",
		"rust-lang.rust-analyzer",
		"rooveterinaryinc.roo-cline",
	]
	for (const ext of extensions) {
		spawnSync("code", ["--install-extension", ext], { stdio: "inherit" })
	}
	console.log("✅ VS Code extensions installed")
}

async function setupRepository(): Promise<void> {
	const repoPath = path.resolve(__dirname, "..", "..", "..", "evals")
	const repoUrl = "https://github.com/cte/evals.git"
	const repoUpstream = "cte/evals"

	console.log(`Checking for cte/evals repository at ${repoPath}...`)

	try {
		fs.accessSync(path.join(repoPath, ".git"))
		console.log(`Repository found at ${repoPath}. Updating...`)
		spawnSync("git", ["-C", repoPath, "pull"], { stdio: "inherit" })
		console.log("✅ Repository updated")
	} catch {
		console.log(`Repository not found at ${repoPath}.`)
		const { cloneRepo } = await inquirer.prompt([
			{
				type: "confirm",
				name: "cloneRepo",
				message: `Clone cte/evals benchmark tests from ${repoUrl}?`,
				default: true,
			},
		])

		if (!cloneRepo) {
			throw new Error("The cte/evals repository is required for benchmark tests.")
		}

		try {
			fs.mkdirSync(path.dirname(repoPath), { recursive: true })
			if (spawnSync("gh", ["--version"]).status === 0) {
				const { forkRepo } = await inquirer.prompt([
					{
						type: "confirm",
						name: "forkRepo",
						message: `Fork ${repoUpstream} using GitHub CLI? (Recommended for contributing results)`,
						default: true,
					},
				])

				if (forkRepo) {
					spawnSync("gh", ["repo", "fork", repoUpstream, "--clone=true", "--", repoPath], {
						stdio: "inherit",
					})
					console.log(`✅ Forked and cloned cte/evals to ${repoPath}`)
					return
				}
			}

			spawnSync("git", ["clone", repoUrl, repoPath], { stdio: "inherit" })
			console.log(`✅ Cloned cte/evals to ${repoPath}`)
		} catch (error) {
			throw new Error(`Failed to clone cte/evals: ${error.message}`)
		}
	}
}

async function setupEnvironment(): Promise<void> {
	if (!fs.existsSync("../.env")) {
		fs.copyFileSync("../.env.sample", "../.env")
	}
	if (!fs.readFileSync("../.env", "utf8").includes("OPENROUTER_API_KEY")) {
		const { key } = await inquirer.prompt([
			{ type: "input", name: "key", message: "Enter OpenRouter API key (sk-or-v1-...):" },
		])
		await axios.get("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } })
		fs.appendFileSync("../.env", `OPENROUTER_API_KEY=${key}\n`)
	}
}

async function setupDatabaseAndWeb(): Promise<void> {
	spawnSync("pnpm", ["--filter", "@evals/db", "db:push"], { stdio: "inherit" })
	spawnSync("pnpm", ["--filter", "@evals/db", "db:enable-wal"], { stdio: "inherit" })
	const { start } = await inquirer.prompt([{ type: "confirm", name: "start", message: "Start the evals web app?" }])
	if (start) {
		spawnSync("pnpm", ["web"], { stdio: "inherit" })
	}
}

async function buildExtension(): Promise<void> {
	const { build } = await inquirer.prompt([{ type: "confirm", name: "build", message: "Build Roo Code extension?" }])
	if (build) {
		process.chdir("..")
		fs.mkdirSync("bin", { recursive: true })
		spawnSync("pnpm", ["install-extension"], { stdio: "inherit" })
		spawnSync("pnpm", ["install-webview"], { stdio: "inherit" })
		spawnSync("pnpm", ["install-e2e"], { stdio: "inherit" })
		spawnSync("npx", ["vsce", "package", "--out", "bin/roo-code-latest.vsix"], { stdio: "inherit" })
		spawnSync("code", ["--install-extension", "bin/roo-code-latest.vsix"], { stdio: "inherit" })
		process.chdir("evals")
	}
}

async function main(): Promise<void> {
	const os = getOS()
	installPowerShell(os)
	installPackageManager(os)
	await setupRepository()
	const selected = await selectLanguages()
	installRuntimesAndTools(os, selected)
	installVSCodeExtensions()
	await setupEnvironment()
	await setupDatabaseAndWeb()
	await buildExtension()
	console.log("🚀 Setup complete!")
}

main().catch((err) => {
	console.error("❌ Error:", err.message)
	process.exit(1)
})
