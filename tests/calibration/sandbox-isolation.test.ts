import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSandbox, isPodmanAvailable } from "../../src/sandbox/podman.js";

describe("sandbox isolation", () => {
  it("does not expose an arbitrary host-only marker", async (context) => {
    if(!(await isPodmanAvailable())) { context.skip("Podman unavailable or not rootless"); return; }
    const root=await mkdtemp(path.join(os.tmpdir(),"ravel-host-marker-"));
    const marker=path.join(root,"marker.txt");
    await writeFile(marker,"HOST_ONLY_MARKER");
    const sandbox=await createSandbox();
    try {
      const result=await sandbox.execProcess("cat",[marker],"/workspace",5_000);
      expect(result.exitCode).not.toBe(0);
    } finally {
      await sandbox.destroy();
      await rm(root,{recursive:true,force:true});
    }
  });
});
