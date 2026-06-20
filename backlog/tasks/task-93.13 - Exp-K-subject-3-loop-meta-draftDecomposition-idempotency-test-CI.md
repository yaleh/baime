---
id: TASK-93.13
title: 'Exp-K subject 3: loop-meta draftDecomposition idempotency test + CI'
status: Backlog
assignee: []
created_date: '2026-06-20 10:50'
updated_date: '2026-06-20 10:55'
labels: []
dependencies: []
parent_task_id: TASK-93
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add an integration test that runs draftDecomposition twice on the same meta-task fixture and asserts that the second run appends 'children already exist' and creates zero new sub-tasks. The test must use a real backlog fixture (not mocks), verify the idempotency note text, and assert child count is unchanged. Wire the test into .github/workflows/ci.yml so it runs on every push. This closes a gap where the idempotency guard is specified in SKILL.md but has no automated verification.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 3 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.

Sub-tasks created:
- TASK-94: Create real backlog fixture for loop-meta draftDecomposition idempotency integration test
- TASK-95: Write integration test asserting draftDecomposition idempotency for loop-meta
- TASK-96: Wire draftDecomposition idempotency integration test into GitHub Actions CI
<!-- SECTION:NOTES:END -->
