import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRunDirectory } from "../../src/experiment/run-directory.js";

const created: string[] = [];

afterEach(async () => {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("createRunDirectory", () => {
  it("creates stable isolated artifact paths", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "ravel-runs-"));
    created.push(base);

    const paths = await createRunDirectory(base, "run-001");

    expect(paths.root).toBe(path.join(base, "run-001"));
    expect(paths.manifest).toBe(path.join(paths.root, "manifest.yaml"));
    expect(paths.staticAnalysis).toBe(path.join(paths.root, "static-analysis.json"));
    expect(paths.trace).toBe(path.join(paths.root, "trace.jsonl"));
    expect(paths.filesystemBefore).toBe(path.join(paths.root, "filesystem-before.json"));
    expect(paths.filesystemAfter).toBe(path.join(paths.root, "filesystem-after.json"));
    expect(paths.reportJson).toBe(path.join(paths.root, "report.json"));
    expect(paths.reportHtml).toBe(path.join(paths.root, "report.html"));
    expect(paths.artifacts).toBe(path.join(paths.root, "artifacts"));
  });

  it("never aliases distinct run IDs", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "ravel-runs-"));
    created.push(base);
    const first = await createRunDirectory(base, "run-a");
    const second = await createRunDirectory(base, "run-b");
    expect(first.root).not.toBe(second.root);
  });
});
