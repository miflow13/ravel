import type { ExperimentManifest } from "../experiment/manifest.js";
import type { RunStatus } from "../experiment/types.js";
import type { StaticAnalysis } from "../skill/types.js";
import type { TraceEvent } from "../trace/event-schema.js";
import type { BehaviorComparison } from "./comparison.js";
import type { ObservationSet } from "./observations.js";

export interface ReportInput {
  manifest: ExperimentManifest;
  status: RunStatus;
  staticAnalysis: StaticAnalysis;
  observations: ObservationSet;
  comparison: BehaviorComparison[];
  events: TraceEvent[];
}
export interface JsonReport {
  schemaVersion: 1;
  identity: { runId: string; skill: string | null; ravelVersion: string; runnerVersion: string; createdAt: string };
  experimentalConditions: {
    model: ExperimentManifest["model"];
    fixture: ExperimentManifest["fixture"];
    sandbox: ExperimentManifest["sandbox"];
    task: string;
    policy: ExperimentManifest["policy"];
  };
  declaredBehavior: StaticAnalysis;
  observedBehavior: ObservationSet;
  declaredVsObserved: BehaviorComparison[];
  evidenceTimeline: Array<{ eventId: string; timestamp: string; type: TraceEvent["type"] }>;
  runStatus: RunStatus;
}
export function buildJsonReport(input: ReportInput): JsonReport {
  return {
    schemaVersion: 1,
    identity: {
      runId: input.manifest.runId,
      skill: input.manifest.skill.name,
      ravelVersion: input.manifest.ravelVersion,
      runnerVersion: input.manifest.runnerVersion,
      createdAt: input.manifest.createdAt
    },
    experimentalConditions: {
      model: input.manifest.model, fixture: input.manifest.fixture, sandbox: input.manifest.sandbox,
      task: input.manifest.task, policy: input.manifest.policy
    },
    declaredBehavior: input.staticAnalysis,
    observedBehavior: input.observations,
    declaredVsObserved: input.comparison,
    evidenceTimeline: input.events.map((event) => ({ eventId: event.eventId, timestamp: event.timestamp, type: event.type })),
    runStatus: input.status
  };
}
