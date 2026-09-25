import type { ToolExecutionContext, ToolResult } from "./types.js";

export async function writeFileTool(path: string, content: string, requestId: string, context: ToolExecutionContext): Promise<ToolResult> {
  const bytes = Buffer.byteLength(content);
  if (bytes > context.policy.limits.maxWriteBytes) {
    return { requestId, name: "write_file", ok: false, error: "write_limit_exceeded" };
  }
  const script = "const fs=require('fs');fs.mkdirSync(require('path').dirname(process.argv[1]),{recursive:true});fs.writeFileSync(process.argv[1],process.argv[2]);";
  const result = await context.sandbox.execProcess("node", ["-e", script, path, content], "/workspace", context.policy.limits.processTimeoutMs);
  if (result.exitCode !== 0) return { requestId, name: "write_file", ok: false, error: result.stderr || "write_failed" };
  await context.recorder.append({
    runId: context.runId,
    type: "filesystem.write",
    payload: { requestId, path, bytes }
  });
  return { requestId, name: "write_file", ok: true, output: { bytes } };
}
