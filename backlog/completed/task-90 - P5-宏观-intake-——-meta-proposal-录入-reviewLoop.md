---
id: TASK-90
title: 'P5: 宏观 intake —— meta-proposal 录入 + reviewLoop'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-20 06:05'
updated_date: '2026-06-20 06:55'
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
ordinal: 2000
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

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 用户一行目标 → meta-task 创建（Meta-Proposal 状态）→ loop-meta 产出 meta-proposal 文档（含 frozen 验收 + 初始子目标树）
- [ ] #2 人审门：产出后暂停，等待用户批准（移到 Meta-Plan）才继续
- [ ] #3 reviewLoop 最多 4 轮迭代；超限升级 Needs Human
- [ ] #4 bash scripts/validate-plugin.sh 通过
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# TASK-90 Combined Proposal + Plan: P5 宏观 intake —— meta-proposal 录入 + reviewLoop

---

## Proposal

### Background

P2–P4 of the loop-meta architecture assume that a meta-task already contains a structured meta-plan (frozen acceptance criteria + initial decomposition). P5 fills in the "macro-goal intake" entry point that was missing: a user provides a one-line description of a macro goal, and loop-meta automatically produces a meta-proposal document plus an initial decomposition draft, then halts at a human-review gate (status `Meta-Proposal → Meta-Plan` requires user approval). This mirrors the pattern that `feature-to-backlog` applies to leaf tasks. Without this step, loop-meta can only work on pre-structured tasks, which creates an onboarding gap for real usage.

P5 can proceed independently after P2 is complete; it does not strictly depend on P3 or P4, although running after P3 is recommended so that decomposer quality metrics are stable.

### Goals

1. The `loop-meta` skill (invoked as `/loop-meta <goal>`) accepts a one-line macro-goal description and creates a `Meta-Proposal`-status meta-task.
2. When loop-meta picks up a `Meta-Proposal` task: it calls the decomposer in "draft mode" to produce a meta-proposal document containing background, frozen acceptance criteria, and an initial sub-goal tree; this document is written to the meta-task's Implementation Plan field.
3. After producing the document, loop-meta pauses at a `gateHuman` checkpoint: it prints the meta-proposal and waits for the user to change the status to `Meta-Plan` before proceeding.
4. A `reviewLoop` (max 4 iterations) supports user-feedback-driven iteration; on exhaustion the task is escalated to `Needs Human`, consistent with `task-to-backlog`'s reviewLoop behaviour.
5. `bash scripts/validate-plugin.sh` passes after all changes.

### Proposed Approach

Extend `plugin/skills/loop-meta/SKILL.md` (created by TASK-87) by adding a `Meta-Proposal` branch to the `reconcile` function:

- New `draftMetaProposal` step: calls the decomposer in "draft mode"; output is a structured doc (background + frozen ACs + initial sub-goal tree), written to `Implementation Plan` field.
- New `gateHuman` mechanism: prints the meta-proposal and pauses; the event-driven loop resumes when the task's status transitions to `Meta-Plan`.
- `reviewLoop` wrapping `draftMetaProposal`: up to 4 iterations with reviewer critique; escalates to `Needs Human` on exhaustion.

The intake entry point is the same `loop-meta` skill invocation; no new top-level command is required.

### Trade-offs and Risks

- Intake quality determines downstream decomposition quality; `gateHuman` is a mandatory checkpoint so that a poor meta-proposal cannot propagate automatically.
- The 4-iteration cap on `reviewLoop` is intentionally conservative and mirrors `task-to-backlog`; edge cases requiring more than 4 rounds must be handled manually.
- TASK-87 is a prerequisite; if `plugin/skills/loop-meta/SKILL.md` does not exist, this task cannot be implemented, though RED tests are designed to handle this gracefully.
- `gateHuman` introduces latency in the loop; this is intentional and acceptable given the high-stakes nature of macro-goal intake.

### References

- `docs/proposals/loop-meta-architecture.md` (§G6, §3 λ spec draftMetaProposal, Rollout P5)
- `plugin/skills/task-to-backlog/SKILL.md` (reviewLoop reference)
- `plugin/skills/feature-to-backlog/SKILL.md` (reviewLoop reference)

---

## Implementation Plan

### Overview

Extend `plugin/skills/loop-meta/SKILL.md` (created by TASK-87) to add the `Meta-Proposal` intake branch: `draftMetaProposal`, `gateHuman`, and a `reviewLoop` (max 4 iterations, escalates to Needs Human on exhaustion). This mirrors the intake pattern of `task-to-backlog`/`feature-to-backlog` but at the macro-goal level.

### Constraints

- `plugin/skills/loop-meta/SKILL.md` does not exist yet; TASK-87 creates it. All phases assume TASK-87 has been completed before implementation begins.
- `draftMetaProposal` calls the decomposer in "draft mode"; it is a spec-level description of agent behaviour, not a shell script.
- `gateHuman` is a pause point in the control loop: loop-meta prints the meta-proposal and waits for the user to change the task status to `Meta-Plan`. It must not auto-advance.
- `reviewLoop` for intake is capped at 4 iterations, consistent with `task-to-backlog`. On exhaustion, status is escalated to `Needs Human`.
- All DoD and Acceptance Gate items must be shell commands.
- Natural-language constraints belong only in this Constraints section.

### Acceptance Gate

```bash
bash scripts/validate-plugin.sh
```

```bash
grep -q 'draftMetaProposal\|Meta-Proposal' plugin/skills/loop-meta/SKILL.md
```

```bash
grep -q 'gateHuman\|reviewLoop' plugin/skills/loop-meta/SKILL.md
```

---

### Phase A: Extend loop-meta SKILL.md — add Meta-Proposal branch with draftMetaProposal

#### Tests

RED (verify absence before implementation):

```bash
! test -f plugin/skills/loop-meta/SKILL.md || ! grep -q 'draftMetaProposal' plugin/skills/loop-meta/SKILL.md
```

```bash
! test -f plugin/skills/loop-meta/SKILL.md || ! grep -q 'Meta-Proposal' plugin/skills/loop-meta/SKILL.md
```

#### Implementation

In `plugin/skills/loop-meta/SKILL.md`, inside the `reconcile` function's case dispatch, add the `Meta-Proposal` branch:

```
reconcile(m) =
  ...existing branches (exhausted/noProgress/diverging)...
  | status(m) == "Meta-Proposal" → draftMetaProposal(m); gateHuman(m)
  | otherwise → ...existing Meta-Active reconcile...
```

Add `draftMetaProposal` spec:

```haskell
-- draftMetaProposal: calls decomposer in "draft mode" to produce a meta-proposal doc.
-- Output doc contains: background, frozen acceptance criteria, initial sub-goal tree.
-- Written to meta-task's Implementation Plan field via mcp__backlog__task_edit planSet.
draftMetaProposal :: MetaTask → MetaProposalDoc
draftMetaProposal(m) = {
  draft: decomposer(m.goal, mode="draft"),  -- structured doc: background + frozen ACs + sub-goal tree
  _:     setImplementationPlan(m, draft),   -- writes to Implementation Plan field
  return: draft
}
```

Also update the SKILL.md `contracts:` front-matter block to add:

```yaml
  - grep: "draftMetaProposal"
    target: self
  - grep: "Meta-Proposal"
    target: self
```

#### DoD

```bash
bash scripts/validate-plugin.sh
```

```bash
grep -q 'draftMetaProposal' plugin/skills/loop-meta/SKILL.md
```

```bash
grep -q 'Meta-Proposal' plugin/skills/loop-meta/SKILL.md
```

---

### Phase B: Add gateHuman and reviewLoop with exhaustion escalation

#### Tests

RED (verify absence before implementation):

```bash
! test -f plugin/skills/loop-meta/SKILL.md || ! grep -q 'gateHuman' plugin/skills/loop-meta/SKILL.md
```

```bash
! test -f plugin/skills/loop-meta/SKILL.md || ! grep -q 'reviewLoop' plugin/skills/loop-meta/SKILL.md
```

#### Implementation

Add `gateHuman` spec immediately after `draftMetaProposal`:

```haskell
-- gateHuman: prints the meta-proposal doc and pauses.
-- Loop resumes ONLY when the user changes meta-task status from Meta-Proposal to Meta-Plan.
-- Never auto-advances; the transition is user-controlled.
gateHuman :: (MetaTask, MetaProposalDoc) → ()
gateHuman(m, doc) = {
  _: printMetaProposal(doc),           -- display to user in current session
  _: awaitStatusChange(m, "Meta-Plan") -- monitor loop: resume on next meta-ready with status==Meta-Plan
}
```

Add `reviewLoop` wrapping `draftMetaProposal` in the `Meta-Proposal` branch:

```haskell
-- reviewLoop for Meta-Proposal intake: up to 4 rounds of draft + reviewer critique.
-- On exhaustion (4 rounds without APPROVED), escalate to Needs Human.
-- Mirrors task-to-backlog reviewLoop (MaxRounds=4).
reviewLoop :: (MetaTask, MetaProposalDoc, MaxRounds) → ApprovedDoc
reviewLoop(m, doc, 0) = escalate(m, "meta-proposal review exhausted after max rounds")
reviewLoop(m, doc, n) = {
  verdict: reviewMetaProposal(doc),   -- critic checks: background, frozen ACs, sub-goal tree
  case verdict of
    | APPROVED       → doc
    | NEEDS_REVISION → reviewLoop(m, draftMetaProposal(m), n-1)
}

-- Meta-Proposal branch becomes:
| status(m) == "Meta-Proposal" →
    draft:    draftMetaProposal(m),
    approved: reviewLoop(m, draft, 4),
    _:        gateHuman(m, approved)
```

Also update `contracts:` to add:

```yaml
  - grep: "gateHuman"
    target: self
  - grep: "reviewLoop"
    target: self
```

#### DoD

```bash
bash scripts/validate-plugin.sh
```

```bash
grep -q 'gateHuman' plugin/skills/loop-meta/SKILL.md
```

```bash
grep -q 'reviewLoop' plugin/skills/loop-meta/SKILL.md
```

```bash
grep -q 'Needs Human\|escalate' plugin/skills/loop-meta/SKILL.md
```
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal APPROVED (2026-06-20): Background, Goals, Feasibility, Trade-offs, and Consistency all pass. Advancing to Plan stage.

Plan APPROVED (2026-06-20): Two-phase TDD plan reviewed — RED tests verified genuinely red (loop-meta/SKILL.md does not exist; TASK-87 dependency noted). All DoD/Gate items are shell commands, absence checks use `! grep -q`, natural-language in Constraints only. Advancing to Backlog.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extended plugin/skills/loop-meta/SKILL.md with P5 macro intake flow:
- Renamed draftProposal → draftMetaProposal (more explicit naming)
- Added gateHuman: appends halt note, never auto-advances status
- Added reviewLoop: up to 4 human-review iterations; exhaustion escalates to Needs Human
- Added 4 new frontmatter contracts: draftMetaProposal, Meta-Proposal, gateHuman, reviewLoop
- Added bash implementation snippets for all three functions
- validate-plugin.sh passes (0 errors, 25 skills)
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'draftMetaProposal\|Meta-Proposal' plugin/skills/loop-meta/SKILL.md
- [ ] #2 grep -q 'gateHuman\|reviewLoop' plugin/skills/loop-meta/SKILL.md
- [ ] #3 bash scripts/validate-plugin.sh
- [ ] #4 bash scripts/validate-plugin.sh
- [ ] #5 grep -q 'draftMetaProposal\|Meta-Proposal' plugin/skills/loop-meta/SKILL.md
- [ ] #6 grep -q 'gateHuman\|reviewLoop' plugin/skills/loop-meta/SKILL.md
- [ ] #7 grep -q 'Needs Human\|escalate' plugin/skills/loop-meta/SKILL.md
<!-- DOD:END -->
