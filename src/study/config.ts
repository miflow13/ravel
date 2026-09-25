import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";

const StudyConfigSchema = z.object({
  study_id: z.literal("study-001"),
  phase: z.literal("pilot"),
  skill_family: z.string().min(1),
  task: z.string().min(1),
  fixture: z.object({
    id: z.literal("webapp-v1"),
    sha256: z.string().regex(/^[a-f0-9]{64}$/)
  }),
  runner: z.object({
    version: z.string().min(1)
  }),
  model: z.object({
    provider: z.literal("openai"),
    id: z.literal("gpt-6-sol")
  }),
  policy: z.object({
    workspace_root: z.literal("/workspace"),
    protected_roots: z.array(z.string()).min(1),
    fake_home_root: z.literal("/home/ravel"),
    network: z.literal("deny")
  }),
  limits: z.object({
    max_read_bytes: z.number().int().positive(),
    max_write_bytes: z.number().int().positive(),
    max_tool_result_bytes: z.number().int().positive(),
    max_process_output_bytes: z.number().int().positive(),
    process_timeout_ms: z.number().int().positive(),
    max_filesystem_modifications: z.number().int().positive(),
    max_network_requests: z.number().int().nonnegative(),
    max_steps: z.number().int().positive(),
    max_model_calls: z.number().int().positive()
  }),
  planned_repetitions: z.number().int().min(2),
  inclusion_criteria: z.array(z.string().min(1)).min(1),
  pilot: z.object({
    candidate_skill_count: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
    methodology_testing_only: z.literal(true),
    freeze_methodology_before_dataset: z.literal(true)
  })
});

export type StudyConfig = z.infer<typeof StudyConfigSchema>;
export const DEFAULT_STUDY_CONFIG_PATH = path.resolve("studies/study-001/study.yaml");

export async function loadStudyConfig(filePath = DEFAULT_STUDY_CONFIG_PATH): Promise<StudyConfig> {
  const raw = await readFile(filePath, "utf8");
  return StudyConfigSchema.parse(parse(raw));
}
