import { existsSync } from "node:fs";
import path from "node:path";
import type { LoadedSkill, StaticAnalysis } from "./types.js";
import { extractLocalReferences } from "./references.js";

const URL_RE = /https?:\/\/[^\s)<>"']+/g;
const COMMAND_RE = /(?:^|\n|\`)(npm (?:test|run [\w:-]+|install|ci)|node [^\n\`]+|python(?:3)? [^\n\`]+|pytest(?: [^\n\`]+)?|git [^\n\`]+|curl [^\n\`]+)/g;
const NEGATED_BEHAVIOR_RE = /\b(?:do not|don't|never|must not|without)\b/i;

function semanticBehaviorDeclarations(markdown: string) {
  const declarations = {
    file_read: [] as string[],
    file_write: [] as string[],
    process_execution: [] as string[],
    network_request: [] as string[]
  };
  const lines = markdown.split("\n").map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const evidence = line.replace(/^[-*#>\d.()\s]+/, "").trim();
    if (!evidence || NEGATED_BEHAVIOR_RE.test(evidence)) continue;

    if (
      /\b(?:read|inspect|review|check|search|open|examine|trace)\b.*\b(?:file|files|code|diff|repository|repo|target|caller|callers|contract|contracts|test|tests|usage|usages|path|paths|surface)\b/i.test(evidence) ||
      /\bsearch\s+(?:the\s+)?whole\s+repo(?:sitory)?\b/i.test(evidence)
    ) declarations.file_read.push(evidence);

    if (
      /\b(?:write|modify|edit|change|create|persist|commit|push|fix)\b.*\b(?:file|files|code|report|artifact|changes?|commit|branch)\b/i.test(evidence)
    ) declarations.file_write.push(evidence);

    if (
      /\b(?:run|execute|invoke)\b.*\b(?:test|tests|check|command|script|repl|build|lint|duplicate|tool)\b/i.test(evidence) ||
      /\b(?:failing test|REPL snippet|concrete reproduction)\b/i.test(evidence)
    ) declarations.process_execution.push(evidence);

    if (
      /\b(?:fetch|request|download|connect|pull)\b.*\b(?:url|http|remote|network|api|pull request|pr|diff)\b/i.test(evidence)
    ) declarations.network_request.push(evidence);
  }

  return Object.fromEntries(
    Object.entries(declarations).map(([key, values]) => [key, [...new Set(values)]])
  ) as typeof declarations;
}

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
  const behaviorDeclarations = semanticBehaviorDeclarations(skill.markdown);
  behaviorDeclarations.file_read.push(...references.map((ref) => `Referenced local file: ${ref}`));
  behaviorDeclarations.process_execution.push(...[...commands].map((command) => `Explicit command: ${command}`));
  behaviorDeclarations.network_request.push(...urls.map((url) => `Explicit URL: ${url}`));
  for (const key of Object.keys(behaviorDeclarations) as Array<keyof typeof behaviorDeclarations>) {
    behaviorDeclarations[key] = [...new Set(behaviorDeclarations[key])];
  }
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
    behaviorDeclarations,
    declarationConfidence:
      Object.values(behaviorDeclarations).some((values) => values.length > 0) ||
      Object.keys(skill.frontmatter).length
        ? "declared"
        : "indeterminate"
  };
}
