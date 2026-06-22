---
id: TASK-94.2
title: >-
  Add regression test for contracts-density warning in validate-plugin test
  suite
status: Backlog
assignee: []
created_date: '2026-06-20 10:38'
updated_date: '2026-06-20 10:48'
labels: []
dependencies: []
parent_task_id: TASK-94
ordinal: 103000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a regression test in scripts/ (as a .test.sh file) that verifies the contracts-density soft-warning introduced by TASK-94.1. The test must:
1. Create a temporary SKILL.md fixture with ≥50 spec body lines and 0 contracts entries — confirm validate-plugin.sh emits a WARNING line for it
2. Create a temporary SKILL.md fixture with 50 spec body lines and 2 contracts entries — confirm no WARNING is emitted for it
3. Clean up all fixtures after each case
4. Exit 0 if both assertions pass, non-zero otherwise

The test file should be named scripts/validate-density-warning.test.sh and follow the same pattern as existing .test.sh files in scripts/. It is picked up automatically by the run_skill_unit_tests() loop in validate-plugin.sh.

Parent task: TASK-94. This sub-task depends on TASK-94.1 (density check implementation) being merged first.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add regression test for contracts-density warning in validate-plugin test suite

## Context
TASK-94.1 adds a "Contract Density per-50-lines Warning" section to validate-plugin.sh. Without a regression test, the warning could silently break or be accidentally removed. This sub-task adds a targeted .test.sh that exercises both the warning-fires and warning-suppressed code paths.

## Phase 1: Study existing test patterns

Read at least one existing .test.sh file in scripts/ (e.g., scripts/verify-subtask-dod.test.sh or scripts/skill-lint.test.sh) to understand the fixture setup, assertion style, and cleanup conventions used in this repo.

### DoD
- `test -f /home/yale/work/baime/scripts/verify-subtask-dod.test.sh`

## Phase 2: Write the regression test file

Create scripts/validate-density-warning.test.sh. The file must:

1. Set REPO_ROOT via `git rev-parse --show-toplevel`
2. Create a temp skill dir under plugin/skills/ named `_density-test-low/` with a SKILL.md that has valid frontmatter (name, description, contracts: []) and exactly 60 non-blank body lines. Run validate-plugin.sh and capture output. Assert that output contains "WARNING" and the string "density low". Remove the fixture dir.
3. Create a temp skill dir under plugin/skills/ named `_density-test-ok/` with a SKILL.md that has valid frontmatter (name, description, contracts: [{grep: "foo"}, {grep: "bar"}]) and exactly 50 non-blank body lines. Run validate-plugin.sh and capture output. Assert that output does NOT contain a "density low" warning for `_density-test-ok`. Remove the fixture dir.
4. Print PASS or FAIL for each case, exit 0 if all pass.

Important: the script must restore count assertions (EXPECTED_SKILLS=25) — do NOT permanently increment the count. Use a subshell or temporarily override via env if needed, or simply acknowledge that validate-plugin.sh will report a skill-count FAIL during the test and grep only for the density-specific output.

### DoD
- `test -f /home/yale/work/baime/scripts/validate-density-warning.test.sh`
- `bash /home/yale/work/baime/scripts/validate-density-warning.test.sh`

## Phase 3: Confirm validate-plugin.sh picks up the new test

Run validate-plugin.sh and verify it executes the new .test.sh via the run_skill_unit_tests() loop.

### DoD
- `bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "validate-density-warning.test.sh"`

## Constraints
- Test file must clean up all temporary fixtures (trap ERR/EXIT recommended)
- Test must be self-contained: no external services, no network calls
- Do not permanently change EXPECTED_SKILLS or EXPECTED_AGENTS in validate-plugin.sh

## Acceptance Gate
- `test -f /home/yale/work/baime/scripts/validate-density-warning.test.sh`
- `bash /home/yale/work/baime/scripts/validate-density-warning.test.sh`
- `bash /home/yale/work/baime/scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-94

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f /home/yale/work/baime/scripts/verify-subtask-dod.test.sh
- [ ] #2 test -f /home/yale/work/baime/scripts/validate-density-warning.test.sh
- [ ] #3 bash /home/yale/work/baime/scripts/validate-density-warning.test.sh
- [ ] #4 bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "validate-density-warning.test.sh"
- [ ] #5 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->
