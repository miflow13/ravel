import type { ToolRequest } from "../tools/types.js";
import type { Runner, RunnerContext, RunnerResult } from "./types.js";

export interface FakeRunnerOptions {
  requests: ToolRequest[];
  throwAfter?: number;
}

export class FakeRunner implements Runner {
  constructor(private readonly options: FakeRunnerOptions) {}

  async run(context: RunnerContext): Promise<RunnerResult> {
    let steps = 0;
    for (const request of this.options.requests) {
      if (this.options.throwAfter !== undefined && steps >= this.options.throwAfter) {
        throw new Error("Synthetic FakeRunner failure");
      }
      const result = await context.toolRegistry.execute(request, context.toolContext);
      steps += 1;
      if (request.name === "finish" && result.ok) {
        const output = result.output as { summary?: string } | undefined;
        return { reason: "completed", steps, summary: output?.summary };
      }
      if (steps >= context.toolContext.policy.limits.maxSteps) {
        return { reason: "step_limit", steps };
      }
    }
    return { reason: "completed", steps };
  }
}
