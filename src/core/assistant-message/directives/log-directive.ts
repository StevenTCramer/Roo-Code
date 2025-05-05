import { logLevels } from "../../../schemas"

/**
 * Represents a log entry directive from the assistant to the system.
 * This directive instructs the system to record a message to its internal logs.
 */
export interface LogDirective {
	type: "log_entry"
	message: string
	level: (typeof logLevels)[number]
	partial: boolean
}
