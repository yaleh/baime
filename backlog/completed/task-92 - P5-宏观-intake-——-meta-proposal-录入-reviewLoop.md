---
id: TASK-92
title: 'P5: 宏观 intake —— meta-proposal 录入 + reviewLoop'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-20 07:07'
updated_date: '2026-06-20 07:19'
labels:
  - loop-meta
  - intake
  - meta-proposal
dependencies:
  - TASK-87
references:
  - docs/proposals/loop-meta-architecture.md
modified_files:
  - plugin/skills/loop-meta/SKILL.md
priority: low
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

P2–P4 假设 meta-task 已含结构化 meta-plan（frozen 验收 + 初始分解）。P5 补上"宏观目标录入"入口：用户一行描述宏观目标，loop-meta 自动产出 meta-proposal 文档 + 初始分解草案，停在人审门（`Meta-Proposal → Meta-Plan` 需用户批准），对齐 feature-to-backlog 对 leaf 任务的做法。

P5 可在 P2 完成后独立推进（不强依赖 P3/P4），但建议 P3 后再做以积累稳定的 decomposer 质量评估数据。

## Goals

1. `/loop-meta <goal>` 或 `loop-meta` skill 的入口：接受一行宏观目标描述，创建 `Meta-Proposal` 状态的 meta-task。
2. loop-meta 拾取 `Meta-Proposal` 后：调用 decomposer 产出 meta-proposal 文档（含 background、frozen 验收、初始子目标树），写入 meta-task 的 Implementation Plan 字段。
3. 产出后暂停于人审门（`gateHuman`）：打印 meta-proposal 并等待用户把状态移到 `Meta-Plan` 才继续。
4. reviewLoop：支持用户反馈迭代（最多 4 轮，超限升级 Needs Human），对标 task-to-backlog 的 reviewLoop。
5. `bash scripts/validate-plugin.sh` 通过。

## Proposed Approach

在 `plugin/skills/loop-meta/SKILL.md` 的 Spec 中扩展 `reconcile` 的 `Meta-Proposal` 分支，新增 `draftMetaProposal` 步骤（调用 decomposer 草案模式）。intake 入口可作为独立 `/loop-meta` 指令，或在 loop-meta 主循环启动时自动检测 `Meta-Proposal` 队列。

## Trade-offs and Risks

- intake 质量决定后续分解质量；human gate 是强制把关点，错误 meta-proposal 不会自动演进。
- reviewLoop 轮数上限（4 轮）与 task-to-backlog 对齐，超限需人工介入。

## References

- docs/proposals/loop-meta-architecture.md（§G6 宏观 intake、§3 λ spec draftMetaProposal 分支、Rollout P5）
- plugin/skills/task-to-backlog/SKILL.md（reviewLoop 参考）
- plugin/skills/feature-to-backlog/SKILL.md（reviewLoop 参考）
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# TASK-92 — P5: 宏观 intake —— meta-proposal 录入 + reviewLoop

## Proposal

### Background

P2–P4 of the loop-meta roadmap assume a meta-task already contains a structured meta-plan (frozen acceptance criteria + initial decomposition). P5 closes the "last mile" gap: there is currently no intake path that lets a user supply a single-line macro goal and receive a structured Meta-Proposal back from the system. Without P5, every meta-task must be hand-crafted before loop-meta can act on it — which undermines the autonomy goal.

`plugin/skills/loop-meta/SKILL.md` (delivered by TASK-87) already defines the `draftMetaProposal`, `gateHuman`, and `reviewLoop` pseudocode stubs plus the `Meta-Proposal` branch in `metaLoop`, but the SKILL.md does not yet contain prose detail on the intake entry-point invocation, the proposalPrompt content, or the contract between the intake path and reviewLoop iteration semantics. P5 completes those stubs so the contracts in SKILL.md are fully backed by verifiable implementation text.

### Goals

1. `/loop-meta <goal>` or a `Meta-Proposal`-status meta-task triggers the `draftMetaProposal` path: the agent reads the one-line description, calls a proposalPrompt subagent, and writes the structured proposal to the meta-task's Implementation Plan / notes.
2. `loop-meta` picks up a `Meta-Proposal` task via `metaLoop` reconcile branch and calls `decomposer` in draft mode (proposalPrompt) to produce a doc containing background, frozen acceptance criteria, and initial sub-goal tree.
3. After drafting, `gateHuman` appends a note and halts — the human must advance status to `Meta-Plan`; no auto-advance occurs.
4. `reviewLoop` supports up to 4 human-feedback iterations; exhaustion escalates to `Needs Human` — matching the `task-to-backlog` pattern.
5. `bash scripts/validate-plugin.sh` passes after all changes.

### Proposed Approach

Extend `plugin/skills/loop-meta/SKILL.md`: flesh out the `draftMetaProposal` implementation section with a concrete `proposalPrompt` template (background, acceptance criteria scaffold, sub-goal tree skeleton). Add an intake entry-point note. Verify the `reviewLoop` implementation prose is internally consistent with the 4-round limit and escalation path. All new text must satisfy existing SKILL.md contracts; no new contracts needed because stubs are already present.

### Trade-offs and Risks

- Intake quality risk: proposal quality depends on the proposalPrompt template and the single-line goal description; the 4-round reviewLoop gate mitigates but does not eliminate this.
- reviewLoop limit alignment: 4 rounds matches task-to-backlog; cap is a single constant.
- Dependency on TASK-87: SKILL.md stubs already exist, so this task extends prose/implementation detail only.
- No P3/P4 hard-dependency: P5 can proceed once P2 is done.

---

## Plan

### Phase A: proposalPrompt Template + Intake Entry-Point

#### A.0 RED
```bash
! test -f plugin/skills/loop-meta/SKILL.md || ! grep -q 'Frozen Acceptance\|Sub-Goal Tree' plugin/skills/loop-meta/SKILL.md
```

#### A.1 Implementation

Extend `plugin/skills/loop-meta/SKILL.md` under `### draftMetaProposal`:

1. proposalPrompt template (bash heredoc): instructs subagent to produce Background (3-8 lines WHY), Frozen Acceptance Criteria (numbered, shell-verifiable where possible), Sub-Goal Tree (bullet hierarchy, max 2 levels).
2. Intake entry-point: when loop-meta receives a bare goal argument, calls `backlog task create --status Meta-Proposal --description "<goal>"` and emits `meta-ready:<TASK-ID>`.
3. draft→plan flow: `draftMetaProposal` writes proposal text via `backlog task edit "$META_ID" --plan "$DOC"`, then calls `reviewLoop`.

#### A.2 GREEN
```bash
bash scripts/validate-plugin.sh
```

---

### Phase B: gateHuman + reviewLoop Operational Detail

#### B.0 RED
```bash
! test -f plugin/skills/loop-meta/SKILL.md || ! grep -q 'soft halt\|approval path' plugin/skills/loop-meta/SKILL.md
```

#### B.1 Implementation

Extend `plugin/skills/loop-meta/SKILL.md` under `### reviewLoop` and `### gateHuman`:

1. gateHuman soft halt: comment block clarifying gateHuman is a soft halt — appends note, process exits; daemon re-emits `meta-ready:<id>` on next poll.
2. reviewLoop iteration counting: ITER = `grep -c "reviewLoop:"` on task notes; on ITER >= 4, escalate to Needs Human with "reviewLoop exhausted — N iterations without human approval".
3. Human approval path: when human sets `status → Meta-Plan`, metaLoop dispatches to draftDecomposition — this is the approval path that exits the intake loop.

#### B.2 GREEN
```bash
bash scripts/validate-plugin.sh
```

---

## Definition of Done (TDD red→green order)

1. `! test -f plugin/skills/loop-meta/SKILL.md || ! grep -q 'Frozen Acceptance\|Sub-Goal Tree' plugin/skills/loop-meta/SKILL.md`
2. `bash scripts/validate-plugin.sh`
3. `! test -f plugin/skills/loop-meta/SKILL.md || ! grep -q 'soft halt\|approval path' plugin/skills/loop-meta/SKILL.md`
4. `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review: APPROVED after 1 iteration. Background clearly explains the last-mile intake gap; 5 numbered verifiable Goals; feasibility confirmed (TASK-87 stubs already in SKILL.md); Trade-offs cover quality risk, reviewLoop cap, and dependency ordering. Advancing to Plan.

Plan review: APPROVED after 1 iteration. All 5 Goals covered across 2 phases; TDD RED→GREEN structure valid; RED checks confirmed absent in SKILL.md (Frozen Acceptance, Sub-Goal Tree, soft halt, approval path); DoD is shell-only; phase ordering correct (A before B since reviewLoop called from draftMetaProposal). validate-plugin.sh baseline: ALL CHECKS PASSED. Advancing to Backlog.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Phase A: Expanded draftMetaProposal in SKILL.md with concrete proposalPrompt heredoc template producing 3-section document (Background, Frozen Acceptance Criteria, Sub-Goal Tree). Added intake entry-point prose and implementation flow (backlog task edit --plan to write structured proposal).

Phase B: Expanded gateHuman (soft halt semantics — appends note, exits 0, never changes status; daemon re-emits meta-ready on next poll) and reviewLoop (iteration counting via grep -c, cap=4 matching task-to-backlog, explicit approval path and revision path documentation).

validate-plugin.sh passes (0 errors, 25 skills).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 ! test -f plugin/skills/loop-meta/SKILL.md || ! grep -q 'Frozen Acceptance\|Sub-Goal Tree' plugin/skills/loop-meta/SKILL.md
- [ ] #2 bash scripts/validate-plugin.sh
- [ ] #3 ! test -f plugin/skills/loop-meta/SKILL.md || ! grep -q 'soft halt\|approval path' plugin/skills/loop-meta/SKILL.md
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->
