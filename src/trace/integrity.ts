import type { TraceEvent } from "./event-schema.js";

export interface TraceIntegrityViolation {
  code:
    | "missing_run_start"
    | "duplicate_event_id"
    | "sequence_regression"
    | "timestamp_regression"
    | "unresolved_tool_request"
    | "missing_terminal_event";
  message: string;
  eventId?: string;
}

export interface TraceIntegrityResult {
  valid: boolean;
  violations: TraceIntegrityViolation[];
}

function numericId(eventId: string): number {
  return Number(eventId.replace(/^event-/, ""));
}

export function validateTrace(events: TraceEvent[]): TraceIntegrityResult {
  const violations: TraceIntegrityViolation[] = [];
  if (!events.some((event) => event.type === "run.start")) {
    violations.push({ code: "missing_run_start", message: "Trace has no run.start event" });
  }

  const ids = new Set<string>();
  let previousId = 0;
  let previousTime = -Infinity;
  for (const event of events) {
    if (ids.has(event.eventId)) {
      violations.push({ code: "duplicate_event_id", message: `Duplicate event ID ${event.eventId}`, eventId: event.eventId });
    }
    ids.add(event.eventId);
    const currentId = numericId(event.eventId);
    if (currentId <= previousId) {
      violations.push({ code: "sequence_regression", message: `Event sequence regressed at ${event.eventId}`, eventId: event.eventId });
    }
    previousId = currentId;
    const currentTime = Date.parse(event.timestamp);
    if (currentTime < previousTime) {
      violations.push({ code: "timestamp_regression", message: `Timestamp regressed at ${event.eventId}`, eventId: event.eventId });
    }
    previousTime = currentTime;
  }

  const requests = new Map<string, { decision: boolean; result: boolean; eventId: string }>();
  for (const event of events) {
    const requestId = typeof event.payload.requestId === "string" ? event.payload.requestId : null;
    if (!requestId) continue;
    if (event.type === "tool.request") requests.set(requestId, { decision: false, result: false, eventId: event.eventId });
    if (event.type === "tool.allowed" || event.type === "tool.denied") {
      const request = requests.get(requestId);
      if (request) request.decision = true;
    }
    if (event.type === "tool.result") {
      const request = requests.get(requestId);
      if (request) request.result = true;
    }
  }
  for (const [requestId, state] of requests) {
    if (!state.decision || !state.result) {
      violations.push({
        code: "unresolved_tool_request",
        message: `Tool request ${requestId} did not receive both a decision and result`,
        eventId: state.eventId
      });
    }
  }

  if (!events.some((event) => event.type === "run.end" || event.type === "run.terminated")) {
    violations.push({ code: "missing_terminal_event", message: "Trace has neither run.end nor run.terminated" });
  }

  return { valid: violations.length === 0, violations };
}
