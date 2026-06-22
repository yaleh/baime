---
id: TASK-108
title: >-
  Add contract assertion and regression test: tasks created by task-to-backlog
  always have a DoD section
status: Backlog
assignee: []
created_date: '2026-06-20 10:39'
updated_date: '2026-06-20 10:40'
labels: []
dependencies: []
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a contract assertion to validate-plugin.sh and a regression test fixture that verifies tasks created by the task-to-backlog skill always contain a '## Definition of Done' section with at least one shell-gate checkbox. This is the verification half of TASK-106 (Add a shell-gate DoD template to task-to-backlog). Without this test, the DoD-injection logic added in TASK-107 can silently regress. The test must fail if a task produced by the skill lacks a DoD section, and must pass after TASK-107's changes are applied.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add contract assertion and regression test — tasks created by task-to-backlog always have a DoD section

## Context
Root cause R1 in loop-meta SKILL.md identifies missing DoD sections as the primary loop-breaking defect. TASK-107 patches the skill to inject a default DoD section. This plan adds a regression test and contract assertion so the fix cannot silently regress: validate-plugin.sh must fail if any task-to-backlog output lacks a `## Definition of Done` section with a shell-gate checkbox.

## Phase 1: Identify Existing Test Infrastructure
Read `scripts/validate-plugin.sh` and any existing Class D test fixtures under `experiments/skill-quality/` or `scripts/` to understand how task-to-backlog is currently contract-tested.

### DoD
- [ ] `test -f scripts/validate-plugin.sh`
- [ ] `grep -qr 'task-to-backlog' scripts/validate-plugin.sh || grep -qr 'task-to-backlog' experiments/`

## Phase 2: Write Regression Test Fixture
Create `scripts/test-task-to-backlog-dod-contract.sh` that:
1. Simulates a minimal task-to-backlog output by writing a test markdown file to `$TMPDIR/ttb-test-task.md` that has no `## Definition of Done` section.
2. Asserts that after the DoD-injection logic runs (inline shell snippet from TASK-107), the file contains `## Definition of Done` and at least one `- [ ]` line.
3. Also tests the idempotency case: runs the injection twice and asserts only one `## Definition of Done` section exists.
4. Exits 0 on pass, exits 1 with a descriptive message on failure.

### DoD
- [ ] `test -f scripts/test-task-to-backlog-dod-contract.sh`
- [ ] `grep -q 'Definition of Done' scripts/test-task-to-backlog-dod-contract.sh`
- [ ] `bash scripts/test-task-to-backlog-dod-contract.sh`

## Phase 3: Wire Test into validate-plugin.sh
Add a call to `bash scripts/test-task-to-backlog-dod-contract.sh` inside `scripts/validate-plugin.sh` so it runs as part of the standard validation suite. Place it in the task-to-backlog skill section or at the end of the skill contract checks.

### DoD
- [ ] `grep -q 'test-task-to-backlog-dod-contract.sh' scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- The regression test must not create real backlog tasks; it operates on temp files only
- Do not modify any skill SKILL.md files (that is TASK-107's scope)
- The test script must be self-contained and runnable with `bash scripts/test-task-to-backlog-dod-contract.sh`
- The idempotency check is mandatory: double-injection must not produce two DoD sections

## Acceptance Gate
- [ ] `test -f scripts/test-task-to-backlog-dod-contract.sh`
- [ ] `grep -q 'test-task-to-backlog-dod-contract.sh' scripts/validate-plugin.sh`
- [ ] `bash scripts/test-task-to-backlog-dod-contract.sh`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-106
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/test-task-to-backlog-dod-contract.sh
- [ ] #2 grep -q 'Definition of Done' scripts/test-task-to-backlog-dod-contract.sh
- [ ] #3 bash scripts/test-task-to-backlog-dod-contract.sh
- [ ] #4 grep -q 'test-task-to-backlog-dod-contract.sh' scripts/validate-plugin.sh
- [ ] #5 bash scripts/validate-plugin.sh
<!-- DOD:END -->
