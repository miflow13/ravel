import type { StaticAnalysis } from "../skill/types.js";
import type { ObservationSet } from "./observations.js";
import { observationValue } from "./observations.js";

export type BehaviorLabel =
  | "declared_and_observed"
  | "declared_not_observed"
  | "observed_not_declared"
  | "indeterminate";

export interface BehaviorComparison {
  behavior: "file_read" | "file_write" | "process_execution" | "network_request";
  label: BehaviorLabel;
  declaredEvidence: string[];
  observedEvidenceEventIds: string[];
}

function observedCount(observations: ObservationSet, behavior: BehaviorComparison["behavior"]): number {
  const map = {
    file_read: "files_read",
    file_write: "files_written",
    process_execution: "processes_started",
    network_request: "network_requests_attempted"
  } as const;
  const value = observationValue(observations, map[behavior]);
  return typeof value === "number" ? value : 0;
}

function evidenceIds(observations: ObservationSet, behavior: BehaviorComparison["behavior"]): string[] {
  const map = {
    file_read: "files_read",
    file_write: "files_written",
    process_execution: "processes_started",
    network_request: "network_requests_attempted"
  } as const;
  return observations.observations.find((item) => item.name === map[behavior])?.evidenceEventIds ?? [];
}

export function compareDeclaredToObserved(
  staticAnalysis: StaticAnalysis,
  observations: ObservationSet
): BehaviorComparison[] {
  const declarations: Record<BehaviorComparison["behavior"], string[]> = {
    file_read: staticAnalysis.references,
    file_write: [],
    process_execution: staticAnalysis.commands,
    network_request: staticAnalysis.urls
  };

  return (Object.keys(declarations) as BehaviorComparison["behavior"][]).map((behavior) => {
    const declaredEvidence = declarations[behavior];
    const declared = declaredEvidence.length > 0;
    const observed = observedCount(observations, behavior) > 0;
    let label: BehaviorLabel;
    if (staticAnalysis.declarationConfidence === "indeterminate" && !declared) label = "indeterminate";
    else if (declared && observed) label = "declared_and_observed";
    else if (declared) label = "declared_not_observed";
    else if (observed) label = "observed_not_declared";
    else label = "indeterminate";
    return { behavior, label, declaredEvidence, observedEvidenceEventIds: evidenceIds(observations, behavior) };
  });
}
