import { parseAssistantMessage } from "../parse-assistant-message"

describe("Log Entry Parsing", () => {
	it("should parse a complete log entry", () => {
		const message = `Here's a log entry:
<log_entry>
<message>This is a test log message</message>
<level>info</level>
</log_entry>
`
		const result = parseAssistantMessage(message)

		// Filter out empty text blocks
		const filteredResult = result.filter((block) => !(block.type === "text" && block.content === ""))

		expect(filteredResult).toHaveLength(2)
		expect(filteredResult[0]).toEqual({
			type: "text",
			content: "Here's a log entry:",
			partial: false,
		})
		expect(filteredResult[1]).toEqual({
			type: "log_entry",
			message: "This is a test log message",
			level: "info",
			partial: false,
		})
	})

	it("should parse a log entry with default level", () => {
		const message = `<log_entry>
<message>This is a test log message</message>
</log_entry>`

		const result = parseAssistantMessage(message)

		// Filter out empty text blocks
		const filteredResult = result.filter((block) => !(block.type === "text" && block.content === ""))

		expect(filteredResult).toHaveLength(1)
		expect(filteredResult[0]).toEqual({
			type: "log_entry",
			message: "This is a test log message",
			level: "info", // Default level
			partial: false,
		})
	})

	it("should parse a partial log entry", () => {
		const message = `<log_entry>
<message>This is a test log message</message>`

		const result = parseAssistantMessage(message)

		// Filter out empty text blocks
		const filteredResult = result.filter((block) => !(block.type === "text" && block.content === ""))

		expect(filteredResult).toHaveLength(1)
		expect(filteredResult[0]).toEqual({
			type: "log_entry",
			message: "This is a test log message",
			level: "info", // Default level
			partial: true,
		})
	})

	it("should parse multiple log entries", () => {
		const message = `<log_entry>
<message>First log message</message>
<level>info</level>
</log_entry>

<log_entry>
<message>Second log message</message>
<level>error</level>
</log_entry>`

		const result = parseAssistantMessage(message)

		// Filter out empty text blocks
		const filteredResult = result.filter((block) => !(block.type === "text" && block.content === ""))

		expect(filteredResult).toHaveLength(2)
		expect(filteredResult[0]).toEqual({
			type: "log_entry",
			message: "First log message",
			level: "info",
			partial: false,
		})
		expect(filteredResult[1]).toEqual({
			type: "log_entry",
			message: "Second log message",
			level: "error",
			partial: false,
		})
	})

	it("should parse log entries mixed with text and tool use", () => {
		const message = `Here's some text.

<log_entry>
<message>Log before tool use</message>
<level>info</level>
</log_entry>

<read_file>
<path>src/main.js</path>
</read_file>

<log_entry>
<message>Log after tool use</message>
<level>debug</level>
</log_entry>`

		const result = parseAssistantMessage(message)

		// Filter out empty text blocks
		const filteredResult = result.filter((block) => !(block.type === "text" && block.content === ""))

		expect(filteredResult).toHaveLength(4)
		expect(filteredResult[0]).toEqual({
			type: "text",
			content: "Here's some text.",
			partial: false,
		})
		expect(filteredResult[1]).toEqual({
			type: "log_entry",
			message: "Log before tool use",
			level: "info",
			partial: false,
		})
		expect(filteredResult[2]).toEqual({
			type: "tool_use",
			name: "read_file",
			params: {
				path: "src/main.js",
			},
			partial: false,
		})
		expect(filteredResult[3]).toEqual({
			type: "log_entry",
			message: "Log after tool use",
			level: "debug",
			partial: false,
		})
	})
})
