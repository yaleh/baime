---
id: TASK-125.7
title: '端到端冒烟:统一双泳道全生命周期'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 10:23'
updated_date: '2026-06-21 11:14'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-125
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
epic-to-backlog→促 Epic: Ready→自动 decompose→促子任务 Ready→执行→自动 evaluate+建议→确认 Done。
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q "terminal:" logs/unified-loop-smoke.log
- [ ] #2 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — scripts/unified-loop-smoke.sh:Tier1 真实 daemon-routing(34通过)+ Tier2 确定性全生命周期模拟(epic-to-backlog→Ready→自动decompose→促子任务→执行→child-done→Evaluating→FINISH建议→确认 Done)。logs/unified-loop-smoke.log 含 terminal:。DoD ✓✓.
<!-- SECTION:NOTES:END -->
