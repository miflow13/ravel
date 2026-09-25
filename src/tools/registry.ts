import { evaluateToolRequest } from "../policy/engine.js";
import type { ToolExecutionContext, ToolDefinition, ToolRequest, ToolResult } from "./types.js";
import {
  FinishArgsSchema,
  ListFilesArgsSchema,
  ReadFileArgsSchema,
  RequestUrlArgsSchema,
  RunProcessArgsSchema,
  WriteFileArgsSchema
} from "./types.js";
import { listFiles } from "./list-files.js";
import { readFileTool } from "./read-file.js";
import { writeFileTool } from "./write-file.js";
import { runProcessTool } from "./run-process.js";
import { requestUrlTool } from "./request-url.js";
import { finishTool } from "./finish.js";

const schemas = {
  list_files: ListFilesArgsSchema,
  read_file: ReadFileArgsSchema,
  write_file: WriteFileArgsSchema,
  run_process: RunProcessArgsSchema,
  request_url: RequestUrlArgsSchema,
  finish: FinishArgsSchema
} as const;

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { type: "function", name: "list_files", description: "List files under a workspace directory.", parameters: { type: "object", properties: { path: { type: "string" } } } },
  { type: "function", name: "read_file", description: "Read a bounded text file inside /workspace.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false } },
  { type: "function", name: "write_file", description: "Write bounded text inside /workspace.", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"], additionalProperties: false } },
  { type: "function", name: "run_process", description: "Run one structured process without shell interpolation.", parameters: { type: "object", properties: { program: { type: "string" }, args: { type: "array", items: { type: "string" } }, cwd: { type: "string" } }, required: ["program", "args", "cwd"], additionalProperties: false } },
  { type: "function", name: "request_url", description: "Request an HTTP(S) URL if policy permits it.", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false } },
  { type: "function", name: "finish", description: "Finish the experiment task.", parameters: { type: "object", properties: { summary: { type: "string" } }, additionalProperties: false } }
];

export class ToolRegistry {
  definitions(): ToolDefinition[] {
    return TOOL_DEFINITIONS;
  }

  parseRequest(requestId: string, name: string, rawArgs: unknown): ToolRequest {
    if (!(name in schemas)) throw new Error(`Unsupported tool: ${name}`);
    const schema = schemas[name as keyof typeof schemas];
    const parsed = schema.parse(rawArgs);
    return { requestId, name, args: parsed } as ToolRequest;
  }

  async execute(request: ToolRequest, context: ToolExecutionContext): Promise<ToolResult> {
    await context.recorder.append({
      runId: context.runId,
      type: "tool.request",
      payload: { requestId: request.requestId, name: request.name, args: request.args }
    });

    let normalized = request;
    try {
      if (request.name === "list_files" || request.name === "read_file") {
        const path = await context.sandbox.resolvePath(request.args.path, false);
        normalized = { ...request, args: { ...request.args, path } } as ToolRequest;
      } else if (request.name === "write_file") {
        const path = await context.sandbox.resolvePath(request.args.path, true);
        normalized = { ...request, args: { ...request.args, path } } as ToolRequest;
      } else if (request.name === "run_process") {
        const cwd = await context.sandbox.resolvePath(request.args.cwd, false);
        normalized = { ...request, args: { ...request.args, cwd } } as ToolRequest;
      }
    } catch {
      const result: ToolResult = { requestId: request.requestId, name: request.name, ok: false, error: "invalid_path" };
      await context.recorder.append({ runId: context.runId, type: "tool.denied", payload: { requestId: request.requestId, reason: "invalid_path" } });
      await context.recorder.append({ runId: context.runId, type: "tool.result", payload: result });
      return result;
    }

    const decision = evaluateToolRequest(normalized, context.policy);
    await context.recorder.append({
      runId: context.runId,
      type: decision.decision === "allow" ? "tool.allowed" : "tool.denied",
      payload: { requestId: request.requestId, reason: decision.reason }
    });

    if (decision.decision === "deny") {
      if (request.name === "request_url") {
        await context.recorder.append({ runId: context.runId, type: "network.request", payload: { requestId: request.requestId, url: request.args.url, decision: "denied" } });
      }
      const denied: ToolResult = { requestId: request.requestId, name: request.name, ok: false, error: decision.reason };
      await context.recorder.append({ runId: context.runId, type: "tool.result", payload: denied });
      return denied;
    }

    let result: ToolResult;
    switch (normalized.name) {
      case "list_files": result = await listFiles(normalized.args.path, normalized.requestId, context); break;
      case "read_file": result = await readFileTool(normalized.args.path, normalized.requestId, context); break;
      case "write_file": result = await writeFileTool(normalized.args.path, normalized.args.content, normalized.requestId, context); break;
      case "run_process": result = await runProcessTool(normalized.args.program, normalized.args.args, normalized.args.cwd, normalized.requestId, context); break;
      case "request_url": result = await requestUrlTool(normalized.args.url, normalized.requestId, context); break;
      case "finish": result = finishTool(normalized.args.summary, normalized.requestId); break;
    }
    await context.recorder.append({ runId: context.runId, type: "tool.result", payload: result });
    return result;
  }
}
