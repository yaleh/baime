---
id: TASK-94
title: >-
  Add a contracts-density soft-warning to validate-plugin.sh: emit a warning
  when any SKILL.md has fewer than 1 contract per 50 lines of spec
status: Meta-Active
assignee: []
created_date: '2026-06-20 10:25'
updated_date: '2026-06-20 10:47'
labels: []
dependencies: []
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a contracts-density soft-warning to validate-plugin.sh: emit a warning when any SKILL.md has fewer than 1 contract per 50 lines of spec, helping catch under-specified skills early in CI.

Rationale: validate-plugin.sh already has a contracts-count path; this extends it with a density check. Two sub-tasks: (1) implement density check in shell, (2) add a regression test in validate-plugin test suite. Clear, measurable acceptance criteria make replan unlikely.

This meta-task is part of TASK-93 Exp-K experiment corpus (input MT-01).
Source: plugin/loop-meta/data/task-notes/meta-task-inputs.json
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 2 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.

idempotentReconcile: no gap — sub-tasks present with shell-gate DoDs (verify-subtask-dod: PASS). Promoted to Meta-Active for Exp-K lifecycle execution.

evaluator: Met | dod_slice: PASS | data_source: measured
<!-- SECTION:NOTES:END -->
