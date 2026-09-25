import type { TerminationReason } from "../experiment/types.js";
import type { ToolExecutionContext } from "../tools/types.js";
import type { ToolRegistry } from "../tools/registry.js";

export interface RunnerContext {
  runId: string;
  instructions: string;
  task: string;
  toolRegistry: ToolRegistry;
  toolContext: ToolExecutionContext;
}

export interface RunnerResult {
  reason: TerminationReason;
  steps: number;
  summary?: string;
}

export interface Runner {
  run(context: RunnerContext): Promise<RunnerResult>;
}
