---
id: TASK-125.1
title: '看板 Epic 泳道对称化(加 Epic: Backlog/Ready,14→16)'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 10:23'
updated_date: '2026-06-21 10:27'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-125
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
config.yml 加 Epic: Backlog/Epic: Ready;verify-kind-status EPIC_STATUSES +2;TASK-122 config 检查 14→16;epic-daemon 状态集更新。
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 python3 -c "import yaml;c=yaml.safe_load(open('backlog/config.yml'));assert len([s for s in c['statuses'] if s.startswith(('Epic:','Basic:')])==16"
- [ ] #2 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — config.yml 14→16 (加 Epic: Backlog/Ready);verify-kind-status EPIC_STATUSES +2;validate config 检查 14→16。DoD ✓✓.
<!-- SECTION:NOTES:END -->
