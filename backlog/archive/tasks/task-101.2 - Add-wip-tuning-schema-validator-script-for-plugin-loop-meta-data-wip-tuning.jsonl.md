---
id: TASK-101.2
title: >-
  Add wip-tuning schema validator script for
  plugin/loop-meta/data/wip-tuning.jsonl
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:39'
labels: []
dependencies: []
parent_task_id: TASK-101
priority: high
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write scripts/validate-wip-tuning.sh (or plugin/loop-meta/data/validate-schema.sh) that reads plugin/loop-meta/data/wip-tuning.jsonl and asserts every line is valid JSON with the required fields: meta_id (string), wip_cap_used (integer), cycle_count (integer), elapsed_seconds (number). Exits 0 if all lines pass, exits 1 with a descriptive error message on the first failing line.

This is sub-task 2 of 3 for TASK-101 (WIP_CAP auto-tuning probe). The instrumentation added by sub-task 1 (TASK-101.1) only has value if its output can be trusted. This validator acts as a schema gate that can be run in CI or manually to catch corrupt/incomplete records before any downstream analysis reads them.

parentTask: TASK-101
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add wip-tuning schema validator script for plugin/loop-meta/data/wip-tuning.jsonl

## Context
TASK-101 adds a WIP_CAP auto-tuning probe to loop-meta. Sub-task 1 (TASK-101.1) instruments idempotentReconcile to emit JSONL records. This sub-task (2 of 3) adds a schema validator so the emitted data can be trusted. Without validation, corrupt or incomplete records could silently propagate into downstream WIP_CAP analysis.

## Phase 1: Design and write the validator script

Create scripts/validate-wip-tuning.sh. The script must:
1. Check that plugin/loop-meta/data/wip-tuning.jsonl exists; exit 0 (vacuously valid) if the file is absent or empty
2. For each non-empty line, use python3 to parse JSON and assert presence and correct types for all four required fields:
   - meta_id: string
   - wip_cap_used: integer
   - cycle_count: integer
   - elapsed_seconds: number (int or float)
3. On first failure, print the line number and a descriptive error to stderr and exit 1
4. On full pass, print "PASS: N records valid" and exit 0

Use only Python 3 stdlib (json, sys); no third-party packages.

### DoD
- [ ] `test -f scripts/validate-wip-tuning.sh`
- [ ] `bash -n scripts/validate-wip-tuning.sh`

## Phase 2: Write positive and negative fixture tests

Create plugin/loop-meta/data/test-validator-fixtures.sh that:
1. Runs the validator against a temp file of valid records — expects exit 0
2. Runs the validator against a temp file containing a line missing wip_cap_used — expects exit 1
3. Runs the validator against a temp file containing a line with wip_cap_used as a string instead of integer — expects exit 1

### DoD
- [ ] `test -f plugin/loop-meta/data/test-validator-fixtures.sh`
- [ ] `bash plugin/loop-meta/data/test-validator-fixtures.sh`

## Phase 3: Integrate validator into validate-plugin.sh

Add a call to bash scripts/validate-wip-tuning.sh inside scripts/validate-plugin.sh so schema validation runs as part of the standard plugin validation gate. Only add the call if the JSONL file already exists (skip silently if absent, since the probe file is created at runtime, not at repo-initialisation time).

### DoD
- [ ] `grep -q 'validate-wip-tuning.sh' scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- Validator must not modify wip-tuning.jsonl under any circumstances
- No runtime dependencies beyond Python 3 stdlib and bash
- Exit code 0 when file does not yet exist (validator is not a file-existence gate)

## Acceptance Gate
- [ ] `bash scripts/validate-wip-tuning.sh`
- [ ] `bash plugin/loop-meta/data/test-validator-fixtures.sh`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-101
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/validate-wip-tuning.sh
- [ ] #2 bash -n scripts/validate-wip-tuning.sh
- [ ] #3 test -f plugin/loop-meta/data/test-validator-fixtures.sh
- [ ] #4 bash plugin/loop-meta/data/test-validator-fixtures.sh
- [ ] #5 grep -q 'validate-wip-tuning.sh' scripts/validate-plugin.sh
- [ ] #6 bash scripts/validate-plugin.sh
<!-- DOD:END -->
