---
id: TASK-89
title: 'P4: Gated 自动调度 —— WIP 上限 + budget 硬顶 + 人审门'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-20 06:05'
updated_date: '2026-06-20 07:03'
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

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 loop-meta 在 wip < WIP_CAP 时自动把子任务移 Ready（无需人工）
- [ ] #2 Meta-Plan → Meta-Active 的人审门保留（首次 auto-schedule 需用户批准）
- [ ] #3 budget / noProgress / diverging 任一触发时写入 notes 并进入 Needs Human
- [ ] #4 端到端集成测试通过（meta-task → 子任务自动 Ready → L0 执行 → evaluator 评价）
- [ ] #5 bash scripts/validate-plugin.sh 通过
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: P4: Gated 自动调度 —— WIP 上限 + budget 硬顶 + 人审门\n\n## Overview\n\nExtend `plugin/skills/loop-meta/SKILL.md` (created by TASK-87) to open the `setReady(t)` path inside the reconcile loop and activate all guardrail branches. Add `scripts/test-loop-meta-e2e.sh` as an end-to-end integration test using dry-run/fixture mode.\n\n## Constraints\n\n- TASK-87 must be Done before this task is executed (plugin/skills/loop-meta/SKILL.md must exist).\n- **P3 ROI gate hard prerequisite**: Phase P4 (the `setReady` auto-scheduling path) only executes AFTER P3 ROI gate passes with measured evidence (replan has demonstrated real value AND evaluator reliability is verified). This is a design constraint, not a risk to mitigate — if the P3 gate has not passed, this task MUST NOT be scheduled.\n- WIP_CAP initial value = 2 (conservative; adjustable after validation data accumulates).\n- All guardrail triggers MUST write to task notes before escalating to Needs Human — silent failure is prohibited.\n- Meta-Plan → Meta-Active human gate is preserved unconditionally; first auto-schedule requires user approval.\n\n## Phase A — Write e2e test first (RED → GREEN)\n\n### Tests\n\n```\n# RED check: test file must not yet exist\n! test -f scripts/test-loop-meta-e2e.sh\n```\n\n### Implementation\n\nCreate `scripts/test-loop-meta-e2e.sh` as a dry-run integration test that:\n- Uses a fixture meta-task state machine (no live backlog writes)\n- Simulates: Meta-Plan → human gate → Meta-Active → wip < WIP_CAP → setReady(child) → L0 signal → evaluator → converged\n- Simulates each guardrail path: budget exhausted, noProgress (k cycles), diverging\n- Asserts for each path: notes written + Needs Human escalation\n- Exits 0 on all assertions passed, non-zero on any failure\n- Uses `DRY_RUN=1` or fixture files under `scripts/fixtures/` — no live backlog mutations\n\n### DoD\n\n```bash\nbash scripts/validate-plugin.sh\n```\n\n```bash\ntest -f scripts/test-loop-meta-e2e.sh\n```\n\n```bash\nbash -n scripts/test-loop-meta-e2e.sh\n```\n\n## Phase B — Extend loop-meta SKILL.md with setReady path and guardrails (RED → GREEN)\n\n### Tests\n\n```bash\n# RED checks: WIP_CAP and setReady must not yet exist in SKILL.md\n! grep -q 'WIP_CAP\\|setReady' plugin/skills/loop-meta/SKILL.md\n```\n\n### Implementation\n\nExtend `plugin/skills/loop-meta/SKILL.md` reconcile main loop:\n\n1. **setReady path**: In the reconcile loop, when `wip(m) < WIP_CAP`, auto-move child tasks from `diff.toSchedule` to `Ready` status — no human intervention required after Meta-Active gate.\n\n2. **Meta-Plan → Meta-Active human gate**: Keep the existing gate. First auto-schedule still requires user one-time approval. Document in SKILL.md that this gate is unconditional.\n\n3. **budget exhausted guardrail**: When any budget limit (child task count / token count / max cycle count) is hit → `appendNote(metaTask, \"budget exhausted: <detail>\")` → `setStatus(metaTask, \"Needs Human\")`. No silent continuation.\n\n4. **noProgress guardrail**: When k consecutive cycles show no progress (no task moved to Done, no new evaluator signal) → `appendNote(metaTask, \"noProgress: k=\" + k + \" cycles without progress\")` → `setStatus(metaTask, \"Needs Human\")`.\n\n5. **diverging guardrail**: When divergence is detected → `appendNote(metaTask, \"diverging: <diagnosis>\")` → `setStatus(metaTask, \"Needs Human\")`.\n\n6. Add `contracts` entries in SKILL.md frontmatter for each new spec element: `WIP_CAP`, `setReady`, `Meta-Active`, `budget exhausted`, `noProgress`, `diverging`, `appendNote`.\n\n### DoD\n\n```bash\nbash scripts/validate-plugin.sh\n```\n\n```bash\ngrep -q 'WIP_CAP' plugin/skills/loop-meta/SKILL.md\n```\n\n```bash\ngrep -q 'setReady' plugin/skills/loop-meta/SKILL.md\n```\n\n```bash\ngrep -q 'Meta-Active' plugin/skills/loop-meta/SKILL.md\n```\n\n```bash\ngrep -q 'noProgress' plugin/skills/loop-meta/SKILL.md\n```\n\n```bash\ngrep -q 'diverging' plugin/skills/loop-meta/SKILL.md\n```\n\n```bash\ngrep -q 'budget exhausted' plugin/skills/loop-meta/SKILL.md\n```\n\n```bash\nbash scripts/test-loop-meta-e2e.sh\n```\n\n## Acceptance Gate\n\n```bash\nbash scripts/validate-plugin.sh\n```\n\n```bash\ntest -f scripts/test-loop-meta-e2e.sh\n```\n\n```bash\nbash scripts/test-loop-meta-e2e.sh\n```\n\n```bash\ngrep -q 'WIP_CAP' plugin/skills/loop-meta/SKILL.md\n```\n\n```bash\ngrep -q 'setReady' plugin/skills/loop-meta/SKILL.md\n```\n\n```bash\ngrep -q 'noProgress' plugin/skills/loop-meta/SKILL.md\n```\n\n```bash\ngrep -q 'diverging' plugin/skills/loop-meta/SKILL.md\n```\n\n```bash\ngrep -q 'budget exhausted' plugin/skills/loop-meta/SKILL.md\n```
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
[ftb89] Proposal APPROVED (iteration 1, 2026-06-20). All checks passed: Background explains WHY (7 lines), Goals numbered and verifiable, Feasibility aligned with TASK-87 dependency, P3 ROI gate hard prerequisite explicitly stated as design constraint, Trade-offs identified including highest-risk nature. Proceeding to plan drafting.

[ftb89] Plan APPROVED (iteration 1, 2026-06-20). All invariants passed: both phases have Tests+Implementation sections, first DoD in each phase is validate-plugin.sh, first Acceptance Gate is validate-plugin.sh, all DoD/Gate items are shell commands, absence checks use ! grep -q, P3 ROI gate constraint is in ## Constraints (non-executable), no contradictions. Proceeding to finalise.

[ftb89] Finalised 2026-06-20. Combined proposal+plan written to /tmp/ftb89-combined.md. DoD commands extracted and added. Status moved to Backlog.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented P4 gated auto-scheduling for loop-meta:
- Added WIP_CAP=2 constant, setReady spec (promotes Backlog→Ready while wip<WIP_CAP), and wip() helper to plugin/skills/loop-meta/SKILL.md
- Extended idempotentReconcile to call setReady after gap fill (Meta-Active only)
- Updated budget escalation message to "budget exhausted" (contract-aligned)
- Added setReady bash implementation snippet
- Added 3 new frontmatter contracts: WIP_CAP, setReady, budget exhausted
- Created scripts/test-loop-meta-e2e.sh: 31 dry-run fixture assertions covering happy path, budget exhausted, noProgress, diverging, WIP_CAP cap, and Meta-Plan gate preservation
- validate-plugin.sh passes (0 errors, 25 skills), e2e test 31/31 passing
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/test-loop-meta-e2e.sh
- [ ] #2 bash scripts/test-loop-meta-e2e.sh
- [ ] #3 bash scripts/validate-plugin.sh
- [ ] #4 bash scripts/validate-plugin.sh
- [ ] #5 test -f scripts/test-loop-meta-e2e.sh
- [ ] #6 bash -n scripts/test-loop-meta-e2e.sh
- [ ] #7 bash scripts/test-loop-meta-e2e.sh
- [ ] #8 grep -q 'WIP_CAP' plugin/skills/loop-meta/SKILL.md
- [ ] #9 grep -q 'setReady' plugin/skills/loop-meta/SKILL.md
- [ ] #10 grep -q 'Meta-Active' plugin/skills/loop-meta/SKILL.md
- [ ] #11 grep -q 'noProgress' plugin/skills/loop-meta/SKILL.md
- [ ] #12 grep -q 'diverging' plugin/skills/loop-meta/SKILL.md
- [ ] #13 grep -q 'budget exhausted' plugin/skills/loop-meta/SKILL.md
<!-- DOD:END -->
