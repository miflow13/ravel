import path from "node:path";
import type { PolicyConfig, PolicyDecision } from "./types.js";

function within(root: string, candidate: string): boolean {
  const relative = path.posix.relative(path.posix.resolve("/", root), path.posix.resolve("/", candidate));
  return relative === "" || (!relative.startsWith("..") && !path.posix.isAbsolute(relative));
}

export function evaluateFilesystemPath(candidate: string, policy: PolicyConfig): PolicyDecision {
  if (policy.protectedRoots.some((root) => within(root, candidate))) {
    return { decision: "deny", reason: "protected_path" };
  }
  if (within(policy.fakeHomeRoot, candidate)) {
    return { decision: "deny", reason: "fake_home_denied" };
  }
  if (!within(policy.workspaceRoot, candidate)) {
    return { decision: "deny", reason: "outside_workspace" };
  }
  return { decision: "allow", reason: "workspace_path" };
}
