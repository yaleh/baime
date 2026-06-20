---
id: TASK-93.20
title: >-
  Exp-K subject 10: task-to-backlog auto-inject default DoD + regression
  contract
status: Backlog
assignee: []
created_date: '2026-06-20 10:50'
updated_date: '2026-06-20 10:56'
labels: []
dependencies: []
parent_task_id: TASK-93
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When task-to-backlog finalises a new task, auto-append a default '## Definition of Done' section with a placeholder shell-gate checkbox (- [ ] bash scripts/validate-plugin.sh exits 0) if no DoD section is found in the draft. Patch the finalise phase in plugin/skills/task-to-backlog/SKILL.md to include this check. Add a contract assertion in validate-plugin.sh (via a test script scripts/test-task-to-backlog-dod-contract.sh) that creates a fixture task through task-to-backlog and asserts the output contains a ## Definition of Done section with at least one checkbox. This closes the gap identified in TASK-93 post-mortem root-cause R1: tasks created without DoD can be rubber-stamped Done.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 2 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.
<!-- SECTION:NOTES:END -->
