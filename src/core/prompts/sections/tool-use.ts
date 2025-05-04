export function getSharedToolUseSection(): string {
	return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

Additionally, you can use the <log_entry> block to log messages to the output channel for debugging or validation purposes. Unlike tools, log entries don't require approval and don't count toward the one-tool-per-message limit.

# Tool Use Formatting

Tool use is formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:

<tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</tool_name>

For example:

<read_file>
<path>src/main.js</path>
</read_file>

Always adhere to this format for the tool use to ensure proper parsing and execution.

# Log Entry Formatting

You can use log entries to output debugging information to the VSCode output channel. Log entries don't require approval and don't count toward the one-tool-per-message limit. Here's the structure:

<log_entry>
<message>Your log message here</message>
<level>info</level>
</log_entry>

The level parameter is optional and defaults to "info". Valid levels are: "debug", "info", "warn", and "error".

For example:

<log_entry>
<message>Starting task execution</message>
<level>info</level>
</log_entry>

<log_entry>
<message>Failed to parse input: invalid JSON</message>
<level>error</level>
</log_entry>

You can use log entries multiple times in a single message, and they will be processed immediately without requiring user approval.`
}
