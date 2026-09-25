import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { registerRunCommand } from "../../src/cli/run-command.js";
import { runExperiment, DEFAULT_STUDY_POLICY } from "../../src/experiment/controller.js";
import { FakeRunner } from "../../src/runner/fake-runner.js";
import type { ModelAdapter, ModelInput, ModelOutput } from "../../src/runner/model-adapter.js";
import { RavelRunner } from "../../src/runner/loop.js";
import { isPodmanAvailable } from "../../src/sandbox/podman.js";

class ScriptedModel implements ModelAdapter {
  constructor(private outputs:ModelOutput[]){}
  async respond(_input:ModelInput){
    const next=this.outputs.shift();
    if(!next) throw new Error("synthetic model error");
    return next;
  }
}

async function skill(root:string){
  const dir=path.join(root,"skill"); await mkdir(dir);
  await writeFile(path.join(dir,"SKILL.md"),"---\nname: controlled-review\n---\nReview the repository and read [the notes](notes.md).");
  await writeFile(path.join(dir,"notes.md"),"Review fixture notes.");
  return dir;
}

describe("real ravel run workflow",()=>{
  it("CLI creates the complete evidence bundle with a controlled adapter",async(context)=>{
    if(!(await isPodmanAvailable())){context.skip("Podman unavailable or not rootless");return;}
    const root=await mkdtemp(path.join(os.tmpdir(),"ravel-cli-e2e-"));
    try{
      const skillDir=await skill(root);
      const program=new Command().name("ravel");
      registerRunCommand(program,{
        fixtureDir:path.resolve("fixtures/webapp-v1"),runsDir:path.join(root,"runs"),requireApiKey:false,
        createModel:()=>new ScriptedModel([
          {modelId:"controlled",toolCalls:[{callId:"a",name:"read_file",args:{path:"/workspace/README.md"}}]},
          {modelId:"controlled",toolCalls:[{callId:"b",name:"finish",args:{summary:"done"}}]}
        ])
      });
      await program.parseAsync(["node","ravel","run",skillDir]);
      const [runName]=await readdir(path.join(root,"runs"));
      const runRoot=path.join(root,"runs",runName!);
      for(const file of ["manifest.yaml","static-analysis.json","trace.jsonl","filesystem-before.json","filesystem-after.json","report.json","report.html"]){
        expect((await readFile(path.join(runRoot,file))).length).toBeGreaterThan(0);
      }
      expect(await readdir(path.join(runRoot,"artifacts"))).toEqual([]);
      const manifest = await readFile(path.join(runRoot,"manifest.yaml"),"utf8");
      expect(manifest).toContain("maxOutputTokens: 8000");
      expect(manifest).toContain("reasoningEffort: medium");
      expect(manifest).toContain("entrypoint: SKILL.md");
      expect(manifest).not.toContain(root);
      const staticAnalysis = await readFile(path.join(runRoot,"static-analysis.json"),"utf8");
      expect(staticAnalysis).toContain('"resolvedPath": "notes.md"');
      expect(staticAnalysis).not.toContain(root);
      for (const snapshotFile of ["filesystem-before.json","filesystem-after.json"]) {
        const snapshot = JSON.parse(await readFile(path.join(runRoot,snapshotFile),"utf8")) as { root: string };
        expect(snapshot.root).toBe("/workspace");
      }
    }finally{await rm(root,{recursive:true,force:true});}
  });

  it("preserves explicit termination evidence for step limit, timeout, model error and sandbox startup error",async(context)=>{
    if(!(await isPodmanAvailable())){context.skip("Podman unavailable or not rootless");return;}
    const root=await mkdtemp(path.join(os.tmpdir(),"ravel-termination-e2e-"));
    try{
      const skillDir=await skill(root);
      const common={skillDir,fixtureDir:path.resolve("fixtures/webapp-v1"),fixtureId:"webapp-v1",runsDir:path.join(root,"runs"),task:"Review."};

      const stepPolicy=structuredClone(DEFAULT_STUDY_POLICY); stepPolicy.limits.maxSteps=0;
      const step=await runExperiment({...common,runId:"step",policy:stepPolicy},new RavelRunner(new ScriptedModel([{modelId:"x",toolCalls:[{callId:"x",name:"finish",args:{}}]}])));
      expect(step.status.reason).toBe("step_limit");

      const timeoutPolicy=structuredClone(DEFAULT_STUDY_POLICY); timeoutPolicy.limits.processTimeoutMs=1;
      const timeout=await runExperiment({...common,runId:"timeout",policy:timeoutPolicy},new RavelRunner(new ScriptedModel([{modelId:"x",toolCalls:[{callId:"p",name:"run_process",args:{program:"node",args:["-e","setTimeout(()=>{},10000)"],cwd:"/workspace"}}]}])));
      expect(timeout.status.reason).toBe("timeout");

      const model=await runExperiment({...common,runId:"model"},new RavelRunner(new ScriptedModel([])));
      expect(model.status.reason).toBe("model_error");

      const sandbox=await runExperiment({...common,runId:"sandbox",sandbox:{image:"ravel/definitely-missing-image:never"}},new FakeRunner({requests:[]}));
      expect(sandbox.status.reason).toBe("sandbox_error");

      for(const result of [step,timeout,model,sandbox]){
        expect(await readFile(result.paths.trace,"utf8")).toContain('"type":"run.terminated"');
        expect((await readFile(result.paths.reportJson,"utf8")).length).toBeGreaterThan(0);
      }
    }finally{await rm(root,{recursive:true,force:true});}
  });
});
