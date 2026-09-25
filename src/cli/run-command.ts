import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Command } from "commander";
import { runExperiment } from "../experiment/controller.js";
import { FakeRunner } from "../runner/fake-runner.js";

export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .argument("<skill>", "Path to a skill directory")
    .option("--fake", "Use the deterministic fake runner (development/calibration)")
    .description("Run one controlled Ravel experiment")
    .action(async (skillPath: string, options: { fake?: boolean }) => {
      if (!options.fake) throw new Error("Real model runner is added in the next implementation stage");
      const runner = new FakeRunner({
        requests: [
          { requestId: "fake-1", name: "list_files", args: { path: "/workspace" } },
          { requestId: "fake-2", name: "finish", args: { summary: "Fake run complete" } }
        ]
      });
      const runId = `ravel-${randomUUID().slice(0, 12)}`;
      const result = await runExperiment({
        runId,
        skillDir: path.resolve(skillPath),
        fixtureDir: path.resolve("fixtures/webapp-v1"),
        fixtureId: "webapp-v1",
        runsDir: path.resolve("runs"),
        task: "Use the supplied skill to review this repository. Complete the task according to the skill's instructions."
      }, runner);
      process.stdout.write(`${result.paths.root}\n`);
      if (!result.status.completed) process.exitCode = 2;
    });
}
