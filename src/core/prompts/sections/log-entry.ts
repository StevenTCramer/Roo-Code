export function getLogEntrySection(): string {
	return `====

LOG ENTRIES

You can use log entries to output debugging information to the VSCode output channel. Unlike tools, log entries don't require approval and don't count toward the one-tool-per-message limit.

# Log Entry Formatting

Log entries are formatted using XML-style tags. Here's the structure:

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
