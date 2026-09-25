import path from "node:path";

export const WORKSPACE_ROOT = "/workspace";
export const PROTECTED_ROOT = "/protected";
export const FAKE_HOME_ROOT = "/home/ravel";

export function normalizeContainerPath(candidate: string): string {
  if (!candidate.startsWith("/")) {
    throw new Error(`Container path must be absolute: ${candidate}`);
  }
  return path.posix.resolve("/", candidate);
}

export function isWithinContainerRoot(root: string, candidate: string): boolean {
  const normalizedRoot = path.posix.resolve("/", root);
  const normalized = normalizeContainerPath(candidate);
  const relative = path.posix.relative(normalizedRoot, normalized);
  return relative === "" || (!relative.startsWith("..") && !path.posix.isAbsolute(relative));
}

export function assertWorkspacePath(candidate: string): string {
  const normalized = normalizeContainerPath(candidate);
  if (!isWithinContainerRoot(WORKSPACE_ROOT, normalized)) {
    throw new Error(`Path is outside ${WORKSPACE_ROOT}: ${candidate}`);
  }
  return normalized;
}
