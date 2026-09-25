import { z } from "zod";
import type { PolicyConfig } from "../policy/types.js";
import type { PodmanSandbox } from "../sandbox/podman.js";
import type { TraceRecorder } from "../trace/recorder.js";

export const ListFilesArgsSchema = z.object({ path: z.string().default("/workspace") });
export const ReadFileArgsSchema = z.object({ path: z.string() });
export const WriteFileArgsSchema = z.object({ path: z.string(), content: z.string() });
export const RunProcessArgsSchema = z.object({
  program: z.string(),
  args: z.array(z.string()),
  cwd: z.string()
});
export const RequestUrlArgsSchema = z.object({ url: z.string() });
export const FinishArgsSchema = z.object({ summary: z.string().optional() });

export type ToolRequest =
  | { requestId: string; name: "list_files"; args: z.infer<typeof ListFilesArgsSchema> }
  | { requestId: string; name: "read_file"; args: z.infer<typeof ReadFileArgsSchema> }
  | { requestId: string; name: "write_file"; args: z.infer<typeof WriteFileArgsSchema> }
  | { requestId: string; name: "run_process"; args: z.infer<typeof RunProcessArgsSchema> }
  | { requestId: string; name: "request_url"; args: z.infer<typeof RequestUrlArgsSchema> }
  | { requestId: string; name: "finish"; args: z.infer<typeof FinishArgsSchema> };

export interface ToolResult {
  requestId: string;
  name: ToolRequest["name"];
  ok: boolean;
  output?: unknown;
  error?: string;
  truncated?: boolean;
}

export interface ToolExecutionContext {
  runId: string;
  sandbox: PodmanSandbox;
  recorder: TraceRecorder;
  policy: PolicyConfig;
  canaryPaths: string[];
}

export interface ToolDefinition {
  type: "function";
  name: ToolRequest["name"];
  description: string;
  parameters: Record<string, unknown>;
}
