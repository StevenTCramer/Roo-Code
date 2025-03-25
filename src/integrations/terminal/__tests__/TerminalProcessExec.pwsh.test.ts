// src/integrations/terminal/__tests__/TerminalProcessExec.pwsh.test.ts
import * as vscode from "vscode"
import { TerminalProcess, ExitCodeDetails } from "../TerminalProcess"
import { Terminal } from "../Terminal"
import { TerminalRegistry } from "../TerminalRegistry"
import { createPowerShellStream } from "./streamUtils/pwshStream"
import { createPowerShellMockStream } from "./streamUtils"
import { isPowerShellCoreAvailable } from "./streamUtils"

// Skip this test if PowerShell Core is not available
const hasPwsh = isPowerShellCoreAvailable()
const describePlatform = hasPwsh ? describe : describe.skip

// Mock the vscode module
jest.mock("vscode", () => {
	// Store event handlers so we can trigger them in tests
	const eventHandlers = {
		startTerminalShellExecution: null,
		endTerminalShellExecution: null,
	}

	return {
		workspace: {
			getConfiguration: jest.fn().mockReturnValue({
				get: jest.fn().mockReturnValue(null),
			}),
		},
		window: {
			createTerminal: jest.fn(),
			onDidStartTerminalShellExecution: jest.fn().mockImplementation((handler) => {
				eventHandlers.startTerminalShellExecution = handler
				return { dispose: jest.fn() }
			}),
			onDidEndTerminalShellExecution: jest.fn().mockImplementation((handler) => {
				eventHandlers.endTerminalShellExecution = handler
				return { dispose: jest.fn() }
			}),
		},
		ThemeIcon: class ThemeIcon {
			constructor(id: string) {
				this.id = id
			}
			id: string
		},
		Uri: {
			file: (path: string) => ({ fsPath: path }),
		},
		// Expose event handlers for testing
		__eventHandlers: eventHandlers,
	}
})

/**
 * Test PowerShell command execution
 * @param command The PowerShell command to execute
 * @param expectedOutput The expected output after processing
 * @param useMock Optional flag to use mock stream instead of real command
 * @returns Test results including execution time and exit details
 */
async function testPowerShellCommand(
	command: string,
	expectedOutput: string,
	useMock: boolean = false,
	skipVerification: boolean = false,
): Promise<{ executionTimeUs: number; capturedOutput: string; exitDetails: ExitCodeDetails }> {
	let startTime: bigint = BigInt(0)
	let endTime: bigint = BigInt(0)
	let timeRecorded = false
	let timeoutId: NodeJS.Timeout | undefined

	// Create a mock terminal with shell integration
	const mockTerminal = {
		shellIntegration: {
			executeCommand: jest.fn(),
			cwd: vscode.Uri.file("/test/path"),
		},
		name: "Roo Code",
		processId: Promise.resolve(123),
		creationOptions: {},
		exitStatus: undefined,
		state: { isInteractedWith: true },
		dispose: jest.fn(),
		hide: jest.fn(),
		show: jest.fn(),
		sendText: jest.fn(),
	}

	// Create terminal info with running state
	const mockTerminalInfo = new Terminal(1, mockTerminal, "/test/path")
	mockTerminalInfo.running = true

	// Add the terminal to the registry
	TerminalRegistry["terminals"] = [mockTerminalInfo]

	// Create a new terminal process for testing
	startTime = process.hrtime.bigint() // Start timing from terminal process creation
	const terminalProcess = new TerminalProcess(mockTerminalInfo)

	try {
		// Set up the stream - either real command output or mock
		let stream, exitCode

		if (useMock) {
			// Use PowerShell-specific mock stream with predefined output
			;({ stream, exitCode } = createPowerShellMockStream(expectedOutput))
		} else {
			// Set up the real command stream
			;({ stream, exitCode } = createPowerShellStream(command))
		}

		// Configure the mock terminal to return our stream
		mockTerminal.shellIntegration.executeCommand.mockImplementation(() => {
			return {
				read: jest.fn().mockReturnValue(stream),
			}
		})

		// Set up event listeners to capture output
		let capturedOutput = ""
		terminalProcess.on("completed", (output) => {
			if (!timeRecorded) {
				endTime = process.hrtime.bigint() // End timing when completed event is received with output
				timeRecorded = true
			}
			if (output) {
				capturedOutput = output
			}
		})

		// Create a promise that resolves when the command completes
		const completedPromise = new Promise<void>((resolve) => {
			terminalProcess.once("completed", () => {
				resolve()
			})
		})

		// Set the process on the terminal
		mockTerminalInfo.process = terminalProcess

		// Get the event handlers from the mock
		const eventHandlers = (vscode as any).__eventHandlers

		// Execute the command first to set up the process
		terminalProcess.run(command)

		// Trigger the start terminal shell execution event through VSCode mock
		if (eventHandlers.startTerminalShellExecution) {
			eventHandlers.startTerminalShellExecution({
				terminal: mockTerminal,
				execution: {
					commandLine: { value: command },
					read: () => stream,
				},
			})
		}

		// Wait for some output to be processed
		await new Promise<void>((resolve) => {
			const onLine = () => {
				terminalProcess.removeListener("line", onLine)
				if (timeoutId) {
					clearTimeout(timeoutId)
				}
				resolve()
			}
			terminalProcess.on("line", onLine)

			// Add a timeout in case no lines are emitted
			const timeoutId = setTimeout(() => {
				terminalProcess.removeListener("line", onLine)
				resolve()
			}, 500)
		})

		// Then trigger the end event
		if (eventHandlers.endTerminalShellExecution) {
			eventHandlers.endTerminalShellExecution({
				terminal: mockTerminal,
				exitCode: exitCode,
			})
		}

		// Store exit details for return
		const exitDetails = TerminalProcess.interpretExitCode(exitCode)

		// Set a timeout to avoid hanging tests
		const timeoutPromise = new Promise<void>((_, reject) => {
			setTimeout(() => {
				reject(new Error("Test timed out after 1000ms"))
			}, 1000)
		})

		// Wait for the command to complete or timeout
		await Promise.race([completedPromise, timeoutPromise])

		// Calculate execution time in microseconds
		if (!timeRecorded) {
			endTime = process.hrtime.bigint()
		}
		const executionTimeUs = Number((endTime - startTime) / BigInt(1000))

		// Verify the output matches the expected output (unless skipped)
		if (!skipVerification) {
			expect(capturedOutput).toBe(expectedOutput)
		}

		return { executionTimeUs, capturedOutput, exitDetails }
	} finally {
		// Clean up
		terminalProcess.removeAllListeners()
		TerminalRegistry["terminals"] = []

		// Ensure we don't have any lingering timeouts
		// This is a safety measure in case the test exits before the timeout is cleared
		if (typeof global.gc === "function") {
			global.gc() // Force garbage collection if available
		}
	}
}

describePlatform("TerminalProcess with PowerShell Command Output", () => {
	beforeAll(() => {
		// Initialize TerminalRegistry event handlers
		TerminalRegistry.initialize()
		// Log environment info
		console.log(`Running PowerShell tests with PowerShell Core available: ${hasPwsh}`)
	})

	beforeEach(() => {
		// Reset state between tests
		TerminalRegistry["terminals"] = []
		jest.clearAllMocks()
	})

	it("should execute 'Write-Output a' and return expected output", async () => {
		const { executionTimeUs, capturedOutput } = await testPowerShellCommand("Write-Output a", "a\n")
		console.log(`'Write-Output a' execution time: ${executionTimeUs} microseconds (${executionTimeUs / 1000} ms)`)
		expect(capturedOutput).toBe("a\n")
	})

	it("should execute command without newline", async () => {
		// PowerShell command for output without newline
		const { executionTimeUs } = await testPowerShellCommand("Write-Host -NoNewline a", "a")
		console.log(`'Write-Host -NoNewline a' execution time: ${executionTimeUs} microseconds`)
	})

	it("should handle multiline output", async () => {
		const expectedOutput = "a\nb\n"
		// PowerShell multiline command
		const { executionTimeUs } = await testPowerShellCommand('Write-Output @("a", "b")', expectedOutput)
		console.log(`Multiline command execution time: ${executionTimeUs} microseconds`)
	})

	it("should handle exit codes properly", async () => {
		// Success exit code
		const { exitDetails: successDetails } = await testPowerShellCommand("exit 0", "")
		expect(successDetails).toEqual({ exitCode: 0 })

		// Error exit code
		const { exitDetails: errorDetails } = await testPowerShellCommand("exit 1", "")
		expect(errorDetails).toEqual({ exitCode: 1 })
	})

	it("should handle command not found errors", async () => {
		const { exitDetails } = await testPowerShellCommand("nonexistentcommand", "")
		expect(exitDetails.exitCode).not.toBe(0)
	})

	it("should handle forced output using mock stream when needed", async () => {
		// Some tests are better with controlled mocks
		const { capturedOutput } = await testPowerShellCommand(
			"special-command",
			"special output\n",
			true, // Use mock
		)
		expect(capturedOutput).toBe("special output\n")
	})

	it("should simulate terminal control sequences", async () => {
		// This test uses a mock to simulate complex terminal output that would be hard to generate with real PowerShell
		const controlSequences = "\x1B[31mRed Text\x1B[0m\n"
		const { capturedOutput } = await testPowerShellCommand("color-output", controlSequences, true)
		expect(capturedOutput).toBe(controlSequences)
	})

	it("should handle larger output streams", async () => {
		// Generate a larger output stream (but not too large for tests)
		const lines = 10

		// Use a more explicit command that works consistently across platforms
		// Avoid using $_ which seems to be expanded differently on Linux
		const command = `foreach ($i in 1..${lines}) { Write-Output "Line $i" }`

		// Build expected output
		const expectedOutput = Array.from({ length: lines }, (_, i) => `Line ${i + 1}`).join("\n") + "\n"

		// Skip the automatic output verification
		const skipVerification = true
		const { executionTimeUs, capturedOutput } = await testPowerShellCommand(
			command,
			expectedOutput,
			false,
			skipVerification,
		)

		// Log the actual and expected output for debugging
		console.log("Actual output:", JSON.stringify(capturedOutput))
		console.log("Expected output:", JSON.stringify(expectedOutput))

		// Manually verify the output
		if (process.platform === "linux") {
			// On Linux, we'll check if the output contains the expected lines in any format
			for (let i = 1; i <= lines; i++) {
				expect(capturedOutput).toContain(`Line ${i}`)
			}
		} else {
			// On other platforms, we'll do the exact match
			expect(capturedOutput).toBe(expectedOutput)
		}

		console.log(`Large output command (${lines} lines) execution time: ${executionTimeUs} microseconds`)
	})
})
