import { existsSync } from "node:fs";
import path from "node:path";
import type { LoadedSkill, StaticAnalysis } from "./types.js";
import { extractLocalReferences } from "./references.js";

const URL_RE = /https?:\/\/[^\s)<>"']+/g;
const COMMAND_RE = /(?:^|\n|\`)(npm (?:test|run [\w:-]+|install|ci)|node [^\n\`]+|python(?:3)? [^\n\`]+|pytest(?: [^\n\`]+)?|git [^\n\`]+|curl [^\n\`]+)/g;

export function analyzeSkill(skill: LoadedSkill): StaticAnalysis {
  const references = extractLocalReferences(skill.markdown);
  const urls = [...new Set(skill.markdown.match(URL_RE) ?? [])];
  const commands = new Set<string>();
  COMMAND_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COMMAND_RE.exec(skill.markdown))) {
    if (match[1]) commands.add(match[1].trim());
  }

  const scripts = references.filter((ref) => /\.(?:sh|js|mjs|cjs|ts|py)$/i.test(ref));
  const brokenReferences = references.filter((ref) => {
    const absolute = path.resolve(path.dirname(skill.entrypoint), ref);
    const relative = path.relative(skill.root, absolute);
    return relative.startsWith("..") || path.isAbsolute(relative) || !existsSync(absolute);
  });

  return {
    skillName: skill.name,
    references,
    urls,
    commands: [...commands],
    scripts,
    brokenReferences,
    declarationConfidence:
      references.length || urls.length || commands.size || Object.keys(skill.frontmatter).length
        ? "declared"
        : "indeterminate"
  };
}
