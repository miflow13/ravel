import { describe, expect, it } from "vitest";
import { renderHtmlReport } from "../../src/report/html-report.js";
import type { JsonReport } from "../../src/report/json-report.js";

const report: JsonReport = {
  schemaVersion:1,
  identity:{runId:"r1",skill:"demo",ravelVersion:"0.1.0",runnerVersion:"runner",createdAt:"2026-09-25T20:00:00.000Z"},
  experimentalConditions:{model:{provider:"fake",id:"fake"},fixture:{id:"f",sha256:"abc"},sandbox:{image:"synthetic-image",networkDisabled:true},task:"Review.",policy:{workspaceRoot:"/workspace",protectedRoots:["/protected"],fakeHomeRoot:"/home/ravel",network:"deny",limits:{maxReadBytes:1,maxWriteBytes:1,maxToolResultBytes:1,maxProcessOutputBytes:1,processTimeoutMs:1,maxFilesystemModifications:1,maxNetworkRequests:1,maxSteps:1,maxModelCalls:1}}},
  declaredBehavior:{skillName:"demo",references:[],urls:[],commands:[],scripts:[],brokenReferences:[],declarationConfidence:"indeterminate"},
  observedBehavior:{observations:[{name:"files_read",value:4,evidenceEventIds:["event-000002","event-000003","event-000004","event-000005"]}],filesystemDelta:{created:[],modified:[],deleted:[]}},
  declaredVsObserved:[{behavior:"file_read",label:"observed_not_declared",declaredEvidence:[],observedEvidenceEventIds:["event-000002"]}],
  modelOutputs:[{eventId:"event-000010",turn:3,text:"Substantive review output"}],
  evidenceTimeline:[{eventId:"event-000002",timestamp:"2026-09-25T20:00:01.000Z",type:"filesystem.read"}],
  runStatus:{runId:"r1",reason:"runner_error",completed:false}
};

describe("renderHtmlReport", () => {
  it("is standalone, contains all approved sections, exact values and provenance", () => {
    const html=renderHtmlReport(report);
    for(const title of ["Identity","Experimental Conditions","Declared Behavior","Observed Behavior","Declared vs Observed","Model Outputs","Evidence Timeline"]) expect(html).toContain(title);
    expect(html).toContain(">4<");
    expect(html).toContain("event-000002");
    expect(html).toContain("Substantive review output");
    expect(html).toContain("event-000010");
    expect(html).toContain("Partial/terminated run");
    expect(html).not.toMatch(/<script\s+src=|https?:\/\/[^<]*\.js/);
  });
});
