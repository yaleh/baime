---
id: TASK-93.16
title: 'Exp-K subject 6: loop-meta WIP_CAP auto-tuning probe + schema validator'
status: Backlog
assignee: []
created_date: '2026-06-20 10:50'
updated_date: '2026-06-20 10:54'
labels: []
dependencies: []
parent_task_id: TASK-93
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After each full meta-task lifecycle, emit a JSONL record to plugin/loop-meta/data/wip-tuning.jsonl with fields {meta_id, wip_cap_used, cycle_count, elapsed_seconds}. Add this emission to the idempotentReconcile completion path in loop-meta SKILL.md. Write scripts/validate-wip-tuning.sh (using bash + python3 stdlib) to validate schema correctness for all records in the file, with positive and negative fixture tests. Integrate the validator into scripts/validate-plugin.sh. Add a README to plugin/loop-meta/data/ documenting the probe schema and WIP_CAP calibration guidance.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 4 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.
<!-- SECTION:NOTES:END -->
