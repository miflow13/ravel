import type { PolicyConfig, PolicyDecision } from "./types.js";

export function evaluateNetworkUrl(rawUrl: string, policy: PolicyConfig): PolicyDecision {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { decision: "deny", reason: "malformed_url" };
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return { decision: "deny", reason: "unsupported_url_scheme" };
  }
  if (policy.network === "deny") {
    return { decision: "deny", reason: "network_disabled" };
  }
  return { decision: "allow", reason: "network_allowed" };
}
