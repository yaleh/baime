---
id: TASK-101.1
title: >-
  Instrument idempotentReconcile in loop-meta to emit JSONL record on meta-task
  completion
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:39'
labels: []
dependencies: []
parent_task_id: TASK-101
priority: high
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add instrumentation to the idempotentReconcile function in the loop-meta skill so that when a meta-task reaches Meta-Done status, it appends a JSON record to plugin/loop-meta/data/wip-tuning.jsonl. Each record must contain exactly four fields: meta_id (the task ID string), wip_cap_used (integer WIP_CAP value used during that lifecycle), cycle_count (integer number of reconcile cycles run), and elapsed_seconds (float seconds from first reconcile to Meta-Done).

This is sub-task 1 of 3 for TASK-101 (WIP_CAP auto-tuning probe). Without emitting per-lifecycle throughput data, there is no empirical basis for future WIP_CAP calibration. The JSONL file accumulates rows across runs, enabling statistical analysis of WIP_CAP vs throughput trade-offs.

parentTask: TASK-101
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Instrument idempotentReconcile in loop-meta to emit JSONL record on meta-task completion

## Context
TASK-101 adds a WIP_CAP auto-tuning probe to loop-meta. This sub-task (1 of 3) instruments idempotentReconcile to write one JSONL record per completed meta-task lifecycle to plugin/loop-meta/data/wip-tuning.jsonl. Without this instrumentation the other two sub-tasks (schema validator, README) have nothing to validate or document.

## Phase 1: Locate idempotentReconcile and understand its lifecycle boundaries

Read plugin/loop-meta/skill.md to find the idempotentReconcile function, identify where meta-task status transitions to Meta-Done, and locate where WIP_CAP and cycle_count are tracked.

### DoD
- [ ] `grep -q 'idempotentReconcile' plugin/loop-meta/skill.md`
- [ ] `grep -q 'Meta-Done' plugin/loop-meta/skill.md`

## Phase 2: Create data directory and JSONL emit logic

Create the directory plugin/loop-meta/data/ if absent. Add a emitWipTuningRecord helper (in skill.md prose / shell snippet) that:
1. Accepts meta_id, wip_cap_used, cycle_count, elapsed_seconds
2. Constructs a JSON object with exactly those four fields
3. Appends the JSON line to plugin/loop-meta/data/wip-tuning.jsonl (creating the file if absent)

Wire the call into idempotentReconcile at the point where meta-task status becomes Meta-Done.

### DoD
- [ ] `test -d plugin/loop-meta/data`
- [ ] `grep -q 'wip-tuning.jsonl' plugin/loop-meta/skill.md`
- [ ] `grep -q 'emitWipTuningRecord\|emit_wip_tuning\|wip_cap_used' plugin/loop-meta/skill.md`

## Phase 3: Write a synthetic fixture test and verify JSONL output

Write a minimal shell fixture script at plugin/loop-meta/data/test-emit-fixture.sh that:
1. Calls (or simulates) the emit logic with fixed test values: meta_id=TASK-TEST, wip_cap_used=3, cycle_count=5, elapsed_seconds=12.34
2. Verifies that wip-tuning.jsonl contains a valid JSON line with all four fields

### DoD
- [ ] `test -f plugin/loop-meta/data/test-emit-fixture.sh`
- [ ] `bash plugin/loop-meta/data/test-emit-fixture.sh`
- [ ] `python3 -c "import json,sys; rows=[json.loads(l) for l in open('plugin/loop-meta/data/wip-tuning.jsonl') if l.strip()]; assert all(set(['meta_id','wip_cap_used','cycle_count','elapsed_seconds']).issubset(r.keys()) for r in rows), 'missing fields'; print('PASS')"`

## Constraints
- Do not add new runtime dependencies beyond Python 3 (stdlib only) and standard shell
- The emit must be append-only; never truncate or overwrite existing records
- Do not modify unrelated parts of skill.md

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `python3 -c "import json,sys; rows=[json.loads(l) for l in open('plugin/loop-meta/data/wip-tuning.jsonl') if l.strip()]; assert all(set(['meta_id','wip_cap_used','cycle_count','elapsed_seconds']).issubset(r.keys()) for r in rows); print('PASS')"`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-101
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'idempotentReconcile' plugin/loop-meta/skill.md
- [ ] #2 grep -q 'Meta-Done' plugin/loop-meta/skill.md
- [ ] #3 test -d plugin/loop-meta/data
- [ ] #4 grep -q 'wip-tuning.jsonl' plugin/loop-meta/skill.md
- [ ] #5 grep -q 'emitWipTuningRecord\|emit_wip_tuning\|wip_cap_used' plugin/loop-meta/skill.md
- [ ] #6 test -f plugin/loop-meta/data/test-emit-fixture.sh
- [ ] #7 bash plugin/loop-meta/data/test-emit-fixture.sh
- [ ] #8 python3 -c "import json,sys; rows=[json.loads(l) for l in open('plugin/loop-meta/data/wip-tuning.jsonl') if l.strip()]; assert all(set(['meta_id','wip_cap_used','cycle_count','elapsed_seconds']).issubset(r.keys()) for r in rows), 'missing fields'; print('PASS')"
- [ ] #9 bash scripts/validate-plugin.sh
<!-- DOD:END -->
