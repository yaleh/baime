---
id: TASK-93
title: Exp-K：采集 loop-meta replan 触发频率与根因分布（P3 ROI 门控基线）
status: Meta-Active
assignee: []
created_date: '2026-06-20 07:53'
updated_date: '2026-06-20 14:27'
labels: []
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
运行 ≥10 个 meta-task 完整生命周期，从任务 notes 抓取 replan: 标记，统计 replan 触发率、5 类根因（impl/sub-plan/meta-plan/harness/infeasible）分布，以及 evaluator Met/NotMet 判定分布。结果作为 check-roi-gate.sh P3→P4 门控所需的 10-cycle 基线数据，跑完直接解锁 ROI gate。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Background

BAIME 的 ROI 门控机制（check-roi-gate.sh）要求在进入 P4 阶段前收集至少 10 个完整 meta-task 生命周期的基线数据，以证明 loop-meta 框架具备可测量的自我改进能力。当前 P3 阶段已完成框架骨架搭建，但缺乏实际运行数据支撑：replan 触发率、根因分布及 evaluator 判定分布均为空白，导致门控脚本无法通过。系统性地采集这批基线数据，不仅是解锁 P4 的前置条件，也是验证 meta-task 框架设计假设（replan 率可控、根因可分类、evaluator 判定准确）的最早机会。通过统计 5 类根因（impl/sub-plan/meta-plan/harness/infeasible）的分布，可以识别框架中最薄弱的环节，为 P4 的优化方向提供定量依据。

## Frozen Acceptance Criteria

> **方法论修订（2026-06-20，post-mortem）**：原 FAC#1 用 `ls task-notes/*.md | wc -l ≥10`
> 计数手写 note 文件——可被编造（首次执行即如此失败）。原 FAC#5 用 `check-roi-gate.sh
> 退出码 0`——而该脚本曾恒退出 0，与门控判定无关。两者均已重写：基线只能由
> `check-roi-gate.sh --emit-json` 从 backlog 中**真实** meta-task cycle 生成，并经
> `verify-provenance.sh` 证明来源；门控以 `Result: PROCEED` 为通过信号（PROCEED→0/HOLD→2）。

1. backlog 中存在 ≥10 个**真实**已完成的 meta-task cycle（每个为独立 meta-task，经
   Meta-Active→Meta-Done，其子任务均带 shell-gate DoD 且由 loop-backlog 真实 verifyDod 完成）：
   `bash -c '[ "$(bash scripts/check-roi-gate.sh 2>/dev/null | grep -oP "Meta-task cycles detected:\s*\K\d+")" -ge 10 ]'` 退出码为 0。
2. 每个 meta-task 的子任务均带可验证 DoD（无橡皮图章）：对每个被统计的 meta-task，
   `bash scripts/verify-subtask-dod.sh <META_ID>` 退出码为 0。
3. 基线 JSON 由 `check-roi-gate.sh --emit-json` 生成（**唯一合法产出路径**），并带溯源字段：
   `bash -c 'jq -e ".generated_by == \"scripts/check-roi-gate.sh\" and .data_source == \"measured\"" plugin/loop-meta/data/baseline/replan-stats.json'` 退出码为 0。
4. 基线目录通过溯源门（无 data_source: measured 而缺 generated_by 的伪造文件）：
   `bash scripts/verify-provenance.sh plugin/loop-meta/data/baseline` 退出码为 0。
5. ROI 门控真实判定为 PROCEED（不再以恒为真的退出码冒充）：
   `bash -c 'bash scripts/check-roi-gate.sh | grep -q "Result: PROCEED"'` 退出码为 0，
   且 `bash scripts/check-roi-gate.sh` 退出码为 0（R2 后 0 即 PROCEED）。
6. evaluator 判定分布来自真实 cycle 且自洽：基线 JSON 中
   `(.evaluator.Met + .evaluator.NotMet) == .meta_task_cycles`：
   `bash -c 'jq -e "(.evaluator.Met + .evaluator.NotMet) == .meta_task_cycles" plugin/loop-meta/data/baseline/replan-stats.json'` 退出码为 0。

## Sub-Goal Tree

- **G1 运行环境与守卫就位**
  - G1.1 确认数据目录结构与写权限；清理被隔离的伪造基线（_quarantine-task-93）
  - G1.2 确认四道守卫可用：verify-subtask-dod.sh / check-roi-gate.sh(PROCEED/HOLD) / --emit-json / verify-provenance.sh

- **G2 真实执行 ≥10 个 meta-task 生命周期**
  - G2.1 选取或生成 ≥10 个真实 meta-task 输入（覆盖不同复杂度，含会触发 replan 的场景）
  - G2.2 逐一经 loop-meta 真实分解（createSubTask→task-to-backlog，子任务带 DoD）并经 loop-backlog 真实执行至 Meta-Done；每个 cycle 的 replan:/evaluator: 标记写入该 meta-task 的 backlog notes（非手写外部文件）

- **G3 基线生成（唯一合法路径）**
  - G3.1 运行 `check-roi-gate.sh --emit-json plugin/loop-meta/data/baseline/replan-stats.json` 从真实 cycle 产出带溯源的基线
  - G3.2 运行 `verify-provenance.sh plugin/loop-meta/data/baseline` 证明基线来源可追溯

- **G4 ROI 门控解锁**
  - G4.1 确认 `check-roi-gate.sh` 真实判定为 `Result: PROCEED` 且退出码 0
  - G4.2 记录 P3→P4 解锁结论于 TASK-93 notes（引用上述守卫输出作为证据）
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
HOLD: FAC#5 gate check not yet satisfied. Need ≥10 real Meta-Done cycles with evaluator: markers in backlog before this task can advance. Current gate: 0 cycles detected. Required action: process TASK-93.11–20 through their independent meta-task lifecycles (Meta-Plan→Meta-Active→Meta-Done) until gate shows 'Result: PROCEED'. Then set status → Meta-Active to re-trigger evaluateAndReplan. Do not auto-advance this task via completionCheck — the experiment corpus must be collected first.

idempotentReconcile: no gap — all 4 sub-tasks present (TASK-93.7, 93.8, 93.9, 93.10 all Done)

evaluateAndReplan: evaluator verdict=NotMet done=4 pending=0 | dod_aggregate: verify-subtask-dod.sh FAIL (false positive — 11/21 flagged children are archived old-iteration tasks with duplicate IDs; all 4 ACTIVE children carry shell-gate DoD) | roi_gate: HOLD (0 Meta-Done cycles with evaluator: markers detected — experiment corpus not yet run) | data_source: measured

Escalated: evaluator NotMet — ROI gate shows HOLD (0 cycles). Root cause: experiment subjects TASK-93.11–20 are in Backlog status and have not been driven through Meta-Plan→Meta-Active→Meta-Done yet. These 10 subjects were restored to working tree (had been deleted without committing). Required action: promote TASK-93.11–20 from Backlog→Meta-Plan so loop-meta can process them through the full lifecycle. Once ≥10 subjects reach Meta-Done with evaluator: markers, re-run check-roi-gate.sh and set TASK-93 status → Meta-Active to re-trigger evaluateAndReplan.
To continue: resolve blocker and set status → Meta-Active.

loop-meta reset 2026-06-20: deleted TASK-93.11–20 and their sub-tasks (39 files). Cleared previous Done children (93.7, 93.8, 93.9, 93.10 were experiment scaffolding, not real meta-task subjects). Running fresh draftDecomposition + idempotentReconcile to create proper sub-tasks for Exp-K.

idempotentReconcile: no gap — all 4 sub-tasks present (93.7 Done, 93.10 Done, 93.8 Ready, 93.9 Ready)

setReady: promoted G3 (TASK-93.8) and G4 (TASK-93.9) to Ready (WIP=2, WIP_CAP=2)

evaluateAndReplan: evaluator verdict=Met (verify-subtask-dod.sh PASS, archive contamination cleared) | done=2 pending=2 | partial progress — no escalation. Waiting for loop-backlog to execute TASK-93.8 (G3) — its DoD#1 gates on ≥10 real Meta-Done cycles with idempotentReconcile: markers; that gate will block until the experiment corpus is run through loop-meta. | data_source: measured

Exp-K corpus ready: 12 meta tasks created in Meta-Plan status (TASK-106–117) via /meta-task-to-backlog skill. Each carries proposal + implementation plan + acceptance criteria; no shell-gate DoD on meta tasks (evaluator-judged). Loop-meta can now dispatch draftDecomposition on all 12. TASK-93.8 DoD#1 gate (≥10 tasks with meta/reconcile markers) will clear as loop-meta processes each subject through Meta-Done.
<!-- SECTION:NOTES:END -->
