---
id: TASK-123.2
title: daemon-status.sh 增加陈旧检测与重启提示
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 09:34'
updated_date: '2026-06-21 09:35'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-123
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
--check 模式:pid 文件存在但进程死 → STALE + exit 非零 + 打印重启命令。
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -qE "STALE|--check" scripts/daemon-status.sh
- [ ] #2 bash scripts/daemon-status.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — --check mode: STALE detection (dead pid) → exit non-zero + restart hint. Verified with planted dead pid. DoD ✓✓.
<!-- SECTION:NOTES:END -->
