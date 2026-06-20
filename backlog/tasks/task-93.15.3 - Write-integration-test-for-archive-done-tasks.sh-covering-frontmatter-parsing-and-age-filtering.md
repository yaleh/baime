---
id: TASK-93.15.3
title: >-
  Write integration test for archive-done-tasks.sh covering frontmatter parsing
  and age filtering
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:54'
labels: []
dependencies:
  - TASK-93.15.1
parent_task_id: TASK-93.15
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write scripts/archive-done-tasks.test.sh that exercises the key correctness requirements of archive-done-tasks.sh: (1) a Done-status file older than 30 days is moved to backlog/archive/; (2) a Done-status file newer than 30 days is NOT moved; (3) a non-Done file older than 30 days is NOT moved; (4) --dry-run never moves any file; (5) re-running is idempotent (already-archived files are skipped). Each assertion must use isolated temp directories so tests are side-effect free. The test file must be callable via `bash scripts/archive-done-tasks.test.sh` and exit 0 on full pass.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Integration test for archive-done-tasks.sh

## Context
TASK-93.15.1 delivers the archive script; this task ensures its correctness guarantees are machine-verifiable and regression-proof. The test file follows the same pattern as existing scripts/*.test.sh files in the project (e.g. scripts/check-roi-gate.test.sh).

## Phase 1: Study existing test patterns

Read one existing test file (e.g. scripts/check-roi-gate.test.sh or scripts/skill-lint.test.sh) to match the project's assertion style (pass/fail counters, trap cleanup, etc.).

### DoD
- [ ] `test -f scripts/check-roi-gate.test.sh`

## Phase 2: Implement scripts/archive-done-tasks.test.sh

Create scripts/archive-done-tasks.test.sh. Each test case must:
- Set up an isolated TMPDIR with synthetic tasks/ and archive/ subdirectories
- Write a task .md file with controlled frontmatter status and mtime
- Call `TASKS_DIR=... ARCHIVE_DIR=... bash scripts/archive-done-tasks.sh [flags] --older-than N`
- Assert the outcome (file moved / not moved) and print PASS/FAIL
- Clean up regardless of result (trap)

Required test cases:
1. Done + old (>= older-than) → file moved to archive/
2. Done + new (< older-than) → file NOT moved
3. Non-Done (e.g. Backlog) + old → file NOT moved
4. Done + old + --dry-run → file NOT moved, output contains "DRY RUN"
5. Idempotent: run script twice on same file → second run skips (already in archive)

Script must exit 0 only if ALL tests pass; exit 1 otherwise. Print a summary line.

### DoD
- [ ] `test -f scripts/archive-done-tasks.test.sh`
- [ ] `bash scripts/archive-done-tasks.test.sh`

## Phase 3: Validation gate

### DoD
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- Tests must use isolated temp directories; must not mutate backlog/tasks/ or backlog/archive/
- The script must be self-contained (no external test framework)
- Must be idempotent: running it multiple times produces the same exit code

## Acceptance Gate
- [ ] `test -f scripts/archive-done-tasks.test.sh`
- [ ] `bash scripts/archive-done-tasks.test.sh`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.15
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/archive-done-tasks.test.sh
- [ ] #2 bash scripts/archive-done-tasks.test.sh
- [ ] #3 bash scripts/validate-plugin.sh
<!-- DOD:END -->
