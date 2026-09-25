import type { ToolExecutionContext, ToolResult } from "./types.js";

export async function requestUrlTool(url: string, requestId: string, context: ToolExecutionContext): Promise<ToolResult> {
  await context.recorder.append({
    runId: context.runId,
    type: "network.request",
    payload: { requestId, url }
  });
  // Study 001's baseline policy denies network before this implementation can be reached.
  return { requestId, name: "request_url", ok: false, error: "network_execution_not_enabled" };
}
