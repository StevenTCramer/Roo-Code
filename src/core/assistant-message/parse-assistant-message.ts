import { TextContent, ToolUse, ToolParamName, toolParamNames, LogEntry } from "../../shared/tools"
import { toolNames, ToolName, logLevels } from "../../schemas"

export type AssistantMessageContent = TextContent | ToolUse | LogEntry

export function parseAssistantMessage(assistantMessage: string) {
	let contentBlocks: AssistantMessageContent[] = []
	let currentTextContent: TextContent | undefined = undefined
	let currentTextContentStartIndex = 0
	let currentToolUse: ToolUse | undefined = undefined
	let currentToolUseStartIndex = 0
	let currentLogEntry: LogEntry | undefined = undefined
	let currentLogEntryStartIndex = 0
	let currentParamName: ToolParamName | undefined = undefined
	let currentParamValueStartIndex = 0
	let accumulator = ""

	for (let i = 0; i < assistantMessage.length; i++) {
		const char = assistantMessage[i]
		accumulator += char

		// there should not be a param without a tool use
		if (currentToolUse && currentParamName) {
			const currentParamValue = accumulator.slice(currentParamValueStartIndex)
			const paramClosingTag = `</${currentParamName}>`
			if (currentParamValue.endsWith(paramClosingTag)) {
				// end of param value
				currentToolUse.params[currentParamName] = currentParamValue.slice(0, -paramClosingTag.length).trim()
				currentParamName = undefined
				continue
			} else {
				// partial param value is accumulating
				continue
			}
		}

		// no currentParamName

		if (currentToolUse) {
			const currentToolValue = accumulator.slice(currentToolUseStartIndex)
			const toolUseClosingTag = `</${currentToolUse.name}>`
			if (currentToolValue.endsWith(toolUseClosingTag)) {
				// end of a tool use
				currentToolUse.partial = false
				contentBlocks.push(currentToolUse)
				currentToolUse = undefined
				continue
			} else {
				const possibleParamOpeningTags = toolParamNames.map((name) => `<${name}>`)
				for (const paramOpeningTag of possibleParamOpeningTags) {
					if (accumulator.endsWith(paramOpeningTag)) {
						// start of a new parameter
						currentParamName = paramOpeningTag.slice(1, -1) as ToolParamName
						currentParamValueStartIndex = accumulator.length
						break
					}
				}

				// there's no current param, and not starting a new param

				// special case for write_to_file where file contents could contain the closing tag, in which case the param would have closed and we end up with the rest of the file contents here. To work around this, we get the string between the starting content tag and the LAST content tag.
				const contentParamName: ToolParamName = "content"
				if (currentToolUse.name === "write_to_file" && accumulator.endsWith(`</${contentParamName}>`)) {
					const toolContent = accumulator.slice(currentToolUseStartIndex)
					const contentStartTag = `<${contentParamName}>`
					const contentEndTag = `</${contentParamName}>`
					const contentStartIndex = toolContent.indexOf(contentStartTag) + contentStartTag.length
					const contentEndIndex = toolContent.lastIndexOf(contentEndTag)
					if (contentStartIndex !== -1 && contentEndIndex !== -1 && contentEndIndex > contentStartIndex) {
						currentToolUse.params[contentParamName] = toolContent
							.slice(contentStartIndex, contentEndIndex)
							.trim()
					}
				}

				// partial tool value is accumulating
				continue
			}
		}

		// no currentToolUse

		// Check for log_entry blocks
		if (currentLogEntry) {
			const currentLogValue = accumulator.slice(currentLogEntryStartIndex)
			const logEntryClosingTag = `</log_entry>`

			if (currentLogValue.endsWith(logEntryClosingTag)) {
				// End of a log entry
				currentLogEntry.partial = false

				// Parse the log entry content to extract message and level
				const messageMatch = /<message>(.*?)<\/message>/s.exec(currentLogValue)
				const levelMatch = /<level>(.*?)<\/level>/s.exec(currentLogValue)

				if (messageMatch) {
					currentLogEntry.message = messageMatch[1].trim()
				}

				if (levelMatch && logLevels.includes(levelMatch[1].trim() as any)) {
					currentLogEntry.level = levelMatch[1].trim() as (typeof logLevels)[number]
				}

				contentBlocks.push(currentLogEntry)
				currentLogEntry = undefined
				continue
			} else {
				// Partial log entry is accumulating
				continue
			}
		}

		// Check for log_entry opening tag
		const logEntryOpeningTag = `<log_entry>`
		if (accumulator.endsWith(logEntryOpeningTag)) {
			// Start of a new log entry
			currentLogEntry = {
				type: "log_entry",
				message: "",
				level: "info", // Default level
				partial: true,
			}
			currentLogEntryStartIndex = accumulator.length

			// This also indicates the end of the current text content
			if (currentTextContent) {
				currentTextContent.partial = false
				// Remove the partially accumulated log entry tag from the end of text
				currentTextContent.content = currentTextContent.content
					.slice(0, -logEntryOpeningTag.slice(0, -1).length)
					.trim()
				contentBlocks.push(currentTextContent)
				currentTextContent = undefined
			}

			continue
		}

		let didStartToolUse = false
		const possibleToolUseOpeningTags = toolNames.map((name) => `<${name}>`)
		for (const toolUseOpeningTag of possibleToolUseOpeningTags) {
			if (accumulator.endsWith(toolUseOpeningTag)) {
				// start of a new tool use
				currentToolUse = {
					type: "tool_use",
					name: toolUseOpeningTag.slice(1, -1) as ToolName,
					params: {},
					partial: true,
				}
				currentToolUseStartIndex = accumulator.length
				// this also indicates the end of the current text content
				if (currentTextContent) {
					currentTextContent.partial = false
					// remove the partially accumulated tool use tag from the end of text (<tool)
					currentTextContent.content = currentTextContent.content
						.slice(0, -toolUseOpeningTag.slice(0, -1).length)
						.trim()
					contentBlocks.push(currentTextContent)
					currentTextContent = undefined
				}

				didStartToolUse = true
				break
			}
		}

		if (!didStartToolUse) {
			// no tool use, so it must be text either at the beginning or between tools
			if (currentTextContent === undefined) {
				currentTextContentStartIndex = i
			}
			currentTextContent = {
				type: "text",
				content: accumulator.slice(currentTextContentStartIndex).trim(),
				partial: true,
			}
		}
	}

	if (currentToolUse) {
		// stream did not complete tool call, add it as partial
		if (currentParamName) {
			// tool call has a parameter that was not completed
			currentToolUse.params[currentParamName] = accumulator.slice(currentParamValueStartIndex).trim()
		}
		contentBlocks.push(currentToolUse)
	}

	if (currentLogEntry) {
		// Stream did not complete log entry, add it as partial
		// Try to extract any partial message or level information
		const partialContent = accumulator.slice(currentLogEntryStartIndex)
		const messageMatch = /<message>(.*?)(?:<\/message>)?$/s.exec(partialContent)
		const levelMatch = /<level>(.*?)(?:<\/level>)?$/s.exec(partialContent)

		if (messageMatch) {
			currentLogEntry.message = messageMatch[1].trim()
		}

		if (levelMatch && logLevels.includes(levelMatch[1].trim() as any)) {
			currentLogEntry.level = levelMatch[1].trim() as (typeof logLevels)[number]
		}

		contentBlocks.push(currentLogEntry)
	}

	// Note: it doesnt matter if check for currentToolUse, currentLogEntry, or currentTextContent,
	// only one of them will be defined since only one can be partial at a time
	if (currentTextContent) {
		// stream did not complete text content, add it as partial
		contentBlocks.push(currentTextContent)
	}

	return contentBlocks
}
