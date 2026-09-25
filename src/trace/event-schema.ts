import { z } from "zod";

export const TRACE_EVENT_TYPES = [
  "run.start",
  "run.end",
  "skill.loaded",
  "model.request",
  "model.response",
  "tool.request",
  "tool.allowed",
  "tool.denied",
  "tool.result",
  "filesystem.read",
  "filesystem.write",
  "process.start",
  "process.exit",
  "network.request",
  "canary.access",
  "run.terminated"
] as const;

export const TraceEventSchema = z.object({
  eventId: z.string().regex(/^event-\d{6,}$/),
  timestamp: z.string().datetime(),
  runId: z.string().min(1),
  type: z.enum(TRACE_EVENT_TYPES),
  payload: z.record(z.string(), z.unknown())
});

export type TraceEvent = z.infer<typeof TraceEventSchema>;
export type TraceEventType = TraceEvent["type"];
export type TraceEventInput = Omit<TraceEvent, "eventId" | "timestamp">;
