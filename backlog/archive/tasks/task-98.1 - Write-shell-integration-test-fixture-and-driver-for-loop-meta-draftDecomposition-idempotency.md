---
id: TASK-98.1
title: >-
  Write shell integration test fixture and driver for loop-meta
  draftDecomposition idempotency
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:38'
labels: []
dependencies: []
parent_task_id: TASK-98
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a standalone bash integration test at scripts/test-loop-meta-idempotency.sh that verifies the loop-meta draftDecomposition idempotency guard works end-to-end against a real backlog fixture task.

The test must:
1. Create a synthetic Meta-Plan fixture task in backlog/tasks using `backlog task create`.
2. Invoke draftDecomposition logic once (simulated via the loop-meta skill path or a direct call) and record the created sub-task IDs.
3. Invoke draftDecomposition a second time on the same fixture.
4. Assert that the second run appended a note containing "children already exist" to the parent fixture task and created zero new sub-tasks.
5. Clean up all created fixture tasks and sub-tasks after the test regardless of pass/fail.
6. Exit 0 on full pass; exit non-zero and print a clear PASS/FAIL summary on any assertion failure.

Parent task: TASK-98 (Add loop-meta idempotency integration test).
This is phase 1 of 2: writing the test before wiring it into CI.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Write shell integration test fixture and driver for loop-meta draftDecomposition idempotency

## Context
The loop-meta skill contains an idempotency guard in draftDecomposition that detects pre-existing children and skips re-creation. TASK-98 requires proving this guard works end-to-end with a real backlog task fixture. This sub-task produces the test script itself (phase 1 of 2 for TASK-98).

## Phase 1: Survey existing idempotency guard and test patterns
Read scripts/test-loop-meta-idempotent.sh and scripts/test-loop-meta-e2e.sh to understand the existing test helper patterns (mock state, assert functions, cleanup traps). Read plugin/loop-meta/ and .claude/skills/loop-meta/ to locate the draftDecomposition entry point and its "children already exist" note-appending logic.

### DoD
- `grep -q 'children already exist' .claude/skills/loop-meta/loop-meta.md 2>/dev/null || grep -rq 'children already exist' plugin/ .claude/`
- `test -f scripts/test-loop-meta-idempotent.sh`

## Phase 2: Write scripts/test-loop-meta-idempotency.sh
Create the integration test script. It must:
1. Use `backlog task create` to make a real Meta-Plan fixture task (title prefixed "FIXTURE-IDEMPOTENCY-TEST-").
2. Simulate two draftDecomposition calls: first call creates child tasks via `backlog task create` with `parentTaskId` and appends "parentTask: <FIXTURE-ID>" note; second call reads existing children, detects N > 0, and appends note "draftDecomposition: children already exist (N) — skipping creation" without creating new tasks.
3. Assert: after run 1, child count == expected N; after run 2, child count unchanged and parent note contains "children already exist".
4. Trap EXIT to clean up: archive or delete all fixture tasks.
5. Print PASS/FAIL summary; exit 0 only if all assertions pass.

### DoD
- `test -f scripts/test-loop-meta-idempotency.sh`
- `bash -n scripts/test-loop-meta-idempotency.sh`

## Phase 3: Run the test and confirm it passes cleanly
Execute the new script end-to-end and verify exit 0. Confirm cleanup leaves no FIXTURE- tasks in the backlog.

### DoD
- `bash scripts/test-loop-meta-idempotency.sh`
- `! backlog task list --plain 2>/dev/null | grep -q 'FIXTURE-IDEMPOTENCY-TEST-'`

## Constraints
- The script must be self-contained and not require any external service beyond the local `backlog` CLI.
- No CI wiring in this sub-task (that is TASK-98.2).
- No modifications to loop-meta skill source — this is test-only work.
- Cleanup must run even on test failure (use `trap cleanup EXIT`).

## Acceptance Gate
- `bash scripts/test-loop-meta-idempotency.sh`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-98

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'children already exist' .claude/skills/loop-meta/loop-meta.md 2>/dev/null || grep -rq 'children already exist' plugin/ .claude/
- [ ] #2 test -f scripts/test-loop-meta-idempotent.sh
- [ ] #3 test -f scripts/test-loop-meta-idempotency.sh
- [ ] #4 bash -n scripts/test-loop-meta-idempotency.sh
- [ ] #5 bash scripts/test-loop-meta-idempotency.sh
- [ ] #6 ! backlog task list --plain 2>/dev/null | grep -q 'FIXTURE-IDEMPOTENCY-TEST-'
- [ ] #7 bash scripts/validate-plugin.sh
<!-- DOD:END -->
