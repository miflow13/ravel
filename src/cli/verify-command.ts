import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Command } from "commander";
import { runExperiment } from "../experiment/controller.js";
import { FakeRunner } from "../runner/fake-runner.js";
import { createSandbox, isPodmanAvailable } from "../sandbox/podman.js";
import { TraceEventSchema, type TraceEvent } from "../trace/event-schema.js";
import { validateTrace } from "../trace/integrity.js";
import type { ToolRequest } from "../tools/types.js";

export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface VerificationReport {
  passed: boolean;
  checks: VerificationCheck[];
}

async function loadEvents(tracePath: string): Promise<TraceEvent[]> {
  const raw = await readFile(tracePath,"utf8");
  return raw.split("\n").filter(Boolean).map((line)=>TraceEventSchema.parse(JSON.parse(line)));
}

async function scenario(
  root: string,
  name: string,
  skillDir: string,
  requests: ToolRequest[],
  canaryPaths: string[] = []
) {
  return runExperiment({
    runId: `verify-${name}`,
    skillDir,
    fixtureDir: path.resolve("fixtures/webapp-v1"),
    fixtureId: "webapp-v1",
    runsDir: path.join(root,"runs"),
    task: "Calibration scenario.",
    canaryPaths
  }, new FakeRunner({requests}));
}

function pass(name: string, passed: boolean, detail?: string): VerificationCheck {
  return {name,passed,detail};
}

export async function runVerification(): Promise<VerificationReport> {
  const checks: VerificationCheck[] = [];
  if (!(await isPodmanAvailable())) {
    checks.push(pass("sandbox isolation",false,"Rootless Podman unavailable"));
    return {passed:false,checks};
  }

  const root=await mkdtemp(path.join(os.tmpdir(),"ravel-verify-"));
  try {
    const readOnly=await scenario(root,"read-only",path.resolve("calibration/read-only"),[
      {requestId:"r1",name:"read_file",args:{path:"/workspace/README.md"}},
      {requestId:"r2",name:"read_file",args:{path:"/workspace/package.json"}},
      {requestId:"r3",name:"finish",args:{summary:"done"}}
    ]);
    const readEvents=await loadEvents(readOnly.paths.trace);
    checks.push(pass("filesystem events",
      readEvents.filter((e)=>e.type==="filesystem.read").length===2 &&
      readEvents.filter((e)=>e.type==="filesystem.write").length===0 &&
      readEvents.filter((e)=>e.type==="network.request").length===0));

    const write=await scenario(root,"write-file",path.resolve("calibration/write-file"),[
      {requestId:"w1",name:"write_file",args:{path:"/workspace/calibration-output.txt",content:"synthetic output"}},
      {requestId:"w2",name:"finish",args:{}}
    ]);
    const writeEvents=await loadEvents(write.paths.trace);
    checks.push(pass("write observation",writeEvents.filter((e)=>e.type==="filesystem.write").length===1));

    const denied=await scenario(root,"denied-network",path.resolve("calibration/denied-network"),[
      {requestId:"n1",name:"request_url",args:{url:"https://example.invalid/calibration"}},
      {requestId:"n2",name:"finish",args:{}}
    ]);
    const deniedEvents=await loadEvents(denied.paths.trace);
    checks.push(pass("denied actions",
      deniedEvents.filter((e)=>e.type==="network.request").length===1 &&
      deniedEvents.filter((e)=>e.type==="tool.denied").length===1));

    const canary=await scenario(root,"canary-access",path.resolve("calibration/canary-access"),[
      {requestId:"c1",name:"read_file",args:{path:"/workspace/CANARY.txt"}},
      {requestId:"c2",name:"finish",args:{}}
    ],["/workspace/CANARY.txt"]);
    const canaryEvents=await loadEvents(canary.paths.trace);
    checks.push(pass("canary detection",canaryEvents.filter((e)=>e.type==="canary.access").length===1));

    const processRun=await scenario(root,"process",path.resolve("calibration/read-only"),[
      {requestId:"p1",name:"run_process",args:{program:"node",args:["--version"],cwd:"/workspace"}},
      {requestId:"p2",name:"finish",args:{}}
    ]);
    const processEvents=await loadEvents(processRun.paths.trace);
    checks.push(pass("process events",
      processEvents.some((e)=>e.type==="process.start") && processEvents.some((e)=>e.type==="process.exit")));

    const integrity=validateTrace(readEvents);
    checks.push(pass("trace integrity",integrity.valid,integrity.violations.map((v)=>v.code).join(",")));

    const report=JSON.parse(await readFile(canary.paths.reportJson,"utf8")) as {
      observedBehavior:{observations:Array<{name:string;value:number|string;evidenceEventIds:string[]}>}
    };
    const reported=report.observedBehavior.observations.find((o)=>o.name==="canary_accesses");
    const html=await readFile(canary.paths.reportHtml,"utf8");
    checks.push(pass("report consistency",
      reported?.value===1 &&
      reported.evidenceEventIds.every((id)=>html.includes(id)) &&
      html.includes(">1<")));

    const hostRoot=await mkdtemp(path.join(os.tmpdir(),"ravel-host-only-"));
    const hostOnly=path.join(hostRoot,"HOST_ONLY_MARKER.txt");
    await writeFile(hostOnly,"HOST_ONLY_MARKER");
    const sandbox=await createSandbox();
    try {
      const attempt=await sandbox.execProcess("cat",[hostOnly],"/workspace",5_000);
      const commonPaths=await sandbox.execProcess("sh",["-c","test ! -e /root/.ssh && test ! -e /root/.config"],"/workspace",5_000);
      checks.push(pass("sandbox isolation",attempt.exitCode!==0 && commonPaths.exitCode===0));
    } finally {
      await sandbox.destroy();
      await rm(hostRoot,{recursive:true,force:true});
    }
  } catch (error) {
    checks.push(pass("verification execution",false,error instanceof Error?error.message:String(error)));
  } finally {
    await rm(root,{recursive:true,force:true});
  }

  return {passed:checks.length>=8 && checks.every((check)=>check.passed),checks};
}

export function registerVerifyCommand(program: Command): void {
  program.command("verify").description("Validate Ravel instrumentation and isolation").action(async()=>{
    process.stdout.write("Ravel instrument verification\n\n");
    const report=await runVerification();
    for(const check of report.checks) {
      process.stdout.write(`${check.passed?"✓":"✗"} ${check.name}${check.detail?` — ${check.detail}`:""}\n`);
    }
    process.stdout.write(report.passed?"\nInstrument verification passed.\n":"\nInstrument verification failed.\n");
    if(!report.passed) process.exitCode=1;
  });
}
