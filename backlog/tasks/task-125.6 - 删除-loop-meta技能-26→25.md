---
id: TASK-125.6
title: 删除 loop-meta(技能 26→25)
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 10:23'
updated_date: '2026-06-21 10:57'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-125
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
移除 skill+symlink;EXPECTED_SKILLS 26→25;清理契约/文档引用。
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 ! test -d plugin/skills/loop-meta
- [ ] #2 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — 删除 loop-meta skill+symlink;EXPECTED_SKILLS 26→25;移除 epic-daemon.js(统一 daemon 取代)+ 3 个 loop-meta 测试脚本;daemon-status.sh 改为单一 unified daemon;清理 WORKER_SKILLS;修正 epic-to-backlog 完成消息(epic-daemon+loop-meta→unified loop-backlog)。DoD ✓✓.
<!-- SECTION:NOTES:END -->
