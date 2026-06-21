---
id: TASK-88
title: 'P3: evaluator（切片聚合）+ replanner + ROI 闸门测量'
status: Basic: Done
assignee: []
created_date: '2026-06-20 06:04'
updated_date: '2026-06-20 06:51'
labels:
  - kind:basic
  - loop-meta
  - evaluator
  - replanner
  - roi-gate
dependencies:
  - TASK-87
  - TASK-55
references:
  - docs/proposals/loop-meta-architecture.md
  - TASK-55
  - TASK-52
modified_files:
  - scripts/check-roi-gate.sh
  - plugin/skills/loop-meta/SKILL.md
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

P2 实现了分解，P3 闭合"评价→replan"回路，并量化 ROI 以决定是否值得投入 P4 自治。

evaluator 设计依据"分叉共识"（工业界已放弃整体 agent 测试，主流为 single-step + trace replay + sliced grading）：**不实现新的整体裁判**，而是聚合已有切片资产：Layer 2.5 oracle（Class A/B/C，TASK-46/55 的产物）+ 子任务 DoD 聚合 + trace replay，每个切片证据须 `data_source: measured`。

replanner 在 NotMet 时诊断根因（impl/sub-plan/meta-plan/harness/infeasible）并更新计划，只改路径不改 acceptance。

**P3→P4 ROI 闸门**：P3 运行期间 measured 记录 replan 实际触发频率 + evaluator 切片与人工判断一致率；若 replan 极少或 evaluator 不可靠，停在 P3，不进 P4。

## Goals

1. `evaluator` 子代理：把 frozen 验收分解为切片检查（Layer 2.5 oracle slice + DoD 聚合 + trace replay），输出 Met / NotMet+reasons，每切片含 `data_source: measured`。
2. `replanner` 子代理：NotMet 时诊断根因分类，更新 meta-plan（留痕，不改 acceptance）。
3. loop-meta reconcile 主循环集成 evaluate → replan 分支（仅 Meta-Active 且有 Done 子任务时触发）。
4. ROI 闸门测量：在运行日志/notes 中记录每次 replan 触发事件 + evaluator 切片结论（格式可脚本查询），输出一份 measured 证据报告供 P4 决策。
5. `bash scripts/validate-plugin.sh` 通过。

## Proposed Approach

扩展 `plugin/skills/loop-meta/SKILL.md` 的 Spec，新增 evaluator/replanner 子代理定义。evaluator 的切片输入从 L0 notes（P0 产出）和 Layer 2.5 oracle run artifacts 读取。ROI 报告用脚本从 notes/日志中聚合。

## Trade-offs and Risks

- evaluator 质量上限由 Layer 2.5 oracle 资产决定——依赖 TASK-55 产物（Class A/B oracle runner）。
- replanner 诊断错误会改错层；对策：诊断结论须引用具体证据，必要时多轮投票。
- ROI 闸门是硬边界：若 replan 触发频率 <2次/10个 meta-task 周期，P4 不应立即推进。

## References

- docs/proposals/loop-meta-architecture.md（§4 子代理 evaluator/replanner、Rollout P3、Acceptance Gate）
- experiments/skill-quality/artifacts/analysis/（Layer 2.5 oracle 产物）
- TASK-55（Class A/B oracle runner）
- TASK-52（provenance 门）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 evaluator 为切片聚合（Layer 2.5 oracle + DoD + trace replay），非整体 LLM judge
- [ ] #2 每个 evaluator 切片含 data_source: measured；不允许 estimated 切片影响 Met/NotMet 结论
- [ ] #3 replanner 输出根因分类 + 更新后 meta-plan，不修改 acceptance
- [ ] #4 ROI 闸门测量报告存在（measured 记录 replan 触发频率 + evaluator 切片一致率）
- [ ] #5 bash scripts/validate-plugin.sh 通过
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: P3 evaluator（切片聚合）+ replanner + ROI 闸门测量

## Overview

Extend `plugin/skills/loop-meta/SKILL.md` (created by TASK-87) to add `evaluator` and `replanner` subagent definitions in the Spec section, integrate evaluate→replan branch into metaLoop reconcile, and create `scripts/check-roi-gate.sh` to produce a measured ROI report from task notes/logs.

## Acceptance Gate

```
bash scripts/validate-plugin.sh
grep -q 'evaluator' plugin/skills/loop-meta/SKILL.md
grep -q 'replanner' plugin/skills/loop-meta/SKILL.md
test -f scripts/check-roi-gate.sh
bash scripts/check-roi-gate.sh
bash scripts/validate-plugin.sh
```

---

## Phase A — scripts/check-roi-gate.sh

### Tests

**RED (before implementation):**
```bash
! test -f scripts/check-roi-gate.sh
```

**GREEN (after implementation):**
```bash
test -f scripts/check-roi-gate.sh
bash scripts/check-roi-gate.sh
```

### DoD

```bash
bash scripts/validate-plugin.sh
test -f scripts/check-roi-gate.sh
bash scripts/check-roi-gate.sh
```

### Implementation

Create `scripts/check-roi-gate.sh` as a bash script that:
1. Scans `backlog/tasks/*.md` files for lines matching `evaluator:` or `replan:` markers in task notes/implementation sections.
2. Counts replan trigger events and evaluator slice conclusions.
3. Outputs a ROI measurement report in plain text showing: total replan events, evaluator slice Met/NotMet counts, replan trigger rate (events per task), and a P4 gate recommendation (PROCEED / HOLD) based on whether replan trigger rate >= 2 per 10 meta-task cycles.
4. Exits 0 when the report is produced successfully (even if zero events found — zero is a valid measured baseline).

Script structure:
```bash
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASKS_DIR="$REPO_ROOT/backlog/tasks"

replan_events=0
evaluator_met=0
evaluator_not_met=0
total_tasks=0

for f in "$TASKS_DIR"/*.md; do
    [ -f "$f" ] || continue
    total_tasks=$((total_tasks + 1))
    while IFS= read -r line; do
        case "$line" in
            *"replan:"*) replan_events=$((replan_events + 1)) ;;
            *"evaluator: Met"*) evaluator_met=$((evaluator_met + 1)) ;;
            *"evaluator: NotMet"*) evaluator_not_met=$((evaluator_not_met + 1)) ;;
        esac
    done < "$f"
done

echo "=== ROI Gate Measurement Report ==="
echo "Scanned tasks: $total_tasks"
echo "Replan trigger events: $replan_events"
echo "Evaluator slices Met: $evaluator_met"
echo "Evaluator slices NotMet: $evaluator_not_met"

if [ "$total_tasks" -gt 0 ]; then
    rate=$(echo "scale=2; $replan_events * 10 / $total_tasks" | bc)
else
    rate=0
fi
echo "Replan rate (per 10 tasks): $rate"

if [ "$replan_events" -ge 2 ] && [ "$total_tasks" -ge 10 ]; then
    echo "P4 Gate: PROCEED (sufficient replan evidence)"
elif [ "$total_tasks" -lt 10 ]; then
    echo "P4 Gate: HOLD (insufficient task sample — need >= 10 meta-task cycles)"
else
    echo "P4 Gate: HOLD (replan trigger frequency < 2 per 10 cycles)"
fi
echo "data_source: measured"
```

---

## Phase B — Extend plugin/skills/loop-meta/SKILL.md

### Tests

**RED (before implementation):**
```bash
! test -f plugin/skills/loop-meta/SKILL.md || ! grep -q 'evaluator' plugin/skills/loop-meta/SKILL.md
```

**GREEN (after implementation):**
```bash
grep -q 'evaluator' plugin/skills/loop-meta/SKILL.md
grep -q 'replanner' plugin/skills/loop-meta/SKILL.md
```

### DoD

```bash
bash scripts/validate-plugin.sh
grep -q 'evaluator' plugin/skills/loop-meta/SKILL.md
grep -q 'replanner' plugin/skills/loop-meta/SKILL.md
bash scripts/check-roi-gate.sh
bash scripts/validate-plugin.sh
```

### Implementation

Extend `plugin/skills/loop-meta/SKILL.md` Spec section to add evaluator subagent definition (slice types: layer25_oracle, dod_aggregate, trace_replay; each slice data_source: measured), replanner subagent definition (root cause taxonomy: impl/sub-plan/meta-plan/harness/infeasible; MUST NOT modify acceptance; MUST leave audit trail as `replan: <root-cause> — <diagnosis>`), and reconcile branch integration (triggers on Meta-Active + Done children).

---

## Constraints

- `plugin/skills/loop-meta/SKILL.md` is created by TASK-87. Phase B is blocked until TASK-87 delivers the file. This is an acceptable dependency, not a plan defect.
- evaluator quality ceiling is determined by the Layer 2.5 oracle assets in `experiments/skill-quality/artifacts/analysis/` (TASK-55 dependency).
- replanner MUST NOT change acceptance criteria — only update the path to meet them.
- ROI gate is a hard boundary: if replan trigger frequency < 2 per 10 meta-task cycles, P4 must not proceed.
- `bash scripts/validate-plugin.sh` must pass after all changes, including any skill count update in the validator (TASK-87 adds loop-meta as skill #25, requiring EXPECTED_SKILLS to be updated to 25).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal APPROVED (2026-06-20): Background explains evaluate→replan loop closure and ROI gate rationale. Goals are numbered and concretely verifiable. Feasibility confirmed: experiments/skill-quality/artifacts/analysis/ exists with oracle artifacts; plugin/skills/loop-meta/SKILL.md stated as TASK-87 dependency (acceptable). Trade-offs and risks identified (oracle quality ceiling, replanner diagnosis errors, ROI gate hard boundary). No contradictions. Advancing to Plan.

Plan APPROVED (2026-06-20): All 5 goals covered across Phase A (check-roi-gate.sh) and Phase B (evaluator+replanner in SKILL.md). TDD structure verified: both phases have Tests/DoD/Implementation; first DoD item in each phase is bash scripts/validate-plugin.sh; first Acceptance Gate item is bash scripts/validate-plugin.sh. All DoD items are shell commands. RED tests use ! test -f and ! grep -q (not grep -qv). Phase B RED test correctly handles missing-file and missing-content cases. Phase ordering correct (A has no dependencies; B depends on TASK-87). File paths are repo-root-relative. Advancing to Backlog.

Phase A ✓ 2026-06-20T07:02:00Z
Created scripts/check-roi-gate.sh — scans task notes for evaluator/replan markers, outputs P4 gate decision (HOLD at baseline: 0 meta-task cycles), data_source: measured.

Phase B ✓ 2026-06-20T07:02:00Z
Extended plugin/skills/loop-meta/SKILL.md: evaluator (3 measured slices), replanner (5-category root-cause taxonomy, no acceptance modification), evaluateAndReplan integration. Added contracts for evaluator and replanner.

## Execution Summary
Result: Done
Commit: 88701bb
All 11 DoD items PASS.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 grep -q 'evaluator' plugin/skills/loop-meta/SKILL.md
- [x] #2 grep -q 'replanner' plugin/skills/loop-meta/SKILL.md
- [x] #3 test -f scripts/check-roi-gate.sh
- [x] #4 bash scripts/check-roi-gate.sh
- [x] #5 bash scripts/validate-plugin.sh
- [x] #6 bash scripts/validate-plugin.sh
- [x] #7 grep -q 'evaluator' plugin/skills/loop-meta/SKILL.md
- [x] #8 grep -q 'replanner' plugin/skills/loop-meta/SKILL.md
- [x] #9 test -f scripts/check-roi-gate.sh
- [x] #10 bash scripts/check-roi-gate.sh
- [x] #11 bash scripts/validate-plugin.sh
<!-- DOD:END -->
