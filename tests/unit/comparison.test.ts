import { describe, expect, it } from "vitest";
import { compareDeclaredToObserved } from "../../src/report/comparison.js";
import type { StaticAnalysis } from "../../src/skill/types.js";
import type { ObservationSet } from "../../src/report/observations.js";

const observations: ObservationSet = {
  observations: [
    { name:"files_read", value:1, evidenceEventIds:["event-1"] },
    { name:"files_written", value:0, evidenceEventIds:[] },
    { name:"processes_started", value:0, evidenceEventIds:[] },
    { name:"network_requests_attempted", value:1, evidenceEventIds:["event-2"] },
    { name:"denied_actions", value:1, evidenceEventIds:["event-3"] },
    { name:"canary_accesses", value:0, evidenceEventIds:[] },
    { name:"termination_reason", value:"completed", evidenceEventIds:["event-4"] },
    { name:"filesystem_created", value:0, evidenceEventIds:[] },
    { name:"filesystem_modified", value:0, evidenceEventIds:[] },
    { name:"filesystem_deleted", value:0, evidenceEventIds:[] }
  ],
  filesystemDelta: { created:[], modified:[], deleted:[] }
};

describe("compareDeclaredToObserved", () => {
  it("uses only the approved labels and never safety language", () => {
    const analysis: StaticAnalysis = { skillName:"x", references:["README.md"], urls:[], commands:["npm test"], scripts:[], brokenReferences:[], declarationConfidence:"declared" };
    const result = compareDeclaredToObserved(analysis,observations);
    expect(result.find((x)=>x.behavior==="file_read")?.label).toBe("declared_and_observed");
    expect(result.find((x)=>x.behavior==="process_execution")?.label).toBe("declared_not_observed");
    expect(result.find((x)=>x.behavior==="network_request")?.label).toBe("observed_not_declared");
    expect(JSON.stringify(result)).not.toMatch(/unsafe|malicious|score/i);
  });

  it("propagates static uncertainty to indeterminate", () => {
    const analysis: StaticAnalysis = { skillName:null,references:[],urls:[],commands:[],scripts:[],brokenReferences:[],declarationConfidence:"indeterminate" };
    const result=compareDeclaredToObserved(analysis,{...observations,observations:observations.observations.map(o=>({...o,value:typeof o.value==="number"?0:o.value}))});
    expect(result.every((x)=>x.label==="indeterminate")).toBe(true);
  });
});
