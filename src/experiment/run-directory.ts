import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ExperimentPaths, RunId } from "./types.js";

function assertSafeRunId(runId: RunId): void {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Run ID contains unsupported characters");
  }
}

export async function createRunDirectory(baseDir: string, runId: RunId): Promise<ExperimentPaths> {
  assertSafeRunId(runId);
  const root = path.resolve(baseDir, runId);
  const artifacts = path.join(root, "artifacts");

  await mkdir(path.resolve(baseDir), { recursive: true });
  await mkdir(root, { recursive: false });
  await mkdir(artifacts, { recursive: false });

  return {
    root,
    manifest: path.join(root, "manifest.yaml"),
    staticAnalysis: path.join(root, "static-analysis.json"),
    trace: path.join(root, "trace.jsonl"),
    filesystemBefore: path.join(root, "filesystem-before.json"),
    filesystemAfter: path.join(root, "filesystem-after.json"),
    reportJson: path.join(root, "report.json"),
    reportHtml: path.join(root, "report.html"),
    artifacts
  };
}
