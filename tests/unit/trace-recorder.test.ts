import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TraceRecorder } from "../../src/trace/recorder.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("TraceRecorder", () => {
  it("assigns monotonic IDs and writes one JSON object per line in append order", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ravel-trace-"));
    roots.push(root);
    const trace = path.join(root, "trace.jsonl");
    const recorder = new TraceRecorder(trace);

    const first = await recorder.append({ runId: "r1", type: "run.start", payload: {} });
    const second = await recorder.append({ runId: "r1", type: "skill.loaded", payload: { name: "demo" } });
    const third = await recorder.append({ runId: "r1", type: "run.end", payload: { reason: "completed" } });

    expect([first.eventId, second.eventId, third.eventId]).toEqual(["event-000001", "event-000002", "event-000003"]);
    const lines = (await readFile(trace, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    expect(lines.map((line) => line.eventId)).toEqual(["event-000001", "event-000002", "event-000003"]);
    expect(lines.every((line) => line.runId === "r1" && line.timestamp && line.type && line.payload)).toBe(true);
  });
});
