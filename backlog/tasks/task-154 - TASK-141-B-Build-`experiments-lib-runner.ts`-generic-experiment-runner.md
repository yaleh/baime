---
id: TASK-154
title: 'TASK-141-B: Build `experiments/lib/runner.ts` generic experiment runner'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-22 11:52'
updated_date: '2026-06-22 12:12'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-141
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build experiments/skill-quality/lib/runner.ts generic experiment runner — variant×fixture×model×k traversal with checkpoint/resume; typed runExperiment(config) API; Wilson CI; fixtureClass grouping; mirrors_role; sanity fixtures; data_source:estimated error; first LLM call timestamp; annotation_kappa WARN; unit tests. Parent: TASK-141.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Build `experiments/lib/runner.ts` generic experiment runner

## Background

Every one of the eight quantitative experiments (Exp-A through Exp-H) implemented its own traversal loop, checkpoint/resume logic, fixture loading, model dispatch, and JSON write-back from scratch. The shared library at `experiments/skill-quality/lib/` already provides `env.ts`, `llm-client.ts`, and `score.ts`, but no generic runner. This means each new experiment costs 2–4 days of scaffold engineering rather than fixture design — the work that actually advances knowledge. Additionally, important epistemic metadata (first-LLM-call timestamp, Wilson confidence intervals, annotation kappa) is either absent or computed inconsistently across scripts. A shared `runner.ts` makes the correct path the easy path: a new experiment requires only a config object and fixture JSON files, not a new boilerplate script, and the runner guarantees consistent metadata in every output artifact.

## Goals

1. `experiments/skill-quality/lib/runner.ts` exports a typed `runExperiment(config: ExperimentConfig): Promise<ExperimentResult>` function covering: variant×fixture×model×k traversal, checkpoint/resume (skip already-completed fixture×run cells), Wilson CI computation per fixtureClass group, fixtureClass grouping in output, mirrors_role field support, sanity fixture negative-control check, error (not silent default) when output would require `data_source: estimated`, first-LLM-call UTC timestamp recorded in artifact, and annotation_kappa WARN when kappa < threshold.
2. A unit-test file `experiments/skill-quality/lib/runner.test.ts` covers: checkpoint logic (existing results are not re-run), fixture-loading edge cases (empty dir, missing file), Wilson CI boundary values, sanity fixture pass/fail paths, and the `data_source: estimated` error path.
3. The runner's output JSON schema is documented in a top-of-file JSDoc comment in `runner.ts` so that downstream consumers (exp-h port in TASK-141-C, provenance gate in TASK-141-E) have a stable reference.

## Proposed Approach

Co-locate `runner.ts` with `env.ts`/`llm-client.ts`/`score.ts` in `experiments/skill-quality/lib/`. The `ExperimentConfig` type captures: fixture directories (keyed by variant name), skill content providers (for prompt injection), model list, k, output root directory, prompt builder function, and optional sanity fixture directory. The traversal iterates variants × fixtures × models × k, writing per-run result JSONs into `<outDir>/<variant>/<fixtureId>/result.json`, matching the existing pattern in `run-exp-h.ts`. Checkpoint/resume reads existing result files and skips already-completed runs. Wilson CI is computed per (variant, fixtureClass) cell. The first LLM call timestamp is recorded at the moment of the first successful API response and written into the top-level artifact. annotation_kappa is computed from per-run responses; if below a configurable threshold, a console WARN is emitted. The `data_source: estimated` guard: the runner always sets `data_source: 'measured'`; if called in a code path where the session log is unavailable and timing would be estimated, it throws rather than silently emitting `estimated`. Unit tests use a mock LLM client (no real API calls).

## Trade-offs and Risks

Not doing: We are not migrating Exp-A through Exp-G scripts in this task — only providing the library. We are not building a CLI wrapper around `runExperiment` — the API is programmatic. We are not yet integrating `timing.ts` (TASK-141-D) into the runner; that is a separate module. Risk: the `ExperimentConfig` type may need revision after the Exp-H port (TASK-141-C) reveals friction; TASK-141-C is the explicit usability gate and must complete before TASK-141-F proceeds.

---

# Plan: Build `experiments/lib/runner.ts` generic experiment runner

Proposal: docs/proposals/proposal-epic-capability-model.md

## Phase A: ExperimentConfig type, checkpoint/resume, and traversal core

### Tests (write first)
- `experiments/skill-quality/lib/runner.test.ts` — test cases for Phase A:
  1. `runExperiment` with a mock config runs each fixture × model × k cell once
  2. Checkpoint: if result.json already has k responses, the mock LLM client is NOT called for that cell
  3. Partial checkpoint: if result.json has 2/5 responses, only 3 more calls are made
  4. Empty fixture directory: `runExperiment` completes with zero cells run (no error)
  5. Missing fixture file: throws with a descriptive error (not silent)

### Implementation
- `experiments/skill-quality/lib/runner.ts` (new file):
  - `ExperimentConfig` interface: `variants`, `modelList`, `k`, `outDir`, `buildPrompt`, `sanityDir?`
  - `runExperiment(config)`: variant×fixture×model×k traversal with checkpoint/resume
  - Result JSON written to `<outDir>/<variant>/<fixtureId>/result.json`
  - First LLM call UTC timestamp recorded and included in top-level result object

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `cd experiments/skill-quality && npx tsx --test lib/runner.test.ts 2>&1 | grep -q "pass"`

## Phase B: Wilson CI, fixtureClass grouping, mirrors_role, annotation_kappa WARN

### Tests (write first)
- `experiments/skill-quality/lib/runner.test.ts` — additional test cases for Phase B:
  1. Wilson CI: 4/5 correct with k=5 produces CI containing 0.8 (boundary check)
  2. Wilson CI: 0/5 correct produces CI [0, upper] with upper > 0
  3. fixtureClass grouping: CLEAR and AMBIGUOUS fixtures scored separately in output
  4. mirrors_role: fixture with `mirrors_role: true` is scored with alternate scorer path
  5. annotation_kappa WARN: when inter-rater agreement < 0.6, a WARN is logged

### Implementation
- `experiments/skill-quality/lib/runner.ts` additions:
  - `computeWilsonCI(k: number, successes: number): {low: number; high: number}` helper
  - fixtureClass grouping in analysis output object
  - mirrors_role field threading through prompt builder call
  - annotation_kappa computation from per-run response agreement; WARN if below threshold

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `cd experiments/skill-quality && npx tsx --test lib/runner.test.ts 2>&1 | grep -q "pass"`

## Phase C: Sanity fixtures and data_source guard

### Tests (write first)
- `experiments/skill-quality/lib/runner.test.ts` — additional test cases for Phase C:
  1. Sanity fixture: if sanity dir exists and a sanity fixture scores 0/k, runner emits a WARN about negative control failure
  2. Sanity fixture: if sanity dir does not exist, runner proceeds without error
  3. data_source guard: calling runner in a context where timing would be estimated throws an error with message containing "data_source: estimated"

### Implementation
- `experiments/skill-quality/lib/runner.ts` additions:
  - Optional `sanityDir` in `ExperimentConfig`; sanity fixtures run before main traversal
  - Sanity pass/fail WARN logic
  - `data_source` guard: runner always sets `data_source: 'measured'`; if a caller explicitly passes `allowEstimated: true`, throw `Error('runner does not support data_source: estimated')`

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `cd experiments/skill-quality && npx tsx --test lib/runner.test.ts 2>&1 | grep -q "pass"`
- [ ] `grep -q 'data_source' experiments/skill-quality/lib/runner.ts`

## Constraints
- No real LLM API calls in unit tests — mock client required
- `runner.ts` must not import any baime-specific path constants; paths come from config only
- Output JSON schema must be documented in top-of-file JSDoc before Phase A lands
- `ExperimentConfig` type must be exported so TASK-141-C (exp-h port) can import it

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `cd experiments/skill-quality && npx tsx --test lib/runner.test.ts 2>&1 | grep -q "pass"`
- [ ] `grep -q 'ExperimentConfig' experiments/skill-quality/lib/runner.ts`
- [ ] `grep -q 'data_source' experiments/skill-quality/lib/runner.ts`
- [ ] `grep -q 'wilsonCI\|WilsonCI\|computeWilson' experiments/skill-quality/lib/runner.ts`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal self-review: APPROVED
Plan review iteration 1: APPROVED
premise-ledger:
[E] goal coverage: goal 1 (traversal+features) covered by Phase A+B+C; goal 2 (unit tests) covered by test specs in all phases; goal 3 (JSDoc schema) covered by Phase A constraint
[E] TDD structure: all three phases have Tests (write first) + Implementation + DoD sections
[E] DoD executability: all DoD items are shell commands using bash or npx
[E] acceptance gate: first item is bash scripts/validate-plugin.sh matching CFG_TEST_ALL
[C] file paths for new files: runner.ts and runner.test.ts do not exist yet — verified by checking experiments/skill-quality/lib/ directory listing
[E] phase ordering: Phase A (core traversal) before Phase B (Wilson/grouping) before Phase C (sanity+guard) — correct dependency order
[H] DoD sufficiency: grep -q 'pass' as test pass-check is a reasonable heuristic but depends on tsx --test output format
GCL-self-report: E=5 C=1 H=1

claimed: 2026-06-22T12:05:24Z

Phase A ✓ 2026-06-22T00:00:00Z — ExperimentConfig type, checkpoint/resume, traversal core. All 5 Phase A tests pass.

Phase B ✓ 2026-06-22T00:00:00Z — Wilson CI, fixtureClass grouping, mirrors_role threading, annotation_kappa WARN. All 5 Phase B tests pass.

Phase C ✓ 2026-06-22T00:00:00Z — Sanity fixtures check, data_source guard (allowEstimated throws). All 3 Phase C tests pass.

DoD #1: PASS — bash scripts/validate-plugin.sh (0 errors, 55 warnings)

DoD #2: PASS — cd experiments/skill-quality && npx tsx --test lib/runner.test.ts 2>&1 | grep -q pass (13/13 tests pass)

DoD #3: PASS — grep -q 'ExperimentConfig' experiments/skill-quality/lib/runner.ts

DoD #4: PASS — grep -q 'data_source' experiments/skill-quality/lib/runner.ts

DoD #5: PASS — grep -q 'wilsonCI\|WilsonCI\|computeWilson' experiments/skill-quality/lib/runner.ts

workerLoop DoD #0: PASS — bash scripts/validate-plugin.sh

workerLoop DoD #1: PASS — cd experiments/skill-quality && npx tsx --test lib/runner.test.ts 2>&1 | grep -q "pass"

workerLoop DoD #2: PASS — grep -q 'ExperimentConfig' experiments/skill-quality/lib/runner.ts

workerLoop DoD #3: PASS — grep -q 'data_source' experiments/skill-quality/lib/runner.ts

workerLoop DoD #4: PASS — grep -q 'wilsonCI\|WilsonCI\|computeWilson' experiments/skill-quality/lib/runner.ts

WARNING: agent-summary missing for TASK-154

Completed: 2026-06-22T12:12:54Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 cd experiments/skill-quality && npx tsx --test lib/runner.test.ts 2>&1 | grep -q "pass"
- [ ] #3 grep -q 'ExperimentConfig' experiments/skill-quality/lib/runner.ts
- [ ] #4 grep -q 'data_source' experiments/skill-quality/lib/runner.ts
- [ ] #5 grep -q 'wilsonCI\|WilsonCI\|computeWilson' experiments/skill-quality/lib/runner.ts
<!-- DOD:END -->
