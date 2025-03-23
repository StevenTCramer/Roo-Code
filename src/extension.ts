import * as vscode from "vscode"
import * as dotenvx from "@dotenvx/dotenvx"
import * as path from "path"
import * as fs from "fs/promises"
import * as fsSync from "fs"

// Load environment variables from .env file
try {
	// Specify path to .env file in the project root directory
	const envPath = __dirname + "/../.env"
	dotenvx.config({ path: envPath })
} catch (e) {
	// Silently handle environment loading errors
	console.warn("Failed to load environment variables:", e)
}

import "./utils/path" // Necessary to have access to String.prototype.toPosix.

import { initializeI18n } from "./i18n"
import { ClineProvider } from "./core/webview/ClineProvider"
import { CodeActionProvider } from "./core/CodeActionProvider"
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { McpServerManager } from "./services/mcp/McpServerManager"
import { telemetryService } from "./services/telemetry/TelemetryService"
import { TerminalRegistry } from "./integrations/terminal/TerminalRegistry"
import { API } from "./exports/api"
import { fileExistsAtPath } from "./utils/fs"
import { GlobalFileNames } from "./shared/globalFileNames"

import { handleUri, registerCommands, registerCodeActions, registerTerminalActions } from "./activate"
import { formatLanguage } from "./shared/language"

/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */

let outputChannel: vscode.OutputChannel
let extensionContext: vscode.ExtensionContext

/**
 * Migrates old settings files to new file names
 *
 * TODO: Remove this migration code in September 2025 (6 months after implementation)
 */
export async function migrateSettings(context: vscode.ExtensionContext): Promise<void> {
	// Legacy file names that need to be migrated to the new names in GlobalFileNames
	const fileMigrations = [
		{ oldName: "cline_custom_modes.json", newName: GlobalFileNames.customModes },
		{ oldName: "cline_mcp_settings.json", newName: GlobalFileNames.mcpSettings },
	]

	try {
		const settingsDir = path.join(context.globalStorageUri.fsPath, "settings")

		// Check if settings directory exists first
		if (!(await fileExistsAtPath(settingsDir))) {
			outputChannel.appendLine("No settings directory found, no migrations necessary")
			return
		}

		// Process each file migration
		for (const migration of fileMigrations) {
			const oldPath = path.join(settingsDir, migration.oldName)
			const newPath = path.join(settingsDir, migration.newName)

			// Only migrate if old file exists and new file doesn't exist yet
			// This ensures we don't overwrite any existing new files
			const oldFileExists = await fileExistsAtPath(oldPath)
			const newFileExists = await fileExistsAtPath(newPath)

			if (oldFileExists && !newFileExists) {
				await fs.rename(oldPath, newPath)
				outputChannel.appendLine(`Renamed ${migration.oldName} to ${migration.newName}`)
			} else {
				outputChannel.appendLine(
					`Skipping migration of ${migration.oldName} to ${migration.newName}: ${oldFileExists ? "new file already exists" : "old file not found"}`,
				)
			}
		}
	} catch (error) {
		outputChannel.appendLine(`Error migrating settings files: ${error}`)
	}
}

// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
export async function activate(context: vscode.ExtensionContext) {
	extensionContext = context
	outputChannel = vscode.window.createOutputChannel("Roo-Code")
	context.subscriptions.push(outputChannel)
	outputChannel.appendLine("Roo-Code extension activated")

	// Migrate old settings to new
	await migrateSettings(context)

	// Initialize telemetry service after environment variables are loaded.
	telemetryService.initialize()

	// Initialize i18n for internationalization support
	initializeI18n(context.globalState.get("language") ?? formatLanguage(vscode.env.language))

	// Initialize terminal shell execution handlers.
	TerminalRegistry.initialize()

	// Get default commands from configuration.
	const defaultCommands = vscode.workspace.getConfiguration("roo-cline").get<string[]>("allowedCommands") || []

	// Initialize global state if not already set.
	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
	}

	const provider = new ClineProvider(context, outputChannel, "sidebar")
	telemetryService.setProvider(provider)

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, provider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)

	registerCommands({ context, outputChannel, provider })

	/**
	 * We use the text document content provider API to show the left side for diff
	 * view by creating a virtual document for the original content. This makes it
	 * readonly so users know to edit the right side if they want to keep their changes.
	 *
	 * This API allows you to create readonly documents in VSCode from arbitrary
	 * sources, and works by claiming an uri-scheme for which your provider then
	 * returns text contents. The scheme must be provided when registering a
	 * provider and cannot change afterwards.
	 *
	 * Note how the provider doesn't create uris for virtual documents - its role
	 * is to provide contents given such an uri. In return, content providers are
	 * wired into the open document logic so that providers are always considered.
	 *
	 * https://code.visualstudio.com/api/extension-guides/virtual-documents
	 */
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider),
	)

	context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }))

	// Register code actions provider.
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider({ pattern: "**/*" }, new CodeActionProvider(), {
			providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
		}),
	)

	registerCodeActions(context)
	registerTerminalActions(context)

	// Implements the `RooCodeAPI` interface.
	return new API(outputChannel, provider)
}

// This method is called when your extension is deactivated
export async function deactivate() {
	outputChannel.appendLine("Roo-Code extension deactivated")
	// Clean up MCP server manager
	await McpServerManager.cleanup(extensionContext)
	telemetryService.shutdown()

	// Clean up terminal handlers
	TerminalRegistry.cleanup()
}
