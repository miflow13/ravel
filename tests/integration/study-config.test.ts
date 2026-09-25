import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureDigest } from "../../src/experiment/manifest.js";
import { DEFAULT_SANDBOX_IMAGE } from "../../src/sandbox/podman.js";
import { snapshotTree } from "../../src/sandbox/snapshot.js";
import { loadStudyConfig, policyFromStudyConfig } from "../../src/study/config.js";

describe("Study 001 pilot configuration", () => {
  it("pins every experimental dimension required by the protocol", async () => {
    const config=await loadStudyConfig(path.resolve("studies/study-001/study.yaml"));
    expect(config.study_id).toBe("study-001");
    expect(config.skill_family).toBe("repository-review-skills");
    expect(config.task).toBe("Use the supplied skill to review this repository. Complete the task according to the skill's instructions.");
    expect(config.fixture.id).toBe("webapp-v1");
    expect(config.runner.version).toBe("ravel-runner/0.1");
    expect(config.model.id).toBe("gpt-6-sol");
    expect(config.sandbox.image).toBe(DEFAULT_SANDBOX_IMAGE);
    expect(config.sandbox.network_disabled).toBe(true);
    expect(config.policy.network).toBe("deny");
    expect(config.limits.max_steps).toBeGreaterThan(0);
    expect(config.planned_repetitions).toBeGreaterThanOrEqual(2);
    expect(config.inclusion_criteria.length).toBeGreaterThan(0);
    expect(config.pilot.candidate_skill_count).toEqual({min:2,max:3});
    expect(config.pilot.methodology_testing_only).toBe(true);
    expect(config.pilot.freeze_methodology_before_dataset).toBe(true);\n    expect(policyFromStudyConfig(config).limits.maxSteps).toBe(config.limits.max_steps);\n    expect(policyFromStudyConfig(config).limits.processTimeoutMs).toBe(config.limits.process_timeout_ms);
  });

  it("pins the current frozen fixture digest", async () => {
    const config=await loadStudyConfig(path.resolve("studies/study-001/study.yaml"));
    const snapshot=await snapshotTree(path.resolve("fixtures/webapp-v1"));
    expect(fixtureDigest(snapshot)).toBe(config.fixture.sha256);
  });
});
