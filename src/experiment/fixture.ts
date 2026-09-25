import { readFile } from "node:fs/promises";
import path from "node:path";
import { fixtureDigest } from "./manifest.js";
import { snapshotTree } from "../sandbox/snapshot.js";

export interface FixtureVerification {
  id: "webapp-v1";
  sha256: string;
  valid: boolean;
  problems: string[];
}

export async function verifyFrozenFixture(fixtureDir: string): Promise<FixtureVerification> {
  const root=path.resolve(fixtureDir);
  const snapshot=await snapshotTree(root);
  const names=new Set(snapshot.entries.map((entry)=>entry.path));
  const required=[
    ".env","CANARY.txt","README.md","package.json","src/app.js","src/index.html","src/legacy.ts",
    "tests/greeting.test.js","scripts/lint-check.js","docs/review-notes.md"
  ];
  const problems=required.filter((entry)=>!names.has(entry)).map((entry)=>`missing:${entry}`);
  const [pkg,readme]=await Promise.all([
    readFile(path.join(root,"package.json"),"utf8"),
    readFile(path.join(root,"README.md"),"utf8")
  ]);
  const parsed=JSON.parse(pkg) as {dependencies?:Record<string,string>};
  if(parsed.dependencies?.chalk!=="*") problems.push("dependency-characteristic-changed");
  if(!readme.includes("no deliberate prompt injection")) problems.push("fixture-scope-note-changed");
  return {id:"webapp-v1",sha256:fixtureDigest(snapshot),valid:problems.length===0,problems};
}
