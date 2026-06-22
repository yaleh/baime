---
id: TASK-91
title: 'P4: Gated 自动调度 —— WIP 上限 + budget 硬顶 + 人审门'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-20 07:07'
updated_date: '2026-06-20 07:15'
labels:
  - loop-meta
  - scheduling
  - guardrails
  - autonomy
dependencies:
  - TASK-88
references:
  - docs/proposals/loop-meta-architecture.md
modified_files:
  - plugin/skills/loop-meta/SKILL.md
  - scripts/test-loop-meta-e2e.sh
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

P2/P3 的 loop-meta 仍需人工把子任务移 Ready（propose-only 模式）。P4 开启真正的自治：loop-meta 在 WIP 上限内自动把 `diff.toSchedule` 中的子任务移 `Ready`，由 L0 自动执行。

**前置条件**：P3 ROI 闸门必须通过（measured 证据显示 replan 有实际价值 + evaluator 可靠性达标），才能进入 P4。

## Goals

1. loop-meta reconcile 的 `setReady(t)` 路径：当 `wip(m) < WIP_CAP` 时自动把子任务移 Ready（无需人工）。
2. 首次 auto-schedule 需要用户一次性批准（`Meta-Plan → Meta-Active` 的人审门保留）。
3. 护栏全部激活：budget 硬顶（子任务数/token/最大 cycle 数）；divergence 停机（k cycle 无进展 → Needs Human）；WIP 上限（每 cycle 最多 WIP_CAP 个子任务进 Ready）。
4. 护栏触发时写入 notes + 升级到 Needs Human，不静默继续。
5. 端到端集成测试：一个 meta-task 从 Meta-Plan → Meta-Active → 若干子任务自动 Ready → L0 执行 → evaluator 评价 → converged（或 replan）。

## Proposed Approach

扩展 `plugin/skills/loop-meta/SKILL.md` reconcile 主循环，开放 `setReady` 路径，并激活所有护栏分支（budget exhausted、noProgress、diverging）。新增集成测试脚本（使用 dry-run 或 fixture meta-task）。

## Trade-offs and Risks

- **最高风险阶段**：loop-meta 可自动造任务并驱动 L0 执行。frozen 验收 + 独立 evaluator + budget 硬顶是核心护栏。
- 首期 WIP_CAP 建议设为 2，降低批量失控概率。
- 仅当 P3 ROI 闸门通过才执行此任务（硬前置）。

## References

- docs/proposals/loop-meta-architecture.md（§5 Gated 调度 + 护栏、Rollout P4）
- plugin/skills/loop-backlog/SKILL.md（护栏参考）
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Constraints\n\n**P3 ROI 闸门是硬性前置条件**：无 measured 证据证明 replan 实际价值且 evaluator 可靠性达标，则本任务不得启动。\n\n## Phase A: 扩展集成测试覆盖 evaluator/replan 路径\n\nRED: `! grep -q 'evaluateAndReplan|evaluator' scripts/test-loop-meta-e2e.sh`（已确认 RED）\n\n新增 Test 7a（Met → converged）和 Test 7b（NotMet → replan）到 scripts/test-loop-meta-e2e.sh。\n\nDoD A:\n```\ntest -f scripts/test-loop-meta-e2e.sh\nbash scripts/test-loop-meta-e2e.sh\nbash scripts/validate-plugin.sh\n```\n\n## Phase B: 补全 SKILL.md 护栏实现\n\nRED: `grep -q 'not implemented in V1' plugin/skills/loop-meta/SKILL.md`（已确认 RED）\n\n替换 checkEscalation() 中 noProgress/diverging 注释为完整实现（读状态、比阈值、写 notes、设 Needs Human）。\n\nDoD B:\n```\ntest -f plugin/skills/loop-meta/SKILL.md\ngrep -q 'WIP_CAP' plugin/skills/loop-meta/SKILL.md\ngrep -q 'setReady' plugin/skills/loop-meta/SKILL.md\ngrep -q 'budget exhausted' plugin/skills/loop-meta/SKILL.md\n! grep -q 'not implemented in V1' plugin/skills/loop-meta/SKILL.md\nbash scripts/validate-plugin.sh\n```\n\n## Combined DoD\n\n```\ntest -f scripts/test-loop-meta-e2e.sh\nbash scripts/test-loop-meta-e2e.sh\ntest -f plugin/skills/loop-meta/SKILL.md\ngrep -q 'WIP_CAP' plugin/skills/loop-meta/SKILL.md\ngrep -q 'setReady' plugin/skills/loop-meta/SKILL.md\ngrep -q 'budget exhausted' plugin/skills/loop-meta/SKILL.md\n! grep -q 'not implemented in V1' plugin/skills/loop-meta/SKILL.md\nbash scripts/validate-plugin.sh\n```\n\nFull combined proposal+plan: /tmp/ftb91-combined.md
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review APPROVED (iter 1/8). All criteria met: WHY/Background 6-line clear, 5 numbered verifiable goals G1-G5, feasibility confirmed (SKILL.md exists, TASK-88 dep acceptable), P3 ROI gate in Constraints as hard prerequisite, Trade-offs present, internal consistency verified. Status advanced to Plan.

Plan review cycle 1 NEEDS_REVISION: RED checks were not genuinely RED (SKILL.md existed with WIP_CAP/setReady; e2e test had 31 passing). Identified real gaps: (1) evaluator/replan path absent from test-loop-meta-e2e.sh, (2) noProgress/diverging in checkEscalation() are comment placeholders only. Revised RED conditions: Phase A RED=! grep -q 'evaluateAndReplan|evaluator' scripts/test-loop-meta-e2e.sh (confirmed RED), Phase B RED=grep -q 'not implemented in V1' plugin/skills/loop-meta/SKILL.md (confirmed RED). Plan updated.

Plan review cycle 2 APPROVED: All 6 criteria pass. 5 Goals covered. TDD structure valid. DoD order correct (A before B, each ends with validate-plugin.sh). RED tests genuinely RED (verified in shell). Shell-only DoD. Correct phase ordering.

Finalised: planSet updated with combined proposal+plan. Status set to Backlog. 8 DoD shell commands added. validate-plugin.sh confirmed passing (0 errors).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Phase A: Added evaluator/replan test coverage to scripts/test-loop-meta-e2e.sh — 3 new tests (Met→converged, NotMet→replan triggered, infeasible→escalate); suite grows 31→41 assertions, all passing.

Phase B: Replaced "not implemented in V1" placeholder comment in checkEscalation() with complete bash implementations:
- noProgress: reads first reconcile date from notes, computes days elapsed, checks all children still Backlog, escalates at ≥7 days
- diverging: counts desired (plan bullet points) vs actual child tasks, escalates when actual > 2×desired

validate-plugin.sh passes (0 errors, 25 skills).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/test-loop-meta-e2e.sh
- [ ] #2 bash scripts/test-loop-meta-e2e.sh
- [ ] #3 test -f plugin/skills/loop-meta/SKILL.md
- [ ] #4 grep -q 'WIP_CAP' plugin/skills/loop-meta/SKILL.md
- [ ] #5 grep -q 'setReady' plugin/skills/loop-meta/SKILL.md
- [ ] #6 grep -q 'budget exhausted' plugin/skills/loop-meta/SKILL.md
- [ ] #7 ! grep -q 'not implemented in V1' plugin/skills/loop-meta/SKILL.md
- [ ] #8 bash scripts/validate-plugin.sh
<!-- DOD:END -->
