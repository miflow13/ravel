import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { canonicalSkillPath, MAX_SKILL_FILE_BYTES } from "./loader.js";
import type { LoadedSkill, ResolvedReference } from "./types.js";

const MARKDOWN_LINK = /\[[^\]]*\]\((?!https?:\/\/|mailto:|#)([^)]+)\)/g;
const INLINE_PATH = /`((?:\.\/|\.\.\/)[^\`\n]+)`/g;

export function extractLocalReferences(markdown: string): string[] {
  const values = new Set<string>();
  for (const regex of [MARKDOWN_LINK, INLINE_PATH]) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(markdown))) {
      const value = match[1]?.trim();
      if (value) values.add(value.split("#")[0] ?? value);
    }
  }
  return [...values];
}

export async function resolveSkillReferences(skill: LoadedSkill): Promise<ResolvedReference[]> {
  const results: ResolvedReference[] = [];
  const visited = new Set<string>();
  const active = new Set<string>();

  async function walk(sourcePath: string, content: string): Promise<void> {
    const sourceDir = path.dirname(sourcePath);
    for (const raw of extractLocalReferences(content)) {
      const candidateRelative = path.relative(skill.root, path.resolve(sourceDir, raw));
      let resolvedPath = path.resolve(sourceDir, raw);
      let escapedRoot = false;
      let exists = true;
      let cyclic = false;

      try {
        resolvedPath = await canonicalSkillPath(skill.root, candidateRelative);
      } catch {
        escapedRoot = true;
        exists = false;
      }

      if (!escapedRoot) {
        try {
          const info = await stat(resolvedPath);
          if (!info.isFile()) exists = false;
          if (info.size > MAX_SKILL_FILE_BYTES) {
            throw new Error(`Referenced file exceeds MAX_SKILL_FILE_BYTES: ${raw}`);
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") exists = false;
          else throw error;
        }
      }

      if (active.has(resolvedPath)) cyclic = true;
      const source = path.relative(skill.root, sourcePath).split(path.sep).join("/") || "SKILL.md";
      const publicResolvedPath = escapedRoot
        ? raw
        : path.relative(skill.root, resolvedPath).split(path.sep).join("/");
      results.push({ source, raw, resolvedPath: publicResolvedPath, exists, escapedRoot, cyclic });

      if (!exists || escapedRoot || cyclic || visited.has(resolvedPath)) continue;
      if (!/\.(?:md|markdown|txt)$/i.test(resolvedPath)) continue;

      visited.add(resolvedPath);
      active.add(resolvedPath);
      const nested = await readFile(resolvedPath, "utf8");
      await walk(resolvedPath, nested);
      active.delete(resolvedPath);
    }
  }

  visited.add(skill.entrypoint);
  active.add(skill.entrypoint);
  await walk(skill.entrypoint, skill.markdown);
  active.delete(skill.entrypoint);
  return results;
}
