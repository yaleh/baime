---
id: TASK-121.1
title: '迁移 loop-meta 7 处升级状态 Needs Human → Epic: Needs Human'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 09:19'
updated_date: '2026-06-21 09:22'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-121
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
迁移 loop-meta/SKILL.md 中 7 处遗留升级写入 --status "Needs Human" → "Epic: Needs Human"(行 677/717/813/1026/1042/1063/1078)。B″ 看板无裸 Needs Human 列。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 loop-meta/SKILL.md 无裸 --status "Needs Human" 写入
- [ ] #2 validate-plugin.sh 通过
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — 7× --status "Needs Human" → "Epic: Needs Human". DoD: no bare Needs Human ✓; validate-plugin.sh ✓.
NOTE: surfaced+fixed verify-kind-status.sh bug (block-list labels not quote-stripped).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 ! grep -nE -- '--status "Needs Human"' plugin/skills/loop-meta/SKILL.md
- [ ] #2 bash scripts/validate-plugin.sh
<!-- DOD:END -->
