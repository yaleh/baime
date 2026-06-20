---
id: TASK-93.14.2
title: >-
  Implement --compare flag and results-comparison.md report for
  run-quantitative-experiment
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:53'
labels:
  - experiment
  - skill-extension
  - Exp-K
dependencies:
  - TASK-93.14.1
parent_task_id: TASK-93.14
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a --compare flag to the run-quantitative-experiment skill. When invoked, the skill reads both results.json and results-replicated.json from the experiment directory and renders a results-comparison.md report with a STABLE/DIVERGED verdict per fixture and an overall convergence summary.

**Why:** Human and OCA reviewers need a human-readable comparison document to confirm that methodology claims are reproducible. The per-fixture STABLE/DIVERGED verdict and convergence summary make divergences immediately actionable.

**Parent goal (TASK-93.14):** Extend run-quantitative-experiment to support replication and comparison, enabling OCA convergence checking for methodology claims. This sub-task delivers the comparison report output, the second capability described in TASK-93.14.

**Depends on:** TASK-93.14.1 (--replicate mode, which produces results-replicated.json)

## Implementation Plan

### Phase 1: Define comparison schema and report format
Document the comparison logic: which fields in results.json vs results-replicated.json are compared per fixture, what thresholds or equality rules determine STABLE vs DIVERGED, and what sections results-comparison.md must contain.

DoD:
- `grep -q "STABLE\|DIVERGED" plugin/skills/run-quantitative-experiment/SKILL.md`
- `grep -q "\-\-compare" plugin/skills/run-quantitative-experiment/SKILL.md`

### Phase 2: Implement --compare flag
Add --compare argument parsing to the skill entry point. When invoked, load results.json and results-replicated.json, compare fixture-by-fixture, and write results-comparison.md with: per-fixture STABLE/DIVERGED rows, divergence details for any DIVERGED fixture, and an overall convergence summary (N stable / M total).

DoD:
- `grep -q "\-\-compare" plugin/skills/run-quantitative-experiment/SKILL.md`
- `grep -q "results-comparison" plugin/skills/run-quantitative-experiment/SKILL.md`

### Phase 3: Validate with smoke fixture and run end-to-end
Using the smoke fixture from TASK-93.14.1, run --replicate then --compare and verify results-comparison.md is produced with STABLE/DIVERGED verdicts and a convergence summary section.

DoD:
- `find plugin/skills/run-quantitative-experiment -name "results-comparison*" -o -name "*comparison.md" | grep -q . || grep -q "results-comparison" plugin/skills/run-quantitative-experiment/SKILL.md`
- `bash scripts/validate-plugin.sh`

## Constraints
- --compare is read-only: it only reads results.json and results-replicated.json, never re-runs fixtures
- If either input file is missing, --compare must exit non-zero with a clear error message
- results-comparison.md must have a top-level convergence summary section
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q "\-\-compare" plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #3 grep -q "STABLE\|DIVERGED" plugin/skills/run-quantitative-experiment/SKILL.md
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.14
<!-- SECTION:NOTES:END -->
