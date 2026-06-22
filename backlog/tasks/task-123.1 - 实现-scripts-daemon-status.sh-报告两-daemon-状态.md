---
id: TASK-123.1
title: 实现 scripts/daemon-status.sh 报告两 daemon 状态
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 09:34'
updated_date: '2026-06-21 09:35'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-123
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
只读脚本:basic/epic daemon 各读 .pid → kill -0 判活 → 打印 RUNNING/DOWN + 最近事件 + 日志 mtime。exit 0。
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/daemon-status.sh
- [ ] #2 bash scripts/daemon-status.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — scripts/daemon-status.sh reports RUNNING/DOWN + last-event + log freshness for both daemons. DoD ✓✓.
<!-- SECTION:NOTES:END -->
