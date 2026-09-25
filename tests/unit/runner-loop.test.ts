import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ModelAdapter, ModelInput, ModelOutput } from "../../src/runner/model-adapter.js";
import { RavelRunner } from "../../src/runner/loop.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { TraceRecorder } from "../../src/trace/recorder.js";
import { DEFAULT_STUDY_POLICY } from "../../src/experiment/controller.js";
import type { PodmanSandbox, ProcessResult } from "../../src/sandbox/podman.js";

class ScriptedModel implements ModelAdapter {
  calls: ModelInput[] = [];
  constructor(private readonly outputs: ModelOutput[]) {}
  async respond(input: ModelInput) {
    this.calls.push(structuredClone(input));
    const output = this.outputs.shift();
    if (!output) throw new Error("No scripted output");
    return output;
  }
}

class FakeSandbox {
  async resolvePath(candidate: string) { return candidate; }
  async execProcess(program: string, args: string[], cwd: string, timeoutMs: number): Promise<ProcessResult> {
    if (program === "stat") return { exitCode: 0, stdout: "2\n", stderr: "", timedOut: false, truncated: false };
    if (program === "cat") return { exitCode: 0, stdout: "{}", stderr: "", timedOut: false, truncated: false };
    return { exitCode: 0, stdout: "ok", stderr: "", timedOut: false, truncated: false };
  }
}

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true }))));

async function context(maxModelCalls = 10, maxSteps = 10) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ravel-loop-")); roots.push(root);
  const policy = structuredClone(DEFAULT_STUDY_POLICY);
  policy.limits.maxModelCalls = maxModelCalls;
  policy.limits.maxSteps = maxSteps;
  return {
    runId: "r1", instructions: "Review.", task: "Review this repository.", toolRegistry: new ToolRegistry(),
    toolContext: { runId: "r1", sandbox: new FakeSandbox() as unknown as PodmanSandbox, recorder: new TraceRecorder(path.join(root, "trace.jsonl")), policy, canaryPaths: [] }
  };
}

describe("RavelRunner", () => {
  it("feeds tool results into the next model turn and finishes in three turns", async () => {
    const model = new ScriptedModel([
      { modelId: "fake", toolCalls: [{ callId: "c1", name: "read_file", args: { path: "/workspace/package.json" } }] },
      { modelId: "fake", toolCalls: [{ callId: "c2", name: "run_process", args: { program: "npm", args: ["test"], cwd: "/workspace" } }] },
      { modelId: "fake", toolCalls: [{ callId: "c3", name: "finish", args: { summary: "done" } }] }
    ]);
    const result = await new RavelRunner(model).run(await context());
    expect(result.reason).toBe("completed");
    expect(model.calls).toHaveLength(3);
    expect(model.calls[1]?.messages.some((m) => m.role === "tool" && m.callId === "c1")).toBe(true);
  });

  it("terminates at model and step limits", async () => {
    const model = new ScriptedModel([{ modelId: "fake", toolCalls: [] }, { modelId: "fake", toolCalls: [] }]);
    expect((await new RavelRunner(model).run(await context(1, 10))).reason).toBe("step_limit");
  });

  it("records malformed tool calls instead of throwing", async () => {
    const model = new ScriptedModel([
      { modelId: "fake", toolCalls: [{ callId: "bad", name: "run_process", args: { command: "npm test" } }] },
      { modelId: "fake", toolCalls: [{ callId: "done", name: "finish", args: {} }] }
    ]);
    const result = await new RavelRunner(model).run(await context());
    expect(result.reason).toBe("completed");
  });
});
