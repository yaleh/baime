---
id: TASK-96
title: >-
  Build a skill-lint severity matrix: categorise all existing validate-plugin.sh
  warnings as P0 (blocker), P1 (warning), or P2 (advisory), and write the
  mapping to plugin/.claude-plugin/lint-severity.json
status: Meta-Active
assignee: []
created_date: '2026-06-20 10:25'
updated_date: '2026-06-20 10:47'
labels: []
dependencies: []
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a skill-lint severity matrix: categorise all existing validate-plugin.sh warnings as P0 (blocker), P1 (warning), or P2 (advisory), and write the mapping to plugin/.claude-plugin/lint-severity.json so CI can gate on P0s only.

Rationale: Two clear sub-tasks: (1) audit current warning types and produce severity.json, (2) update validate-plugin.sh to read severity.json and exit non-zero only on P0s. Acceptance criteria are shell-testable (exit code, file existence).

This meta-task is part of TASK-93 Exp-K experiment corpus (input MT-02).
Source: plugin/loop-meta/data/task-notes/meta-task-inputs.json
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 2 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.

idempotentReconcile: no gap — sub-tasks present with shell-gate DoDs (verify-subtask-dod: PASS). Promoted to Meta-Active for Exp-K lifecycle execution.

evaluator: Met | dod_slice: PASS | data_source: measured
<!-- SECTION:NOTES:END -->
