---
id: TASK-93.14
title: >-
  Exp-K subject 4: run-quantitative-experiment replication mode + comparison
  report
status: Backlog
assignee: []
created_date: '2026-06-20 10:50'
updated_date: '2026-06-20 10:53'
labels: []
dependencies: []
parent_task_id: TASK-93
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the run-quantitative-experiment skill to support a --replicate mode: given an existing experiment config JSON, re-run all fixtures and produce a results-replicated.json alongside the original results.json. Add a --compare flag that reads both files and renders a results-comparison.md with a STABLE/DIVERGED verdict per fixture and an overall convergence summary. Validate end-to-end with a regression smoke fixture. This enables OCA convergence checking for methodology claims.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 3 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.

- TASK-93.14.1: Implement --replicate mode (standalone, no deps)
- TASK-93.14.2: Implement --compare flag and comparison report (depends on TASK-93.14.1)
- TASK-93.14.3: Update SKILL.md contract + e2e integration test (depends on TASK-93.14.1, TASK-93.14.2)
<!-- SECTION:NOTES:END -->
