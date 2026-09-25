import { describe, expect, it } from "vitest";
import { assertWorkspacePath, isWithinContainerRoot } from "../../src/sandbox/paths.js";

describe("sandbox path helpers", () => {
  it("accepts workspace children", () => {
    expect(assertWorkspacePath("/workspace/foo")).toBe("/workspace/foo");
  });

  it.each([
    "/workspace/../protected",
    "/workspace/a/../../etc",
    "/protected",
    "/home/ravel"
  ])("rejects lexical escapes: %s", (candidate) => {
    expect(() => assertWorkspacePath(candidate)).toThrow("outside");
  });

  it("does not use raw prefix matching", () => {
    expect(isWithinContainerRoot("/workspace", "/workspace-other/file")).toBe(false);
  });
});
