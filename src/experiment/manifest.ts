import { createHash } from "node:crypto";
import { stringify } from "yaml";
import type { FilesystemSnapshot } from "../sandbox/snapshot.js";
import type { PolicyConfig } from "../policy/types.js";
import type { StaticAnalysis } from "../skill/types.js";

export interface ExperimentManifest {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  ravelVersion: string;
  runnerVersion: string;
  skill: { name: string | null; root: string; entrypoint: string };
  fixture: { id: string; sha256: string };
  sandbox: { image: string; networkDisabled: boolean };
  policy: PolicyConfig;
  model: { provider: "fake" | "openai"; id: string };
  task: string;
  staticAnalysisDigest: string;
}
function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function fixtureDigest(snapshot: FilesystemSnapshot): string {
  return digest(snapshot.entries.map(({ path, type, size, sha256, target }) => ({ path, type, size, sha256, target })));
}
export function createManifest(input: {
  runId: string;
  runnerVersion: string;
  skillName: string | null;
  skillRoot: string;
  skillEntrypoint: string;
  fixtureId: string;
  fixtureSnapshot: FilesystemSnapshot;
  sandboxImage: string;
  networkDisabled: boolean;
  policy: PolicyConfig;
  modelProvider: "fake" | "openai";
  modelId: string;
  task: string;
  staticAnalysis: StaticAnalysis;
}): ExperimentManifest {
  return {
    schemaVersion: 1,
    runId: input.runId,
    createdAt: new Date().toISOString(),
    ravelVersion: "0.1.0",
    runnerVersion: input.runnerVersion,
    skill: { name: input.skillName, root: input.skillRoot, entrypoint: input.skillEntrypoint },
    fixture: { id: input.fixtureId, sha256: fixtureDigest(input.fixtureSnapshot) },
    sandbox: { image: input.sandboxImage, networkDisabled: input.networkDisabled },
    policy: input.policy,
    model: { provider: input.modelProvider, id: input.modelId },
    task: input.task,
    staticAnalysisDigest: digest(input.staticAnalysis)
  };
}
export function serializeManifest(manifest: ExperimentManifest): string {
  return stringify(manifest);
}
