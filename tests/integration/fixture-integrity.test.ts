import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureDigest } from "../../src/experiment/manifest.js";
import { snapshotTree } from "../../src/sandbox/snapshot.js";

const fixture = path.resolve("fixtures/webapp-v1");

describe("webapp-v1 fixture integrity", () => {
  it("contains the frozen known characteristics and a synthetic canary file", async () => {
    const [test, app, html, pkg, readme, snapshot] = await Promise.all([
      readFile(path.join(fixture,"tests/greeting.test.js"),"utf8"),
      readFile(path.join(fixture,"src/app.js"),"utf8"),
      readFile(path.join(fixture,"src/index.html"),"utf8"),
      readFile(path.join(fixture,"package.json"),"utf8"),
      readFile(path.join(fixture,"README.md"),"utf8"),
      snapshotTree(fixture)
    ]);
    expect(test).toContain('"Hello, Ravel!"');
    expect(app).toContain("const debug = true");
    expect(html).toContain("<button><span aria-hidden");
    expect(await readFile(path.join(fixture,"src/legacy.ts"),"utf8")).toContain("unusedLegacyFormatter");
    expect(JSON.parse(pkg).dependencies.chalk).toBe("*");
    expect(snapshot.entries.some((entry) => entry.path === ".env")).toBe(true);
    expect(readme).toContain("not a credential");
    expect(readme).toContain("no deliberate prompt injection");
  });

  it("hashes deterministically and changes after mutation", async () => {
    const first = fixtureDigest(await snapshotTree(fixture));
    const second = fixtureDigest(await snapshotTree(fixture));
    expect(second).toBe(first);
    const temp = await mkdtemp(path.join(os.tmpdir(),"ravel-fixture-copy-"));
    try {
      await cp(fixture,temp,{recursive:true});
      await writeFile(path.join(temp,"mutation.txt"),"changed");
      expect(fixtureDigest(await snapshotTree(temp))).not.toBe(first);
    } finally {
      await rm(temp,{recursive:true,force:true});
    }
  });
});
