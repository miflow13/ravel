import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PolicyConfig } from "../policy/types.js";
import { compareDeclaredToObserved } from "../report/comparison.js";
import { renderHtmlReport } from "../report/html-report.js";
import { buildJsonReport } from "../report/json-report.js";
import { deriveObservations } from "../report/observations.js";
import { createSandbox, DEFAULT_SANDBOX_IMAGE, type PodmanSandbox, type SandboxConfig } from "../sandbox/podman.js";
import { snapshotTree, type FilesystemSnapshot } from "../sandbox/snapshot.js";
import { analyzeSkill } from "../skill/analyzer.js";
import { loadSkill } from "../skill/loader.js";
import { resolveSkillReferences } from "../skill/references.js";
import type { StaticAnalysis } from "../skill/types.js";
import { ToolRegistry } from "../tools/registry.js";
import { TraceEventSchema, type TraceEvent } from "../trace/event-schema.js";
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
  modelReasoningEffort?: string;
  modelMaxOutputTokens?: number;
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

async function readTrace(filePath: string): Promise<TraceEvent[]> {
  const raw = await readFile(filePath, "utf8");
  return raw.split("\n").filter(Boolean).map((line) => TraceEventSchema.parse(JSON.parse(line)));
}

async function initializeFixtureGitRepository(sandbox: PodmanSandbox): Promise<void> {
  const commands: Array<[string, string[]]> = [
    ["git", ["init", "-q", "/workspace"]],
    ["git", ["-C", "/workspace", "add", "-A"]],
    ["env", [
      "GIT_AUTHOR_DATE=2026-01-01T00:00:00Z",
      "GIT_COMMITTER_DATE=2026-01-01T00:00:00Z",
      "git", "-C", "/workspace",
      "-c", "user.name=Ravel Fixture",
      "-c", "user.email=ravel@example.invalid",
      "commit", "-q", "-m", "Frozen fixture baseline"
    ]]
  ];
  for (const [program, args] of commands) {
    const result = await sandbox.execProcess(program, args, "/workspace", 30_000);
    if (result.exitCode !== 0) {
      throw new Error(`Unable to initialize deterministic fixture Git repository: ${result.stderr || result.stdout}`);
    }
  }
}

async function writeReports(input: {
  paths: ExperimentPaths;
  manifest: ExperimentManifest;
  status: RunStatus;
  staticAnalysis: StaticAnalysis;
  before: FilesystemSnapshot;
  after?: FilesystemSnapshot;
}): Promise<void> {
  const events = await readTrace(input.paths.trace);
  const observations = deriveObservations(events, { before: input.before, after: input.after });
  const comparison = compareDeclaredToObserved(input.staticAnalysis, observations);
  const report = buildJsonReport({
    manifest: input.manifest,
    status: input.status,
    staticAnalysis: input.staticAnalysis,
    observations,
    comparison,
    events
  });
  await writeFile(input.paths.reportJson, JSON.stringify(report, null, 2));
  await writeFile(input.paths.reportHtml, renderHtmlReport(report));
}

export async function runExperiment(config: ExperimentConfig, runner: Runner): Promise<ExperimentResult> {
  const paths = await createRunDirectory(config.runsDir, config.runId);
  const skill = await loadSkill(config.skillDir);
  const references = await resolveSkillReferences(skill);
  if (references.some((ref) => !ref.exists || ref.escapedRoot)) throw new Error("Skill validation failed: unresolved or escaping reference");
  const staticAnalysis = analyzeSkill(skill);
  await writeFile(paths.staticAnalysis, JSON.stringify({ ...staticAnalysis, resolvedReferences: references }, null, 2));

  const before = await snapshotTree(config.fixtureDir);
  await writeFile(paths.filesystemBefore, JSON.stringify(before, null, 2));
  const policy = config.policy ?? DEFAULT_STUDY_POLICY;
  const manifest = createManifest({
    runId: config.runId,
    runnerVersion: config.runnerVersion ?? "ravel-runner/0.1",
    skillName: skill.name,
    skillRoot: ".",
    skillEntrypoint: path.relative(skill.root, skill.entrypoint).split(path.sep).join("/"),
    fixtureId: config.fixtureId,
    fixtureSnapshot: before,
    sandboxImage: config.sandbox?.image ?? DEFAULT_SANDBOX_IMAGE,
    networkDisabled: config.sandbox?.networkDisabled !== false,
    policy,
    modelProvider: config.modelProvider ?? "fake",
    modelId: config.modelId ?? "fake",
    modelReasoningEffort: config.modelReasoningEffort,
    modelMaxOutputTokens: config.modelMaxOutputTokens,
    task: config.task,
    staticAnalysis
  });
  await writeFile(paths.manifest, serializeManifest(manifest));

  const recorder = new TraceRecorder(paths.trace);
  await recorder.append({ runId: config.runId, type: "run.start", payload: { manifest: path.basename(paths.manifest) } });
  await recorder.append({
    runId: config.runId,
    type: "skill.loaded",
    payload: { name: skill.name, entrypoint: path.relative(skill.root, skill.entrypoint).split(path.sep).join("/") }
  });

  let sandbox: PodmanSandbox | undefined;
  let after: FilesystemSnapshot | undefined;
  let status: RunStatus = { runId: config.runId, reason: "runner_error", completed: false };
  const exportDir = await mkdtemp(path.join(os.tmpdir(), "ravel-export-"));

  try {
    sandbox = await createSandbox({ ...config.sandbox, maxOutputBytes: policy.limits.maxProcessOutputBytes });
    await sandbox.copyIn(`${path.resolve(config.fixtureDir)}/.`, "/workspace");
    await initializeFixtureGitRepository(sandbox);
    const registry = new ToolRegistry();
    const result = await runner.run({
      runId: config.runId,
      instructions: skill.markdown,
      task: config.task,
      toolRegistry: registry,
      toolContext: { runId: config.runId, sandbox, recorder, policy, canaryPaths: config.canaryPaths ?? [] }
    });
    status = { runId: config.runId, reason: result.reason, completed: result.reason === "completed", message: result.summary };
    await recorder.append({
      runId: config.runId,
      type: result.reason === "completed" ? "run.end" : "run.terminated",
      payload: { reason: result.reason, steps: result.steps, summary: result.summary ?? null }
    });
  } catch (error) {
    const reason = terminationFor(error);
    status = { runId: config.runId, reason, completed: false, message: error instanceof Error ? error.message : String(error) };
    await recorder.append({ runId: config.runId, type: "run.terminated", payload: { reason, error: status.message } });
  } finally {
    try {
      if (sandbox) {
        await sandbox.copyWorkspaceOut(exportDir);
        after = await snapshotTree(exportDir);
        await writeFile(paths.filesystemAfter, JSON.stringify(after, null, 2));
      }
      await writeReports({ paths, manifest, status, staticAnalysis, before, after });
    } finally {
      if (sandbox) await sandbox.destroy();
      await rm(exportDir, { recursive: true, force: true });
    }
  }

  return { paths, status, manifest, before, after };
}
