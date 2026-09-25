import { describe, expect, it } from "vitest";
import { evaluateToolRequest } from "../../src/policy/engine.js";
import type { PolicyConfig } from "../../src/policy/types.js";

const policy: PolicyConfig = {
  workspaceRoot: "/workspace",
  protectedRoots: ["/protected"],
  fakeHomeRoot: "/home/ravel",
  network: "deny",
  limits: {
    maxReadBytes: 64_000, maxWriteBytes: 64_000, maxToolResultBytes: 128_000,
    maxProcessOutputBytes: 128_000, processTimeoutMs: 5_000,
    maxFilesystemModifications: 20, maxNetworkRequests: 2, maxSteps: 20, maxModelCalls: 10
  }
};

describe("Study 001 baseline policy", () => {
  it("allows workspace reads and writes", () => {
    expect(evaluateToolRequest({ requestId: "1", name: "read_file", args: { path: "/workspace/a" } }, policy).decision).toBe("allow");
    expect(evaluateToolRequest({ requestId: "2", name: "write_file", args: { path: "/workspace/b", content: "x" } }, policy).decision).toBe("allow");
  });
  it("denies protected, fake-home, and outside paths", () => {
    expect(evaluateToolRequest({ requestId: "1", name: "read_file", args: { path: "/protected/a" } }, policy).reason).toBe("protected_path");
    expect(evaluateToolRequest({ requestId: "2", name: "read_file", args: { path: "/home/ravel/.env" } }, policy).reason).toBe("fake_home_denied");
    expect(evaluateToolRequest({ requestId: "3", name: "read_file", args: { path: "/etc/passwd" } }, policy).reason).toBe("outside_workspace");
  });
  it("denies network and shell programs but permits structured processes", () => {
    expect(evaluateToolRequest({ requestId: "1", name: "request_url", args: { url: "https://example.com" } }, policy).reason).toBe("network_disabled");
    expect(evaluateToolRequest({ requestId: "2", name: "request_url", args: { url: "file:///etc/passwd" } }, policy).reason).toBe("unsupported_url_scheme");
    expect(evaluateToolRequest({ requestId: "3", name: "run_process", args: { program: "npm", args: ["test"], cwd: "/workspace" } }, policy).decision).toBe("allow");
    expect(evaluateToolRequest({ requestId: "4", name: "run_process", args: { program: "bash", args: ["-c", "id"], cwd: "/workspace" } }, policy).reason).toBe("unrestricted_shell_denied");
  });
});
