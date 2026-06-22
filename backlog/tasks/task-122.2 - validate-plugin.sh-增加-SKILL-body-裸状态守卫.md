---
id: TASK-122.2
title: validate-plugin.sh 增加 SKILL body 裸状态守卫
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 09:30'
updated_date: '2026-06-21 09:33'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-122
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
在 validate-plugin.sh 增加守卫:扫描所有 SKILL.md,任何 --status 写入非 14 个 B″ 状态即 FAIL。
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -qiE "bare.?status|status guard" scripts/validate-plugin.sh
- [ ] #2 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — added bare-status guard (scoped to worker skills). DoD ✓✓.
NOTE: guard surfaced pre-B″ bare statuses in 4 intake skills (feature/task-to-backlog, task-from-template, backlog-setup) — candidate future epic.
<!-- SECTION:NOTES:END -->
