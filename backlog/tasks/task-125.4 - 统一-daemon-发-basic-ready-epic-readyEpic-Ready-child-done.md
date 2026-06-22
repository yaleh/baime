---
id: TASK-125.4
title: '统一 daemon:发 basic-ready + epic-ready(Epic: Ready)+ child-done'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 10:23'
updated_date: '2026-06-21 10:46'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-125
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
合并 basic/epic daemon;child-done 修子→父回触发;嵌入副本+版本同步。
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 node scripts/daemon-routing.test.js
- [ ] #2 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — 统一 daemon v6→v7:emit basic-ready + epic-ready(仅 Epic: Ready)+ child-done(修子→父回触发);嵌入副本字节级同步;routing test 重写(34 通过)。DoD ✓✓.
<!-- SECTION:NOTES:END -->
