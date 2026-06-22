---
id: TASK-125.5
title: loop-backlog worker 增 epic 分发(自动 decompose + child-done evaluate)
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 10:23'
updated_date: '2026-06-21 10:52'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-125
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
epic-ready→自动 decompose;child-done→reconcile→Evaluating→写 recommendation;吸收 decomposer/createSubTask/evaluator。
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -qE "epic-ready|child-done" plugin/skills/loop-backlog/SKILL.md
- [ ] #2 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:claim=started
cap:execute=done — loop-backlog worker 增 epic 分发:Monitor 三通道路由;epicDecompose(epic-ready: Epic: Ready→Decomposing→子任务 Basic: Backlog→Awaiting Children);onChildDone(child-done: 全部子任务 Done→Evaluating→写 FINISH/ITERATE 建议→软停);吸收 decomposer/createSubTask/verifySubTaskDod/evaluator(spec+bash impl)。DoD ✓✓.
<!-- SECTION:NOTES:END -->
