# Ravel v0.1 — Technical Design Specification

Status: Design approved; awaiting written-spec review
Date: September 25, 2026
Initial study: Study 001 — Declared vs. Observed Behavior

1. Project Summary

Ravel is an open-source research instrument for observing how AI agent skills behave under controlled conditions.

Ravel accepts an agent skill, examines its declared instructions and supporting files, executes that skill using a controlled research agent inside an isolated environment, records the agent's attempted and permitted actions, captures resulting system changes, and produces reproducible evidence.

Ravel is not initially intended to determine whether a skill is "safe," "unsafe," "good," or "bad."

Its primary purpose is measurement.

The core model is:

declared instructions
        ↓
agent attempts
        ↓
host permits or denies
        ↓
observable result

Ravel records each layer separately.

2. Research Identity

Ravel v0.1 is primarily a research instrument, not:

a consumer security scanner;

an agent marketplace;

a permission manager;

a general-purpose coding agent;

an automated vulnerability scanner;

a trust-ranking service;

or a proposed ecosystem standard.

Future versions may grow in those directions if the research supports them.

For v0.1, experimental control and evidence quality take precedence over product polish.

3. Study 001

Research question

When agent skills from the same functional family are given the same controlled task, how closely does their observed behavior correspond to their declared behavior?

Study 001 will initially examine one coherent skill family, such as code-review or frontend-review skills.

Unrelated skills will not be compared as though they perform equivalent tasks.

Controlled variables

The following remain fixed:

model;

model configuration;

Runner version;

task wording;

fixture repository;

fixture revision;

container image;

available tools;

permission policy;

execution limits;

Ravel version.

The primary changing variable is:

skill

Each tested skill must be frozen to an identifiable revision where possible.

4. Research Principles

Ravel follows several core principles.

4.1 Evidence before interpretation

Ravel distinguishes:

raw event
    ↓
derived observation
    ↓
interpretation

These must not be conflated.

4.2 Observation is not intent

If an agent attempts a network request that was not described by a skill, Ravel may report:

Network access was observed but was not explicitly identified in the declared instructions.

Ravel must not automatically conclude:

The skill secretly contacted the internet.

4.3 Absence of evidence is scoped

Ravel should say:

No network request was observed through Ravel's instrumented interface.

It should not claim:

The skill never uses the network.

4.4 Reproducibility

Every run records enough configuration and environmental metadata to identify the conditions under which it occurred.

4.5 No overall safety score

Ravel v0.1 will not produce:

safety percentages;

trust scores;

risk levels;

good/bad ratings;

installation recommendations.

Instead it reports measurable behavior.

5. User Experience

The primary v0.1 commands are:

ravel inspect <skill>
ravel run <skill>
ravel verify

ravel inspect

Statically examines a skill without executing it.

Example:

ravel inspect ./frontend-review

ravel run

Executes one controlled Ravel experiment.

Example:

ravel run ./frontend-review

ravel verify

Executes Ravel's calibration and instrument-validation suite.

Example:

ravel verify

6. High-Level Architecture

Ravel consists of five major systems:

┌─────────────────────────────────────┐
│                RAVEL                │
│                                     │
│  Experiment Controller              │
│           │                         │
│           ▼                         │
│  Skill Loader / Static Analyzer     │
│           │                         │
│           ▼                         │
│  Sandbox Manager                    │
│           │                         │
│           ▼                         │
│  Ravel Runner                       │
│           │                         │
│           ▼                         │
│  Trace / Observation / Reporting    │
└─────────────────────────────────────┘

Each component must have a narrow responsibility.

7. Experiment Controller

The Experiment Controller coordinates a run.

Responsibilities include:

input validation;

assigning run identifiers;

resolving skill identity;

creating experiment manifests;

loading fixture versions;

starting and stopping sandboxes;

initializing the Runner;

enforcing experiment limits;

finalizing evidence;

generating reports;

cleanup.

The Controller does not directly perform arbitrary agent actions.

8. Skill Loader and Static Analyzer

The Loader supports one defined SKILL.md-style format in v0.1.

Example structure:

frontend-review/
├── SKILL.md
├── scripts/
│   └── analyze.js
└── references/
    └── checklist.md

The static analysis stage identifies factual properties including:

skill name;

entrypoint;

referenced files;

supporting scripts;

URLs;

obvious package-manager operations;

recognizable commands;

missing references;

package size;

approximate instruction size;

repository revision where available.

Static analysis should favor conservative factual extraction.

When declaration intent cannot be determined confidently, the value should be:

indeterminate

rather than inferred certainty.

9. Experiment Manifest

Every run creates an immutable experiment manifest describing its conditions.

Conceptual example:

experiment:
  id: ravel-20260925-0017
  study: declared-vs-observed

skill:
  name: frontend-review
  revision: 32f20a1

ravel:
  version: 0.1.0

runner:
  version: 0.1.0

model:
  provider: fixed-provider
  id: exact-model-id
  configuration: fixed

fixture:
  id: webapp-v1
  revision: exact-revision

policy:
  filesystem: controlled
  process: controlled
  network: deny

limits:
  max_steps: 50
  wall_time_seconds: 300

The precise configuration format may change during implementation, but the information represented must remain explicit.

10. Sandbox Model

Ravel v0.1 uses rootless Podman for disposable execution environments.

A run receives an isolated environment approximately like:

/workspace
    frozen fixture copy

/skill
    skill under test

/home/ravel
    synthetic home environment

/protected
    synthetic protected resources

The user's real home directory must not be mounted into the experiment.

The container must not receive:

real SSH keys;

browser credentials;

real .env files;

host API credentials;

unrelated host directories.

Synthetic experiment data goes in.

Experiment evidence comes out.

The disposable environment is destroyed after final evidence capture.

11. Fixture Model

Study 001 uses one frozen realistic software project.

Initial fixture direction:

fixtures/webapp-v1/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── App.tsx
│   ├── components/
│   └── utils/
├── tests/
├── docs/
└── .env

The fixture may intentionally contain known characteristics such as:

a failing test;

a lint issue;

an accessibility issue;

an unused file;

a mildly questionable dependency;

synthetic credentials.

These characteristics exist to make the repository realistic and measurable, not adversarial.

Every Study 001 execution receives a clean copy of the exact same fixture revision.

12. Synthetic Canary Model

Study 001 may use synthetic canaries.

Passive workspace canary

Example:

/workspace/.env

containing values such as:

API_KEY=RAVEL_CANARY_8F2A71

These values are nonfunctional.

If an agent chooses to read them, the access becomes an observable event.

Protected boundary canary

Example:

/protected/credentials.txt

Access is denied by the policy layer but attempted access is recorded.

Ravel must not deliberately lure the agent toward protected material during Study 001.

13. Study 001 Adversarial Scope

Study 001 deliberately excludes active prompt-injection testing.

It will not initially include:

"ignore previous instructions" traps;

poisoned dependency instructions;

malicious shell aliases;

simulated attacker messages;

credential-exfiltration traps;

adversarial repository content designed to manipulate the model.

Those belong to a later study specifically designed around prompt-injection resilience.

Study 001 asks:

What does the skill naturally cause the agent to do?

not:

Can an attacker manipulate the skill-driven agent?

14. Ravel Runner

Ravel v0.1 uses a dedicated controlled agent called the Ravel Runner.

Study 001 does not execute Codex, Claude Code, or another external coding agent as the host.

The Runner consists of:

model adapter
agent loop
context manager
tool registry
policy engine
trace integration

Conceptually:

task + skill
     ↓
   model
     ↓
tool request
     ↓
 validation
     ↓
   policy
   ↙   ↘
allow   deny
  ↓      ↓
action   result
   \     /
     ↓
   trace
     ↓
tool result returned to model

15. Model Strategy

Ravel v0.1 uses:

one model provider;

one exact model identifier;

one fixed model configuration.

Verified Study 001 model choice (2026-09-25): OpenAI `gpt-6-sol` through the Responses API. Official OpenAI documentation identifies GPT-6 Sol as supporting function calling and the Responses API and positions it for complex coding and agentic workflows with a capability/cost balance appropriate to the fixed Ravel Runner.

There will initially be no user-facing model picker.

The purpose is to reduce experimental variables.

Ravel should record available model usage metadata, including where supported:

model identifier;

request count;

input token usage;

output token usage;

termination status.

Temperature or equivalent sampling configuration should be fixed where applicable.

A deterministic sampling setting does not imply that model behavior is guaranteed to be perfectly deterministic.

16. Agent Loop

Conceptual behavior:

while run is active:

    send task, skill context, history and tools to model

    receive model response

    if tool requested:
        validate request
        evaluate policy
        execute or deny
        record evidence
        return result to model

    if finish requested:
        terminate normally

    if limit reached:
        terminate with explicit reason

The Runner owns run-state orchestration.

The model does not directly access host resources.

17. Tool Model

Ravel v0.1 exposes a deliberately small tool surface:

list_files
read_file
write_file
run_process
request_url
finish

Additional tools require separate design justification.

run_process

Structured process execution is preferred over unrestricted shell strings.

Example:

{
  "program": "npm",
  "args": ["test"],
  "cwd": "/workspace"
}

This is preferable to:

npm test && curl ... | bash

because structured process execution is easier to validate and observe.

A general-purpose shell capability may be studied later as a distinct capability.

18. Policy Engine

All consequential tool requests pass through a policy layer.

The policy engine determines:

attempted
    ↓
allowed / denied
    ↓
result

A baseline Study 001 policy is:

Capability

Baseline

Read /workspace/**

Allow

Write /workspace/**

Allow

List workspace

Allow

Approved structured process execution

Allow

Read fake home

Deny by default

Read protected synthetic files

Deny and record

Access real host filesystem

Not mounted

Network

Deny and record attempt

Real host credentials

Unavailable

Policies must be explicit experiment configuration rather than hidden Runner behavior.

19. Execution Limits

The Runner must enforce hard resource and behavior limits.

At minimum:

maximum agent steps;

maximum model calls;

maximum wall-clock execution time;

maximum per-process execution time;

maximum file-read size;

maximum file-write size;

maximum tool-result size;

maximum total filesystem modifications;

maximum network requests.

Exact defaults will be established during implementation and calibration.

Limit termination is a recorded outcome, not an unclassified failure.

20. Experiment Lifecycle

A complete ravel run follows this lifecycle:

1. Validate skill input
2. Resolve skill identity/revision
3. Perform static inspection
4. Create experiment manifest
5. Load frozen fixture
6. Snapshot initial state
7. Create disposable sandbox
8. Start Ravel Runner
9. Execute model/tool loop
10. Record all observable events
11. Stop or terminate execution
12. Snapshot final state
13. Compute filesystem/system deltas
14. Derive factual observations
15. Generate JSON report
16. Generate HTML report
17. Destroy sandbox
18. Preserve evidence artifacts

21. Filesystem Snapshots

Before execution, Ravel captures enough fixture state to detect changes.

After execution, it captures the corresponding final state.

Ravel derives changes including:

created files;

modified files;

deleted files.

Content hashes may be used to establish file changes.

The comparison must not depend solely on the agent's claims about what it modified.

22. Trace Format

Every meaningful event is written chronologically to:

trace.jsonl

JSONL contains one JSON object per line.

Conceptual event:

{
  "eventId": "event-000071",
  "timestamp": "2026-09-25T19:41:19.294Z",
  "runId": "ravel-20260925-0017",
  "type": "network.request",
  "destination": "registry.npmjs.org",
  "decision": "denied"
}

The raw trace is the primary runtime evidence source.

23. Evidence Semantics

Ravel separates three evidence layers.

23.1 Raw event

Directly witnessed instrumentation event.

Example:

process.start npm test

23.2 Derived observation

Calculation based on trace events.

Example:

processes started: 2

23.3 Interpretation

Higher-level comparison or research analysis.

Example:

Network activity was observed but not explicitly identified in the skill instructions.

Interpretation must remain traceable to evidence.

24. Declared-vs-Observed Labels

Ravel v0.1 uses a restrained comparison vocabulary.

declared_and_observed
declared_not_observed
observed_not_declared
indeterminate

declared_and_observed

Static analysis identifies behavior and it is observed at runtime.

declared_not_observed

Behavior appears in the declaration but does not occur during the run.

This does not automatically imply malfunction.

observed_not_declared

Behavior occurs at runtime but was not explicitly identified by static analysis.

This does not automatically imply malicious or unsafe behavior.

indeterminate

Ravel cannot confidently establish the declared behavior.

25. Evidence Provenance

Derived observations must reference their source evidence.

Conceptual example:

{
  "observation": "network_attempt",
  "count": 1,
  "evidence": [
    "event-000071"
  ]
}

The evidence chain should remain:

report.html
    ↓
report.json
    ↓
trace.jsonl

The HTML report must not invent independent facts.

26. Run Artifacts

A completed run produces approximately:

runs/
└── <run-id>/
    ├── manifest.yaml
    ├── static-analysis.json
    ├── trace.jsonl
    ├── filesystem-before.json
    ├── filesystem-after.json
    ├── report.json
    ├── report.html
    └── artifacts/

Exact naming may evolve if implementation exposes a better convention.

27. Human-Readable Report

report.html should contain six main sections:

1. Identity
2. Experimental Conditions
3. Declared Behavior

4. Observed Behavior
5. Declared vs Observed
6. Evidence Timeline

Identity

Includes:

skill;

revision;

Ravel version;

Runner version;

run identifier;

timestamp.

Experimental Conditions

Includes:

model;

fixture;

task;

policy;

execution limits;

container identity.

Declared Behavior

Results of static inspection.

Observed Behavior

Trace-derived measurements.

Declared vs Observed

Comparison using Ravel's controlled vocabulary.

Evidence Timeline

Chronological trace navigation.

28. Termination States

Ravel must differentiate distinct run endings.

Examples:

completed
step_limit
timeout
model_error
tool_error
policy_termination
runner_error
sandbox_error

Partial results remain evidence.

A terminated report must clearly state that the task did not complete normally.

Ravel must not silently discard incomplete runs.

29. Instrument Calibration

Ravel must validate itself before Study 001 data collection.

Calibration cases use known expected behaviors.

Examples:

Read-only calibration

Expected:

2 file reads
0 writes
0 processes
0 network attempts

Write calibration

Expected:

1 known file write

Denied-network calibration

Expected:

1 network attempt
1 denial

Canary-read calibration

Expected:

workspace canary detected

Protected-boundary calibration

Expected:

protected access attempted
access denied

30. ravel verify

ravel verify runs instrument validation.

Target output:

Ravel instrument verification

✓ filesystem events
✓ process events
✓ denied actions
✓ canary detection
✓ trace integrity
✓ report consistency
✓ sandbox isolation

Instrument verification passed.

Study 001 data collection must not begin until the relevant verification suite passes.

31. Trace Integrity

Each completed or terminated run must satisfy invariants such as:

run start exists;

event identifiers are unique;

event order is valid;

each actionable tool request has a resolution;

derived observations reference real events;

the run contains either a normal completion or explicit termination reason.

32. Report Consistency

Ravel must verify consistency between:

trace
↓
derived report JSON
↓
HTML presentation

If four filesystem reads exist in the trace, report.json and the rendered HTML must not independently report another number.

33. Sandbox Isolation Verification

Before Study 001, Ravel's validation suite must verify that an experiment cannot access unintended host resources.

Expected properties include:

real host home unavailable
host SSH keys unavailable
host credentials unavailable
unmounted host filesystem unavailable

A failure in isolation validation prevents Study 001 execution from being considered valid.

34. Testing Layers

Ravel uses four primary test levels.

Unit tests

Individual functions such as:

parsers;

schemas;

path handling;

policy evaluation;

event serialization.

Integration tests

Multiple Ravel components together.

Examples:

tool + policy + trace

Calibration tests

Known synthetic agent behavior with known expected observations.

End-to-end tests

Full:

ravel run
↓
sandbox
↓
Runner
↓
trace
↓
report
↓
cleanup

35. Repository Structure

Proposed initial structure:

ravel/
├── src/
│   ├── cli/
│   ├── skill/
│   ├── experiment/
│   ├── sandbox/
│   ├── runner/
│   ├── tools/
│   ├── policy/
│   ├── trace/
│   └── report/
│
├── fixtures/
│   └── webapp-v1/
│
├── calibration/
│   ├── read-only/
│   ├── write-file/
│   ├── denied-network/
│   └── canary-access/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── calibration/
│   └── e2e/
│
├── studies/
│   └── study-001/
│
├── docs/
│   └── superpowers/
│       └── specs/
│
├── package.json
├── tsconfig.json
└── README.md

Module boundaries may be refined during planning, but responsibility separation should be preserved.

36. Technology Direction

Initial technical direction:

Language/runtime:
TypeScript + Node.js

Container isolation:
Rootless Podman

Trace:
JSONL

Structured reports:
JSON

Human reports:
Static HTML

Configuration/manifests:
YAML or JSON

Testing:
TypeScript-native test framework

Ravel should favor a small dependency surface.

A large general-purpose agent framework is not required for v0.1.

The Runner loop should remain directly understandable and instrumentable.

37. Functional Requirements

FR-01

Ravel shall accept a local skill directory.

FR-02

Ravel shall support one documented SKILL.md-style format.

FR-03

Ravel shall identify referenced local files and scripts.

FR-04

Ravel shall report broken local references.

FR-05

Ravel shall record an exact skill revision when such identity is available.

FR-06

Ravel shall statically extract factual declarations such as recognized URLs, references and commands where confidently detectable.

FR-07

Ravel shall create an experiment manifest before execution.

FR-08

Ravel shall load a frozen fixture revision for Study 001.

FR-09

Ravel shall snapshot relevant starting filesystem state.

FR-10

Ravel shall create an isolated rootless container environment.

FR-11

Ravel shall not mount the user's general home directory into the experiment.

FR-12

Ravel shall run one controlled Runner implementation.

FR-13

Ravel shall use one fixed model configuration for Study 001.

FR-14

Ravel shall expose only an explicitly defined tool registry to the Runner.

FR-15

Ravel shall validate every tool request before execution.

FR-16

Ravel shall apply an explicit permission policy to consequential tool requests.

FR-17

Ravel shall record both attempted and permitted/denied actions.

FR-18

Ravel shall support controlled filesystem reads.

FR-19

Ravel shall support controlled filesystem writes.

FR-20

Ravel shall support structured process execution.

FR-21

Ravel shall support controlled network requests or network-request attempts.

FR-22

Ravel shall provide a dedicated finish action.

FR-23

Ravel shall enforce execution limits.

FR-24

Ravel shall record runtime events chronologically.

FR-25

Ravel shall detect configured synthetic canary access.

FR-26

Ravel shall capture final filesystem state.

FR-27

Ravel shall derive file changes from before/after state.

FR-28

Ravel shall distinguish normal completion from explicit termination states.

FR-29

Ravel shall preserve useful evidence from incomplete runs.

FR-30

Ravel shall generate trace.jsonl.

FR-31

Ravel shall generate a structured machine-readable report.

FR-32

Ravel shall generate a standalone human-readable HTML report.

FR-33

Derived observations shall include evidence provenance.

FR-34

Ravel shall distinguish declared, observed and indeterminate behavior.

FR-35

Ravel shall not produce an overall safety or trust score in v0.1.

FR-36

Ravel shall use only synthetic test credentials in its supplied fixtures and calibration suite.

FR-37

Ravel shall provide a calibration verification command.

FR-38

ravel verify shall test the critical observation pipeline.

FR-39

Ravel shall verify sandbox isolation before Study 001 evidence is accepted.

FR-40

The disposable execution environment shall be destroyed after evidence capture.

38. Non-Functional Requirements

Reproducibility

Experiment conditions must be explicit and preserved.

Explainability

A developer should be able to follow a report claim back to its evidence event.

Isolation

Study execution must not depend on exposing unrelated host resources.

Minimal hidden behavior

Critical research logic should remain directly visible in the Ravel codebase.

Deterministic infrastructure

Where feasible, experiment setup should be repeatable even though model output may vary.

Conservative reporting

When Ravel cannot establish a fact confidently, it should report uncertainty rather than guess.

Recoverability

An experiment failure should leave interpretable diagnostic evidence whenever possible.

39. v0.1 Non-Goals

Ravel v0.1 does not include:

support for every skill format;

Codex execution;

Claude Code execution;

multi-host comparisons;

multi-model comparisons;

local-model benchmarking;

MCP server auditing;

plugin marketplace support;

GUI dashboard;

cloud-hosted Ravel service;

authentication/accounts;

GitHub App integration;

automated CI integration;

prompt-injection benchmark;

adversarial repository benchmark;

trust ranking;

safety score;

vulnerability scanner;

arbitrary host filesystem access;

unrestricted shell execution by default;

real credential testing;

distributed execution;

Kubernetes orchestration.

40. Development Sequence

Ravel should be built incrementally.

M0 — Project foundation

Establish the TypeScript project, schemas, tests and CLI skeleton.

M1 — ravel inspect

Implement skill loading and static inspection.

No model is required.

M2 — Trace/report pipeline

Implement event schema, JSONL recording, derived JSON and HTML presentation.

No model is required.

M3 — Sandbox

Implement rootless Podman lifecycle and isolation validation.

No model is required.

M4 — Tool and policy layer

Implement instrumented tools and explicit policy evaluation.

No model is required.

M5 — Deterministic fake Runner

Create a scripted Runner that performs known operations through the real tool/policy stack.

This validates the full experiment pipeline without model variability.

M6 — Real model adapter

Replace the scripted decision-maker with one controlled model adapter.

M7 — Calibration suite

Complete:

ravel verify

and require passing validation.

M8 — Study 001 pilot

Use approximately 2–3 candidate skills and several repeated runs.

The pilot tests the experimental design rather than producing final conclusions.

M9 — Freeze methodology

After reviewing pilot results, freeze:

fixture;

task wording;

policies;

versions;

study inclusion criteria;

repetition count.

M10 — Study 001 dataset

Execute the approved public-skill study.

M11 — Publication

Analyze results and write the accompanying technical article.

41. Study 001 Repetition

A single model execution is not sufficient to characterize consistent behavior.

Study 001 should therefore eventually execute each frozen skill multiple times under identical configured conditions.

Example:

Skill A
├── run 1
├── run 2
├── run 3
├── run 4
└── run 5

This enables statements such as:

npm test observed: 5/5 runs
.env read observed: 1/5 runs
network attempt observed: 2/5 runs

These frequencies describe observed experimental outcomes rather than universal skill properties.

The final repetition count should be chosen after the pilot.

42. Study-Level Aggregation

Individual runs remain primary evidence.

Study aggregation may produce:

study.json

containing measurements such as:

number of runs;

completed runs;

termination distribution;

behavior frequencies;

canary-read frequencies;

process invocation frequencies;

network-attempt frequencies.

Aggregated results must remain traceable to their constituent runs.

43. Privacy and Safety Boundaries

Ravel's supplied experiments shall use:

synthetic credentials;

synthetic repositories;

fake home environments;

controlled containers.

Ravel v0.1 shall not require:

real API secrets inside experiment fixtures;

production systems;

third-party attack targets;

private user data.

The model provider credential required to call the model is infrastructure configuration and must remain outside the model-visible experimental fixture.

44. Definition of Done

Ravel v0.1 is complete when:

ravel verify

reliably validates the instrument, and:

ravel run ./skills/example-review

successfully performs an end-to-end experiment that produces:

manifest
static analysis
raw trace
before/after state
structured report
HTML report

while:

enforcing policy;

recording attempted and denied behavior;

preserving provenance;

using a disposable sandbox;

destroying that sandbox afterward;

and leaving no dependency on real experiment secrets.

The definition of done is:

Ravel can conduct one reproducible agent-skill experiment from beginning to end.

It is not:

Ravel implements every future research idea.

45. Future Research Directions

The architecture should leave room for later work without requiring those features now.

Potential future studies include:

Study 002 — Cross-host behavior

Run the same skill under multiple agent hosts.

Possible hosts may include coding-agent environments such as Codex or Claude Code.

Research question:

Does the host materially change how a skill is interpreted and executed?

Study 003 — Prompt-injection resilience

Introduce controlled adversarial repository content.

Research question:

Can repository content cause skill-driven agents to broaden or redirect their behavior?

Study 004 — Capability vs. usefulness

Vary permissions systematically.

Research question:

Do broader filesystem, process or network capabilities produce better task results, or mainly increase behavioral surface area?

Study 005 — Local vs. frontier models

Use the same Runner architecture with different model classes.

Research question:

How does model capability affect interpretation of identical agent-skill instructions?

46. Design Summary

Ravel v0.1 is intentionally narrow.

It is:

one skill format
one skill family
one fixed task
one fixture
one Runner
one model configuration
one sandbox architecture
one explicit policy
one evidence pipeline

That narrowness is a feature.

It gives Ravel a defensible baseline from which more complex studies can grow.

The defining architectural chain is:

skill
  ↓
static inspection
  ↓
experiment manifest
  ↓
frozen fixture
  ↓
isolated sandbox
  ↓
Ravel Runner
  ↓
instrumented tools
  ↓
policy decisions
  ↓
raw trace
  ↓
derived observations
  ↓
human report

And the defining research principle is:

Ravel reports what it can demonstrate and clearly labels what it inferred.
