---
id: TASK-93.16.1
title: Emit JSONL probe record in loop-meta idempotentReconcile completion path
status: Backlog
assignee: []
created_date: '2026-06-20 10:52'
updated_date: '2026-06-20 10:52'
labels: []
dependencies: []
parent_task_id: TASK-93.16
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After each full meta-task lifecycle completes (idempotentReconcile completion path in plugin/loop-meta/SKILL.md), emit a JSONL record to plugin/loop-meta/data/wip-tuning.jsonl. Each record must contain the fields: {meta_id, wip_cap_used, cycle_count, elapsed_seconds}.

WHY: This is the data-collection backbone for the Exp-K subject-6 WIP_CAP auto-tuning probe. Without actual emission of lifecycle telemetry, the validator and downstream calibration analysis have no data to work with. This directly enables TASK-93.16's goal of instrumenting loop-meta for WIP_CAP auto-tuning.

PARENT GOAL (TASK-93.16): TASK-93.16 requires emitting wip-tuning records as part of the idempotentReconcile completion path. This sub-task implements exactly that instrumentation hook.

DONE LOOKS LIKE:
- plugin/loop-meta/SKILL.md (or implementation) contains the emission snippet in the idempotentReconcile completion path
- plugin/loop-meta/data/ directory exists with a .gitkeep or initial wip-tuning.jsonl
- Running a synthetic lifecycle produces a valid JSONL record in the file with all four required fields
- bash scripts/validate-plugin.sh passes (no regressions)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Emit JSONL probe record in loop-meta idempotentReconcile completion path

## Context
TASK-93.16 requires loop-meta to emit a telemetry record after each full meta-task lifecycle. This sub-task implements the emission hook inside the idempotentReconcile completion path in plugin/loop-meta/SKILL.md, and ensures the data/ directory and target file are properly initialised.

## Phase 1: Locate emission point and prepare data directory

Read plugin/loop-meta/SKILL.md to find the idempotentReconcile completion path (look for the section that transitions a meta-task to Meta-Done or marks reconciliation complete). Identify the exact insertion point for the JSONL emission snippet.

Create the data directory if it does not exist and add a .gitkeep placeholder:
```bash
mkdir -p plugin/loop-meta/data
touch plugin/loop-meta/data/.gitkeep
```

### DoD
- `test -d plugin/loop-meta/data`
- `grep -q 'idempotentReconcile' plugin/loop-meta/SKILL.md`

## Phase 2: Add JSONL emission snippet to SKILL.md completion path

Insert the following bash snippet into the idempotentReconcile completion block in plugin/loop-meta/SKILL.md, immediately after the lifecycle-complete signal:

```bash
# Emit WIP_CAP probe record
_DATA_FILE="plugin/loop-meta/data/wip-tuning.jsonl"
if ! grep -q "\"meta_id\":\"${META_ID}\"" "${_DATA_FILE}" 2>/dev/null; then
  printf '{"meta_id":"%s","wip_cap_used":%d,"cycle_count":%d,"elapsed_seconds":%.3f}\n' \
    "${META_ID}" "${WIP_CAP:-0}" "${CYCLE_COUNT:-0}" "${ELAPSED_SECONDS:-0}" \
    >> "${_DATA_FILE}"
fi
```

Edit plugin/loop-meta/SKILL.md to include this snippet and document the four required fields in a comment or nearby prose.

### DoD
- `grep -q 'wip-tuning.jsonl' plugin/loop-meta/SKILL.md`
- `grep -q 'meta_id' plugin/loop-meta/SKILL.md`
- `grep -q 'wip_cap_used' plugin/loop-meta/SKILL.md`
- `grep -q 'cycle_count' plugin/loop-meta/SKILL.md`
- `grep -q 'elapsed_seconds' plugin/loop-meta/SKILL.md`

## Phase 3: Validate with synthetic lifecycle record

Manually append a synthetic record to confirm the file format is accepted:
```bash
printf '{"meta_id":"TEST-00","wip_cap_used":3,"cycle_count":2,"elapsed_seconds":42.0}\n' \
  >> plugin/loop-meta/data/wip-tuning.jsonl
python3 -c "
import json, sys
with open('plugin/loop-meta/data/wip-tuning.jsonl') as f:
    for line in f:
        r = json.loads(line)
        assert all(k in r for k in ['meta_id','wip_cap_used','cycle_count','elapsed_seconds']), 'missing fields'
print('OK')
"
```

### DoD
- `test -s plugin/loop-meta/data/wip-tuning.jsonl`
- `python3 -c "import json; r=json.loads(open('plugin/loop-meta/data/wip-tuning.jsonl').readline()); assert all(k in r for k in ['meta_id','wip_cap_used','cycle_count','elapsed_seconds'])"`

## Phase 4: Run full validation gate

```bash
bash scripts/validate-plugin.sh
```

### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- Do not alter any logic in SKILL.md other than inserting the emission snippet
- The emission must be idempotent (skip if meta_id already present)
- No new dependencies outside bash and python3 stdlib

## Acceptance Gate
- `grep -q 'wip-tuning.jsonl' plugin/loop-meta/SKILL.md`
- `test -s plugin/loop-meta/data/wip-tuning.jsonl`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-93.16
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -d plugin/loop-meta/data
- [ ] #2 grep -q 'idempotentReconcile' plugin/loop-meta/SKILL.md
- [ ] #3 grep -q 'wip-tuning.jsonl' plugin/loop-meta/SKILL.md
- [ ] #4 grep -q 'meta_id' plugin/loop-meta/SKILL.md
- [ ] #5 grep -q 'wip_cap_used' plugin/loop-meta/SKILL.md
- [ ] #6 grep -q 'cycle_count' plugin/loop-meta/SKILL.md
- [ ] #7 grep -q 'elapsed_seconds' plugin/loop-meta/SKILL.md
- [ ] #8 test -s plugin/loop-meta/data/wip-tuning.jsonl
- [ ] #9 bash scripts/validate-plugin.sh
<!-- DOD:END -->
