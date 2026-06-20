---
id: TASK-93.16.4
title: >-
  Add README to plugin/loop-meta/data/ documenting probe schema and WIP_CAP
  calibration guidance
status: Backlog
assignee: []
created_date: '2026-06-20 10:54'
updated_date: '2026-06-20 10:54'
labels: []
dependencies: []
parent_task_id: TASK-93.16
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write plugin/loop-meta/data/README.md documenting: (1) the wip-tuning.jsonl probe schema with field definitions and types for {meta_id, wip_cap_used, cycle_count, elapsed_seconds}; (2) WIP_CAP calibration guidance — how to interpret the data and adjust WIP_CAP based on observed cycle_count and elapsed_seconds distributions; (3) how to run the schema validator manually; (4) the idempotency guarantee (records are not duplicated per meta_id).

WHY: TASK-93.16 explicitly requires a README in plugin/loop-meta/data/ for the probe schema and calibration guidance. Without this documentation, operators cannot understand the data format or how to act on it for WIP_CAP tuning.

PARENT GOAL (TASK-93.16): Satisfies the documentation requirement of TASK-93.16 as a standalone deliverable.

DONE LOOKS LIKE:
- plugin/loop-meta/data/README.md exists and is non-empty
- README contains a schema table or definition for all four fields with types
- README contains a WIP_CAP calibration guidance section
- README explains how to run validate-wip-tuning.sh manually
- bash scripts/validate-plugin.sh passes (no regressions)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add README to plugin/loop-meta/data/ documenting probe schema and WIP_CAP calibration guidance

## Context
TASK-93.16 requires a README in plugin/loop-meta/data/ that documents the wip-tuning probe schema and provides actionable WIP_CAP calibration guidance for operators. This is a documentation-only sub-task with no code changes.

## Phase 1: Check existing data directory and any existing docs

Check whether plugin/loop-meta/data/ exists and contains any existing documentation:
```bash
ls plugin/loop-meta/data/ 2>/dev/null || echo "directory absent"
```

Also read plugin/loop-meta/SKILL.md to understand the existing WIP_CAP context and how idempotentReconcile works, so the README is accurate.

### DoD
- `test -d plugin/loop-meta/data`

## Phase 2: Write plugin/loop-meta/data/README.md

Create plugin/loop-meta/data/README.md with the following sections:

1. **Overview** — what wip-tuning.jsonl is, when records are emitted, and who produces them (loop-meta idempotentReconcile completion path)

2. **Probe Schema** — table with columns: Field | Type | Description for all four fields:
   - `meta_id` (string): unique identifier of the meta-task
   - `wip_cap_used` (integer): WIP_CAP value in effect during the lifecycle
   - `cycle_count` (integer): number of reconcile cycles executed
   - `elapsed_seconds` (float): wall-clock seconds from lifecycle start to completion

3. **Idempotency Guarantee** — records are not duplicated; if meta_id already appears in the file, emission is skipped

4. **WIP_CAP Calibration Guidance** — actionable guidance:
   - If median cycle_count > WIP_CAP * 1.5, consider raising WIP_CAP
   - If median elapsed_seconds > target SLA, investigate bottleneck tasks
   - Suggested python3 one-liner for computing stats from the file

5. **Running the Schema Validator** — exact command:
   ```bash
   bash scripts/validate-wip-tuning.sh [path/to/wip-tuning.jsonl]
   bash scripts/validate-wip-tuning.sh --test   # run fixture tests
   ```

### DoD
- `test -f plugin/loop-meta/data/README.md`
- `test -s plugin/loop-meta/data/README.md`
- `grep -q 'meta_id' plugin/loop-meta/data/README.md`
- `grep -q 'wip_cap_used' plugin/loop-meta/data/README.md`
- `grep -q 'elapsed_seconds' plugin/loop-meta/data/README.md`
- `grep -q 'WIP_CAP' plugin/loop-meta/data/README.md`
- `grep -q 'validate-wip-tuning.sh' plugin/loop-meta/data/README.md`

## Phase 3: Run full validation gate

```bash
bash scripts/validate-plugin.sh
```

### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- README is the only file created or modified in this sub-task
- No changes to SKILL.md or any script
- Calibration guidance must be actionable (specific thresholds or formulas), not vague

## Acceptance Gate
- `test -s plugin/loop-meta/data/README.md`
- `grep -q 'WIP_CAP' plugin/loop-meta/data/README.md`
- `grep -q 'validate-wip-tuning.sh' plugin/loop-meta/data/README.md`
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
- [ ] #2 test -s plugin/loop-meta/data/README.md
- [ ] #3 grep -q 'meta_id' plugin/loop-meta/data/README.md
- [ ] #4 grep -q 'wip_cap_used' plugin/loop-meta/data/README.md
- [ ] #5 grep -q 'elapsed_seconds' plugin/loop-meta/data/README.md
- [ ] #6 grep -q 'WIP_CAP' plugin/loop-meta/data/README.md
- [ ] #7 grep -q 'validate-wip-tuning.sh' plugin/loop-meta/data/README.md
- [ ] #8 bash scripts/validate-plugin.sh
<!-- DOD:END -->
