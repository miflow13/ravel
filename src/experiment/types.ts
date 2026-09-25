export type RunId = string;

export type TerminationReason =
  | "completed"
  | "step_limit"
  | "timeout"
  | "model_error"
  | "tool_error"
  | "policy_termination"
  | "runner_error"
  | "sandbox_error";

export interface RunStatus {
  runId: RunId;
  reason: TerminationReason;
  completed: boolean;
  message?: string;
}

export interface ExperimentPaths {
  root: string;
  manifest: string;
  staticAnalysis: string;
  trace: string;
  filesystemBefore: string;
  filesystemAfter: string;
  reportJson: string;
  reportHtml: string;
  artifacts: string;
}
