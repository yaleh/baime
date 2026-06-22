---
id: TASK-106
title: >-
  Add a shell-gate DoD template to task-to-backlog: when the skill creates a new
  task, auto-append a default '## Definition of Done' section with a placeholder
  shell-gate checkbox if no DoD section is found in the draft
status: Meta-Plan
assignee: []
created_date: '2026-06-20 10:27'
updated_date: '2026-06-20 10:40'
labels: []
dependencies: []
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a shell-gate DoD template to task-to-backlog: when the skill creates a new task, auto-append a default '## Definition of Done' section with a placeholder shell-gate checkbox (e.g. '- [ ] bash scripts/validate-plugin.sh exits 0') if no DoD section is found in the draft.

Rationale: Two sub-tasks: (1) update task-to-backlog SKILL.md to inject default DoD section logic, (2) add a contract assertion and regression test verifying that created tasks always have a DoD section. Directly addresses root cause R1 documented in loop-meta SKILL.md.

This meta-task is part of TASK-93 Exp-K experiment corpus (input MT-12).
Source: plugin/loop-meta/data/task-notes/meta-task-inputs.json
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 2 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.

Sub-tasks:
- TASK-107: Update task-to-backlog SKILL.md to auto-inject default DoD section when none is present
- TASK-108: Add contract assertion and regression test — tasks created by task-to-backlog always have a DoD section
<!-- SECTION:NOTES:END -->
