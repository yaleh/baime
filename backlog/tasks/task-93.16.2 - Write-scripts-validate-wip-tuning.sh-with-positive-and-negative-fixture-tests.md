---
id: TASK-93.16.2
title: Write scripts/validate-wip-tuning.sh with positive and negative fixture tests
status: Backlog
assignee: []
created_date: '2026-06-20 10:52'
updated_date: '2026-06-20 10:53'
labels: []
dependencies: []
parent_task_id: TASK-93.16
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write scripts/validate-wip-tuning.sh (using bash + python3 stdlib only) to validate schema correctness of all records in plugin/loop-meta/data/wip-tuning.jsonl. The validator must verify that every line is valid JSON and contains all four required fields: meta_id (string), wip_cap_used (int), cycle_count (int), elapsed_seconds (float/number). Include positive fixture tests (valid records pass) and negative fixture tests (records missing fields or with wrong types fail). Exit 0 on all-pass, exit 1 on any failure with a descriptive error message.

WHY: TASK-93.16 requires a standalone schema validator for wip-tuning.jsonl records. This validator will be called by validate-plugin.sh to enforce data quality on every pipeline run, and serves as the reference implementation for the probe schema.

PARENT GOAL (TASK-93.16): Provides the validate-wip-tuning.sh script and fixture tests required by TASK-93.16.

DONE LOOKS LIKE:
- scripts/validate-wip-tuning.sh exists and is executable
- Running it against a valid wip-tuning.jsonl exits 0
- Running it against a fixture with missing/wrong-type fields exits 1 with an error message
- Both positive and negative fixtures are embedded in the script or in a fixtures/ directory
- bash scripts/validate-plugin.sh passes (no regressions)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Write scripts/validate-wip-tuning.sh with positive and negative fixture tests

## Context
TASK-93.16 requires a standalone schema validator script for plugin/loop-meta/data/wip-tuning.jsonl. This script enforces the four-field probe schema and must include self-contained fixture tests so correctness can be verified in CI via validate-plugin.sh.

## Phase 1: Write scripts/validate-wip-tuning.sh

Create scripts/validate-wip-tuning.sh. The script must:
1. Accept an optional file path argument (default: plugin/loop-meta/data/wip-tuning.jsonl)
2. Use python3 stdlib (json, sys) to validate each line:
   - Must be valid JSON
   - Must contain all four fields: meta_id (str), wip_cap_used (int), cycle_count (int), elapsed_seconds (float or int)
3. Print a summary: N records validated, or error with line number and reason
4. Exit 0 if all records pass, exit 1 on any failure

Also add a `--test` flag that runs embedded positive/negative fixture tests:
- Positive fixture: 2 valid records → expect exit 0
- Negative fixture 1: record missing `elapsed_seconds` → expect exit 1
- Negative fixture 2: record with `wip_cap_used` as a string instead of int → expect exit 1
- Negative fixture 3: invalid JSON line → expect exit 1

Make the script executable:
```bash
chmod +x scripts/validate-wip-tuning.sh
```

### DoD
- `test -f scripts/validate-wip-tuning.sh`
- `test -x scripts/validate-wip-tuning.sh`
- `grep -q 'meta_id' scripts/validate-wip-tuning.sh`
- `grep -q 'wip_cap_used' scripts/validate-wip-tuning.sh`
- `grep -q 'elapsed_seconds' scripts/validate-wip-tuning.sh`

## Phase 2: Run fixture tests to verify correctness

Run the embedded fixture tests:
```bash
bash scripts/validate-wip-tuning.sh --test
```

All four fixture cases (2 positive, 2 negative) must produce expected outcomes.

### DoD
- `bash scripts/validate-wip-tuning.sh --test`

## Phase 3: Verify against actual data file (if present)

If plugin/loop-meta/data/wip-tuning.jsonl exists and is non-empty, run the validator against it:
```bash
test -s plugin/loop-meta/data/wip-tuning.jsonl && bash scripts/validate-wip-tuning.sh plugin/loop-meta/data/wip-tuning.jsonl || true
```

If the file is absent or empty, skip this phase (validator gracefully handles empty/missing files).

### DoD
- `bash scripts/validate-wip-tuning.sh --test`

## Phase 4: Run full validation gate

```bash
bash scripts/validate-plugin.sh
```

### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- Only bash and python3 stdlib — no third-party packages
- Script must be self-contained; no external fixture files required for --test mode
- Negative fixture tests must exit 1 (not just print an error and exit 0)

## Acceptance Gate
- `test -x scripts/validate-wip-tuning.sh`
- `bash scripts/validate-wip-tuning.sh --test`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-93.16
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/validate-wip-tuning.sh
- [ ] #2 test -x scripts/validate-wip-tuning.sh
- [ ] #3 grep -q 'meta_id' scripts/validate-wip-tuning.sh
- [ ] #4 grep -q 'wip_cap_used' scripts/validate-wip-tuning.sh
- [ ] #5 grep -q 'elapsed_seconds' scripts/validate-wip-tuning.sh
- [ ] #6 bash scripts/validate-wip-tuning.sh --test
- [ ] #7 bash scripts/validate-plugin.sh
<!-- DOD:END -->
