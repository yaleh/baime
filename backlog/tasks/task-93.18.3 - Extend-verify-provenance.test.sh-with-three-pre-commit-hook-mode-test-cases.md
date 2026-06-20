---
id: TASK-93.18.3
title: Extend verify-provenance.test.sh with three pre-commit hook mode test cases
status: Backlog
assignee: []
created_date: '2026-06-20 10:54'
updated_date: '2026-06-20 10:54'
labels: []
dependencies:
  - TASK-93.18.1
modified_files:
  - scripts/verify-provenance.test.sh
parent_task_id: TASK-93.18
ordinal: 107000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add three new test cases to scripts/verify-provenance.test.sh that exercise the hook mode added in the companion sub-task. The three cases are: (1) a staged JSON file missing the generated_by field is rejected (exit 1), (2) a compliant staged JSON file is accepted (exit 0), (3) no staged JSON files is a no-op (exit 0). These tests must mock `git diff --cached` output so they run without a real git repo. Depends on TASK-93.18.1 (hook mode must exist before tests can pass).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Extend verify-provenance.test.sh with three pre-commit hook mode test cases

## Context
TASK-93.18 specifies three test cases for the hook mode added in TASK-93.18.1. The test harness already exists with a check() helper pattern. New tests use a PATH-override mock to avoid needing a real git staging area.

## Phase 1: Design mock strategy
Use a temp bin dir with a fake `git` script that echoes `$FAKE_GIT_OUTPUT` when called. Each test sets `FAKE_GIT_OUTPUT` to the desired staged file list and prepends the temp bin to PATH.
### DoD
- `grep -q 'FAKE_GIT_OUTPUT\|TMPBIN\|mock' scripts/verify-provenance.test.sh`

## Phase 2: Add the three test cases
Append to scripts/verify-provenance.test.sh before the final summary line:

**Test 8: staged JSON missing generated_by → hook rejects (exit 1)**
- Create temp JSON with `data_source: measured`, no `generated_by`.
- FAKE_GIT_OUTPUT = that file path.
- Invoke `bash "$GUARD"` (no DIR arg). Expect exit 1.

**Test 9: staged compliant JSON → hook accepts (exit 0)**
- Create temp JSON with `data_source: measured` and `generated_by: scripts/check-roi-gate.sh`.
- FAKE_GIT_OUTPUT = that file path.
- Invoke `bash "$GUARD"` (no DIR arg). Expect exit 0.

**Test 10: no staged JSON files → hook no-op (exit 0)**
- FAKE_GIT_OUTPUT = "" (empty).
- Invoke `bash "$GUARD"` (no DIR arg). Expect exit 0.
### DoD
- `grep -q 'Test 8\|hook rejects\|staged JSON missing' scripts/verify-provenance.test.sh`
- `grep -q 'Test 9\|compliant staged\|hook accepts' scripts/verify-provenance.test.sh`
- `grep -q 'Test 10\|no staged JSON\|hook no-op' scripts/verify-provenance.test.sh`

## Phase 3: Run the full test suite
### DoD
- `bash scripts/verify-provenance.test.sh`

## Phase 4: Validate plugin
### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- Tests must not require a real git staging area (mock git)
- Must not break existing Tests 1-7
- Clean up TMPBIN in teardown

## Acceptance Gate
- `bash scripts/verify-provenance.test.sh 2>&1 | grep -q '10 passed'`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.18
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'FAKE_GIT_OUTPUT\|TMPBIN\|mock' scripts/verify-provenance.test.sh
- [ ] #2 bash scripts/verify-provenance.test.sh
- [ ] #3 bash scripts/validate-plugin.sh
<!-- DOD:END -->
