import { describe, expect, it } from "vitest";
import { validateTrace } from "../../src/trace/integrity.js";
import type { TraceEvent } from "../../src/trace/event-schema.js";

const e = (eventId: string, type: TraceEvent["type"], payload: Record<string, unknown> = {}, timestamp = "2026-09-25T20:00:00.000Z"): TraceEvent =>
  ({ eventId, runId: "r1", timestamp, type, payload });

describe("validateTrace", () => {
  it("accepts a resolved chronological trace", () => {
    const result = validateTrace([
      e("event-000001", "run.start"),
      e("event-000002", "tool.request", { requestId: "t1" }),
      e("event-000003", "tool.allowed", { requestId: "t1" }),
      e("event-000004", "tool.result", { requestId: "t1" }),
      e("event-000005", "run.end")
    ]);
    expect(result.valid).toBe(true);
  });

  it("reports all core integrity violations structurally", () => {
    const result = validateTrace([
      e("event-000002", "tool.request", { requestId: "t1" }, "2026-09-25T20:00:02.000Z"),
      e("event-000002", "tool.allowed", { requestId: "t1" }, "2026-09-25T20:00:01.000Z")
    ]);
    expect(result.valid).toBe(false);
    expect(result.violations.map((v) => v.code)).toEqual(expect.arrayContaining([
      "missing_run_start",
      "duplicate_event_id",
      "sequence_regression",
      "timestamp_regression",
      "unresolved_tool_request",
      "missing_terminal_event"
    ]));
  });
});
