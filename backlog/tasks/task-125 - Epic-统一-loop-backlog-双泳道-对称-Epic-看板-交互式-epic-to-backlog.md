---
id: TASK-125
title: 'Epic: 统一 loop-backlog 双泳道 + 对称 Epic 看板 + 交互式 epic-to-backlog'
status: 'Epic: Done'
assignee: []
created_date: '2026-06-21 10:18'
updated_date: '2026-06-21 11:20'
labels:
  - 'kind:epic'
dependencies: []
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Epic 目标
把 epic/basic 机制重构为「人工闸门(创建/计划/选择/确认)+ 单一自治 worker(执行)」模型,贴合用户 proven 的开发模式。

## 架构(已与用户对齐)
### 看板:Epic 泳道对称化(14→16 列)
新增 Epic: Backlog、Epic: Ready。Epic: Decomposing ≈ Basic: In Progress(自动处理)。
Epic 9 列:Proposal/Plan/Backlog/Ready/Decomposing/Awaiting Children/Evaluating/Done/Needs Human
Basic 7 列不变。

### 人工闸门 vs 自治
- 交互:epic-to-backlog 做 propose+plan,停在 Epic: Backlog(对称 feature-to-backlog)
- 闸门①:人工 Epic: Backlog→Epic: Ready(授权自动处理)
- 自治:Epic: Ready→Decomposing→建子任务(Basic: Backlog)→Awaiting Children
- 闸门②:人工 Basic: Backlog→Basic: Ready(选择执行)
- 自治:Basic: Ready→In Progress→Done
- 自治:全部子任务 Done(数 parent_task_id 子任务,非归档)→ Awaiting Children→Evaluating→evaluate→写建议(FINISH|ITERATE)→软停
- 闸门③:人工确认 Evaluating→Done,或退回 Epic: Proposal/Plan 迭代

### 单 daemon + 单 worker(合并为 loop-backlog)
daemon 发:basic-ready(Basic: Ready)、epic-ready(Epic: Ready)、child-done(Basic: Done+有 parent,修缺口#2)
worker 分发:basic-ready→执行;epic-ready→自动 decompose;child-done→reconcile+evaluate+建议
loop-meta 删除(propose/plan→epic-to-backlog;decompose/evaluate→loop-backlog worker)。技能 26→25。

## 关键决策
- 决策点:decompose 归自治(Epic: Ready→Decomposing),非 epic-to-backlog。(用户消息2 对称性优先于消息1)
- 子任务完成判定:count(子@Basic:Done)==count(子,非归档),不重跑 decomposer
- 迭代退回 Epic: Proposal/Plan;新一轮 decompose 用三方 reconcile 只建增量

## 拟拆分(decompose 阶段细化,~6 Basic)
1. 看板对称化:config.yml 14→16(加 Epic: Backlog/Ready)、verify-kind-status EPIC_STATUSES、TASK-122 config 检查 14→16
2. epic-to-backlog 扩成交互式 propose→plan→Epic: Backlog(镜像 feature-to-backlog,复用 reviewLoop)
3. 统一 daemon:emit basic-ready + epic-ready(Epic: Ready)+ child-done;合并 basic/epic daemon,嵌入副本+版本号同步
4. loop-backlog worker 增 epic 分发:epic-ready→自动 decompose;child-done→reconcile→Evaluating→建议;吸收 decomposer/createSubTask/evaluator
5. 删除 loop-meta:技能数 26→25、symlink、文档、契约清理
6. 端到端冒烟:epic-to-backlog→促 Epic: Ready→自动 decompose→促子任务 Ready→执行→自动 evaluate+建议→确认 Done

## 验收信号(Epic)
bash scripts/validate-plugin.sh
config.yml 含 16 个 Epic:/Basic: 状态(9+7)
端到端冒烟日志含 terminal: 标记

## 关联
吸收/紧随 TASK-124(intake skills 状态迁移:set status→Basic: Ready)。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 统一 loop-backlog 双泳道架构

提案见 task 描述。7 个 Basic 子任务,依赖序:1 →{2,3}→ 4 → 5 → 6 → 7。

## Child 1: 看板 Epic 泳道对称化(14→16 列)
config.yml 加 Epic: Backlog/Epic: Ready;verify-kind-status EPIC_STATUSES +2;
TASK-122 config 完整性检查 14→16;epic-daemon 状态集更新。
### DoD
- [ ] `python3 -c "import yaml;c=yaml.safe_load(open('backlog/config.yml'));assert len([s for s in c['statuses'] if s.startswith(('Epic:','Basic:')])==16"`
- [ ] `bash scripts/validate-plugin.sh`

## Child 2: epic-to-backlog 扩为交互式 propose→plan→Epic: Backlog
镜像 feature-to-backlog(loadConfig/resolveOrCreate/proposalLoop/planLoop/finalise),复用 reviewLoop,收尾停在 Epic: Backlog。
### DoD
- [ ] `grep -q "proposalLoop" plugin/skills/epic-to-backlog/SKILL.md && grep -q "Epic: Backlog" plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `bash scripts/validate-plugin.sh`

## Child 3: intake skills B″ 状态迁移(原 TASK-124)
feature-to-backlog/task-to-backlog/task-from-template 裸状态→Basic:*;把 validate 裸状态守卫范围扩到这 3 个 intake skill。
### DoD
- [ ] `! grep -nE -- '--status "(Proposal|Plan|Backlog|Ready|Needs Human)"' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md plugin/skills/task-from-template/SKILL.md`
- [ ] `bash scripts/validate-plugin.sh`

## Child 4: 统一 daemon — 发 basic-ready + epic-ready(Epic: Ready)+ child-done
合并 basic/epic daemon;child-done 修子→父回触发缺口;嵌入副本 + daemon-version 同步;routing 测试。
### DoD
- [ ] `node scripts/daemon-routing.test.js`
- [ ] `bash scripts/validate-plugin.sh`

## Child 5: loop-backlog worker 增 epic 分发
epic-ready→自动 decompose(Epic: Ready→Decomposing→子任务 Basic: Backlog→Awaiting Children);
child-done→reconcile(全部子任务 Done?)→Evaluating→evaluate→写 cap:evaluate=recommendation;吸收 decomposer/createSubTask/evaluator。
### DoD
- [ ] `grep -qE "epic-ready|child-done" plugin/skills/loop-backlog/SKILL.md && grep -q "recommendation" plugin/skills/loop-backlog/SKILL.md`
- [ ] `bash scripts/validate-plugin.sh`

## Child 6: 删除 loop-meta
移除 skill + symlink;EXPECTED_SKILLS 26→25;清理契约/文档引用。
### DoD
- [ ] `! test -d plugin/skills/loop-meta && grep -q "EXPECTED_SKILLS=25" scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh`

## Child 7: 端到端冒烟
epic-to-backlog→促 Epic: Ready→自动 decompose→促子任务 Basic: Ready→执行→自动 evaluate+建议→确认 Done。
### DoD
- [ ] `grep -q "terminal:" logs/unified-loop-smoke.log`
- [ ] `bash scripts/validate-plugin.sh`

## Acceptance Gate (Epic)
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `python3 -c "import yaml;c=yaml.safe_load(open('backlog/config.yml'));assert len([s for s in c['statuses'] if s.startswith(('Epic:','Basic:')])==16"`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:propose=approved
epicReviewProposal: 架构已与用户对齐(decompose 自治、TASK-124 并入)。APPROVED.

cap:plan=approved
epicReviewPlan: 7 子任务依赖序明确,各 DoD shell 可断言。TASK-124 并入为 Child 3。APPROVED.

cap:decompose=done child_ids:[TASK-125.1..125.7]
epicDecompose: 7 kind:basic children at Basic: Backlog, R1 DoD-gate PASS. 等待人工选择执行(促 Basic: Ready)。

epicAwaitChildren: done=2/7 (125.1, 125.3) reconcileRunCount=1 — 低风险打底批完成,等待人工选择后续(125.2/4/5/6/7)。

epicAwaitChildren: done=4/7 (125.1,125.2,125.3,125.4) reconcileRunCount=2 — 剩 125.5(worker 增 epic 分发)→125.6(删 loop-meta)→125.7(冒烟)。

epicAwaitChildren: done=5/7 reconcileRunCount=3 — 核心 worker 集成完成。剩 125.6(删 loop-meta)→125.7(冒烟)。

epicAwaitChildren: done=6/7 — loop-meta 已删除,legacy meta lane 退役。剩 125.7(端到端冒烟)。

epicAwaitChildren: done=7/7 — all children Basic: Done.
cap:await=done all_children_done:true

cap:evaluate=recommendation:FINISH | done=7/7 needsHuman=0 | acceptance_gate: validate✓ config-16✓ smoke-terminal✓ loop-meta-removed✓ routing-34/34✓ | data_source: measured
RECOMMENDATION: FINISH — 统一双泳道架构已完整交付并验证。确认请将 TASK-125 → Epic: Done;迭代请退回 Epic: Proposal/Plan。
<!-- SECTION:NOTES:END -->
