import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadSkill, MAX_SKILL_FILE_BYTES } from "../../src/skill/loader.js";
import { resolveSkillReferences } from "../../src/skill/references.js";

const roots: string[] = [];
async function tempSkill(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "ravel-skill-"));
  roots.push(root);
  return root;
}
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("skill loading", () => {
  it("loads a valid SKILL.md", async () => {
    const root = await tempSkill();
    await writeFile(path.join(root, "SKILL.md"), "---\nname: demo\n---\nHello");
    const skill = await loadSkill(root);
    expect(skill.name).toBe("demo");
    expect(skill.markdown).toContain("Hello");
  });

  it("rejects a missing entrypoint", async () => {
    const root = await tempSkill();
    await expect(loadSkill(root)).rejects.toThrow("Missing SKILL.md");
  });

  it("surfaces invalid frontmatter", async () => {
    const root = await tempSkill();
    await writeFile(path.join(root, "SKILL.md"), "---\n: bad: [\n---\n");
    await expect(loadSkill(root)).rejects.toThrow();
  });

  it("records a missing reference", async () => {
    const root = await tempSkill();
    await writeFile(path.join(root, "SKILL.md"), "[missing](references/nope.md)");
    const refs = await resolveSkillReferences(await loadSkill(root));
    expect(refs[0]?.exists).toBe(false);
  });

  it("rejects traversal and symlink escapes", async () => {
    const outer = await tempSkill();
    const root = path.join(outer, "skill");
    await mkdir(root);
    await writeFile(path.join(outer, "secret.md"), "secret");
    await symlink(path.join(outer, "secret.md"), path.join(root, "escape.md"));
    await writeFile(path.join(root, "SKILL.md"), "[up](../secret.md) [link](escape.md)");
    const refs = await resolveSkillReferences(await loadSkill(root));
    expect(refs.every((ref) => ref.escapedRoot)).toBe(true);
  });

  it("terminates cyclic references", async () => {
    const root = await tempSkill();
    await writeFile(path.join(root, "SKILL.md"), "[a](a.md)");
    await writeFile(path.join(root, "a.md"), "[entry](SKILL.md)");
    const refs = await resolveSkillReferences(await loadSkill(root));
    expect(refs.some((ref) => ref.cyclic)).toBe(true);
    expect(refs.length).toBeLessThan(5);
  });

  it("rejects oversized referenced input", async () => {
    const root = await tempSkill();
    await writeFile(path.join(root, "SKILL.md"), "[big](big.md)");
    await writeFile(path.join(root, "big.md"), "x".repeat(MAX_SKILL_FILE_BYTES + 1));
    await expect(resolveSkillReferences(await loadSkill(root))).rejects.toThrow("MAX_SKILL_FILE_BYTES");
  });
});
