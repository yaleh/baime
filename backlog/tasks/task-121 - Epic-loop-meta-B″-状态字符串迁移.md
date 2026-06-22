---
id: TASK-121
title: 'Epic: loop-meta B″ 状态字符串迁移'
status: 'Epic: Done'
assignee: []
created_date: '2026-06-21 09:16'
updated_date: '2026-06-21 09:25'
labels:
  - 'kind:epic'
dependencies: []
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Epic 目标
loop-meta/SKILL.md 仍残留 B″ 迁移前的裸状态字符串(7 处 "Needs Human"、1 处 "Ready"),B″ 双状态机下应使用带泳道前缀的状态。本 Epic 将其迁移到 Epic:/Basic: 命名空间,并防止回归。

## 拟拆分的 Basic 子任务(decompose 阶段细化)
1. 修正 escalate/evaluate 路径 7 处 "Needs Human" → "Epic: Needs Human"
2. 修正子任务派发 "Ready" → "Basic: Ready",审计 loop-meta 全部 status 写入

## 验收信号
! grep -nE -- '--status "(Needs Human|Ready)"' plugin/skills/loop-meta/SKILL.md (exit 0)
bash scripts/validate-plugin.sh
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: loop-meta B″ 状态字符串迁移

loop-meta/SKILL.md 的遗留 meta-lane 函数仍写入 B″ 看板中已不存在的列
(Meta-Done / 裸 Needs Human / 裸 Ready)。本 Epic 将其全部迁移到 B″ 命名空间,
拆为 2 个独立、shell 可断言的 Basic 子任务。

映射:
  "Needs Human" → "Epic: Needs Human"   (epic worker 人工升级列)
  "Ready"        → "Basic: Ready"         (子任务派发进基础泳道)
  "Meta-Done"    → "Epic: Done"           (完成列)

## Child 1 (Basic): 迁移 7 处升级状态 "Needs Human" → "Epic: Needs Human"
位置:行 677/717/813/1026/1042/1063/1078
### DoD
- [ ] `! grep -nE -- '--status "Needs Human"' plugin/skills/loop-meta/SKILL.md`
- [ ] `bash scripts/validate-plugin.sh`

## Child 2 (Basic): 迁移子任务生命周期状态 "Ready"/"Meta-Done"
位置:行 972 ("Ready"→"Basic: Ready")、1014 ("Meta-Done"→"Epic: Done")
### DoD
- [ ] `! grep -nE -- '--status "(Ready|Backlog|Meta-[A-Za-z]+)"' plugin/skills/loop-meta/SKILL.md`
- [ ] `bash scripts/validate-plugin.sh`

## Acceptance Gate (Epic)
- [ ] `! grep -nE -- '--status "(Needs Human|Ready|Backlog|Meta-[A-Za-z]+)"' plugin/skills/loop-meta/SKILL.md`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:propose=approved
epicReviewProposal: proposal reviewed — goal concrete, acceptance shell-verifiable (! grep bare statuses). APPROVED.

cap:plan=approved
epicReviewPlan: plan reviewed — 2 independent children, each DoD shell-verifiable, status mapping explicit. APPROVED.

cap:decompose=done child_ids:[TASK-121.1, TASK-121.2]
epicDecompose: 2 kind:basic children created at Basic: Backlog, parent_task_id=TASK-121, R1 DoD-gate PASS.

epicAwaitChildren: done=2/2 reconcileRunCount=1 — desired=created=done, no missing, no excess.
cap:await=done all_children_done:true

evaluator: Met | dod_aggregate=PASS(2/2 children DoD) | acceptance_gate=PASS(no bare statuses, validate-plugin.sh) | needs_human=0 | data_source: measured
cap:evaluate=done verdict:Approved
terminal:TASK-121 Epic: Done
<!-- SECTION:NOTES:END -->
