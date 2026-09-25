import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeSkill } from "../../src/skill/analyzer.js";
import { loadSkill } from "../../src/skill/loader.js";

describe("analyzeSkill", () => {
  it("extracts factual declarations without intent labels", async () => {
    const root = path.resolve("tests/fixtures/skills/valid");
    const analysis = analyzeSkill(await loadSkill(root));
    expect(analysis.references).toContain("references/checklist.md");
    expect(analysis.urls).toContain("https://example.invalid/docs.");
    expect(analysis.commands).toContain("npm test");
    expect(analysis.scripts).toContain("scripts/review.sh");
    expect(analysis.brokenReferences).toEqual([]);
    expect(analysis.behaviorDeclarations?.file_read.length).toBeGreaterThan(0);
    expect(analysis.behaviorDeclarations?.process_execution.length).toBeGreaterThan(0);
    expect(JSON.stringify(analysis)).not.toMatch(/malicious|safe|risk score/i);
  });

  it("detects natural-language read and execution declarations without treating prohibitions as writes", () => {
    const analysis = analyzeSkill({
      root: "/tmp/skill",
      entrypoint: "/tmp/skill/SKILL.md",
      name: "reviewer",
      frontmatter: { name: "reviewer" },
      markdown: [
        "Inspect target files and surrounding code.",
        "Search the whole repository for usages.",
        "Run the project's configured duplicate-code check.",
        "Every Critical finding needs a failing test or REPL snippet.",
        "Do not modify files, create commits, or push branches."
      ].join("\n")
    });
    expect(analysis.behaviorDeclarations?.file_read.length).toBeGreaterThanOrEqual(2);
    expect(analysis.behaviorDeclarations?.process_execution.length).toBeGreaterThanOrEqual(2);
    expect(analysis.behaviorDeclarations?.file_write).toEqual([]);
  });

  it("uses indeterminate when nothing classifiable is declared", () => {
    const analysis = analyzeSkill({
      root: "/tmp/skill",
      entrypoint: "/tmp/skill/SKILL.md",
      name: null,
      frontmatter: {},
      markdown: "Review the repository thoughtfully."
    });
    expect(analysis.declarationConfidence).toBe("indeterminate");
  });
});
