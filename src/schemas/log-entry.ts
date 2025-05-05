import { z } from "zod"

export const logLevels = ["debug", "info", "warn", "error"] as const
export const logLevelsSchema = z.enum(logLevels).optional().default("info")

export const logEntryParamsSchema = z.object({
	message: z.string(),
	level: logLevelsSchema,
})

export type LogEntryParams = z.infer<typeof logEntryParamsSchema>
