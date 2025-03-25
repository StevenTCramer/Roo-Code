// streamUtils/pwshStream.ts
import { execSync } from "child_process"
import { CommandStream } from "./index"

/**
 * Map shell-specific commands to equivalent PowerShell commands
 * @param command The shell command to convert to PowerShell
 * @returns The equivalent PowerShell command
 */
export function toPowerShellCommand(command: string): string {
	// Map common shell commands to PowerShell equivalents
	if (command === "echo a") {
		return "Write-Output 'a'"
	} else if (command === "/bin/echo -n a" || command.includes("echo -n a")) {
		return "Write-Host -NoNewline 'a'"
	} else if (command.includes('printf "a\\nb\\n"') || command.includes("echo a&echo b")) {
		return "Write-Output @('a', 'b')"
	} else if (command.includes("exit 0") || command === "true") {
		return "exit 0"
	} else if (command.includes("exit 1") || command === "false") {
		return "exit 1"
	} else if (command.includes("exit 2")) {
		return "exit 2"
	} else if (command.includes("nonexistentcommand")) {
		return "nonexistentcommand" // This will fail in PowerShell too
	} else if (command.includes("bash -c 'kill $$'") || command.includes("kill")) {
		// Simulate SIGTERM exit code
		return "[System.Environment]::Exit(143)"
	} else if (command.includes("kill -SIGSEGV")) {
		// Simulate SIGSEGV exit code
		return "[System.Environment]::Exit(139)"
	} else if (command.includes("yes") && command.includes("head")) {
		// Extract pattern and count from yes | head command
		const match = command.match(/yes\s+"([^"]+)"\s+\|\s+head\s+-n\s+(\d+)/)
		if (match) {
			const [, repeatChar, lines] = match
			// PowerShell equivalent of "yes | head"
			return `1..${lines} | ForEach-Object { "${repeatChar}" }`
		}
	}

	// Default case - pass command as is wrapped in appropriate quotes
	return command
}

/**
 * Creates a stream with real command output using PowerShell Core
 * @param command The PowerShell command to execute
 * @returns An object containing the stream and exit code
 */
export function createPowerShellStream(command: string): CommandStream {
	let realOutput: string
	let exitCode: number

	// Convert the command to PowerShell syntax if needed
	const psCommand = toPowerShellCommand(command)

	try {
		// Execute the PowerShell command
		// Wrap the command in double quotes to preserve it when passing to pwsh
		const shellCommand = `pwsh -NoProfile -NonInteractive -Command "${psCommand.replace(/"/g, '\\"')}"`

		realOutput = execSync(shellCommand, {
			encoding: "utf8",
			maxBuffer: 100 * 1024 * 1024,
			stdio: ["pipe", "pipe", "ignore"], // Redirect stderr to null
		})
		exitCode = 0 // Command succeeded
	} catch (error: any) {
		// Command failed - get output and exit code from error
		realOutput = error.stdout?.toString() || ""
		exitCode = error.status || 1
	}

	// Create an async iterator for the stream
	const stream = {
		async *[Symbol.asyncIterator]() {
			// Command start marker
			yield "\x1b]633;C\x07"

			// Normalize line endings to ensure consistent behavior across platforms
			if (realOutput.length > 0) {
				yield realOutput.replace(/\r\n/g, "\n")
			}

			// Command end marker
			yield "\x1b]633;D\x07"
		},
	}

	return { stream, exitCode }
}
