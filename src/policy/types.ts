import type { ToolRequest } from "../tools/types.js";

export interface ExecutionLimits {
  maxReadBytes: number;
  maxWriteBytes: number;
  maxToolResultBytes: number;
  maxProcessOutputBytes: number;
  processTimeoutMs: number;
  maxFilesystemModifications: number;
  maxNetworkRequests: number;
  maxSteps: number;
  maxModelCalls: number;
}

export interface PolicyConfig {
  workspaceRoot: string;
  protectedRoots: string[];
  fakeHomeRoot: string;
  network: "deny" | "allow";
  limits: ExecutionLimits;
}

export interface PolicyDecision {
  decision: "allow" | "deny";
  reason: string;
}

export type PolicyRequest = ToolRequest;
