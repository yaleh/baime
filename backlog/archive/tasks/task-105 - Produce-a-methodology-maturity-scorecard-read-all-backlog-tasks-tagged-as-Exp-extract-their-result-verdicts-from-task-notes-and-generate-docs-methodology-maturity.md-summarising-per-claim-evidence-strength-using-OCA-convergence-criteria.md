---
id: TASK-105
title: >-
  Produce a methodology maturity scorecard: read all backlog tasks tagged as
  Exp-*, extract their result verdicts from task notes, and generate
  docs/methodology-maturity.md summarising per-claim evidence strength using OCA
  convergence criteria
status: Meta-Active
assignee: []
created_date: '2026-06-20 10:27'
updated_date: '2026-06-20 10:47'
labels: []
dependencies: []
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Produce a methodology maturity scorecard: read all backlog tasks tagged as Exp-*, extract their result verdicts (Met/NotMet/Inconclusive) from task notes, and generate docs/methodology-maturity.md summarising per-claim evidence strength using the OCA convergence criteria.

Rationale: Four sub-tasks: (1) write scripts/extract-exp-verdicts.sh to parse Exp-* task notes, (2) implement scoring logic using OCA criteria in a Python script, (3) generate docs/methodology-maturity.md from scores, (4) add a gate that fails if any P0 claim has zero measured evidence. Real project need: baime lacks a consolidated evidence-strength dashboard.

This meta-task is part of TASK-93 Exp-K experiment corpus (input MT-11).
Source: plugin/loop-meta/data/task-notes/meta-task-inputs.json
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
idempotentReconcile: no gap — sub-tasks present with shell-gate DoDs (verify-subtask-dod: PASS). Promoted to Meta-Active for Exp-K lifecycle execution.

Decomposition complete: 4 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.

Sub-tasks created:
- TASK-105.1: Write scripts/extract-exp-verdicts.sh to parse Exp-* backlog task notes
- TASK-105.2: Implement OCA scoring logic in scripts/score-maturity.py using exp-verdicts.json
- TASK-105.3: Generate docs/methodology-maturity.md from maturity-scores.json
- TASK-105.4: Add gate script scripts/check-p0-evidence.sh that fails if any P0 claim has zero measured evidence

evaluator: Met | dod_slice: PASS | data_source: measured
<!-- SECTION:NOTES:END -->
