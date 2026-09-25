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
    expect(JSON.stringify(analysis)).not.toMatch(/malicious|safe|risk score/i);
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
