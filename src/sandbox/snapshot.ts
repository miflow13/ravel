import { createHash } from "node:crypto";
import { lstat, readdir, readFile, readlink } from "node:fs/promises";
import path from "node:path";

export interface FilesystemSnapshotEntry {
  path: string;
  type: "file" | "directory" | "symlink";
  size: number;
  sha256?: string;
  target?: string;
}

export interface FilesystemSnapshot {
  root: string;
  entries: FilesystemSnapshotEntry[];
}

export interface FilesystemDelta {
  created: string[];
  modified: string[];
  deleted: string[];
}

function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export async function snapshotTree(root: string): Promise<FilesystemSnapshot> {
  const absoluteRoot = path.resolve(root);
  const entries: FilesystemSnapshotEntry[] = [];

  async function walk(current: string): Promise<void> {
    const children = await readdir(current, { withFileTypes: true });
    children.sort((a, b) => compareNames(a.name, b.name));
    for (const child of children) {
      const absolute = path.join(current, child.name);
      const relative = path.relative(absoluteRoot, absolute).split(path.sep).join("/");
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) {
        entries.push({ path: relative, type: "symlink", size: info.size, target: await readlink(absolute) });
      } else if (info.isDirectory()) {
        entries.push({ path: relative, type: "directory", size: 0 });
        await walk(absolute);
      } else if (info.isFile()) {
        const content = await readFile(absolute);
        entries.push({
          path: relative,
          type: "file",
          size: content.length,
          sha256: createHash("sha256").update(content).digest("hex")
        });
      }
    }
  }

  await walk(absoluteRoot);
  return { root: absoluteRoot, entries };
}

export function diffSnapshots(before: FilesystemSnapshot, after: FilesystemSnapshot): FilesystemDelta {
  const left = new Map(before.entries.map((entry) => [entry.path, entry]));
  const right = new Map(after.entries.map((entry) => [entry.path, entry]));
  const created = [...right.keys()].filter((key) => !left.has(key));
  const deleted = [...left.keys()].filter((key) => !right.has(key));
  const modified = [...right.keys()].filter((key) => {
    const a = left.get(key);
    const b = right.get(key);
    return Boolean(a && b && (a.type !== b.type || a.size !== b.size || a.sha256 !== b.sha256 || a.target !== b.target));
  });
  return {
    created: created.sort(compareNames),
    modified: modified.sort(compareNames),
    deleted: deleted.sort(compareNames)
  };
}
