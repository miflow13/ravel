# Ravel

Ravel is a small, evidence-first research instrument for studying the difference between what an agent skill **declares** and what a controlled agent **actually does** when following that skill.

Ravel v0.1 is intentionally narrow: one supported `SKILL.md` style, one Ravel-owned Runner, one frozen repository fixture, one explicit policy, one pinned model configuration, one rootless Podman sandbox architecture, and one evidence pipeline.

> **Status:** v0.1 implementation branch. The release gate must be run on a Linux host with rootless Podman before this branch is considered release-ready. This repository does not treat unexecuted tests as passing.

## What Ravel measures

Ravel separates several things that are easy to blur together:

- **declared** — behavior Ravel can conservatively identify in the skill text and local references;
- **attempted** — an action requested through a Ravel instrumented tool;
- **permitted / denied** — the policy decision made before the action;
- **observed** — behavior witnessed through Ravel instrumentation or before/after filesystem state.

Evidence is also separated into three layers:

1. **raw events** — chronological entries in `trace.jsonl`;
2. **derived observations** — counts/deltas computed from those events and snapshots;
3. **interpretation** — declared-vs-observed labels backed by those observations.

Ravel v0.1 **does not produce a safety score, trust score, maliciousness score, or universal judgment about a skill**.

## Commands

### `ravel inspect <skill>`

Performs conservative static inspection without executing the skill.

It reports things such as:

- local file references;
- broken or escaping references;
- obvious URLs;
- obvious command mentions;
- referenced scripts;
- indeterminate declarations when Ravel cannot classify them confidently.

### `ravel run <skill>`

Runs one Study 001 experiment with the frozen protocol in `studies/study-001/study.yaml`.

The command performs preflight validation before model use, creates a disposable rootless Podman sandbox, runs the controlled Ravel Runner, records attempted/permitted/denied/observed behavior, captures before/after state, generates reports, and destroys the sandbox.

The v0.1 CLI intentionally has **no general `--model` selector**. Study 001 pins one model configuration so model choice does not drift between compared skills.

### `ravel verify`

Runs deterministic calibration checks for:

- filesystem observation;
- process observation;
- denied actions;
- synthetic canary detection;
- trace integrity;
- report consistency;
- sandbox isolation.

Study 001 data must not be accepted unless the relevant verification run passes.

## Prerequisites

- Node.js 20 or newer;
- npm;
- Linux with **rootless Podman**;
- an OpenAI API credential for real model runs.

The provider credential belongs in the host process environment:

```bash
export OPENAI_API_KEY=...
```

It must **never** be copied into the fixture, sandbox, trace, manifest, report, calibration files, or skill under study.

## Development

Install dependencies:

```bash
npm install
```

Build and typecheck:

```bash
npm run typecheck
npm run build
```

Run tests:

```bash
npm test
```

Run instrument calibration:

```bash
npm run build
node dist/cli/index.js verify
```

Inspect a fixture skill:

```bash
node dist/cli/index.js inspect tests/fixtures/skills/valid
```

A real model experiment:

```bash
node dist/cli/index.js run ./path/to/review-skill
```

## Evidence bundle

Each run is stored under `runs/<run-id>/`:

```text
manifest.yaml
static-analysis.json
trace.jsonl
filesystem-before.json
filesystem-after.json
report.json
report.html
artifacts/
```

The evidence chain is deliberately one-way:

```text
trace.jsonl + filesystem snapshots + static analysis
                    ↓
                report.json
                    ↓
                report.html
```

The HTML renderer does not invent an independent behavioral narrative. Behavioral values shown there come from the structured report, whose observations carry source event IDs.

## Isolation boundary

The experiment sandbox is disposable and starts with network disabled for Study 001. Ravel does not mount the user's general home directory, SSH keys, browser data, or unrelated host paths into the experiment.

Supplied fixtures and calibration cases use synthetic markers only. Do not put real credentials or private user data into an experiment fixture.

The controlled process interface is structured:

```text
run_process(program, args, cwd)
```

Ravel does not expose an unrestricted shell-string tool to the model.

## Study 001

Study 001 is **Declared vs Observed Behavior** for one coherent family of repository-review skills. Every candidate receives the same:

- neutral task wording;
- frozen `webapp-v1` fixture and hash;
- Runner version;
- model ID;
- permissions and limits;
- network-denied baseline policy;
- evidence pipeline.

The pilot uses approximately 2–3 candidate skills with repeated runs. Pilot data tests the methodology; it is not automatically part of the final dataset. See [the Study 001 protocol](studies/study-001/README.md) and [research methodology](docs/research-methodology.md).

## Architecture

See [docs/architecture.md](docs/architecture.md) for module boundaries and runtime flow.

The short version:

```text
skill
  ↓
static inspection
  ↓
experiment manifest + frozen fixture
  ↓
rootless Podman sandbox
  ↓
Ravel Runner
  ↓
instrumented tools → policy decision → side effect
  ↓
raw trace + filesystem snapshots
  ↓
derived observations
  ↓
JSON report
  ↓
standalone HTML report
```

Ravel's core research rule is simple:

> Report what the instrument can demonstrate, and label uncertainty instead of guessing.
