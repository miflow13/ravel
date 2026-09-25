import type { ToolResult } from "../tools/types.js";
import type { ModelAdapter, RunnerMessage } from "./model-adapter.js";
import type { Runner, RunnerContext, RunnerResult } from "./types.js";

export class RavelRunner implements Runner {
  constructor(
    private readonly model: ModelAdapter,
    readonly version = "ravel-runner/0.1"
  ) {}

  async run(context: RunnerContext): Promise<RunnerResult> {
    const messages: RunnerMessage[] = [{ role: "user", content: context.task }];
    let modelCalls = 0;
    let steps = 0;

    while (modelCalls < context.toolContext.policy.limits.maxModelCalls) {
      await context.toolContext.recorder.append({
        runId: context.runId,
        type: "model.request",
        payload: { turn: modelCalls + 1, messageCount: messages.length }
      });

      let output;
      try {
        output = await this.model.respond({
          instructions: context.instructions,
          messages,
          tools: context.toolRegistry.definitions()
        });
      } catch (error) {
        await context.toolContext.recorder.append({
          runId: context.runId,
          type: "model.response",
          payload: { turn: modelCalls + 1, error: error instanceof Error ? error.message : String(error) }
        });
        return { reason: "model_error", steps };
      }
      modelCalls += 1;

      await context.toolContext.recorder.append({
        runId: context.runId,
        type: "model.response",
        payload: {
          turn: modelCalls,
          modelId: output.modelId,
          responseId: output.responseId ?? null,
          inputTokens: output.usage?.inputTokens ?? null,
          outputTokens: output.usage?.outputTokens ?? null,
          toolCalls: output.toolCalls.map((call) => ({ callId: call.callId, name: call.name }))
        }
      });

      if (output.text) messages.push({ role: "assistant", content: output.text });
      if (output.toolCalls.length === 0) {
        messages.push({ role: "user", content: "Continue by using one of the available tools, or call finish when the task is complete." });
        continue;
      }

      for (const call of output.toolCalls) {
        if (steps >= context.toolContext.policy.limits.maxSteps) {
          return { reason: "step_limit", steps };
        }

        let result: ToolResult;
        try {
          const request = context.toolRegistry.parseRequest(call.callId, call.name, call.args);
          result = await context.toolRegistry.execute(request, context.toolContext);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await context.toolContext.recorder.append({
            runId: context.runId,
            type: "tool.request",
            payload: { requestId: call.callId, name: call.name, args: call.args, malformed: true }
          });
          await context.toolContext.recorder.append({
            runId: context.runId,
            type: "tool.denied",
            payload: { requestId: call.callId, reason: "malformed_tool_call" }
          });
          result = { requestId: call.callId, name: "finish", ok: false, error: `malformed_tool_call: ${message}` };
          await context.toolContext.recorder.append({
            runId: context.runId,
            type: "tool.result",
            payload: result
          });
        }

        steps += 1;
        messages.push({
          role: "tool",
          callId: call.callId,
          name: call.name,
          content: JSON.stringify(result)
        });

        if (call.name === "finish" && result.ok) {
          const summary = (result.output as { summary?: string } | undefined)?.summary;
          return { reason: "completed", steps, summary };
        }
      }
    }

    return { reason: "step_limit", steps };
  }
}
