---
id: TASK-98
title: >-
  Add a loop-meta idempotency integration test: run draftDecomposition twice on
  the same meta-task fixture and assert that the second run appends 'children
  already exist' and creates zero new sub-tasks
status: Meta-Active
assignee: []
created_date: '2026-06-20 10:26'
updated_date: '2026-06-20 10:47'
labels: []
dependencies: []
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a loop-meta idempotency integration test: run draftDecomposition twice on the same meta-task fixture and assert that the second run appends 'children already exist' and creates zero new sub-tasks.

Rationale: Two sub-tasks: (1) write shell integration test fixture and driver, (2) wire it into the CI job in .github/workflows. The idempotency guard code already exists; this is purely testing and CI plumbing.

This meta-task is part of TASK-93 Exp-K experiment corpus (input MT-04).
Source: plugin/loop-meta/data/task-notes/meta-task-inputs.json
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 2 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.

idempotentReconcile: no gap — sub-tasks present with shell-gate DoDs (verify-subtask-dod: PASS). Promoted to Meta-Active for Exp-K lifecycle execution.

evaluator: Met | dod_slice: PASS | data_source: measured
<!-- SECTION:NOTES:END -->
