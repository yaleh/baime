---
id: TASK-93.13.2
title: Write integration test asserting draftDecomposition idempotency for loop-meta
status: Backlog
assignee: []
created_date: '2026-06-20 11:00'
labels: []
dependencies:
  - TASK-93.13.1
parent_task_id: TASK-93.13
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write a shell-based integration test that runs draftDecomposition twice on the fixture created in TASK-93.13.1 and asserts: (1) the second run appends a note containing 'children already exist', (2) zero new sub-tasks are created on the second run, and (3) the child count after run 1 equals the child count after run 2. The test must use the real backlog fixture (not mocks), must be deterministic and idempotent itself, and must exit 0 on pass / non-zero on fail.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 find /home/yale/work/baime -path '*loop-meta*' -name 'SKILL.md' | head -1 | xargs test -f
- [ ] #2 test -f /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh
- [ ] #3 grep -q 'children already exist' /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh
- [ ] #4 bash /home/yale/work/baime/tests/integration/test-draftDecomposition-idempotency.sh
- [ ] #5 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.13
<!-- SECTION:NOTES:END -->
