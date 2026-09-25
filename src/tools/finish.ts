import type { ToolResult } from "./types.js";

export function finishTool(summary: string | undefined, requestId: string): ToolResult {
  return { requestId, name: "finish", ok: true, output: { summary: summary ?? null, finished: true } };
}
