#!/usr/bin/env node
import { Command } from "commander";
import { registerInspectCommand } from "./inspect-command.js";

export function createProgram(): Command {
  const program = new Command()
    .name("ravel")
    .description("Declared-vs-observed agent skill research instrument")
    .version("0.1.0");
  registerInspectCommand(program);
  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createProgram().parseAsync(process.argv).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
