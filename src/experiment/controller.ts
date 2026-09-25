import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PolicyConfig } from "../policy/types.js";
import { createSandbox, type PodmanSandbox, type SandboxConfig } from "../sandbox/podman.js";
import { snapshotTree, type FilesystemSnapshot } from "../sandbox/snapshot.js";
import { analyzeSkill } from "../skill/analyzer.js";
import { loadSkill } from "../skill/loader.js";
import { resolveSkillReferences } from "../skill/references.js";
import { ToolRegistry } from "../tools/registry.js";
import { TraceRecorder } from "../trace/recorder.js";
import type { Runner } from "../runner/types.js";
import { createManifest, serializeManifest, type ExperimentManifest } from "./manifest.js";
import { createRunDirectory } from "./run-directory.js";
import type { ExperimentPaths, RunStatus, TerminationReason } from "./types.js";

export const DEFAULT_STUDY_POLICY: PolicyConfig = {
  workspaceRoot: "/workspace",
  protectedRoots: ["/protected"],
  fakeHomeRoot: "/home/ravel",
  network: "deny",
  limits: {
    maxReadBytes: 256_000,
    maxWriteBytes: 256_000,
    maxToolResultBytes: 512_000,
    maxProcessOutputBytes: 512_000,
    processTimeoutMs: 60_000,
    maxFilesystemModifications: 100,
    maxNetworkRequests: 4,
    maxSteps: 40,
    maxModelCalls: 20
  }
};

export interface ExperimentConfig {
  runId: string;
  skillDir: string;
  fixtureDir: string;
  fixtureId: string;
  runsDir: string;
  task: string;
  runnerVersion?: string;
  modelProvider?: "fake" | "openai";
  modelId?: string;
  policy?: PolicyConfig;
  sandbox?: SandboxConfig;
  canaryPaths?: string[];
}

export interface ExperimentResult {
  paths: ExperimentPaths;
  status: RunStatus;
  manifest: ExperimentManifest;
  before: FilesystemSnapshot;
  after?: FilesystemSnapshot;
}

function terminationFor(error: unknown): TerminationReason {
  const message = error instanceof Error ? error.message : String(error);
  if (/podman|sandbox/i.test(message)) return "sandbox_error";
  return "runner_error";
}

export async function runExperiment(config: ExperimentConfig, runner: Runner): Promise<ExperimentResult> {
  const paths = await createRunDirectory(config.runsDir, config.runId);
  const skill = await loadSkill(config.skillDir);
  const references = await resolveSkillReferences(skill);
  if (references.some((ref) => !ref.exists || ref.escapedRoot)) {
    throw new Error("Skill validation failed: unresolved or escaping reference");
  }
  const staticAnalysis = analyzeSkill(skill);
  await writeFile(paths.staticAnalysis, JSON.stringify({ ...staticAnalysis, resolvedReferences: references }, null, 2));

  const before = await snapshotTree(config.fixtureDir);
  await writeFile(paths.filesystemBefore, JSON.stringify(before, null, 2));
  const policy = config.policy ?? DEFAULT_STUDY_POLICY;
  const manifest = createManifest({
    runId: config.runId,
    runnerVersion: config.runnerVersion ?? "ravel-runner/0.1",
    skillName: skill.name,
    skillRoot: skill.root,
    skillEntrypoint: skill.entrypoint,
    fixtureId: config.fixtureId,
    fixtureSnapshot: before,
    policy,
    modelProvider: config.modelProvider ?? "fake",
    modelId: config.modelId ?? "fake",
    task: config.task,
    staticAnalysis
  });
  await writeFile(paths.manifest, serializeManifest(manifest));

  const recorder = new TraceRecorder(paths.trace);
  await recorder.append({ runId: config.runId, type: "run.start", payload: { manifest: path.basename(paths.manifest) } });
  await recorder.append({ runId: config.runId, type: "skill.loaded", payload: { name: skill.name, entrypoint: skill.entrypoint } });

  let sandbox: PodmanSandbox | undefined;
  let after: FilesystemSnapshot | undefined;
  let status: RunStatus = { runId: config.runId, reason: "runner_error", completed: false };
  const exportDir = await mkdtemp(path.join(os.tmpdir(), "ravel-export-"));

  try {
    sandbox = await createSandbox({ ...config.sandbox, maxOutputBytes: policy.limits.maxProcessOutputBytes });
    await sandbox.copyIn(`${path.resolve(config.fixtureDir)}/.`, "/workspace");
    const registry = new ToolRegistry();
    const result = await runner.run({
      runId: config.runId,
      instructions: skill.markdown,
      task: config.task,
      toolRegistry: registry,
      toolContext: {
        runId: config.runId,
        sandbox,
        recorder,
        policy,
        canaryPaths: config.canaryPaths ?? []
      }
    });

    status = {
      runId: config.runId,
      reason: result.reason,
      completed: result.reason === "completed",
      message: result.summary
    };
    await recorder.append({
      runId: config.runId,
      type: result.reason === "completed" ? "run.end" : "run.terminated",
      payload: { reason: result.reason, steps: result.steps, summary: result.summary ?? null }
    });
  } catch (error) {
    const reason = terminationFor(error);
    status = { runId: config.runId, reason, completed: false, message: error instanceof Error ? error.message : String(error) };
    await recorder.append({
      runId: config.runId,
      type: "run.terminated",
      payload: { reason, error: status.message }
    });
  } finally {
    if (sandbox) {
      try {
        await sandbox.copyWorkspaceOut(exportDir);
        after = await snapshotTree(exportDir);
        await writeFile(paths.filesystemAfter, JSON.stringify(after, null, 2));
      } catch (snapshotError) {
        if (!status.message) status.message = `Final snapshot failed: ${snapshotError instanceof Error ? snapshotError.message : String(snapshotError)}`;
      }
      await sandbox.destroy();
    }
    await rm(exportDir, { recursive: true, force: true });
  }

  return { paths, status, manifest, before, after };
}
