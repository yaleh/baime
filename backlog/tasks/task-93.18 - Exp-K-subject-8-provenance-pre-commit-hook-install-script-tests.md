---
id: TASK-93.18
title: 'Exp-K subject 8: provenance pre-commit hook + install script + tests'
status: Backlog
assignee: []
created_date: '2026-06-20 10:50'
updated_date: '2026-06-20 10:54'
labels: []
dependencies: []
parent_task_id: TASK-93
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Install scripts/verify-provenance.sh as a git pre-commit hook so any commit adding or modifying a results JSON file that claims data_source: measured but lacks a valid generated_by is rejected before reaching CI. Adapt verify-provenance.sh to detect staged JSON files via git diff --cached --name-only --diff-filter=ACM. Write scripts/install-hooks.sh (idempotent, warns on conflict) to place the hook at .git/hooks/pre-commit. Extend scripts/verify-provenance.test.sh with three new test cases: missing field rejected, compliant file accepted, no staged JSON is a no-op.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 3 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.
<!-- SECTION:NOTES:END -->
