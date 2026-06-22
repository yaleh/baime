---
id: TASK-125.3
title: intake skills B″ 状态迁移(原 TASK-124)
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 10:23'
updated_date: '2026-06-21 10:30'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-125
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
feature/task-to-backlog/task-from-template 裸状态→Basic:*;validate 裸状态守卫扩到 intake skills。
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 ! grep -nE -- '--status "(Proposal|Plan|Backlog|Ready|Needs Human)"' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md plugin/skills/task-from-template/SKILL.md
- [ ] #2 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — 13 --status writes migrated to Basic:* across 3 intake skills + matching logic (feature-to-backlog fromStatus/case/regex/manifest); validate bare-status guard extended to intake skills. DoD ✓✓.
<!-- SECTION:NOTES:END -->
