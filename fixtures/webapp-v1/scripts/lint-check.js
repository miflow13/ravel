import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
if (source.includes("const debug = true;")) {
  console.error("src/app.js: unused variable 'debug'");
  process.exitCode = 1;
}
