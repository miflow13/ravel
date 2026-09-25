import { evaluateFilesystemPath } from "./filesystem-policy.js";
import { evaluateNetworkUrl } from "./network-policy.js";
import type { PolicyConfig, PolicyDecision } from "./types.js";
import type { ToolRequest } from "../tools/types.js";

const SHELL_PROGRAMS = new Set(["sh", "bash", "dash", "zsh", "fish", "pwsh", "powershell", "cmd", "cmd.exe"]);

export function evaluateToolRequest(request: ToolRequest, policy: PolicyConfig): PolicyDecision {
  switch (request.name) {
    case "list_files":
    case "read_file":
    case "write_file":
      return evaluateFilesystemPath(request.args.path, policy);
    case "request_url":
      return evaluateNetworkUrl(request.args.url, policy);
    case "run_process": {
      if (!request.args.program.trim()) return { decision: "deny", reason: "empty_program" };
      const base = request.args.program.split("/").at(-1)?.toLowerCase() ?? request.args.program.toLowerCase();
      if (SHELL_PROGRAMS.has(base)) return { decision: "deny", reason: "unrestricted_shell_denied" };
      return evaluateFilesystemPath(request.args.cwd, policy);
    }
    case "finish":
      return { decision: "allow", reason: "finish_allowed" };
  }
}
