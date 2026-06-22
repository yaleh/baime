---
id: TASK-144
title: >-
  TASK-130-B: Layer 1: unit tests for epic-to-backlog and feature-to-backlog
  branching logic
status: 'Basic: Done'
assignee: []
created_date: '2026-06-22 04:58'
updated_date: '2026-06-22 05:22'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-130
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## What

Write two new test files auto-discovered by `run_skill_unit_tests`:
- `scripts/epic-to-backlog.test.sh` — covers decomposer-routing decisions and phase-transition gating for epic-to-backlog
- `scripts/feature-to-backlog.test.sh` — covers approval-round counting and APPROVED-state detection for feature-to-backlog

Each file covers the main path plus ≥1 boundary case. Tests must NOT invoke LLM APIs. Choose between a dry-run adapter approach or thin re-implementation; document the choice in the test file header.

Parent epic: TASK-130

## Definition of Done
- [ ] `bash scripts/validate-plugin.sh | grep -c "unit test:.*PASS"` returns ≥14
- [ ] `bash scripts/validate-plugin.sh` exits 0
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
claimed: 2026-06-22T05:15:39Z

DoD #1: PASS — validate-plugin.sh | grep -c 'PASS.*unit test:' = 14 (≥14, up from 12)
DoD #2: PASS — bash scripts/validate-plugin.sh exits 0

## Execution Summary
Result: done
Commit: 28668b68d0081faa6cb4016554625c64857bc813

Completed: 2026-06-22T05:22:51Z
<!-- SECTION:NOTES:END -->
