---
id: TASK-103
title: >-
  Implement a provenance-gate pre-commit hook: install
  scripts/verify-provenance.sh as a git pre-commit hook so that any commit
  adding or modifying a results JSON file that lacks data_source: measured is
  rejected before it reaches CI
status: Meta-Active
assignee: []
created_date: '2026-06-20 10:27'
updated_date: '2026-06-20 10:47'
labels: []
dependencies: []
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a provenance-gate pre-commit hook: install scripts/verify-provenance.sh as a git pre-commit hook so that any commit adding or modifying a results JSON file that lacks data_source: measured is rejected before it reaches CI.

Rationale: Three sub-tasks: (1) adapt verify-provenance.sh to detect modified JSON files via git diff --cached, (2) write install-hooks.sh to place the hook at .git/hooks/pre-commit, (3) add test cases in verify-provenance.test.sh for the hook path. Well-defined, tested gate exists already (verify-provenance.sh).

This meta-task is part of TASK-93 Exp-K experiment corpus (input MT-09).
Source: plugin/loop-meta/data/task-notes/meta-task-inputs.json
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 3 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.

Sub-tasks created:
- TASK-103.1: Adapt verify-provenance.sh to detect staged JSON files via git diff --cached (core logic layer)
- TASK-103.2: Write install-hooks.sh to install verify-provenance.sh as .git/hooks/pre-commit (installation layer; depends on TASK-103.1)
- TASK-103.3: Add test cases in verify-provenance.test.sh for the pre-commit hook path (verification layer; depends on TASK-103.1)

idempotentReconcile: no gap — sub-tasks present with shell-gate DoDs (verify-subtask-dod: PASS). Promoted to Meta-Active for Exp-K lifecycle execution.

evaluator: Met | dod_slice: PASS | data_source: measured
<!-- SECTION:NOTES:END -->
