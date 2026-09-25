# Ravel v0.1 Architecture

## Design goal

Ravel is a controlled research instrument, not a general-purpose agent framework. The architecture prioritizes reproducibility, inspectable control flow, evidence provenance, isolation, and conservative reporting over flexibility.

The v0.1 runtime path is:

```text
SKILL.md
   ↓
skill loader / static analyzer
   ↓
study configuration + experiment manifest
   ↓
frozen fixture snapshot
   ↓
rootless Podman sandbox
   ↓
Ravel Runner
   ↓
ToolRegistry
   ↓
PolicyEngine
   ↓
sandbox side effect
   ↓
TraceRecorder + final filesystem snapshot
   ↓
derived observations
   ↓
declared-vs-observed comparison
   ↓
report.json
   ↓
report.html
```

## Module boundaries

### `src/skill`

Loads one supported `SKILL.md` format, resolves local references, rejects escaping paths and oversized referenced text, and extracts factual declarations.

Static inspection does not decide whether intent is safe, malicious, trustworthy, or dangerous.

### `src/experiment`

Owns the run lifecycle:

1. validate input;
2. write static analysis;
3. snapshot the frozen fixture;
4. write the immutable experiment manifest;
5. initialize the raw trace;
6. create the sandbox;
7. execute a Runner;
8. record normal completion or explicit termination;
9. copy out final workspace state;
10. build structured and HTML reports;
11. destroy the sandbox in `finally`.

Partial evidence is preserved when execution terminates after trace initialization.

### `src/sandbox`

Owns the rootless Podman boundary and filesystem snapshots.

Podman subprocesses are invoked using structured Node process arguments with `shell: false`. The Study 001 container has network disabled, drops capabilities, enables `no-new-privileges`, uses a read-only container root, and provides disposable tmpfs paths for the workspace and synthetic home.

Host home directories and unrelated host paths are not mounted.

### `src/tools`

Defines the only model-visible actions in v0.1:

- `list_files`;
- `read_file`;
- `write_file`;
- `run_process`;
- `request_url`;
- `finish`.

The process tool accepts `program`, `args[]`, and `cwd`; it has no free-form command string.

Every request flows through instrumentation and policy rather than calling the sandbox directly.

### `src/policy`

Makes explicit allow/deny decisions for consequential tool calls. Study 001:

- permits reads/writes inside canonical `/workspace` paths;
- denies protected and fake-home paths;
- denies network requests;
- permits structured process execution subject to limits;
- denies direct shell-program entrypoints at the tool boundary.

Policy denials use stable machine-readable reasons.

### `src/trace`

Writes append-only JSONL events with monotonically assigned IDs. Trace validation checks invariants including:

- `run.start` exists;
- event IDs are unique and ordered;
- timestamps do not regress;
- actionable tool requests receive decisions/results;
- a run ends with `run.end` or `run.terminated`.

The raw trace is the primary runtime evidence source.

### `src/runner`

The Runner loop is provider-independent. It depends on a small `ModelAdapter` interface and the Ravel `ToolRegistry`.

Only `OpenAIModelAdapter` imports the OpenAI SDK. Provider responses are normalized into Ravel-owned types before the Runner interprets tool calls.

The host-side API credential is consumed only to initialize the provider client and is never copied into the model-visible experiment filesystem.

### `src/report`

Derives factual observations from trace events and snapshots, compares declared and observed behavior with a restrained vocabulary, and renders JSON plus standalone HTML.

Approved comparison labels are:

- `declared_and_observed`;
- `declared_not_observed`;
- `observed_not_declared`;
- `indeterminate`.

An `observed_not_declared` event is a measurement, not an accusation.

### `src/study`

Validates the frozen Study 001 configuration. `ravel run` consumes this config so the fixture identity, task text, Runner version, model, policy, and limits cannot drift silently across compared skills.

## Evidence semantics

A tool event sequence is conceptually:

```text
tool.request
   ↓
tool.allowed | tool.denied
   ↓
observable effect (when allowed)
   ↓
tool.result
```

Examples of observable effects are `filesystem.read`, `filesystem.write`, `process.start`, `process.exit`, `network.request`, and `canary.access`.

A denied network request is still an attempted network action and is therefore observable even though no network side effect occurs.

## Termination

Ravel distinguishes:

- `completed`;
- `step_limit`;
- `timeout`;
- `model_error`;
- `tool_error`;
- `policy_termination`;
- `runner_error`;
- `sandbox_error`.

Termination is evidence. It is not silently converted into a successful run.

## Security boundary

Ravel v0.1 reduces exposure; it is not a claim of perfect containment. Rootless Podman, narrow mounts, disabled experiment networking, synthetic fixtures, explicit tools, and policy checks create the research boundary. `ravel verify` exists to validate critical properties of that boundary on the actual study host before data collection.
