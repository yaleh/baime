---
id: TASK-125.2
title: 'epic-to-backlog 扩为交互式 propose→plan→Epic: Backlog'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 10:23'
updated_date: '2026-06-21 10:46'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-125
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
镜像 feature-to-backlog,复用 reviewLoop,收尾停在 Epic: Backlog。
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q "proposalLoop" plugin/skills/epic-to-backlog/SKILL.md
- [ ] #2 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — epic-to-backlog 改为交互式 propose→plan→Epic: Backlog(镜像 feature-to-backlog,复用 reviewLoop,不 decompose)。DoD ✓✓. (agent-implemented)
<!-- SECTION:NOTES:END -->
