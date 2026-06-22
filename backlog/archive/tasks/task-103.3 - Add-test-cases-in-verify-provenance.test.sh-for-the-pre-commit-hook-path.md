---
id: TASK-103.3
title: Add test cases in verify-provenance.test.sh for the pre-commit hook path
status: Backlog
assignee: []
created_date: '2026-06-20 10:38'
updated_date: '2026-06-20 10:49'
labels: []
dependencies: []
parent_task_id: TASK-103
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create or extend `scripts/verify-provenance.test.sh` with test cases that exercise the pre-commit hook path specifically: (1) a staged JSON file missing `data_source: measured` causes the script to exit non-zero, (2) a staged JSON file with `data_source: measured` causes the script to exit 0, (3) no staged JSON files causes the script to exit 0. Tests must be self-contained (set up and tear down their own git state) and must not leave any side-effects.

**Why it exists:** The adapted script (TASK-103.1) and installer (TASK-103.2) form the gate, but without automated tests there is no way to confirm the hook path works after future changes.

**Parent goal (TASK-103):** This is the verification layer. It closes the quality loop for TASK-103 and ensures the provenance gate remains reliable as the codebase evolves.

**parentTask: TASK-103**
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/verify-provenance.test.sh
- [ ] #2 grep -q 'diff --cached' scripts/verify-provenance.test.sh
- [ ] #3 bash scripts/verify-provenance.test.sh
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Plan: Add test cases in verify-provenance.test.sh for the pre-commit hook path

## Context
The adapted `verify-provenance.sh` and `install-hooks.sh` form the provenance gate, but need automated tests to confirm the hook path works correctly and continues to work after future changes. Tests operate in isolated git environments to avoid polluting the main repo.

## Phase 1: Inspect existing test infrastructure
Check if `scripts/verify-provenance.test.sh` already exists and review its structure to understand any test harness conventions in use.

### DoD
- `test -f scripts/verify-provenance.sh`

## Phase 2: Write hook-path test cases
Create or extend `scripts/verify-provenance.test.sh` with three test functions using a temp git repo for isolation:
1. `test_staged_missing_field`: stage a JSON file without `data_source: measured`, run script, assert exit non-zero
2. `test_staged_compliant_file`: stage a JSON file with `"data_source": "measured"`, run script, assert exit 0
3. `test_no_staged_json`: no staged JSON files, run script, assert exit 0

Each test initializes a fresh `git init` temp directory, performs the setup, runs the script, checks exit code, and cleans up.

### DoD
- `test -f scripts/verify-provenance.test.sh`
- `grep -q 'test_staged_missing_field' scripts/verify-provenance.test.sh`
- `grep -q 'test_staged_compliant_file' scripts/verify-provenance.test.sh`
- `grep -q 'test_no_staged_json' scripts/verify-provenance.test.sh`
- `grep -q 'diff --cached' scripts/verify-provenance.test.sh`

## Phase 3: Run tests and validate
Execute the test file and confirm all tests pass, then run the plugin validation gate.

### DoD
- `bash scripts/verify-provenance.test.sh`
- `bash scripts/validate-plugin.sh`

## Constraints
- Tests must be self-contained with no permanent side-effects on the repo
- Use a temp directory (`mktemp -d`) with `git init` for isolation
- No external test frameworks — pure bash

## Acceptance Gate
- `bash scripts/verify-provenance.test.sh`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:NOTES:END -->
