import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runExperiment } from "../../src/experiment/controller.js";
import { FakeRunner } from "../../src/runner/fake-runner.js";
import { isPodmanAvailable } from "../../src/sandbox/podman.js";

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ravel-e2e-"));
  const skill = path.join(root, "skill");
  const fixture = path.join(root, "fixture");
  await mkdir(skill);
  await mkdir(fixture);
  await writeFile(path.join(skill, "SKILL.md"), "---\nname: calibration\n---\nReview the repository.");
  await writeFile(path.join(fixture, "package.json"), '{"scripts":{"test":"node -e \\"process.exit(0)\\""}}');
  return { root, skill, fixture, runs: path.join(root, "runs") };
}

describe("fake runner experiment", () => {
  it("executes through the real tool/policy stack and preserves artifacts", async (context) => {
    if (!(await isPodmanAvailable())) { context.skip("Podman unavailable or not rootless"); return; }
    const env = await setup();
    try {
      const runner = new FakeRunner({ requests: [
        { requestId: "1", name: "list_files", args: { path: "/workspace" } },
        { requestId: "2", name: "read_file", args: { path: "/workspace/package.json" } },
        { requestId: "3", name: "run_process", args: { program: "npm", args: ["test"], cwd: "/workspace" } },
        { requestId: "4", name: "write_file", args: { path: "/workspace/result.txt", content: "done" } },
        { requestId: "5", name: "request_url", args: { url: "https://example.com" } },
        { requestId: "6", name: "finish", args: { summary: "complete" } }
      ]});
      const result = await runExperiment({
        runId: "fake-e2e", skillDir: env.skill, fixtureDir: env.fixture, fixtureId: "fixture", runsDir: env.runs,
        task: "Review."
      }, runner);
      expect(result.status.reason).toBe("completed");
      expect(await readFile(result.paths.manifest, "utf8")).toContain("model:\n  provider: fake");
      expect(await readFile(result.paths.trace, "utf8")).toContain('"type":"tool.denied"');
      const after = JSON.parse(await readFile(result.paths.filesystemAfter, "utf8")) as { entries: { path: string }[] };
      expect(after.entries.some((entry) => entry.path === "result.txt")).toBe(true);
    } finally { await rm(env.root, { recursive: true, force: true }); }
  });

  it("preserves prior events and records runner_error on interruption", async (context) => {
    if (!(await isPodmanAvailable())) { context.skip("Podman unavailable or not rootless"); return; }
    const env = await setup();
    try {
      const runner = new FakeRunner({ throwAfter: 2, requests: [
        { requestId: "1", name: "list_files", args: { path: "/workspace" } },
        { requestId: "2", name: "read_file", args: { path: "/workspace/package.json" } },
        { requestId: "3", name: "finish", args: {} }
      ]});
      const result = await runExperiment({
        runId: "fake-fail", skillDir: env.skill, fixtureDir: env.fixture, fixtureId: "fixture", runsDir: env.runs, task: "Review."
      }, runner);
      expect(result.status.reason).toBe("runner_error");
      const trace = await readFile(result.paths.trace, "utf8");
      expect(trace).toContain('"type":"tool.result"');
      expect(trace).toContain('"type":"run.terminated"');
    } finally { await rm(env.root, { recursive: true, force: true }); }
  });
});
