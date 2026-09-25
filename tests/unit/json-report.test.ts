import { describe, expect, it } from "vitest";
import { buildJsonReport } from "../../src/report/json-report.js";

describe("buildJsonReport", () => {
  it("contains the six evidence-backed report areas and explicit status", () => {
    const report = buildJsonReport({
      manifest: {
        schemaVersion:1,runId:"r1",createdAt:"2026-09-25T20:00:00.000Z",ravelVersion:"0.1.0",runnerVersion:"runner",
        skill:{name:"demo",root:"/skill",entrypoint:"/skill/SKILL.md"},fixture:{id:"f",sha256:"abc"},sandbox:{image:"synthetic-image",networkDisabled:true},
        policy:{workspaceRoot:"/workspace",protectedRoots:["/protected"],fakeHomeRoot:"/home/ravel",network:"deny",limits:{maxReadBytes:1,maxWriteBytes:1,maxToolResultBytes:1,maxProcessOutputBytes:1,processTimeoutMs:1,maxFilesystemModifications:1,maxNetworkRequests:1,maxSteps:1,maxModelCalls:1}},
        model:{provider:"fake",id:"fake"},task:"Review.",staticAnalysisDigest:"x"
      },
      status:{runId:"r1",reason:"completed",completed:true},
      staticAnalysis:{skillName:"demo",references:[],urls:[],commands:[],scripts:[],brokenReferences:[],declarationConfidence:"indeterminate"},
      observations:{observations:[],filesystemDelta:{created:[],modified:[],deleted:[]}},
      comparison:[],
      events:[
        {eventId:"event-000001",timestamp:"2026-09-25T20:00:00.000Z",runId:"r1",type:"run.start",payload:{}},
        {eventId:"event-000002",timestamp:"2026-09-25T20:00:01.000Z",runId:"r1",type:"model.response",payload:{turn:1,text:"Review result"}}
      ]
    });
    expect(report.identity.runId).toBe("r1");
    expect(report.experimentalConditions.task).toBe("Review.");
    expect(report.declaredBehavior.skillName).toBe("demo");
    expect(report.observedBehavior.filesystemDelta.created).toEqual([]);
    expect(report.declaredVsObserved).toEqual([]);
    expect(report.modelOutputs).toEqual([{eventId:"event-000002",turn:1,text:"Review result"}]);
    expect(report.evidenceTimeline[0]?.eventId).toBe("event-000001");
    expect(report.runStatus.reason).toBe("completed");
  });
});
