---
id: TASK-93.15
title: 'Exp-K subject 5: backlog archival automation + weekly CI cron'
status: Backlog
assignee: []
created_date: '2026-06-20 10:50'
updated_date: '2026-06-20 10:54'
labels: []
dependencies: []
parent_task_id: TASK-93
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write scripts/archive-done-tasks.sh that moves all Done-status task markdown files older than 30 days into backlog/archive/, with a --dry-run flag for safe preview. The script must parse the status field from YAML frontmatter (not filename), support --older-than N (days), and print a summary of moved files. Add a .github/workflows/archive-done-tasks.yml with a weekly cron (Mondays 02:00 UTC) and a workflow_dispatch trigger, with an auto-commit step for any archived files.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 3 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.
<!-- SECTION:NOTES:END -->
