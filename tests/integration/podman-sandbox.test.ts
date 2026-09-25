import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { containerExists, createSandbox, isPodmanAvailable } from "../../src/sandbox/podman.js";
import { diffSnapshots, snapshotTree } from "../../src/sandbox/snapshot.js";

describe("Podman sandbox", () => {
  it("isolates the workspace and destroys the container", async (context) => {
    if (!(await isPodmanAvailable())) {
      context.skip("Podman unavailable or not rootless");
      return;
    }
    const temp = await mkdtemp(path.join(os.tmpdir(), "ravel-podman-"));
    const fixture = path.join(temp, "fixture.txt");
    const hostOnly = path.join(temp, "host-only.txt");
    await writeFile(fixture, "fixture");
    await writeFile(hostOnly, "host secret");
    const sandbox = await createSandbox();
    try {
      await sandbox.copyIn(fixture, "/workspace/fixture.txt");
      const read = await sandbox.execProcess("cat", ["fixture.txt"]);
      expect(read.stdout).toBe("fixture");
      const leaked = await sandbox.execProcess("cat", [hostOnly]);
      expect(leaked.exitCode).not.toBe(0);
      const git = await sandbox.execProcess("git", ["--version"]);
      expect(git.exitCode).toBe(0);
      expect(git.stdout).toMatch(/^git version /);
    } finally {
      const id = sandbox.containerId;
      await sandbox.destroy();
      expect(await containerExists(id)).toBe(false);
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("snapshots and diffs created, modified and deleted files", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "ravel-snapshot-"));
    try {
      await writeFile(path.join(temp, "a.txt"), "a");
      await writeFile(path.join(temp, "gone.txt"), "gone");
      const before = await snapshotTree(temp);
      await writeFile(path.join(temp, "a.txt"), "changed");
      await rm(path.join(temp, "gone.txt"));
      await writeFile(path.join(temp, "new.txt"), "new");
      const after = await snapshotTree(temp);
      expect(diffSnapshots(before, after)).toEqual({
        created: ["new.txt"],
        modified: ["a.txt"],
        deleted: ["gone.txt"]
      });
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});
