import { describe, expect, it } from "vitest";
import { runVerification } from "../../src/cli/verify-command.js";
import { isPodmanAvailable } from "../../src/sandbox/podman.js";

describe("ravel verify", () => {
  it("passes every mandatory deterministic calibration", async (context) => {
    if(!(await isPodmanAvailable())) { context.skip("Podman unavailable or not rootless"); return; }
    const report=await runVerification();
    expect(report.passed).toBe(true);
    expect(report.checks.every((check)=>check.passed)).toBe(true);
    expect(report.checks.map((check)=>check.name)).toEqual(expect.arrayContaining([
      "filesystem events","process events","denied actions","canary detection","trace integrity","report consistency","sandbox isolation"
    ]));
  });
});
