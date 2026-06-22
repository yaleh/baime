---
id: TASK-121.2
title: 迁移 loop-meta 子任务生命周期状态 Ready/Meta-Done
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 09:19'
updated_date: '2026-06-21 09:23'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-121
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
迁移 loop-meta/SKILL.md 行 972 --status "Ready" → "Basic: Ready",行 1014 --status "Meta-Done" → "Epic: Done"。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 loop-meta/SKILL.md 无裸 --status Ready/Backlog/Meta-* 写入
- [ ] #2 validate-plugin.sh 通过
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — line 972 Ready→Basic: Ready, line 1014 Meta-Done→Epic: Done. DoD: no bare Ready/Backlog/Meta-* ✓; validate-plugin.sh ✓.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 ! grep -nE -- '--status "(Ready|Backlog|Meta-[A-Za-z]+)"' plugin/skills/loop-meta/SKILL.md
- [ ] #2 bash scripts/validate-plugin.sh
<!-- DOD:END -->
