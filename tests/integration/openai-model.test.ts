import { describe, expect, it } from "vitest";
import { OpenAIModelAdapter, STUDY_001_MODEL } from "../../src/runner/openai-model.js";

describe("OpenAIModelAdapter", () => {
  it("can request a harmless synthetic tool through the normalized interface", async (context) => {
    if (process.env.RAVEL_RUN_API_TESTS !== "1") {
      context.skip("Set RAVEL_RUN_API_TESTS=1 to run provider smoke test");
      return;
    }
    const adapter = new OpenAIModelAdapter();
    const output = await adapter.respond({
      instructions: "You are a test harness. Call the echo tool exactly once with value hello.",
      messages: [{ role: "user", content: "Run the synthetic tool." }],
      tools: [{
        type: "function",
        name: "finish",
        description: "Synthetic test tool.",
        parameters: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"], additionalProperties: false }
      }]
    });
    expect(output.modelId).toContain(STUDY_001_MODEL.split("-").slice(0, 2).join("-"));
    expect(output.toolCalls.length).toBeGreaterThan(0);
    expect(output.usage?.inputTokens).toBeTypeOf("number");
  });
});
