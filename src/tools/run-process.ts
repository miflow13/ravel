import type { ToolExecutionContext, ToolResult } from "./types.js";

export async function runProcessTool(
  program: string,
  args: string[],
  cwd: string,
  requestId: string,
  context: ToolExecutionContext
): Promise<ToolResult> {
  await context.recorder.append({
    runId: context.runId,
    type: "process.start",
    payload: { requestId, program, args, cwd }
  });
  const result = await context.sandbox.execProcess(program, args, cwd, context.policy.limits.processTimeoutMs);
  await context.recorder.append({
    runId: context.runId,
    type: "process.exit",
    payload: {
      requestId,
      program,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      truncated: result.truncated
    }
  });
  if (result.timedOut) return { requestId, name: "run_process", ok: false, error: "process_timeout", output: { stdout: result.stdout, stderr: result.stderr }, truncated: result.truncated };
  return {
    requestId,
    name: "run_process",
    ok: result.exitCode === 0,
    output: { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr },
    error: result.exitCode === 0 ? undefined : "process_failed",
    truncated: result.truncated
  };
}
