---
id: TASK-93.13.1
title: >-
  Create real backlog fixture for loop-meta draftDecomposition idempotency
  integration test
status: Backlog
assignee: []
created_date: '2026-06-20 11:00'
labels: []
dependencies: []
parent_task_id: TASK-93.13
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a self-contained backlog fixture (a minimal but realistic meta-task file in a test-scoped backlog directory) that can be used as input for running draftDecomposition twice. The fixture must represent a plausible meta-task with a description, status, and no pre-existing children. Done looks like: a fixture file at tests/fixtures/backlog/tasks/task-fixture-idempotency.md with status Meta-Plan and a non-trivial description, plus a README documenting the fixture purpose.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -d /home/yale/work/baime/backlog/tasks
- [ ] #2 test -f /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #3 grep -q 'Meta-Plan' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #4 grep -q 'TASK-FIXTURE-IDEM-1' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #5 test -f /home/yale/work/baime/tests/fixtures/backlog/README.md
- [ ] #6 ! grep -q 'parentTask' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #7 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.13
<!-- SECTION:NOTES:END -->
