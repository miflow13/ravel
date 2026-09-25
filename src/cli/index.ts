#!/usr/bin/env node
import { Command } from "commander";

export function createProgram(): Command {
  return new Command()
    .name("ravel")
    .description("Declared-vs-observed agent skill research instrument")
    .version("0.1.0");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createProgram().parseAsync(process.argv).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
