---
id: TASK-99.2
title: >-
  Implement results comparison report generator for run-quantitative-experiment
  replication mode
status: Backlog
assignee: []
created_date: '2026-06-20 10:38'
updated_date: '2026-06-20 10:38'
labels: []
dependencies: []
parent_task_id: TASK-99
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a results comparison report generator that reads `results.json` and `results-replicated.json` produced by the run-quantitative-experiment skill and produces a human-readable comparison summary (`results-comparison.md`) showing per-fixture deltas, pass/fail changes, and a top-level verdict (STABLE / DIVERGED).

This component is the analytical output of TASK-99's replication mode. Without it, running replication produces two JSON files with no actionable insight. The comparison report makes divergence visible and auditable.

**Done when:**
- SKILL.md documents a `--compare` sub-command (or comparison phase) that reads `results.json` and `results-replicated.json` and writes `results-comparison.md`
- The report includes: per-fixture pass/fail status for both runs, delta in key metrics (score, duration), and a top-level STABLE/DIVERGED verdict
- Shell gate: `grep -q 'results-comparison.md' plugin/run-quantitative-experiment/SKILL.md`
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Implement results comparison report generator for run-quantitative-experiment replication mode

## Context
Once `--replicate` produces `results-replicated.json` alongside the original `results.json`, there is no tooling to surface what changed between the two runs. This sub-task adds a comparison phase (or `--compare` flag) to the run-quantitative-experiment skill that reads both JSON files and writes a `results-comparison.md` report with per-fixture status and a top-level STABLE/DIVERGED verdict.

## Phase 1: Audit output schema of results.json
Read `plugin/run-quantitative-experiment/SKILL.md` to understand the exact JSON schema used for `results.json` — specifically the fixture identifier field, pass/fail field name, and any numeric metric fields (score, duration). This determines what keys the comparison logic must read.

### DoD
- `test -f plugin/run-quantitative-experiment/SKILL.md`
- `grep -q 'results.json\|output' plugin/run-quantitative-experiment/SKILL.md`

## Phase 2: Document --compare flag and comparison phase in SKILL.md
Edit `plugin/run-quantitative-experiment/SKILL.md` to add:
1. A `--compare <dir>` flag description: "Read `results.json` and `results-replicated.json` from `<dir>` and write `results-comparison.md` to the same directory."
2. A comparison phase that:
   - Loads both JSON files
   - For each fixture: records pass/fail from original and replicated run, computes delta for numeric metrics (score, duration)
   - Emits a top-level verdict line: `STABLE` if all fixtures agree, `DIVERGED` if any fixture changed pass/fail status
3. The `results-comparison.md` report structure: header, per-fixture table, verdict line.

### DoD
- `grep -q 'results-comparison.md' plugin/run-quantitative-experiment/SKILL.md`
- `grep -q -- '--compare' plugin/run-quantitative-experiment/SKILL.md`
- `grep -q 'STABLE\|DIVERGED' plugin/run-quantitative-experiment/SKILL.md`

## Phase 3: Validate plugin contracts
Run the project validation script to confirm the updated SKILL.md still passes structural checks.

### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- Do not modify any existing flag behavior
- The comparison phase must be additive — it must not alter `results.json` or `results-replicated.json`
- Natural-language verdict descriptions go in `## Constraints`, not in DoD items

## Acceptance Gate
- `grep -q 'results-comparison.md' plugin/run-quantitative-experiment/SKILL.md`
- `grep -q -- '--compare' plugin/run-quantitative-experiment/SKILL.md`
- `grep -q 'STABLE\|DIVERGED' plugin/run-quantitative-experiment/SKILL.md`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-99
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'results-comparison.md' plugin/run-quantitative-experiment/SKILL.md
- [ ] #2 grep -q -- '--compare' plugin/run-quantitative-experiment/SKILL.md
- [ ] #3 grep -q 'STABLE\|DIVERGED' plugin/run-quantitative-experiment/SKILL.md
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->
