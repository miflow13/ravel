import type { ToolDefinition } from "../tools/types.js";

export interface RunnerMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  callId?: string;
  name?: string;
}

export interface ModelInput {
  instructions: string;
  messages: RunnerMessage[];
  tools: ToolDefinition[];
}

export interface ModelToolCall {
  callId: string;
  name: string;
  args: unknown;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ModelOutput {
  responseId?: string;
  modelId: string;
  text?: string;
  toolCalls: ModelToolCall[];
  usage?: ModelUsage;
}

export interface ModelAdapter {
  respond(input: ModelInput): Promise<ModelOutput>;
}
