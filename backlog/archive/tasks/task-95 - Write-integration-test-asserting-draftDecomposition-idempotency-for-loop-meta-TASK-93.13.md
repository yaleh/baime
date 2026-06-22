---
id: TASK-95
title: >-
  Write integration test asserting draftDecomposition idempotency for loop-meta
  (TASK-93.13)
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:53'
labels: []
dependencies:
  - TASK-93.13
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write a shell-based or Node.js integration test that runs draftDecomposition twice on the fixture created in TASK-94 and asserts: (1) the second run appends a note containing 'children already exist', (2) zero new sub-tasks are created on the second run, and (3) the child count after run 1 equals the child count after run 2. The test must use the real backlog fixture (not mocks), must be deterministic and idempotent itself, and must exit 0 on pass / non-zero on fail. This directly verifies the idempotency guard in SKILL.md for TASK-93.13.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Write integration test asserting draftDecomposition idempotency for loop-meta

## Context
TASK-93.13 requires automated verification that the idempotency guard in loop-meta SKILL.md
works correctly: running draftDecomposition twice on the same meta-task must append
'children already exist' on the second run and create zero new sub-tasks.
This test uses the real backlog fixture from TASK-94 to satisfy the "no mocks" requirement.

## Phase 1: Inspect loop-meta skill and idempotency guard implementation
Read the loop-meta skill to understand how draftDecomposition is invoked and how the
idempotency check works in practice.
Run: `find /home/yale/work/baime -path '*/loop-meta*' -name '*.md' | head -10`
and `grep -n 'children already exist\|idempotency\|draftDecomposition' /home/yale/work/baime/.claude/skills/loop-meta/SKILL.md 2>/dev/null | head -30`
to locate the guard logic and understand what note text and behaviour to assert.
### DoD
- [ ] `find /home/yale/work/baime -path '*loop-meta*' -name 'SKILL.md' | head -1 | xargs test -f`
- [ ] `grep -qi 'children already exist\|idempotency' /home/yale/work/baime/.claude/skills/loop-meta/SKILL.md`

## Phase 2: Design test script
Write `tests/integration/test-draftDecomposition-idempotency.sh` that:
1. Copies the fixture from `tests/fixtures/backlog/tasks/task-fixture-idempotency.md` into a
   fresh temp backlog directory (so the test is isolated and repeatable).
2. Runs draftDecomposition once against the temp backlog (first run — children get created).
3. Records the child count after run 1 (count of tasks with `parentTask: TASK-FIXTURE-IDEM-1`).
4. Runs draftDecomposition a second time against the same temp backlog.
5. Asserts the note 'children already exist' appears in the meta-task file.
6. Records child count after run 2 and asserts it equals run-1 count (zero new tasks created).
7. Exits 0 on all assertions passing, non-zero on any failure with a descriptive error message.
### DoD
- [ ] `test -f /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh`
- [ ] `grep -q 'children already exist' /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh`
- [ ] `grep -q 'child count' /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh`

## Phase 3: Run the test script to confirm it works end-to-end
Execute: `bash /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh`
and confirm it exits 0. Fix any failures before proceeding.
### DoD
- [ ] `bash /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh`

## Constraints
- The test must not modify the production backlog — always use a temp copy of the fixture
- The test must be self-cleaning (remove temp dirs on exit)
- No mocks: use the real backlog CLI and real fixture files
- Test must be idempotent: running it multiple times should always pass

## Acceptance Gate
- [ ] `test -f /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh`
- [ ] `bash /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh`
- [ ] `grep -q 'children already exist' /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.13
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 find /home/yale/work/baime -path '*loop-meta*' -name 'SKILL.md' | head -1 | xargs test -f
- [ ] #2 grep -qi 'children already exist\|idempotency' /home/yale/work/baime/.claude/skills/loop-meta/SKILL.md
- [ ] #3 test -f /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh
- [ ] #4 grep -q 'children already exist' /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh
- [ ] #5 grep -q 'child count' /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh
- [ ] #6 bash /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh
- [ ] #7 test -f /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh
- [ ] #8 bash /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh
- [ ] #9 grep -q 'children already exist' /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh
- [ ] #10 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->
