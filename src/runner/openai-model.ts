import OpenAI from "openai";
import type { ModelAdapter, ModelInput, ModelOutput } from "./model-adapter.js";

export const STUDY_001_MODEL = "gpt-6-sol";

type ResponseItem = Record<string, unknown>;

export class OpenAIModelAdapter implements ModelAdapter {
  private readonly client: OpenAI;
  private history: ResponseItem[] = [];
  private sentToolOutputs = new Set<string>();

  constructor(
    readonly modelId = STUDY_001_MODEL,
    apiKey = process.env.OPENAI_API_KEY
  ) {
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for real model runs");
    this.client = new OpenAI({ apiKey });
  }

  async respond(input: ModelInput): Promise<ModelOutput> {
    if (this.history.length === 0) {
      const user = input.messages.find((message) => message.role === "user");
      this.history.push({ role: "user", content: user?.content ?? "" });
    }

    for (const message of input.messages) {
      if (message.role !== "tool" || !message.callId || this.sentToolOutputs.has(message.callId)) continue;
      this.history.push({
        type: "function_call_output",
        call_id: message.callId,
        output: message.content
      });
      this.sentToolOutputs.add(message.callId);
    }

    const response = await this.client.responses.create({
      model: this.modelId,
      instructions: input.instructions,
      input: this.history as never,
      tools: input.tools.map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: true
      })) as never,
      tool_choice: "auto"
    });

    const outputItems = response.output as unknown as ResponseItem[];
    this.history.push(...outputItems);

    const toolCalls = outputItems
      .filter((item) => item.type === "function_call")
      .map((item) => {
        const raw = typeof item.arguments === "string" ? item.arguments : "{}";
        let args: unknown;
        try { args = JSON.parse(raw); } catch { args = raw; }
        return {
          callId: String(item.call_id ?? item.id ?? ""),
          name: String(item.name ?? ""),
          args
        };
      });

    return {
      responseId: response.id,
      modelId: response.model ?? this.modelId,
      text: response.output_text || undefined,
      toolCalls,
      usage: response.usage ? {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      } : undefined
    };
  }
}
