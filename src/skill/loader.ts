import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { LoadedSkill } from "./types.js";

export const MAX_SKILL_FILE_BYTES = 1_048_576;

export async function canonicalSkillPath(root: string, candidate: string): Promise<string> {
  const canonicalRoot = await realpath(root);
  const absolute = path.resolve(canonicalRoot, candidate);
  const relative = path.relative(canonicalRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Skill reference escapes skill root: ${candidate}`);
  }
  try {
    const canonical = await realpath(absolute);
    const canonicalRelative = path.relative(canonicalRoot, canonical);
    if (canonicalRelative.startsWith("..") || path.isAbsolute(canonicalRelative)) {
      throw new Error(`Skill reference resolves outside skill root: ${candidate}`);
    }
    return canonical;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return absolute;
    throw error;
  }
}

export async function readBoundedText(filePath: string): Promise<string> {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error(`Expected regular file: ${filePath}`);
  if (info.size > MAX_SKILL_FILE_BYTES) {
    throw new Error(`Skill input exceeds MAX_SKILL_FILE_BYTES (${MAX_SKILL_FILE_BYTES})`);
  }
  return readFile(filePath, "utf8");
}

export async function loadSkill(skillDir: string): Promise<LoadedSkill> {
  const root = await realpath(skillDir);
  const entrypoint = await canonicalSkillPath(root, "SKILL.md");
  let source: string;
  try {
    source = await readBoundedText(entrypoint);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Missing SKILL.md in ${root}`);
    }
    throw error;
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(source);
  } catch (error) {
    throw new Error(`Invalid SKILL.md frontmatter: ${error instanceof Error ? error.message : String(error)}`);
  }

  const name = typeof parsed.data.name === "string" ? parsed.data.name : null;
  return {
    root,
    entrypoint,
    name,
    frontmatter: parsed.data as Record<string, unknown>,
    markdown: parsed.content
  };
}
