---
id: TASK-97
title: Add regression contract for task-to-backlog DoD auto-injection
status: Backlog
assignee: []
created_date: '2026-06-20 10:55'
updated_date: '2026-06-20 10:56'
labels: []
dependencies:
  - TASK-93.20.1
ordinal: 112000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write scripts/test-task-to-backlog-dod-contract.sh that exercises the task-to-backlog finalise phase with a fixture that has no DoD section, and asserts the output task file contains a '## Definition of Done' section with at least one checkbox. Integrate this test into scripts/validate-plugin.sh as a contract check so any regression in task-to-backlog that removes the auto-inject logic is caught immediately. This is the verification half of TASK-93.20 (the implementation half is TASK-93.20.1). Depends on TASK-93.20.1.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add regression contract for task-to-backlog DoD auto-injection

## Context
TASK-93.20.1 patches the task-to-backlog finalise phase to auto-inject a `## Definition of Done` section when the task file lacks one. Without a contract test, any future refactor of that phase could silently remove the auto-inject logic and the regression would go undetected. This task adds the verification half: a standalone contract test script and its integration into the validate-plugin.sh gate.

## Phase 1: Write the contract test script

Create `scripts/test-task-to-backlog-dod-contract.sh`:
1. Create a temp directory acting as a fake backlog tasks dir.
2. Write a fixture task file with no `## Definition of Done` section (only `## Description` and `## Implementation Plan` blocks).
3. Invoke the finalise logic from task-to-backlog by calling `backlog task edit <fixture-id> --dod "echo ok"` on the fixture, simulating what the finalise phase does (i.e. the `--dod` flag that causes backlog to inject the DoD section).
4. Read the resulting task file and assert:
   - `## Definition of Done` section is present (`grep -q`)
   - At least one `- [ ]` checkbox line exists under that section
5. Exit 0 on pass, 1 on fail; print `PASS` / `FAIL` lines.

Use the same fixture-and-assert pattern as `scripts/verify-subtask-dod.test.sh`: `mktemp -d` for isolation, `check()` helper, cleanup with `rm -rf`.

### DoD
- [ ] `test -f scripts/test-task-to-backlog-dod-contract.sh`
- [ ] `bash scripts/test-task-to-backlog-dod-contract.sh`

## Phase 2: Integrate into validate-plugin.sh

Add a new `=== Contract Tests: task-to-backlog DoD ===` section in `scripts/validate-plugin.sh` (after the existing Unit Tests section) that calls `bash scripts/test-task-to-backlog-dod-contract.sh` and increments `$ERRORS` on failure, following the same `run_skill_unit_tests` pattern already used.

### DoD
- [ ] `grep -q 'test-task-to-backlog-dod-contract' scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- Do not execute the actual task-to-backlog skill end-to-end; test only the finalise-phase behaviour (DoD section injection via `--dod` flag or direct file mutation).
- Do not modify backlog production task files; all fixtures must be in a temp directory.
- The script must be idempotent (multiple runs produce the same result).

## Acceptance Gate
- [ ] `bash scripts/test-task-to-backlog-dod-contract.sh`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-93.20
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/test-task-to-backlog-dod-contract.sh
- [ ] #2 bash scripts/test-task-to-backlog-dod-contract.sh
- [ ] #3 grep -q 'test-task-to-backlog-dod-contract' scripts/validate-plugin.sh
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->
