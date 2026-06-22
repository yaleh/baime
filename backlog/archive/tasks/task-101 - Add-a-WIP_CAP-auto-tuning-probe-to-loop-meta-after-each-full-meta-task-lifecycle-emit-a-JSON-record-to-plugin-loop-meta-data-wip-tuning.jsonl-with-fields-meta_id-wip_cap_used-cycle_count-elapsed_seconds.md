---
id: TASK-101
title: >-
  Add a WIP_CAP auto-tuning probe to loop-meta: after each full meta-task
  lifecycle, emit a JSON record to plugin/loop-meta/data/wip-tuning.jsonl with
  fields {meta_id, wip_cap_used, cycle_count, elapsed_seconds}
status: Meta-Active
assignee: []
created_date: '2026-06-20 10:26'
updated_date: '2026-06-20 10:47'
labels: []
dependencies: []
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a WIP_CAP auto-tuning probe to loop-meta: after each full meta-task lifecycle, emit a JSON record to plugin/loop-meta/data/wip-tuning.jsonl with fields {meta_id, wip_cap_used, cycle_count, elapsed_seconds} to accumulate throughput data for future WIP_CAP calibration.

Rationale: Three sub-tasks: (1) instrument idempotentReconcile to write JSONL record on meta-task completion, (2) add a wip-tuning schema validator script, (3) document the probe in loop-meta data README. All gates are shell-testable.

This meta-task is part of TASK-93 Exp-K experiment corpus (input MT-07).
Source: plugin/loop-meta/data/task-notes/meta-task-inputs.json
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 3 sub-tasks in Backlog.
- TASK-101.1: Instrument idempotentReconcile in loop-meta to emit JSONL record on meta-task completion (High)
- TASK-101.2: Add wip-tuning schema validator script for plugin/loop-meta/data/wip-tuning.jsonl (High)
- TASK-101.3: Document WIP_CAP auto-tuning probe in plugin/loop-meta/data/README.md (Medium)

Review sub-tasks, then set status → Meta-Active to start reconcile loop.

idempotentReconcile: no gap — sub-tasks present with shell-gate DoDs (verify-subtask-dod: PASS). Promoted to Meta-Active for Exp-K lifecycle execution.

evaluator: Met | dod_slice: PASS | data_source: measured
<!-- SECTION:NOTES:END -->
