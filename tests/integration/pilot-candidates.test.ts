import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeSkill } from "../../src/skill/analyzer.js";
import { loadSkill } from "../../src/skill/loader.js";
import { resolveSkillReferences } from "../../src/skill/references.js";
import { loadStudyConfig } from "../../src/study/config.js";

function gitBlobSha(content: Buffer): string {
  const header = Buffer.from(`blob ${content.length}\0`, "utf8");
  return createHash("sha1").update(header).update(content).digest("hex");
}

describe("Study 001 pilot candidates", () => {
  it("keeps every vendored skill pinned, loadable, and self-contained", async () => {
    const study = await loadStudyConfig(path.resolve("studies/study-001/study.yaml"));

    expect(study.pilot.candidates.length).toBeGreaterThanOrEqual(study.pilot.candidate_skill_count.min);
    expect(study.pilot.candidates.length).toBeLessThanOrEqual(study.pilot.candidate_skill_count.max);

    for (const candidate of study.pilot.candidates) {
      const root = path.resolve(candidate.path);
      const entrypoint = path.join(root, "SKILL.md");
      const raw = await readFile(entrypoint);
      expect(gitBlobSha(raw)).toBe(candidate.source_blob_sha);

      const skill = await loadSkill(root);
      const references = await resolveSkillReferences(skill);
      expect(references.filter((reference) => !reference.exists || reference.escapedRoot)).toEqual([]);
    }
  });

  it("recognizes Channing review instructions as declared read and process behavior", async () => {
    const skill = await loadSkill(path.resolve("studies/study-001/candidates/channing-code-reviewer"));
    const analysis = analyzeSkill(skill);
    expect(analysis.behaviorDeclarations?.file_read.length).toBeGreaterThan(0);
    expect(analysis.behaviorDeclarations?.process_execution.length).toBeGreaterThan(0);
    expect(analysis.behaviorDeclarations?.file_write).toEqual([]);
  });
});
