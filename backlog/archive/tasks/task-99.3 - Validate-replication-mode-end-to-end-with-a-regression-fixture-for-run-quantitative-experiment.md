---
id: TASK-99.3
title: >-
  Validate replication mode end-to-end with a regression fixture for
  run-quantitative-experiment
status: Backlog
assignee: []
created_date: '2026-06-20 10:38'
updated_date: '2026-06-20 10:39'
labels: []
dependencies: []
parent_task_id: TASK-99
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a regression fixture that exercises the full replication pipeline end-to-end: given a known experiment config JSON with deterministic fixtures, run the skill in `--replicate` mode, produce `results-replicated.json`, then run `--compare` to produce `results-comparison.md`, and assert the verdict is STABLE.

This sub-task is the validation gate for TASK-99. It proves the `--replicate` flag (TASK-99.1) and the comparison report generator (TASK-99.2) work together correctly on a real invocation. It also satisfies the Exp-K corpus requirement that the meta-task includes a replan-triggering path — the fixture is designed to surface any output-format contract ambiguity between the two sub-tasks.

**Done when:**
- A regression fixture file exists at `plugin/run-quantitative-experiment/fixtures/replication-smoke.json` (or equivalent path documented in SKILL.md)
- Running the skill with `--replicate` on that fixture produces `results-replicated.json` without error
- Running `--compare` on the output directory produces `results-comparison.md` containing a STABLE verdict
- Shell gate: `grep -q 'replication\|replicate' plugin/run-quantitative-experiment/SKILL.md && grep -q 'STABLE' plugin/run-quantitative-experiment/SKILL.md`
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Validate replication mode end-to-end with a regression fixture for run-quantitative-experiment

## Context
TASK-99.1 adds the `--replicate` flag and TASK-99.2 adds the `--compare` comparison report. This sub-task closes the loop by creating a deterministic regression fixture and documenting the end-to-end invocation sequence in SKILL.md, confirming the two new modes work together without output-format ambiguity. It is the final acceptance gate for TASK-99.

## Phase 1: Confirm dependencies are in place
Verify that SKILL.md documents both `--replicate` (TASK-99.1) and `--compare` (TASK-99.2) before proceeding. This prevents creating a fixture against an incomplete contract.

### DoD
- `grep -q -- '--replicate' plugin/run-quantitative-experiment/SKILL.md`
- `grep -q -- '--compare' plugin/run-quantitative-experiment/SKILL.md`

## Phase 2: Create regression fixture JSON
Create `plugin/run-quantitative-experiment/fixtures/replication-smoke.json` — a minimal experiment config with at least 2 deterministic fixtures (fixed inputs, fixed expected outputs). The fixture must be self-contained: no external API calls, no randomness. Document the fixture schema inline with comments or a companion note in SKILL.md.

### DoD
- `test -f plugin/run-quantitative-experiment/fixtures/replication-smoke.json`
- `grep -q 'replication-smoke\|replication smoke' plugin/run-quantitative-experiment/SKILL.md`

## Phase 3: Document end-to-end invocation sequence in SKILL.md
Add a "Replication Smoke Test" section to SKILL.md that shows the exact sequence:
1. Run `--replicate plugin/run-quantitative-experiment/fixtures/replication-smoke.json`
2. Run `--compare <output-dir>`
3. Assert `results-comparison.md` contains `STABLE`

### DoD
- `grep -q 'Replication Smoke\|replication smoke' plugin/run-quantitative-experiment/SKILL.md`
- `grep -q 'results-comparison.md' plugin/run-quantitative-experiment/SKILL.md`

## Phase 4: Validate plugin contracts
Run the project validation script to confirm all changes pass structural checks.

### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- The fixture must be deterministic — no LLM calls with variable output, no timestamps in comparison keys
- Do not modify fixtures created by other sub-tasks
- The smoke test section in SKILL.md is documentation only — it does not execute automatically

## Acceptance Gate
- `test -f plugin/run-quantitative-experiment/fixtures/replication-smoke.json`
- `grep -q 'Replication Smoke\|replication smoke' plugin/run-quantitative-experiment/SKILL.md`
- `grep -q 'STABLE' plugin/run-quantitative-experiment/SKILL.md`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-99
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f plugin/run-quantitative-experiment/fixtures/replication-smoke.json
- [ ] #2 grep -q 'Replication Smoke\|replication smoke' plugin/run-quantitative-experiment/SKILL.md
- [ ] #3 grep -q 'STABLE' plugin/run-quantitative-experiment/SKILL.md
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->
