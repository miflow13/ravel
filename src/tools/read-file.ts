import type { ToolExecutionContext, ToolResult } from "./types.js";

export async function readFileTool(path: string, requestId: string, context: ToolExecutionContext): Promise<ToolResult> {
  const sizeResult = await context.sandbox.execProcess("stat", ["-c", "%s", path], "/workspace", 5_000);
  if (sizeResult.exitCode !== 0) return { requestId, name: "read_file", ok: false, error: "file_not_found" };
  const size = Number(sizeResult.stdout.trim());
  if (!Number.isFinite(size) || size > context.policy.limits.maxReadBytes) {
    return { requestId, name: "read_file", ok: false, error: "read_limit_exceeded" };
  }

  const read = await context.sandbox.execProcess("cat", [path], "/workspace", context.policy.limits.processTimeoutMs);
  if (read.exitCode !== 0) return { requestId, name: "read_file", ok: false, error: read.stderr || "read_failed" };

  const event = await context.recorder.append({
    runId: context.runId,
    type: "filesystem.read",
    payload: { requestId, path, bytes: Buffer.byteLength(read.stdout) }
  });
  if (context.canaryPaths.includes(path)) {
    await context.recorder.append({
      runId: context.runId,
      type: "canary.access",
      payload: { requestId, path, sourceEventId: event.eventId }
    });
  }
  return { requestId, name: "read_file", ok: true, output: read.stdout, truncated: read.truncated };
}
