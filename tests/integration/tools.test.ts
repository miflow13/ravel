import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ToolRegistry } from "../../src/tools/registry.js";
import type { PolicyConfig } from "../../src/policy/types.js";
import { TraceRecorder } from "../../src/trace/recorder.js";
import type { PodmanSandbox, ProcessResult } from "../../src/sandbox/podman.js";
import { assertWorkspacePath } from "../../src/sandbox/paths.js";

class FakeSandbox {
  files = new Map([["/workspace/a.txt", "hello"], ["/workspace/CANARY.txt", "synthetic-canary"]]);
  async resolvePath(candidate: string) { return assertWorkspacePath(candidate); }
  async execProcess(program: string, args: string[], cwd: string, timeoutMs: number): Promise<ProcessResult> {
    if (program === "stat") {
      const value = this.files.get(args.at(-1) ?? "");
      return { exitCode: value === undefined ? 1 : 0, stdout: value === undefined ? "" : String(Buffer.byteLength(value)) + "\n", stderr: "", timedOut: false, truncated: false };
    }
    if (program === "cat") {
      const value = this.files.get(args[0] ?? "");
      return { exitCode: value === undefined ? 1 : 0, stdout: value ?? "", stderr: "", timedOut: false, truncated: false };
    }
    if (program === "node") {
      this.files.set(args.at(-2) ?? "", args.at(-1) ?? "");
      return { exitCode: 0, stdout: "", stderr: "", timedOut: false, truncated: false };
    }
    if (program === "find") return { exitCode: 0, stdout: "a.txt\nCANARY.txt\n", stderr: "", timedOut: false, truncated: false };
    return { exitCode: timeoutMs === 1 ? 124 : 0, stdout: "", stderr: "", timedOut: timeoutMs === 1, truncated: false };
  }
}

const policy: PolicyConfig = {
  workspaceRoot: "/workspace", protectedRoots: ["/protected"], fakeHomeRoot: "/home/ravel", network: "deny",
  limits: { maxReadBytes: 32, maxWriteBytes: 32, maxToolResultBytes: 128, maxProcessOutputBytes: 128, processTimeoutMs: 1000, maxFilesystemModifications: 10, maxNetworkRequests: 1, maxSteps: 10, maxModelCalls: 5 }
};

describe("ToolRegistry", () => {
  it("records request, decision, effect and result including canary access", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ravel-tools-"));
    try {
      const trace = path.join(root, "trace.jsonl");
      const registry = new ToolRegistry();
      const context = { runId: "r1", sandbox: new FakeSandbox() as unknown as PodmanSandbox, recorder: new TraceRecorder(trace), policy, canaryPaths: ["/workspace/CANARY.txt"] };
      const result = await registry.execute({ requestId: "t1", name: "read_file", args: { path: "/workspace/CANARY.txt" } }, context);
      expect(result.ok).toBe(true);
      const types = (await readFile(trace, "utf8")).trim().split("\n").map((line) => JSON.parse(line).type);
      expect(types).toEqual(["tool.request", "tool.allowed", "filesystem.read", "canary.access", "tool.result"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("normalizes relative file paths into the workspace without a denial", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ravel-tools-relative-"));
    try {
      const trace = path.join(root, "trace.jsonl");
      const registry = new ToolRegistry();
      const context = { runId: "r1", sandbox: new FakeSandbox() as unknown as PodmanSandbox, recorder: new TraceRecorder(trace), policy, canaryPaths: [] };
      const result = await registry.execute({ requestId: "r1", name: "read_file", args: { path: "a.txt" } }, context);
      expect(result.ok).toBe(true);
      const events = (await readFile(trace, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
      expect(events.some((event) => event.type === "tool.denied")).toBe(false);
      expect(events.find((event) => event.type === "filesystem.read")?.payload.path).toBe("/workspace/a.txt");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("records denied network attempts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ravel-tools-"));
    try {
      const trace = path.join(root, "trace.jsonl");
      const registry = new ToolRegistry();
      const context = { runId: "r1", sandbox: new FakeSandbox() as unknown as PodmanSandbox, recorder: new TraceRecorder(trace), policy, canaryPaths: [] };
      const result = await registry.execute({ requestId: "n1", name: "request_url", args: { url: "https://example.com" } }, context);
      expect(result.error).toBe("network_disabled");
      const types = (await readFile(trace, "utf8")).trim().split("\n").map((line) => JSON.parse(line).type);
      expect(types).toEqual(["tool.request", "tool.denied", "network.request", "tool.result"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("enforces frozen network and write-count limits", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ravel-tools-limits-"));
    try {
      const trace = path.join(root, "trace.jsonl");
      const registry = new ToolRegistry();
      const limited = structuredClone(policy);
      limited.limits.maxNetworkRequests = 1;
      limited.limits.maxFilesystemModifications = 1;
      const context = { runId: "r1", sandbox: new FakeSandbox() as unknown as PodmanSandbox, recorder: new TraceRecorder(trace), policy: limited, canaryPaths: [] };

      const n1 = await registry.execute({ requestId: "n1", name: "request_url", args: { url: "https://example.com/1" } }, context);
      const n2 = await registry.execute({ requestId: "n2", name: "request_url", args: { url: "https://example.com/2" } }, context);
      expect(n1.error).toBe("network_disabled");
      expect(n2.error).toBe("network_request_limit_exceeded");

      const w1 = await registry.execute({ requestId: "w1", name: "write_file", args: { path: "/workspace/a.txt", content: "one" } }, context);
      const w2 = await registry.execute({ requestId: "w2", name: "write_file", args: { path: "/workspace/b.txt", content: "two" } }, context);
      expect(w1.ok).toBe(true);
      expect(w2.error).toBe("filesystem_modification_limit_exceeded");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("caps oversized tool results deterministically", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ravel-tools-result-limit-"));
    try {
      const trace = path.join(root, "trace.jsonl");
      const registry = new ToolRegistry();
      const limited = structuredClone(policy);
      limited.limits.maxReadBytes = 1024;
      limited.limits.maxToolResultBytes = 96;
      const sandbox = new FakeSandbox();
      sandbox.files.set("/workspace/large.txt", "x".repeat(400));
      const context = { runId: "r1", sandbox: sandbox as unknown as PodmanSandbox, recorder: new TraceRecorder(trace), policy: limited, canaryPaths: [] };
      const result = await registry.execute({ requestId: "r1", name: "read_file", args: { path: "/workspace/large.txt" } }, context);
      expect(result.truncated).toBe(true);
      expect(result.output).toMatchObject({ truncated: true });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects malformed arguments before execution", () => {
    const registry = new ToolRegistry();
    expect(() => registry.parseRequest("x", "run_process", { command: "npm test" })).toThrow();
  });
});
