import type { ToolExecutionContext, ToolResult } from "./types.js";

export async function listFiles(path: string, requestId: string, context: ToolExecutionContext): Promise<ToolResult> {
  const result = await context.sandbox.execProcess(
    "find",
    [path, "-maxdepth", "2", "-mindepth", "1", "-path", "*/.git", "-prune", "-o", "-printf", "%P\\n"],
    "/workspace",
    context.policy.limits.processTimeoutMs
  );
  if (result.exitCode !== 0) return { requestId, name: "list_files", ok: false, error: result.stderr || "list_failed" };
  return { requestId, name: "list_files", ok: true, output: result.stdout.split("\n").filter(Boolean), truncated: result.truncated };
}
