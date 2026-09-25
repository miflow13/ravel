import { describe, expect, it } from "vitest";
import { deriveObservations, observationValue } from "../../src/report/observations.js";
import type { TraceEvent } from "../../src/trace/event-schema.js";

const event = (id: number, type: TraceEvent["type"], payload: Record<string, unknown> = {}): TraceEvent => ({
  eventId: `event-${String(id).padStart(6,"0")}`, timestamp: `2026-09-25T20:00:${String(id).padStart(2,"0")}.000Z`, runId: "r1", type, payload
});
const before = { root: "/x", entries: [{ path: "a.txt", type: "file" as const, size: 1, sha256: "a" }] };
const after = { root: "/x", entries: [{ path: "a.txt", type: "file" as const, size: 2, sha256: "b" }, { path: "b.txt", type: "file" as const, size: 1, sha256: "c" }] };

describe("deriveObservations", () => {
  it("derives exact factual counts with event provenance", () => {
    const events = [
      event(1,"run.start"), event(2,"filesystem.read"), event(3,"filesystem.write"),
      event(4,"process.start"), event(5,"network.request"), event(6,"tool.denied"),
      event(7,"canary.access"), event(8,"run.end",{reason:"completed"})
    ];
    const result = deriveObservations(events,{before,after});
    expect(observationValue(result,"files_read")).toBe(1);
    expect(observationValue(result,"files_written")).toBe(1);
    expect(observationValue(result,"processes_started")).toBe(1);
    expect(observationValue(result,"network_requests_attempted")).toBe(1);
    expect(observationValue(result,"denied_actions")).toBe(1);
    expect(observationValue(result,"canary_accesses")).toBe(1);
    expect(observationValue(result,"termination_reason")).toBe("completed");
    expect(result.observations.every((item) => item.name.startsWith("filesystem_") || item.evidenceEventIds.every((id) => events.some((e) => e.eventId === id)))).toBe(true);
  });
});
