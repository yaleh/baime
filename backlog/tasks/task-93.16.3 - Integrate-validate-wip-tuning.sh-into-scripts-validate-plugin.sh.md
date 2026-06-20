---
id: TASK-93.16.3
title: Integrate validate-wip-tuning.sh into scripts/validate-plugin.sh
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:54'
labels: []
dependencies:
  - TASK-93.16.2
parent_task_id: TASK-93.16
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a call to scripts/validate-wip-tuning.sh inside scripts/validate-plugin.sh so that WIP_CAP probe schema validation is part of the standard plugin validation gate. The integration must be guarded: if wip-tuning.jsonl does not exist or is empty, the call should be skipped gracefully (no false failures on fresh checkouts). If the file exists and is non-empty, validate-wip-tuning.sh must be called and its exit code must propagate failure.

WHY: TASK-93.16 explicitly requires integrating the validator into scripts/validate-plugin.sh. Without this integration, schema errors in wip-tuning.jsonl would be invisible to the standard CI gate.

PARENT GOAL (TASK-93.16): Completes the CI integration required by TASK-93.16. Depends on TASK-93.16.2 (validate-wip-tuning.sh must exist first).

DONE LOOKS LIKE:
- scripts/validate-plugin.sh calls validate-wip-tuning.sh (guarded by file existence check)
- Running validate-plugin.sh on a fresh checkout (no wip-tuning.jsonl) exits 0
- Running validate-plugin.sh with a valid wip-tuning.jsonl exits 0
- bash scripts/validate-plugin.sh passes end-to-end
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Integrate validate-wip-tuning.sh into scripts/validate-plugin.sh

## Context
TASK-93.16 requires the wip-tuning schema validator to be part of the standard plugin CI gate. This sub-task adds the guarded call to scripts/validate-plugin.sh, ensuring the integration is safe for fresh checkouts while enforcing schema on populated data files.

## Phase 1: Read current validate-plugin.sh and identify insertion point

Read scripts/validate-plugin.sh to understand its structure (exit code handling, section order). Identify the best insertion point — typically at the end of the existing validation steps, before the final exit.

### DoD
- `test -f scripts/validate-plugin.sh`
- `grep -q 'validate-plugin' scripts/validate-plugin.sh`

## Phase 2: Add guarded wip-tuning validation call

Edit scripts/validate-plugin.sh to add the following block at the appropriate location (after existing plugin checks, before final exit):

```bash
# WIP_CAP probe schema validation (skip if file absent or empty)
WIP_TUNING_FILE="plugin/loop-meta/data/wip-tuning.jsonl"
if [ -s "${WIP_TUNING_FILE}" ]; then
  bash scripts/validate-wip-tuning.sh "${WIP_TUNING_FILE}"
fi
```

This guard ensures that:
- Fresh checkouts with no wip-tuning.jsonl produce no failure
- Populated files are always validated

### DoD
- `grep -q 'validate-wip-tuning.sh' scripts/validate-plugin.sh`
- `grep -q 'wip-tuning.jsonl' scripts/validate-plugin.sh`

## Phase 3: Verify fresh-checkout safety

Confirm that running validate-plugin.sh without a wip-tuning.jsonl does not fail:
```bash
mv plugin/loop-meta/data/wip-tuning.jsonl /tmp/wip-tuning.jsonl.bak 2>/dev/null || true
bash scripts/validate-plugin.sh
```
Restore the file:
```bash
mv /tmp/wip-tuning.jsonl.bak plugin/loop-meta/data/wip-tuning.jsonl 2>/dev/null || true
```

### DoD
- `bash scripts/validate-plugin.sh`

## Phase 4: Verify integration with populated file

If wip-tuning.jsonl exists and contains valid records, confirm the full pipeline passes:
```bash
bash scripts/validate-plugin.sh
```

### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- Do not remove or reorder any existing validation steps in validate-plugin.sh
- The guard must use -s (non-empty file test), not just -f (existence)
- No changes to validate-wip-tuning.sh in this sub-task (that is TASK-93.16.2's scope)

## Acceptance Gate
- `grep -q 'validate-wip-tuning.sh' scripts/validate-plugin.sh`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-93.16
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/validate-plugin.sh
- [ ] #2 grep -q 'validate-wip-tuning.sh' scripts/validate-plugin.sh
- [ ] #3 grep -q 'wip-tuning.jsonl' scripts/validate-plugin.sh
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->
