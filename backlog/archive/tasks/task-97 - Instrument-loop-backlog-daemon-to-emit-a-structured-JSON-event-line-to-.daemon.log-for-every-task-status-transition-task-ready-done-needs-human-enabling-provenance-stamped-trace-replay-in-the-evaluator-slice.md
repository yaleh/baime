---
id: TASK-97
title: >-
  Instrument loop-backlog daemon to emit a structured JSON event line to
  .daemon.log for every task status transition (task-ready, done, needs-human),
  enabling provenance-stamped trace replay in the evaluator slice
status: Meta-Active
assignee: []
created_date: '2026-06-20 10:26'
updated_date: '2026-06-20 10:47'
labels: []
dependencies: []
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Instrument loop-backlog daemon to emit a structured JSON event line to .daemon.log for every task status transition (task-ready, done, needs-human), enabling provenance-stamped trace replay in the evaluator slice.

Rationale: Three sub-tasks: (1) add JSON event emission to loop-backlog-daemon.js, (2) update extract-replan-markers.sh to parse new JSON lines, (3) add daemon unit tests for new event format. Well-scoped with shell-testable gates.

This meta-task is part of TASK-93 Exp-K experiment corpus (input MT-03).
Source: plugin/loop-meta/data/task-notes/meta-task-inputs.json
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 3 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.

Sub-tasks created:
- TASK-97.1: Add structured JSON event emission to loop-backlog-daemon.js
- TASK-97.2: Update extract-replan-markers.sh to parse JSON event lines (depends on TASK-97.1)
- TASK-97.3: Add unit tests for JSON event emission format (depends on TASK-97.1, TASK-97.2)

idempotentReconcile: no gap — sub-tasks present with shell-gate DoDs (verify-subtask-dod: PASS). Promoted to Meta-Active for Exp-K lifecycle execution.

evaluator: Met | dod_slice: PASS | data_source: measured
<!-- SECTION:NOTES:END -->
