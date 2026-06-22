---
id: TASK-100
title: >-
  Create a backlog task archival automation: write scripts/archive-done-tasks.sh
  that moves all Done-status task markdown files older than 30 days into
  backlog/archive/, and adds a CI cron job to run it weekly
status: Meta-Active
assignee: []
created_date: '2026-06-20 10:26'
updated_date: '2026-06-20 10:47'
labels: []
dependencies: []
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a backlog task archival automation: write scripts/archive-done-tasks.sh that moves all Done-status task markdown files older than 30 days into backlog/archive/, and adds a CI cron job to run it weekly.

Rationale: Two sub-tasks: (1) write and test archive-done-tasks.sh, (2) add GitHub Actions cron workflow. Both sub-tasks have crisp file-existence and exit-code gates.

This meta-task is part of TASK-93 Exp-K experiment corpus (input MT-06).
Source: plugin/loop-meta/data/task-notes/meta-task-inputs.json
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 2 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.
- TASK-100.1: Write and test scripts/archive-done-tasks.sh
- TASK-100.2: Add GitHub Actions cron workflow (depends on TASK-100.1)

idempotentReconcile: no gap — sub-tasks present with shell-gate DoDs (verify-subtask-dod: PASS). Promoted to Meta-Active for Exp-K lifecycle execution.

evaluator: Met | dod_slice: PASS | data_source: measured
<!-- SECTION:NOTES:END -->
