import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Command } from "commander";
import { runExperiment } from "../experiment/controller.js";
import { verifyFrozenFixture } from "../experiment/fixture.js";
import { OpenAIModelAdapter, STUDY_001_MODEL } from "../runner/openai-model.js";
import { RavelRunner } from "../runner/loop.js";
import type { ModelAdapter } from "../runner/model-adapter.js";
import { isPodmanAvailable } from "../sandbox/podman.js";
import { loadSkill } from "../skill/loader.js";
import { resolveSkillReferences } from "../skill/references.js";
import { loadStudyConfig } from "../study/config.js";

export interface RunCommandDependencies {
  createModel?: () => ModelAdapter;
  fixtureDir?: string;
  runsDir?: string;
  requireApiKey?: boolean;
  studyConfigPath?: string;
}

export async function preflightStudyRun(
  skillPath: string,
  fixtureDir: string,
  requireApiKey = true,
  studyConfigPath?: string
): Promise<void> {
  const study=await loadStudyConfig(studyConfigPath);
  const skill=await loadSkill(skillPath);
  const refs=await resolveSkillReferences(skill);
  if(refs.some((ref)=>!ref.exists||ref.escapedRoot)) throw new Error("Skill preflight failed: unresolved or escaping reference");
  if(!(await isPodmanAvailable())) throw new Error("Rootless Podman is required");
  const fixture=await verifyFrozenFixture(fixtureDir);
  if(!fixture.valid) throw new Error(`Study fixture integrity failed: ${fixture.problems.join(", ")}`);
  if(fixture.id!==study.fixture.id || fixture.sha256!==study.fixture.sha256) {
    throw new Error("Study fixture hash does not match the frozen Study 001 configuration");
  }
  if(study.model.id!==STUDY_001_MODEL) throw new Error("Study model configuration does not match the pinned Ravel model");
  if(requireApiKey && !process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for real model runs");
}

export function registerRunCommand(program: Command, deps: RunCommandDependencies = {}): void {
  program
    .command("run")
    .argument("<skill>", "Path to a skill directory")
    .description("Run one controlled Ravel experiment")
    .action(async (skillPath: string) => {
      const fixtureDir=path.resolve(deps.fixtureDir ?? "fixtures/webapp-v1");
      const absoluteSkill=path.resolve(skillPath);
      const study=await loadStudyConfig(deps.studyConfigPath);
      await preflightStudyRun(absoluteSkill,fixtureDir,deps.requireApiKey ?? true,deps.studyConfigPath);

      const model=(deps.createModel ?? (()=>new OpenAIModelAdapter(STUDY_001_MODEL)))();
      const runner=new RavelRunner(model,study.runner.version);
      const runId=`ravel-${randomUUID().slice(0,12)}`;
      const result=await runExperiment({
        runId,
        skillDir:absoluteSkill,
        fixtureDir,
        fixtureId:study.fixture.id,
        runsDir:path.resolve(deps.runsDir ?? "runs"),
        task:study.task,
        runnerVersion:study.runner.version,
        modelProvider:"openai",
        modelId:study.model.id,
        canaryPaths:["/workspace/CANARY.txt"]
      },runner);

      process.stdout.write(`${result.paths.root}\n`);
      if(!result.status.completed) process.exitCode=2;
    });
}
