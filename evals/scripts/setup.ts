import * as os from "os"
import * as fs from "fs"
import * as path from "path"
import inquirer from "inquirer"
import * as spawn from "cross-spawn"
import axios from "axios"
import chalk from "chalk"
import * as semver from "semver"
import { fileURLToPath } from "url"
import { spawnSync } from "child_process"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const evalsRoot = path.resolve(__dirname, "..", "..")
const workspaceRoot = path.resolve(__dirname, "..", "..", "..")
const dataDir = path.join(evalsRoot, "data")
console.log("DEBUG __filename:", __filename)
console.log("DEBUG __dirname:", __dirname)
console.log("DEBUG evalsRoot:", evalsRoot)
console.log("DEBUG workspaceRoot:", workspaceRoot)
console.log("DEBUG dataDir:", dataDir)
// Helper: Refresh process.env.PATH from Windows registry after winget install
function refreshProcessEnvPathFromRegistry() {
	if (getOS() !== "Windows") return
	let newPath = ""
	// Try user and system PATH
	const queries = [
		["HKCU\\Environment", "Path"],
		["HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment", "Path"],
	]
	for (const [key, value] of queries) {
		const reg = spawnSync("reg", ["query", key, "/v", value], { encoding: "utf8" })
		if (reg.status === 0 && reg.stdout) {
			const match = reg.stdout.match(/Path\s+REG_\w+\s+([^\r\n]+)/i)
			if (match && match[1]) {
				newPath += match[1] + ";"
			}
		}
	}
	if (newPath) {
		process.env.PATH = newPath + process.env.PATH
		console.log(
			chalk.blue(
				"💡 Refreshed process.env.PATH from registry after winget install. If issues persist, restart your terminal.",
			),
		)
	} else {
		console.log(
			chalk.yellow(
				"⚠️  Could not refresh PATH from registry. If Python is installed but not found, try restarting your terminal.",
			),
		)
	}
}

function getOS(): "macOS" | "Linux" | "Windows" {
	const platform = os.platform()
	if (platform === "darwin") return "macOS"
	if (platform === "linux") return "Linux"
	if (platform === "win32") return "Windows"
	throw new Error("Unsupported OS")
}

const logInfo = (message: string) => console.log(chalk.blue(`💡 ${message}`))
const logSuccess = (message: string) => console.log(chalk.green(`✅ ${message}`))
const logWarning = (message: string) => console.log(chalk.yellow(`⚠️ ${message}`))
const logError = (message: string) => console.error(chalk.red(`🚨 ${message}`))

/**
 * Persist a key-value pair to a .env file.
 * If the key exists, its value is updated; otherwise, it is appended.
 */
function persistEnvVar(envPath: string, key: string, value: string): void {
	let envContent = ""
	try {
		envContent = fs.readFileSync(envPath, "utf8")
	} catch (err) {
		envContent = ""
	}
	const envVar = `${key}=${value}`
	if (envContent.includes(`${key}=`)) {
		// Replace existing value
		envContent = envContent.replace(new RegExp(`^${key}=.*$`, "m"), envVar)
	} else {
		// Ensure newline if needed
		if (envContent.length > 0 && !envContent.endsWith("\n")) {
			envContent += "\n"
		}
		envContent += envVar + "\n"
	}
	fs.writeFileSync(envPath, envContent, "utf8")
	logSuccess(`Persisted ${key} to .env: ${value}`)
}

function installPowerShell(osType: string): void {
	if (osType === "Windows") return // PowerShell pre-installed on Windows
	if (spawn.sync("pwsh", ["--version"]).status !== 0) {
		logInfo("Installing PowerShell Core...")
		if (osType === "macOS") {
			spawn.sync(
				"/bin/bash",
				["-c", "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"],
				{ stdio: "inherit" },
			)
			spawn.sync("brew", ["install", "powershell"], { stdio: "inherit" })
		} else if (osType === "Linux") {
			spawn.sync("sudo", ["apt-get", "update"], { stdio: "inherit" })
			spawn.sync("sudo", ["apt-get", "install", "-y", "wget"], { stdio: "inherit" })
			spawn.sync(
				"wget",
				["-q", "https://packages.microsoft.com/config/ubuntu/20.04/packages-microsoft-prod.deb"],
				{ stdio: "inherit" },
			)
			spawn.sync("sudo", ["dpkg", "-i", "packages-microsoft-prod.deb"], { stdio: "inherit" })
			spawn.sync("sudo", ["apt-get", "update"], { stdio: "inherit" })
			spawn.sync("sudo", ["apt-get", "install", "-y", "powershell"], { stdio: "inherit" })
			spawn.sync("rm", ["packages-microsoft-prod.deb"], { stdio: "inherit" })
		}
		logSuccess("PowerShell Core installed")
	} else {
		logSuccess("PowerShell Core already installed")
	}
}

function installPackageManager(osType: string): void {
	if (osType === "macOS" && spawn.sync("brew", ["--version"]).status !== 0) {
		logInfo("Installing Homebrew...")
		spawn.sync(
			"/bin/bash",
			["-c", "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"],
			{ stdio: "inherit" },
		)
		logSuccess("Homebrew installed")
	} else if (osType === "Linux") {
		if (spawn.sync("apt", ["--version"]).status !== 0) {
			logWarning("apt not found; please ensure a compatible package manager is installed")
		} else {
			logInfo("Updating apt...")
			spawn.sync("sudo", ["apt", "update"], { stdio: "inherit" })
			spawn.sync("sudo", ["apt", "install", "-y", "curl", "git"], { stdio: "inherit" })
			logSuccess("apt updated and prerequisites installed")
		}
	} else if (osType === "Windows" && spawn.sync("winget", ["--version"]).status !== 0) {
		logInfo("Installing winget...")
		spawn.sync(
			"powershell",
			["Add-AppxPackage", "-RegisterByFamilyName", "-MainPackage", "Microsoft.DesktopAppInstaller_8wekyb3d8bbwe"],
			{ stdio: "inherit", shell: true },
		)
		logSuccess("winget installed")
	} else {
		logSuccess("Package manager already installed")
	}
}

function installAsdf(osType: string): boolean {
	if (osType === "Windows") {
		logInfo("Using winget for Windows runtime management.")
		return false
	}
	if (spawn.sync("asdf", ["--version"]).status !== 0) {
		logInfo("Installing asdf...")
		if (osType === "macOS") {
			spawn.sync("brew", ["install", "asdf"], { stdio: "inherit" })
		} else if (osType === "Linux") {
			spawn.sync(
				"git",
				["clone", "https://github.com/asdf-vm/asdf.git", `${os.homedir()}/.asdf`, "--branch", "v0.14.1"],
				{ stdio: "inherit" },
			)
		}
		const shellConfig = osType === "macOS" ? ".zshrc" : ".bashrc"
		const asdfLine = `. $HOME/.asdf/asdf.sh`
		if (
			!fs.existsSync(`${os.homedir()}/${shellConfig}`) ||
			!fs.readFileSync(`${os.homedir()}/${shellConfig}`, "utf8").includes(asdfLine)
		) {
			fs.appendFileSync(`${os.homedir()}/${shellConfig}`, `\n${asdfLine}\n`)
		}
		logSuccess("asdf installed")
	} else {
		logSuccess("asdf already installed")
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
		{ name: ".NET (9.0.300)", value: "dotnet 9.0.300", checked: true },
	]
	logInfo("Select eval languages:")
	const { selected } = await inquirer.prompt([
		{ type: "checkbox", name: "selected", message: "Select eval types:", choices },
	])
	if (!selected || selected.length === 0) {
		logError("No languages selected. Exiting.")
		process.exit(1)
	}
	if (getOS() !== "Windows") {
		fs.writeFileSync("../.tool-versions", selected.join("\n") + "\n")
	} else {
		fs.writeFileSync(
			"../runtimes.json",
			JSON.stringify(
				selected.map((s: string) => s.split(" ")),
				null,
				2,
			),
		)
	}
	logSuccess(`Selected languages: ${selected.map((s: string) => s.split(" ")[0]).join(", ")}`)
	return selected
}

function getCommandOutput(command: string, args: string[] = []): string | null {
	const result = spawn.sync(command, args, { encoding: "utf8", shell: getOS() === "Windows" })
	if (result.status !== 0) {
		return null
	}
	return result.stdout.trim()
}

function checkVersion(output: string | null, requiredVersion: string): boolean {
	if (!output) return false
	try {
		const cleanOutput = semver.coerce(output)
		if (!cleanOutput) {
			logWarning(`Could not coerce version: ${output}. Assuming mismatch.`)
			return false
		}
		return semver.satisfies(cleanOutput.version, requiredVersion)
	} catch {
		logWarning(`Could not parse version: ${output}. Assuming mismatch.`)
		return false
	}
}

function installRuntimesAndTools(os: string, selected: string[]): void {
	const runtimes = [
		{
			plugin: "python",
			winget: "Python.Python.3.13",
			version: ">=3.13.2",
			checkCmd: os === "Windows" ? "python" : "python3",
			checkArgs: ["--version"],
			url: "https://github.com/danhper/asdf-python.git",
		},
		{
			plugin: "golang",
			winget: "GoLang.Go",
			version: "1.24.2",
			checkCmd: "go",
			checkArgs: ["version"],
			url: "https://github.com/asdf-community/asdf-golang.git",
		},
		{
			plugin: "rust",
			winget: "Rustlang.Rustup",
			version: "1.85.1",
			checkCmd: "rustc",
			checkArgs: ["--version"],
			url: "https://github.com/asdf-community/asdf-rust.git",
		},
		{
			plugin: "java",
			winget: "EclipseAdoptium.Temurin.17.JDK",
			version: "17",
			checkCmd: "javac",
			checkArgs: ["-version"],
			url: "https://github.com/halcyon/asdf-java.git",
		},
		{
			plugin: "dotnet",
			winget: "Microsoft.DotNet.SDK.8",
			version: "9.0.300",
			checkCmd: "dotnet",
			checkArgs: ["--version"],
			url: "https://github.com/hensou/asdf-dotnet.git",
		},
	]

	const tools = [
		{
			plugin: "pnpm",
			winget: "pnpm.pnpm",
			version: "10.11.0",
			checkCmd: "pnpm",
			checkArgs: ["--version"],
			url: "https://github.com/jonathanmorley/asdf-pnpm.git",
		},
		{
			plugin: "github-cli",
			winget: "GitHub.cli",
			version: "latest",
			checkCmd: "gh",
			checkArgs: ["--version"],
			url: "https://github.com/bartlomiejdanek/asdf-github-cli.git",
		},
	]

	logInfo("Installing runtimes and tools...")
	if (os !== "Windows" && installAsdf(os)) {
		for (const runtime of runtimes) {
			// Find the selected entry for this runtime, e.g. "java openjdk-17"
			const selectedEntry = selected.find((s) => s.startsWith(`${runtime.plugin} `))
			if (selectedEntry) {
				const asdfVersion = selectedEntry.split(" ")[1] || runtime.version
				const versionOutput = getCommandOutput(runtime.checkCmd, runtime.checkArgs)
				if (versionOutput && checkVersion(versionOutput, runtime.version)) {
					logSuccess(`${runtime.plugin} already installed with compatible version (${versionOutput})`)
					continue
				}
				logInfo(`Installing ${runtime.plugin} via asdf...`)
				logInfo(`Running: asdf plugin add ${runtime.plugin} ${runtime.url}`)
				const pluginAddResult = spawn.sync("asdf", ["plugin", "add", runtime.plugin, runtime.url], {
					stdio: "inherit",
				})
				if (pluginAddResult.status !== 0) {
					logError(`Failed to add asdf plugin for ${runtime.plugin}`)
					process.exit(1)
				}
				logInfo(`Running: asdf install ${runtime.plugin} ${asdfVersion}`)
				const installResult = spawn.sync("asdf", ["install", runtime.plugin, asdfVersion], {
					stdio: "inherit",
				})
				if (installResult.status !== 0) {
					logError(`Failed to install ${runtime.plugin} via asdf`)
					process.exit(1)
				}
				logInfo(`Running: asdf set --parent ${runtime.plugin} ${asdfVersion}`)
				const setResult = spawn.sync("asdf", ["set", "--parent", runtime.plugin, asdfVersion], {
					stdio: "inherit",
				})
				if (setResult.status !== 0) {
					logError(`Failed to set ${runtime.plugin} as parent in asdf`)
					process.exit(1)
				}
				const newVersion = getCommandOutput(runtime.checkCmd, runtime.checkArgs)
				if (newVersion && checkVersion(newVersion, runtime.version)) {
					logSuccess(`${runtime.plugin} installed (${newVersion})`)
				} else {
					if (!newVersion) {
						logError(`${runtime.plugin} installation failed: not found or not installed`)
					} else {
						logError(`${runtime.plugin} version mismatch: found ${newVersion}, expected ${runtime.version}`)
					}
					process.exit(1)
				}
			}
		}
		for (const tool of tools) {
			let toolVersion = tool.version
			// Special handling for pnpm: must use a specific version, not "latest"
			if (tool.plugin === "pnpm" && (tool.version === "latest" || !semver.valid(tool.version))) {
				logInfo("Fetching latest pnpm version from asdf list-all...")
				const listAllResult = spawn.sync("asdf", ["list-all", "pnpm"], { encoding: "utf8" })
				if (listAllResult.status === 0 && listAllResult.stdout) {
					const versions = listAllResult.stdout
						.split("\n")
						.map((v) => v.trim())
						.filter((v) => semver.valid(v))
					if (versions.length > 0) {
						// Sort descending and pick the highest
						versions.sort(semver.rcompare)
						toolVersion = versions[0]
						logInfo(`Using pnpm version ${toolVersion}`)
					} else {
						logError("Could not determine latest pnpm version from asdf list-all")
						process.exit(1)
					}
				} else {
					logError("Failed to fetch pnpm versions from asdf")
					process.exit(1)
				}
			}

			const versionOutput = getCommandOutput(tool.checkCmd, tool.checkArgs)
			// Check if asdf plugin is already added
			const pluginListResult = spawn.sync("asdf", ["plugin", "list"], { encoding: "utf8" })
			const pluginList =
				pluginListResult.status === 0 ? pluginListResult.stdout.split("\n").map((s) => s.trim()) : []
			const pluginAlreadyAdded = pluginList.includes(tool.plugin)
			// Check if the tool/version is already installed
			const asdfListResult = spawn.sync("asdf", ["list", tool.plugin], { encoding: "utf8" })
			const asdfList = asdfListResult.status === 0 ? asdfListResult.stdout.split("\n").map((s) => s.trim()) : []
			const versionAlreadyInstalled = asdfList.some((v) => v === toolVersion)
			// Check if the tool/version is already set as current
			const asdfCurrentResult = spawn.sync("asdf", ["current", tool.plugin], { encoding: "utf8" })
			const asdfCurrent = asdfCurrentResult.status === 0 ? asdfCurrentResult.stdout : ""
			const versionAlreadySet = asdfCurrent.includes(toolVersion)

			if (versionOutput && versionAlreadyInstalled && versionAlreadySet) {
				logSuccess(`${tool.plugin} already installed (${versionOutput})`)
				continue
			}
			logInfo(`Installing ${tool.plugin} via asdf...`)
			if (!pluginAlreadyAdded) {
				logInfo(`Running: asdf plugin add ${tool.plugin} ${tool.url}`)
				const pluginAddResult = spawn.sync("asdf", ["plugin", "add", tool.plugin, tool.url], {
					stdio: "inherit",
				})
				if (pluginAddResult.status !== 0) {
					logError(`Failed to add asdf plugin for ${tool.plugin}`)
					process.exit(1)
				}
			} else {
				logInfo(`asdf plugin for ${tool.plugin} already added`)
			}
			if (!versionAlreadyInstalled) {
				logInfo(`Running: asdf install ${tool.plugin} ${toolVersion}`)
				const installResult = spawn.sync("asdf", ["install", tool.plugin, toolVersion], { stdio: "inherit" })
				if (installResult.status !== 0) {
					logError(`Failed to install ${tool.plugin} via asdf`)
					process.exit(1)
				}
			} else {
				logInfo(`${tool.plugin} version ${toolVersion} already installed`)
			}
			if (!versionAlreadySet) {
				logInfo(`Running: asdf set --parent ${tool.plugin} ${toolVersion}`)
				const setResult = spawn.sync("asdf", ["set", "--parent", tool.plugin, toolVersion], {
					stdio: "inherit",
				})
				if (setResult.status !== 0) {
					logError(`Failed to set ${tool.plugin} as parent in asdf`)
					process.exit(1)
				}
			} else {
				logInfo(`${tool.plugin} version ${toolVersion} already set as current`)
			}
			const newVersion = getCommandOutput(tool.checkCmd, tool.checkArgs)
			if (newVersion) {
				logSuccess(`${tool.plugin} installed (${newVersion})`)
			} else {
				logError(`${tool.plugin} installation failed: not found or not installed`)
				process.exit(1)
			}
		}
		if (selected.some((s) => s.includes("python"))) {
			const uvVersion = getCommandOutput("uv", ["--version"])
			// Check if asdf plugin is already added for uv
			const pluginListResult = spawn.sync("asdf", ["plugin", "list"], { encoding: "utf8" })
			const pluginList =
				pluginListResult.status === 0 ? pluginListResult.stdout.split("\n").map((s) => s.trim()) : []
			const pluginAlreadyAdded = pluginList.includes("uv")
			// Check if uv is already installed
			const asdfListResult = spawn.sync("asdf", ["list", "uv"], { encoding: "utf8" })
			const asdfList = asdfListResult.status === 0 ? asdfListResult.stdout.split("\n").map((s) => s.trim()) : []
			const versionAlreadyInstalled = asdfList.some((v) => v === "latest")
			// Check if uv is already set as current
			const asdfCurrentResult = spawn.sync("asdf", ["current", "uv"], { encoding: "utf8" })
			const asdfCurrent = asdfCurrentResult.status === 0 ? asdfCurrentResult.stdout : ""
			const versionAlreadySet = asdfCurrent.includes("latest")

			if (uvVersion && versionAlreadyInstalled && versionAlreadySet) {
				logSuccess(`uv already installed (${uvVersion})`)
			} else {
				logInfo("Installing uv via asdf...")
				if (!pluginAlreadyAdded) {
					logInfo("Running: asdf plugin add uv https://github.com/asdf-community/asdf-uv")
					const pluginAddResult = spawn.sync(
						"asdf",
						["plugin", "add", "uv", "https://github.com/asdf-community/asdf-uv"],
						{
							stdio: "inherit",
						},
					)
					if (pluginAddResult.status !== 0) {
						logError("Failed to add asdf uv plugin")
						return
					}
				} else {
					logInfo("asdf plugin for uv already added")
				}
				if (!versionAlreadyInstalled) {
					logInfo("Running: asdf install uv latest")
					const installResult = spawn.sync("asdf", ["install", "uv", "latest"], { stdio: "inherit" })
					if (installResult.status !== 0) {
						logError("Failed to install uv via asdf")
						return
					}
				} else {
					logInfo("uv version latest already installed")
				}
				if (!versionAlreadySet) {
					logInfo("Running: asdf set --parent uv latest")
					const setResult = spawn.sync("asdf", ["set", "--parent", "uv", "latest"], { stdio: "inherit" })
					if (setResult.status !== 0) {
						logError("Failed to set uv as parent in asdf")
						return
					}
				} else {
					logInfo("uv version latest already set as current")
				}
				logSuccess("uv installed")
			}
			const venvPath = path.resolve(__dirname, "..", ".venv")
			if (!fs.existsSync(venvPath)) {
				logInfo(`Creating Python virtual environment at ${venvPath}...`)
				spawn.sync("uv", ["venv", venvPath], { stdio: "inherit" })
				logSuccess(`Virtual environment created at ${venvPath}`)
				logInfo(
					`Activate it using: source ${path.join(venvPath, os === "Windows" ? "Scripts" : "bin", "activate")}`,
				)
			} else {
				logSuccess(`Virtual environment already exists at ${venvPath}`)
			}
		}
	} else {
		for (const runtime of runtimes) {
			if (selected.some((s) => s.includes(runtime.plugin))) {
				const versionOutput = getCommandOutput(runtime.checkCmd, runtime.checkArgs)
				if (versionOutput) {
					// Try to extract the version number from output like "Python 3.13.3"
					let foundVersion = versionOutput
					const match = versionOutput.match(/(\d+\.\d+\.\d+)/)
					if (match) {
						foundVersion = match[1]
						logInfo(`${runtime.plugin} detected version: ${foundVersion}`)
						if (semver.satisfies(foundVersion, runtime.version)) {
							logSuccess(`${runtime.plugin} already installed with compatible version (${foundVersion})`)
							continue
						} else {
							logWarning(
								`${runtime.plugin} found, but version ${foundVersion} is not compatible (required: ${runtime.version}). Installing required version...`,
							)
						}
					} else {
						logWarning(
							`${runtime.plugin} found, but could not determine version from output: "${versionOutput}". Proceeding with installation...`,
						)
					}
				} else {
					logWarning(`${runtime.plugin} not found. Proceeding with installation...`)
				}
				logInfo(`Installing ${runtime.plugin} via winget...`)
				const result = spawn.sync(
					"winget",
					[
						"install",
						runtime.winget,
						"--version",
						runtime.version.replace(/>=/, ""),
						"--silent",
						"--accept-package-agreements",
					],
					{ stdio: "inherit", shell: true },
				)
				if (result.status !== 0) {
					logWarning(`${runtime.plugin} version ${runtime.version} not found. Installing latest...`)
					spawn.sync("winget", ["install", runtime.winget, "--silent", "--accept-package-agreements"], {
						stdio: "inherit",
						shell: true,
					})
				}
				// Always refresh PATH from registry after a runtime install on Windows
				if (getOS() === "Windows") {
					refreshProcessEnvPathFromRegistry()
				}
				const newVersion = getCommandOutput(runtime.checkCmd, runtime.checkArgs)
				if (newVersion && checkVersion(newVersion, runtime.version)) {
					logSuccess(`${runtime.plugin} installed (${newVersion})`)
				} else {
					if (!newVersion) {
						logError(`${runtime.plugin} installation failed: not found or not installed`)
					} else {
						logError(`${runtime.plugin} version mismatch: found ${newVersion}, expected ${runtime.version}`)
					}
					process.exit(1)
				}
			}
		}
		for (const tool of tools) {
			const versionOutput = getCommandOutput(tool.checkCmd, tool.checkArgs)
			if (versionOutput) {
				logSuccess(`${tool.plugin} already installed (${versionOutput})`)
				continue
			}
			logInfo(`Installing ${tool.plugin} via winget...`)
			spawn.sync("winget", ["install", tool.winget, "--silent", "--accept-package-agreements"], {
				stdio: "inherit",
				shell: true,
			})
			// Always refresh PATH from registry after a tool install on Windows
			if (getOS() === "Windows") {
				refreshProcessEnvPathFromRegistry()
			}
			logSuccess(`${tool.plugin} installed`)
		}
		if (selected.some((s) => s.includes("python"))) {
			const uvVersion = getCommandOutput("uv", ["--version"])
			if (uvVersion) {
				logSuccess(`uv already installed (${uvVersion})`)
			} else {
				logInfo("Installing uv via pip...")
				const pipResult = spawn.sync("pip", ["install", "uv"], { stdio: "inherit", shell: true })
				if (pipResult.status !== 0) {
					logError("Failed to install uv via pip")
					return
				}
				logSuccess("uv installed")
			}
			const venvPath = path.resolve(__dirname, "..", ".venv")
			if (!fs.existsSync(venvPath)) {
				logInfo(`Creating Python virtual environment at ${venvPath}...`)
				const venvResult = spawn.sync("uv", ["venv", venvPath], { stdio: "inherit" })
				if (venvResult.status !== 0) {
					logError(`Failed to create virtual environment at ${venvPath}`)
					return
				}
				logSuccess(`Virtual environment created at ${venvPath}`)
				logInfo(
					`Activate it using: .\\${path.relative(path.resolve(__dirname, ".."), venvPath)}\\Scripts\\activate`,
				)
			} else {
				logSuccess(`Virtual environment already exists at ${venvPath}`)
			}
		}
	}
}

function installVSCodeExtensions(): void {
	logInfo("Installing VS Code extensions...")
	if (spawn.sync("code", ["--version"]).status !== 0) {
		logError("VS Code CLI not found. Please install Visual Studio Code.")
		process.exit(1)
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
		spawn.sync("code", ["--install-extension", ext], { stdio: "inherit" })
	}
	logSuccess("VS Code extensions installed")
}

/**
 * Ensures the cte/evals repository is cloned one directory above the project root.
 * This avoids polluting the project directory and matches expected structure:
 *   If project root is /home/user/Roo-Code, clone to /home/user/evals
 */
async function setupRepository(): Promise<void> {
	// __dirname = .../Roo-Code/evals/scripts
	// workspaceRoot = .../Roo-Code
	logInfo(`(__filename: ${__filename})`)
	logInfo(`(__dirname: ${__dirname})`)
	const repoPath = path.resolve(workspaceRoot, "..", "evals")
	const repoUrl = "https://github.com/cte/evals.git"

	logInfo(`Checking for cte/evals repository at ${repoPath}...`)
	logInfo(`(workspaceRoot resolved as: ${workspaceRoot})`)

	try {
		fs.accessSync(path.join(repoPath, ".git"))
		logSuccess(`Repository found at ${repoPath}. Updating...`)
		spawn.sync("git", ["-C", repoPath, "pull"], { stdio: "inherit" })
		logSuccess("Repository updated")
	} catch {
		logWarning(`Repository not found at ${repoPath}.`)
		try {
			fs.mkdirSync(path.dirname(repoPath), { recursive: true })
			const cloneResult = spawn.sync("git", ["clone", repoUrl, repoPath], { stdio: "inherit" })
			if (cloneResult.status === 0) {
				logSuccess(`Cloned cte/evals to ${repoPath}`)
			} else {
				logError(`Failed to clone cte/evals to ${repoPath}`)
				process.exit(1)
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)
			logError(`Failed to clone cte/evals: ${msg}`)
			process.exit(1)
		}
	}
}

async function ensureEnvFileExists(): Promise<void> {
	logInfo("Setting up environment...")
	if (!fs.existsSync("../.env")) {
		fs.copyFileSync("../.env.sample", "../.env")
		logSuccess("Copied .env.sample to .env")
	}
}

function checkGoCacheEnv(selectedLangs: string[]): void {
	const envPath = "../.env"
	const envContent = fs.readFileSync(envPath, "utf8")
	if (selectedLangs.some((lang) => lang.includes("golang"))) {
		const goCacheMatch = envContent.match(/^GOCACHE=(.*)/m)
		if (!goCacheMatch || !goCacheMatch[1]?.trim()) {
			const goCacheValue = getCommandOutput("go", ["env", "GOCACHE"])
			if (goCacheValue && goCacheValue.trim()) {
				fs.appendFileSync(envPath, `GOCACHE=${goCacheValue.trim()}\n`)
				logSuccess(`GOCACHE was detected and added to .env: ${goCacheValue.trim()}`)
			} else {
				logWarning("GOCACHE is not set in your .env file. Go evals require GOCACHE to be set, e.g.:")
				logInfo("Add this line to your .env file (update the path if needed):")
				logInfo("GOCACHE=C:\\Users\\YOUR_USER\\AppData\\Local\\go-build")
			}
		} else {
			logSuccess(`GOCACHE is set in .env: ${goCacheMatch[1].trim()}`)
		}
	}
}

async function ensureOpenRouterApiKey(): Promise<void> {
	const envContent = fs.readFileSync("../.env", "utf8")
	if (!envContent.includes("OPENROUTER_API_KEY")) {
		const { key } = await inquirer.prompt([
			{ type: "input", name: "key", message: "Enter OpenRouter API key (sk-or-v1-...):" },
		])
		await axios.get("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } })
		fs.appendFileSync("../.env", `OPENROUTER_API_KEY=${key}\n`)
		logSuccess("OpenRouter API key added to .env")
	} else {
		logSuccess("OpenRouter API key already set in .env")
	}
}

async function setupEnvironment(selectedLangs: string[]): Promise<void> {
	await ensureEnvFileExists()
	checkGoCacheEnv(selectedLangs)
	await ensureOpenRouterApiKey()
}

async function setupDatabase(): Promise<void> {
	logInfo("Setting up database...")
	fs.mkdirSync(dataDir, { recursive: true })
	logSuccess(`Ensured data directory exists at ${dataDir}`)

	// Set environment variables for database connection
	// set the env BENCHMARKS_DB_PATH to the dataDir prefixed with the protocol `file:`
	const dbPath = `file:${dataDir}/benchmarks.db`
	process.env.BENCHMARKS_DB_PATH = dbPath

	// Persist BENCHMARKS_DB_PATH to .env file in evalsRoot
	const envPath = path.join(evalsRoot, ".env")
	persistEnvVar(envPath, "BENCHMARKS_DB_PATH", dbPath)

	const dbPush = spawn.sync("pnpm", ["--filter", "@evals/db", "db:push"], { stdio: "inherit" })
	if (dbPush.status !== 0) {
		logError("Database push failed. See above for details.")
		process.exit(1)
	}

	const dbEnableWal = spawn.sync("pnpm", ["--filter", "@evals/db", "db:enable-wal"], { stdio: "inherit" })
	if (dbEnableWal.status !== 0) {
		logError("Enabling WAL mode failed. See above for details.")
		process.exit(1)
	}

	logSuccess("Database synced")
}

async function startWebApp(): Promise<void> {
	const osType = getOS()
	if (osType === "Linux") {
		logInfo(
			"You are on Linux. Please log in to this machine via RDP, open a terminal in the RDP session (to ensure VSCode has an X window system), navigate to /Roo-Code/evals, and run:\n    pnpm web",
		)
	} else if (osType === "Windows" || osType === "macOS") {
		logInfo("To start the evals web app, open a terminal, navigate to /Roo-Code/evals, and run:\n    pnpm web")
	} else {
		logInfo("To start the evals web app, open a terminal, navigate to /Roo-Code/evals, and run:\n    pnpm web")
	}
}

async function buildExtension(): Promise<void> {
	logInfo("Building Roo Code extension...")
	const { build } = await inquirer.prompt([{ type: "confirm", name: "build", message: "Build Roo Code extension?" }])
	if (build) {
		process.chdir(path.resolve(__dirname, "../../.."))
		console.log("CWD before npm install:", process.cwd())
		// Ensure node_modules exists before running install scripts
		if (!fs.existsSync("node_modules")) {
			logInfo("node_modules not found. Running npm install...")
			const installResult = spawn.sync("npm", ["install"], { stdio: "inherit" })
			if (installResult.status !== 0) {
				logError("npm install failed. Aborting build.")
				process.exit(1)
			}
		}
		fs.mkdirSync("bin", { recursive: true })
		console.log("CWD before npm run install-extension:", process.cwd())
		spawn.sync("npm", ["run", "install-extension"], { stdio: "inherit" })
		console.log("CWD before npm run install-webview:", process.cwd())
		spawn.sync("npm", ["run", "install-webview"], { stdio: "inherit" })
		console.log("CWD before npm run install-e2e:", process.cwd())
		spawn.sync("npm", ["run", "install-e2e"], { stdio: "inherit" })
		console.log("CWD before npx vsce package:", process.cwd())
		spawn.sync("npx", ["vsce", "package", "--out", "bin/roo-code-latest.vsix"], { stdio: "inherit" })
		console.log("CWD before code --install-extension:", process.cwd())
		spawn.sync("code", ["--install-extension", "bin/roo-code-latest.vsix"], { stdio: "inherit" })
		process.chdir(path.resolve(__dirname, ".."))
		logSuccess("Roo Code extension built and installed")
	} else {
		logInfo("Skipped building Roo Code extension")
	}
}

async function main(): Promise<void> {
	logInfo("Starting Roo Code Evals Setup...")
	const os = getOS()
	// installPowerShell(os)
	installPackageManager(os)
	await setupRepository()
	const selected = await selectLanguages()
	installRuntimesAndTools(os, selected)
	await buildExtension()
	installVSCodeExtensions()
	await setupEnvironment(selected)
	await setupDatabase()
	await startWebApp()
	logSuccess("Setup complete!")
}

main().catch((err) => {
	logError(`Setup failed: ${err.message}`)
	process.exit(1)
})
