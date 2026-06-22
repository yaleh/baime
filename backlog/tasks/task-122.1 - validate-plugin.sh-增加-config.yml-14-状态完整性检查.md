---
id: TASK-122.1
title: validate-plugin.sh 增加 config.yml 14-状态完整性检查
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 09:30'
updated_date: '2026-06-21 09:33'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-122
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
在 validate-plugin.sh 增加 Python YAML parse 检查:config.yml 恰含 14 个 Epic:/Basic: 状态,无 Meta-*/裸列。格式无关。
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q "config.yml" scripts/validate-plugin.sh
- [ ] #2 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — added config.yml 14-status YAML-parse integrity check. DoD ✓✓.
<!-- SECTION:NOTES:END -->
