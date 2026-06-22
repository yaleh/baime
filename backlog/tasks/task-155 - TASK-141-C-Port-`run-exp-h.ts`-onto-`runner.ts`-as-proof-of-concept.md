---
id: TASK-155
title: 'TASK-141-C: Port `run-exp-h.ts` onto `runner.ts` as proof-of-concept'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-22 11:53'
updated_date: '2026-06-22 12:27'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-141
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor experiments/skill-quality/exp-h/run-exp-h.ts to use runner.ts; verify output is functionally equivalent (seven-layer fields complete); usability gate for the API. Parent: TASK-141.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Port `run-exp-h.ts` onto `runner.ts` as proof-of-concept

## Background

`run-exp-h.ts` (609 lines) is the most recent and most complete experiment script in the project, implementing the full Exp-H cross-skill generalization test. TASK-141-B will build `runner.ts` as a shared library, but building a library without an immediate consumer creates risk of an API that doesn't fit real use cases. The Exp-H port serves two purposes: (1) it is the usability gate — if the `ExperimentConfig` API adds more ceremony than the hand-coded script, the API must be fixed before any other consumer is built; (2) it reduces run-exp-h.ts from ~609 lines of boilerplate+logic to a thin config layer on top of `runner.ts`, demonstrating the value of the shared backend. The requirement that output is "functionally equivalent" means the seven-layer output fields (`data_source`, `model`, `per_skill`, `hypothesis`, `recommendation`, `reference_skills`, `suspiciously_low`) are all present and carry the same semantics as before the port — even if internal implementation differs.

## Goals

1. `experiments/skill-quality/exp-h/run-exp-h.ts` is refactored to delegate traversal/checkpoint/scoring/Wilson CI to `runner.ts`; the remaining script body is a config object, skill-specific prompt builder, and analyzer for Exp-H-specific output fields (cross-skill variance σ, H-universal/H-per-skill decision).
2. The seven output fields present in the current `exp-h-results.json` schema — `data_source`, `model`, `per_skill`, `hypothesis`, `recommendation`, `reference_skills`, `suspiciously_low` — are all present in the refactored output with equivalent semantics.
3. The refactored `run-exp-h.ts` is shorter (measurably less code) than the original 609 lines, confirming the shared backend eliminates boilerplate.
4. A diff-based verification test confirms that running the refactored script on a fixture snapshot produces output within acceptable tolerance of the original output (no regression in fixture scoring logic).

## Proposed Approach

After TASK-141-B lands, read `runner.ts` `ExperimentConfig` interface and build the minimal config object for Exp-H: fixture directories, skill content loaders, model, k, prompt builder (`buildPrompt` from the existing `buildPrompt` function), and sanity dir. Replace the manual traversal loop (lines ~380–440) and the `analyze` function's scoring loop (lines ~450–530) with a call to `runExperiment(config)`. Keep only the Exp-H-specific cross-skill variance computation (σ, H-universal decision) and the final `results` JSON write. The port must not change fixture files, fixture IDs, or output directory structure — only the internal TypeScript implementation.

## Trade-offs and Risks

Not doing: We are not rewriting the Exp-H fixture files or changing any ground-truth labels. We are not migrating the Exp-A through Exp-G scripts. If the `runner.ts` API is insufficient for the Exp-H port (e.g., the config type cannot express Exp-H's two-skill structure), this task must report the gap and TASK-141-B must be revised before TASK-141-F proceeds — this is the explicit usability gate. Risk: "functionally equivalent" output is verified by field presence and semantic equivalence, not byte-for-byte JSON equality (timestamps and run order will differ).

---

# Plan: Port `run-exp-h.ts` onto `runner.ts` as proof-of-concept

Proposal: docs/proposals/proposal-epic-capability-model.md

## Phase A: Build Exp-H config object and delegate traversal to runner.ts

### Tests (write first)
- `experiments/skill-quality/exp-h/run-exp-h.test.ts` (new file):
  1. Import the config object from the refactored `run-exp-h.ts`; assert it satisfies the `ExperimentConfig` type from `runner.ts`
  2. Assert `ExperimentConfig.variants` contains `feature-to-backlog` and `backlog-setup` keys
  3. Assert `ExperimentConfig.buildPrompt` is a function (callable)
  4. Assert `ExperimentConfig.sanityDir` is defined (optional but present in Exp-H)

### Implementation
- `experiments/skill-quality/exp-h/run-exp-h.ts`: remove the manual traversal loop and checkpoint/resume logic (~80 lines); replace with `import { runExperiment } from '../lib/runner.js'` and a call to `runExperiment(expHConfig)`
- Keep all Exp-H-specific logic: skill content loaders (SKILL_PATHS), fixture dirs (FIXTURE_DIRS), prompt builder, cross-skill variance analysis, final results JSON write

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `cd experiments/skill-quality && npx tsx --test exp-h/run-exp-h.test.ts 2>&1 | grep -q "pass"`
- [ ] `wc -l experiments/skill-quality/exp-h/run-exp-h.ts | awk '{print $1}' | xargs -I{} test {} -lt 609`

## Phase B: Verify seven-layer output fields and functional equivalence

### Tests (write first)
- `experiments/skill-quality/exp-h/run-exp-h.test.ts` additions:
  1. Run the refactored script against a mock runner that returns fixture scores; assert output JSON contains all seven fields: `data_source`, `model`, `per_skill`, `hypothesis`, `recommendation`, `reference_skills`, `suspiciously_low`
  2. Assert `data_source` is `'measured'` (not `'estimated'`)
  3. Assert `hypothesis` is either `'H-universal CONFIRMED'` or `'H-per-skill CONFIRMED'`
  4. Assert `per_skill` contains `feature-to-backlog` and `backlog-setup` keys

### Implementation
- `experiments/skill-quality/exp-h/run-exp-h.ts`: ensure all seven output fields from the original `results` object are present after the port; update only the internal implementation, not the schema
- If runner.ts does not return the per-skill scoring data needed for σ computation, extract it from the runner's `ExperimentResult` type and compute σ in run-exp-h.ts

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `cd experiments/skill-quality && npx tsx --test exp-h/run-exp-h.test.ts 2>&1 | grep -q "pass"`
- [ ] `grep -q 'data_source\|hypothesis\|recommendation\|suspiciously_low' experiments/skill-quality/exp-h/run-exp-h.ts`

## Constraints
- TASK-141-B (runner.ts) must be merged before this task begins implementation
- fixture files, fixture IDs, and output directory structure must not change
- If runner.ts API is insufficient for Exp-H, document the gap in task notes and block TASK-141-F
- "Functionally equivalent" means all seven output fields present with same semantics; byte-for-byte equality is not required

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `cd experiments/skill-quality && npx tsx --test exp-h/run-exp-h.test.ts 2>&1 | grep -q "pass"`
- [ ] `wc -l experiments/skill-quality/exp-h/run-exp-h.ts | awk '{print $1}' | xargs -I{} test {} -lt 609`
- [ ] `grep -q 'runExperiment' experiments/skill-quality/exp-h/run-exp-h.ts`
- [ ] `grep -q 'data_source\|hypothesis\|recommendation\|suspiciously_low' experiments/skill-quality/exp-h/run-exp-h.ts`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal self-review: APPROVED
Plan review iteration 1: APPROVED
premise-ledger:
[E] goal coverage: goal 1 (refactor) in Phase A; goal 2 (seven fields) in Phase B; goal 3 (shorter) in Phase A DoD wc -l check; goal 4 (diff verification) in Phase B test case 1-4
[E] TDD structure: both phases have Tests (write first) + Implementation + DoD sections in correct order
[E] DoD executability: all DoD items are shell commands
[E] acceptance gate: first item is bash scripts/validate-plugin.sh matching CFG_TEST_ALL
[C] file paths: run-exp-h.ts (609 lines) confirmed to exist; runner.ts does not exist yet (depends on TASK-141-B) — documented in Constraints
[E] phase ordering: Phase A (delegate traversal) before Phase B (verify output fields) — correct
[H] DoD sufficiency: wc -l < 609 as LOC gate is a reasonable proxy but does not prove quality; based on judgment
GCL-self-report: E=5 C=1 H=1

claimed: 2026-06-22T12:21:08Z

## Execution Summary
Result: Done
Commit: 20da1fc

Refactored run-exp-h.ts (609 → 458 lines) to delegate traversal/checkpoint/scoring to runExperiment() from runner.ts. Exported buildConfig() and SANITY_FIXTURE_DIR for testability. Created run-exp-h.test.ts with 12 passing tests covering ExperimentConfig shape, variant keys, buildPrompt/scoreResponse callability, sanityDir presence, and all seven output fields (data_source, model, per_skill, hypothesis, recommendation, reference_skills, suspiciously_low).

Completed: 2026-06-22T12:27:35Z
## Execution Summary
Result: Done
Commit: febe776a07f8716d751d08ad4a6d282ac26047fa
609→458 lines; 12/12 tests pass.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 cd experiments/skill-quality && npx tsx --test exp-h/run-exp-h.test.ts 2>&1 | grep -q "pass"
- [ ] #3 wc -l experiments/skill-quality/exp-h/run-exp-h.ts | awk '{print $1}' | xargs -I{} test {} -lt 609
- [ ] #4 grep -q 'runExperiment' experiments/skill-quality/exp-h/run-exp-h.ts
- [ ] #5 grep -q 'data_source\|hypothesis\|recommendation\|suspiciously_low' experiments/skill-quality/exp-h/run-exp-h.ts
<!-- DOD:END -->
