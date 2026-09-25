import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { assertWorkspacePath, WORKSPACE_ROOT } from "./paths.js";

export const DEFAULT_SANDBOX_IMAGE = "docker.io/library/node:22.23.3-bookworm-slim@sha256:25330af3531fb5e23318554a0aa911125b6e91b1b777edf7655501d207c067a2";

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
}
export interface SandboxConfig {
  image?: string;
  name?: string;
  networkDisabled?: boolean;
  maxOutputBytes?: number;
}
interface SpawnOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
  input?: string;
}

async function spawnCapture(program: string, args: string[], options: SpawnOptions = {}): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { stdio: ["pipe", "pipe", "pipe"], shell: false });
    const limit = options.maxOutputBytes ?? 1_048_576;
    let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let truncated = false;
    let timedOut = false;
    const collect = (
      existing: Buffer<ArrayBufferLike>,
      chunk: Buffer<ArrayBufferLike>
    ): Buffer<ArrayBufferLike> => {
      const remaining = Math.max(0, limit - existing.length);
      if (chunk.length > remaining) truncated = true;
      return Buffer.concat([existing, chunk.subarray(0, remaining)]);
    };
    child.stdout.on("data", (chunk: Buffer<ArrayBufferLike>) => { stdout = collect(stdout, chunk); });
    child.stderr.on("data", (chunk: Buffer<ArrayBufferLike>) => { stderr = collect(stderr, chunk); });
    child.on("error", reject);
    let timer: NodeJS.Timeout | undefined;
    if (options.timeoutMs) timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, options.timeoutMs);
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: timedOut ? 124 : (code ?? 1), stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8"), timedOut, truncated });
    });
    if (options.input !== undefined) child.stdin.end(options.input); else child.stdin.end();
  });
}

export async function isPodmanAvailable(): Promise<boolean> {
  try {
    const result = await spawnCapture("podman", ["info", "--format", "json"], { timeoutMs: 10_000 });
    if (result.exitCode !== 0) return false;
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    const host = (parsed.host ?? {}) as Record<string, unknown>;
    const security = (host.security ?? {}) as Record<string, unknown>;
    return (security.rootless ?? host.rootless) === true;
  } catch { return false; }
}

export class PodmanSandbox {
  constructor(
    readonly containerId: string,
    readonly name: string,
    readonly maxOutputBytes: number,
    readonly image: string
  ) {}

  async execProcess(program: string, args: string[], cwd = WORKSPACE_ROOT, timeoutMs = 30_000): Promise<ProcessResult> {
    const safeCwd = assertWorkspacePath(cwd);
    return spawnCapture("podman", ["exec", "--workdir", safeCwd, this.containerId, program, ...args], { timeoutMs, maxOutputBytes: this.maxOutputBytes });
  }

  async copyIn(source: string, destination = WORKSPACE_ROOT): Promise<void> {
    const safeDestination = assertWorkspacePath(destination);
    const result = await spawnCapture("podman", ["cp", source, `${this.containerId}:${safeDestination}`], { timeoutMs: 30_000 });
    if (result.exitCode !== 0) throw new Error(`podman cp failed: ${result.stderr}`);
  }

  async copyOut(source: string, destination: string): Promise<void> {
    const safeSource = assertWorkspacePath(source);
    const result = await spawnCapture("podman", ["cp", `${this.containerId}:${safeSource}`, destination], { timeoutMs: 30_000 });
    if (result.exitCode !== 0) throw new Error(`podman cp failed: ${result.stderr}`);
  }

  async copyWorkspaceOut(destination: string): Promise<void> {
    const result = await spawnCapture("podman", ["cp", `${this.containerId}:/workspace/.`, destination], { timeoutMs: 30_000 });
    if (result.exitCode !== 0) throw new Error(`podman cp workspace failed: ${result.stderr}`);
  }

  async resolvePath(candidate: string, forWrite = false): Promise<string> {
    const lexical = assertWorkspacePath(candidate);
    const target = forWrite ? path.posix.dirname(lexical) : lexical;
    const result = await spawnCapture("podman", ["exec", this.containerId, "readlink", "-f", "--", target], { timeoutMs: 5_000 });
    if (result.exitCode !== 0) return lexical;
    const canonical = result.stdout.trim();
    return forWrite ? path.posix.join(canonical, path.posix.basename(lexical)) : canonical;
  }

  async destroy(): Promise<void> {
    await spawnCapture("podman", ["rm", "-f", this.containerId], { timeoutMs: 15_000 });
  }
}

export async function createSandbox(config: SandboxConfig = {}): Promise<PodmanSandbox> {
  const name = config.name ?? `ravel-${randomUUID().slice(0, 12)}`;
  const image = config.image ?? DEFAULT_SANDBOX_IMAGE;
  const args = [
    "run","-d","--rm","--name",name,"--read-only",
    "--tmpfs","/tmp:rw,noexec,nosuid,size=64m,mode=1777",
    "--tmpfs","/workspace:rw,nosuid,size=256m,mode=0755,uid=1000,gid=1000",
    "--tmpfs","/home/ravel:rw,noexec,nosuid,size=16m,mode=0700,uid=1000,gid=1000",
    "--user","1000:1000","--cap-drop","ALL","--security-opt","no-new-privileges",
    ...(config.networkDisabled === false ? [] : ["--network","none"]),
    image,"sleep","infinity"
  ];
  const result = await spawnCapture("podman", args, { timeoutMs: 60_000 });
  if (result.exitCode !== 0) throw new Error(`Unable to start Podman sandbox: ${result.stderr}`);
  return new PodmanSandbox(result.stdout.trim(), name, config.maxOutputBytes ?? 1_048_576, image);
}

export async function containerExists(containerId: string): Promise<boolean> {
  const result = await spawnCapture("podman", ["container", "exists", containerId], { timeoutMs: 5_000 });
  return result.exitCode === 0;
}
