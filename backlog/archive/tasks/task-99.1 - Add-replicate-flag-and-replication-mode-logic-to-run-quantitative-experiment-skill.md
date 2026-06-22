---
id: TASK-99.1
title: >-
  Add --replicate flag and replication mode logic to run-quantitative-experiment
  skill
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:37'
labels: []
dependencies: []
parent_task_id: TASK-99
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the run-quantitative-experiment SKILL.md to accept a `--replicate` flag. When this flag is set, the skill accepts a path to an existing experiment config JSON (rather than constructing a new one), re-runs all fixtures defined in that config, and writes the results to `results-replicated.json` in the same directory as the original `results.json`.

This is the foundational change that enables replication mode for TASK-99. Without the flag and mode-switch logic, the skill cannot be driven into replication behavior. Sub-tasks for comparison report generation and regression fixture validation both depend on this being in place first.

**Done when:**
- SKILL.md documents the `--replicate <config-path>` option with clear semantics
- When invoked with `--replicate`, the skill reads the experiment config JSON from the given path, re-runs every fixture listed, and writes output to `results-replicated.json` co-located with the original results file
- The existing non-replicate invocation path is unchanged (regression-safe)
- Shell gate: `grep -q -- '--replicate' plugin/run-quantitative-experiment/SKILL.md && echo PASS`
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add --replicate flag and replication mode logic to run-quantitative-experiment skill

## Context
The run-quantitative-experiment skill currently only supports creating new experiments from scratch. TASK-99 requires a replication mode where an existing experiment config JSON can be re-run to produce `results-replicated.json` alongside the original `results.json`. This sub-task adds the `--replicate` flag and the mode-routing logic that makes replication possible.

## Phase 1: Audit current SKILL.md structure
Read `plugin/run-quantitative-experiment/SKILL.md` to understand the current invocation interface, config JSON schema, output file conventions, and phase structure. Identify exactly where the flag must be added and what the config JSON shape is (fixture list, output paths).

### DoD
- `test -f plugin/run-quantitative-experiment/SKILL.md`
- `grep -q 'experiment' plugin/run-quantitative-experiment/SKILL.md`

## Phase 2: Add --replicate flag documentation and mode logic to SKILL.md
Edit `plugin/run-quantitative-experiment/SKILL.md` to:
1. Add `--replicate <config-path>` to the invocation interface section, with description: "Re-run all fixtures from an existing experiment config JSON and write output to `results-replicated.json` in the same directory as the config file."
2. Add a mode-routing section that checks for the `--replicate` flag: if present, skip config-construction phases and jump directly to fixture execution using the provided config.
3. Ensure all existing non-replicate phases remain untouched (no renames, no removal of existing flags).

### DoD
- `grep -q -- '--replicate' plugin/run-quantitative-experiment/SKILL.md`
- `grep -q 'results-replicated.json' plugin/run-quantitative-experiment/SKILL.md`
- `grep -q 'mode-routing\|replication mode\|replicate mode' plugin/run-quantitative-experiment/SKILL.md`

## Phase 3: Validate plugin contracts
Run the project validation script to ensure SKILL.md still passes all structural checks.

### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- Do not modify any other plugin or skill file
- Do not change existing flag names or output file names for the non-replicate path
- The `results-replicated.json` must be written co-located with the original config's output directory, not a new location

## Acceptance Gate
- `grep -q -- '--replicate' plugin/run-quantitative-experiment/SKILL.md`
- `grep -q 'results-replicated.json' plugin/run-quantitative-experiment/SKILL.md`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-99
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q -- '--replicate' plugin/run-quantitative-experiment/SKILL.md
- [ ] #2 grep -q 'results-replicated.json' plugin/run-quantitative-experiment/SKILL.md
- [ ] #3 bash scripts/validate-plugin.sh
<!-- DOD:END -->
