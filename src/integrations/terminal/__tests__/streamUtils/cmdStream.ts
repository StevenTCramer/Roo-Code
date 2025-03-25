// streamUtils/cmdStream.ts
import { execSync } from "child_process"
import { CommandStream } from "./index"

/**
 * Map shell-specific commands to equivalent CMD commands
 * @param command The shell command to convert to CMD
 * @returns The equivalent CMD command
 */
export function toCmdCommand(command: string): string {
	// Map common shell commands to CMD equivalents
	if (command === "echo a") {
		return "echo a"
	} else if (command === "/bin/echo -n a" || command.includes("echo -n a")) {
		return "echo|set /p=a" // CMD equivalent of echo without newline
	} else if (command.includes('printf "a\\nb\\n"')) {
		return "echo a && echo b"
	} else if (command.includes("exit 0") || command === "true") {
		return "exit /b 0"
	} else if (command.includes("exit 1") || command === "false") {
		return "exit /b 1"
	} else if (command.includes("exit 2")) {
		return "exit /b 2"
	} else if (command.includes("nonexistentcommand")) {
		return "nonexistentcommand" // This will fail in CMD too
	} else if (command.includes("bash -c 'kill $$'") || command.includes("kill")) {
		// Windows doesn't have direct signal equivalents, so we simulate exit codes
		return "exit /b 143" // Simulate SIGTERM exit code
	} else if (command.includes("kill -SIGSEGV")) {
		return "exit /b 139" // Simulate SIGSEGV exit code
	} else if (command.includes("yes") && command.includes("head")) {
		// Extract pattern and count from yes | head command
		const match = command.match(/yes\s+"([^"]+)"\s+\|\s+head\s+-n\s+(\d+)/)
		if (match) {
			const [, repeatChar, lines] = match
			// CMD equivalent using a for loop
			return `for /L %i in (1,1,${lines}) do @echo ${repeatChar}`
		}
	}

	// Default case - pass command as is
	return command
}

/**
 * Creates a stream with real command output using CMD
 * @param command The CMD command to execute
 * @returns An object containing the stream and exit code
 */
export function createCmdCommandStream(command: string): CommandStream {
	let realOutput: string
	let exitCode: number

	// Convert the command to CMD syntax if needed
	const cmdCommand = toCmdCommand(command)

	try {
		// Execute the CMD command
		// Use cmd.exe explicitly to ensure we're using CMD
		const shellCommand = `cmd.exe /c ${cmdCommand}`

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

			// Yield the real output (keep Windows line endings for CMD)
			if (realOutput.length > 0) {
				yield realOutput
			}

			// Command end marker
			yield "\x1b]633;D\x07"
		},
	}

	return { stream, exitCode }
}
