---
id: TASK-93.11
title: 'Exp-K subject 1: validate-plugin severity tiers + contracts-density warning'
status: Backlog
assignee: []
created_date: '2026-06-20 10:50'
updated_date: '2026-06-20 10:56'
labels: []
dependencies: []
parent_task_id: TASK-93
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add two related quality improvements to scripts/validate-plugin.sh: (1) a contracts-density soft-warning that emits a non-blocking WARNING when any SKILL.md has fewer than 1 contract per 50 lines of spec; (2) a lint-severity matrix that categorises all existing validate-plugin.sh checks as P0 (blocker), P1 (warning), or P2 (advisory), persisted to plugin/.claude-plugin/lint-severity.json, with the script updated to exit non-zero only on P0 failures. Together these two changes make the validation framework self-describing and reduce false-alarm noise. Regression tests for the density warning must be added to the validate-plugin test suite.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 3 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.

Sub-tasks created:
- TASK-93.11.1: Implement lint-severity matrix for validate-plugin.sh checks
- TASK-93.11.2: Add contracts-density soft-warning to validate-plugin.sh for SKILL.md files
- TASK-93.11.3: Integration smoke-test: verify severity-matrix + density-warning work together (depends on 93.11.1 + 93.11.2)
<!-- SECTION:NOTES:END -->
