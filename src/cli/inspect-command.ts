import type { Command } from "commander";
import { analyzeSkill } from "../skill/analyzer.js";
import { loadSkill } from "../skill/loader.js";
import { resolveSkillReferences } from "../skill/references.js";

export function registerInspectCommand(program: Command): void {
  program
    .command("inspect")
    .argument("<skill>", "Path to a SKILL.md directory")
    .description("Conservatively inspect a skill without executing it")
    .action(async (skillPath: string) => {
      const skill = await loadSkill(skillPath);
      const analysis = analyzeSkill(skill);
      const resolvedReferences = await resolveSkillReferences(skill);
      const output = {
        ...analysis,
        resolvedReferences
      };
      process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
      if (resolvedReferences.some((ref) => !ref.exists || ref.escapedRoot)) {
        process.exitCode = 2;
      }
    });
}
