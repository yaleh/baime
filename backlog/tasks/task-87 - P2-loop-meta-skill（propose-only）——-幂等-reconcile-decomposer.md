---
id: TASK-87
title: 'P2: loop-meta skill（propose-only）—— 幂等 reconcile + decomposer'
status: Done
assignee: []
created_date: '2026-06-20 06:04'
updated_date: '2026-06-20 06:48'
labels:
  - loop-meta
  - skill
  - reconcile
  - decomposer
dependencies:
  - TASK-86
references:
  - docs/proposals/loop-meta-architecture.md
modified_files:
  - plugin/skills/loop-meta/SKILL.md
  - .claude/skills/loop-meta
  - scripts/test-loop-meta-idempotent.sh
  - scripts/validate-plugin.sh
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

P1 完成后，backlog 有了 Meta 泳道和 `meta-ready` 事件。P2 实现 loop-meta 的核心：一个响应 `meta-ready` 的控制回路，读取 meta-task 的 meta-plan，调用 decomposer 子代理产出子任务（Backlog 状态），记录到黑板。子任务**由人工移 Ready**——等价于现有手工流程，但分解工作由 AI 完成。

这是 loop-meta 的第一个可用里程碑：用户只需创建 meta-task，loop-meta 自动产出结构化子任务计划。

## Goals

1. 新增 `plugin/skills/loop-meta/SKILL.md`，λ spec 实现幂等 reconcile（`desired ⊖ actual` diff，重复 `meta-ready` 不重复建子任务）。
2. `decomposer` 子代理：meta-goal/plan → 子任务树，每个子任务通过 `task-to-backlog` / `feature-to-backlog` 拿审查过的 shell DoD，状态设 Backlog。
3. 控制壳（`metaLoop`）：处理 `Meta-Proposal` 状态时产出 meta-proposal 文档，暂停等人审；`Meta-Active` 时执行 reconcile；检测 budget/noProgress/diverging 时升级到 `Needs Human`。
4. 写幂等测试：重复发 `meta-ready` 同一 meta-task，断言子任务数不翻倍。
5. `bash scripts/validate-plugin.sh` 通过（loop-meta skill 含 contracts 字段）。

## Proposed Approach

新增 `plugin/skills/loop-meta/SKILL.md` 和 `plugin/skills/loop-meta/` 目录结构（仿 loop-backlog）。decomposer 作为子代理在 SKILL.md Spec 中定义。幂等 diff 逻辑：扫描 backlog 中 parentTaskId == meta-task-id 的子任务，与 decompose 输出比对，只创建缺口。

## Trade-offs and Risks

- P2 不做自动调度（人工移 Ready），所以失控风险最低；是验证分解质量与幂等性的最安全起点。
- decomposer 输出质量依赖 task-to-backlog/feature-to-backlog 的审查回路，已有保障。

## References

- docs/proposals/loop-meta-architecture.md（§3 λ spec、§4 子代理 decomposer、§6 复用映射）
- plugin/skills/loop-backlog/SKILL.md（结构参考）
- plugin/skills/task-to-backlog/SKILL.md
- plugin/skills/feature-to-backlog/SKILL.md
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 plugin/skills/loop-meta/SKILL.md 存在且含 contracts 字段（≥3 个 grep/not-grep 断言）
- [ ] #2 幂等测试：重复 meta-ready 不重复建子任务
- [ ] #3 decomposer 产出的子任务含完整 shell DoD（来自 task-to-backlog / feature-to-backlog）
- [ ] #4 budget/noProgress/diverging 任一触发时 meta-task 进入 Needs Human
- [ ] #5 bash scripts/validate-plugin.sh 通过
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: P2: loop-meta skill（propose-only）—— 幂等 reconcile + decomposer

## Background

P1 完成后，backlog 有了 Meta 泳道和 `meta-ready` 事件。P2 实现 loop-meta 的核心：一个响应 `meta-ready` 的控制回路，读取 meta-task 的 meta-plan，调用 decomposer 子代理产出子任务（Backlog 状态），记录到黑板。子任务**由人工移 Ready**——等价于现有手工流程，但分解工作由 AI 完成。

这是 loop-meta 的第一个可用里程碑：用户只需创建 meta-task，loop-meta 自动产出结构化子任务计划。关键约束是幂等性：重复收到 `meta-ready` 事件时，不得重复创建已存在的子任务。

## Goals

1. 新增 `plugin/skills/loop-meta/SKILL.md`，λ spec 实现幂等 reconcile（`desired ⊖ actual` diff，重复 `meta-ready` 不重复建子任务）。
2. `decomposer` 子代理：meta-goal/plan → 子任务树，每个子任务通过 `task-to-backlog` / `feature-to-backlog` 拿审查过的 shell DoD，状态设 Backlog。
3. 控制壳（`metaLoop`）：处理 `Meta-Proposal` 状态时产出 meta-proposal 文档，暂停等人审；`Meta-Active` 时执行 reconcile；检测 budget/noProgress/diverging 时升级到 `Needs Human`。
4. 写幂等测试：重复发 `meta-ready` 同一 meta-task，断言子任务数不翻倍。
5. `bash scripts/validate-plugin.sh` 通过（loop-meta skill 含 contracts 字段）。

## Proposed Approach

新增 `plugin/skills/loop-meta/SKILL.md` 和 `plugin/skills/loop-meta/` 目录结构（仿 loop-backlog）。decomposer 作为子代理在 SKILL.md Spec 中定义。幂等 diff 逻辑：扫描 backlog 中 parentTaskId == meta-task-id 的子任务，与 decompose 输出比对，只创建缺口。

## Trade-offs and Risks

- P2 不做自动调度（人工移 Ready），所以失控风险最低；是验证分解质量与幂等性的最安全起点。
- decomposer 输出质量依赖 task-to-backlog/feature-to-backlog 的审查回路，已有保障。
- 幂等测试用 dry-run/fixture 方式，不需要真实运行 loop-meta 对付 live backlog，降低测试脆弱性。

## References

- docs/proposals/loop-meta-architecture.md（§3 λ spec、§4 子代理 decomposer、§6 复用映射）
- plugin/skills/loop-backlog/SKILL.md（结构参考）
- plugin/skills/task-to-backlog/SKILL.md
- plugin/skills/feature-to-backlog/SKILL.md

---

# Plan: P2: loop-meta skill（propose-only）—— 幂等 reconcile + decomposer

Proposal: docs/proposals/loop-meta-architecture.md

## Phase A: Create plugin/skills/loop-meta/SKILL.md

### Tests (write first)

These tests currently FAIL because `plugin/skills/loop-meta/SKILL.md` does not exist:

```bash
# RED-A1: file must not exist yet
! test -f plugin/skills/loop-meta/SKILL.md

# RED-A2: no contracts field present yet
! grep -q 'contracts:' plugin/skills/loop-meta/SKILL.md 2>/dev/null

# RED-A3: validate-plugin.sh currently passes with 24 skills; after adding loop-meta it
#         will FAIL on skill count (expects 24, finds 25) until we update EXPECTED_SKILLS.
#         Pre-condition: confirm count is 24 now.
test "$(ls plugin/skills/ | wc -l)" -eq 24
```

### Implementation

1. Create `plugin/skills/loop-meta/SKILL.md` with:
   - YAML frontmatter: `name`, `description`, `allowed-tools`, `contracts` (≥3 assertions)
   - λ spec: `metaLoop()` as entry point
   - Spec section: `idempotentReconcile`, `decomposer` subagent, `metaLoop` control shell with `Meta-Proposal`/`Meta-Active` state handling and `budget`/`noProgress`/`diverging` escalation
   - Contracts must grep for: `idempotentReconcile`, `decomposer`, `Needs Human`
   - Contracts must not-grep for: `git worktree add` (loop-meta does not manage worktrees itself)

2. Update `scripts/validate-plugin.sh` line `EXPECTED_SKILLS=24` → `EXPECTED_SKILLS=25`

3. Create `.claude/skills/loop-meta` symlink:
   ```bash
   ln -s ../../plugin/skills/loop-meta .claude/skills/loop-meta
   ```

**Files to create/modify:**
- `plugin/skills/loop-meta/SKILL.md` (new)
- `scripts/validate-plugin.sh` (update EXPECTED_SKILLS)
- `.claude/skills/loop-meta` (new symlink)

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f plugin/skills/loop-meta/SKILL.md`
- [ ] `grep -q 'contracts:' plugin/skills/loop-meta/SKILL.md`
- [ ] `grep -q 'idempotentReconcile' plugin/skills/loop-meta/SKILL.md`
- [ ] `grep -q 'decomposer' plugin/skills/loop-meta/SKILL.md`
- [ ] `grep -q 'Needs Human' plugin/skills/loop-meta/SKILL.md`
- [ ] `test -L .claude/skills/loop-meta`

## Phase B: Write idempotent test script

### Tests (write first)

These tests currently FAIL because `scripts/test-loop-meta-idempotent.sh` does not exist:

```bash
# RED-B1: script must not exist yet
! test -f scripts/test-loop-meta-idempotent.sh

# RED-B2: running it fails (file absent)
! bash scripts/test-loop-meta-idempotent.sh 2>/dev/null
```

### Implementation

Create `scripts/test-loop-meta-idempotent.sh` as a fixture/dry-run test that:

1. Sets up a temporary directory with a mock backlog structure (fixture tasks).
2. Invokes a dry-run `reconcile` helper function (sourced from the test itself, not from a live backlog) to simulate the `desired ⊖ actual` diff logic.
3. Calls reconcile twice with the same `meta-ready` input (same meta-task-id, same desired sub-task list).
4. Asserts that the resulting child-task list has no duplicates (count after second call == count after first call).
5. Exits 0 on pass, 1 on failure, with human-readable output.

**The test uses only bash built-ins and `mktemp` — no live backlog MCP calls.**

**File to create:**
- `scripts/test-loop-meta-idempotent.sh`

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f scripts/test-loop-meta-idempotent.sh`
- [ ] `bash scripts/test-loop-meta-idempotent.sh`

## Constraints

- The test in Phase B must use a dry-run/fixture approach only — it must not call live backlog MCP tools or modify any real backlog state.
- The SKILL.md description must be clearly distinct from `loop-backlog` (different trigger domain: meta-tasks, not L0 Ready tasks) to pass the trigger overlap detector in validate-plugin.sh.
- All decomposer sub-task creation references must name `task-to-backlog` or `feature-to-backlog` as the delegated skill, not re-implement the review cycle inline.
- `budget`, `noProgress`, and `diverging` escalation paths must be present in the SKILL.md Spec as named conditions that route to `Needs Human`.
- No natural-language DoD criteria — all DoD items must be executable shell commands.

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f plugin/skills/loop-meta/SKILL.md`
- [ ] `grep -q 'contracts:' plugin/skills/loop-meta/SKILL.md`
- [ ] `test -f scripts/test-loop-meta-idempotent.sh`
- [ ] `bash scripts/test-loop-meta-idempotent.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal approved. Starting plan draft.

Plan approved after 1 iteration. All 5 goals covered, TDD structure verified, RED tests confirmed (plugin/skills/loop-meta/ does not exist), all DoD items are executable shell commands, validate-plugin.sh is first DoD item in every phase and first Acceptance Gate item.

Baseline note: As of 2026-06-20, the working tree has an unstaged modification to plugin/skills/loop-backlog/SKILL.md that causes validate-plugin.sh to FAIL (loop-backlog contract grep for 'DoD #.*: PASS' not found). This is pre-existing and unrelated to TASK-87. The implementer must either (a) ensure that modification is committed/reverted before running TASK-87 DoD checks, or (b) include fixing the loop-backlog contract as part of Phase A if the change is intentional. The clean repo (HEAD) passes validate-plugin.sh with 0 errors.

Phase A ✓ 2026-06-20T06:58:00Z
Created plugin/skills/loop-meta/SKILL.md with 5 contracts, idempotentReconcile spec, decomposer subagent, metaLoop state machine, escalation paths. Updated EXPECTED_SKILLS to 25. Created .claude/skills/loop-meta symlink.

Phase B ✓ 2026-06-20T06:58:00Z
Created scripts/test-loop-meta-idempotent.sh — 15 assertions, all pass. Tests first/second/third reconcile, partial gap, empty desired, parent isolation.

## Execution Summary
Result: Done
Commit: db13ccd
All 13 DoD items PASS. 15/15 idempotent test assertions pass.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 test -f plugin/skills/loop-meta/SKILL.md
- [x] #2 grep -q 'contracts:' plugin/skills/loop-meta/SKILL.md
- [x] #3 test -f scripts/test-loop-meta-idempotent.sh
- [x] #4 bash scripts/test-loop-meta-idempotent.sh
- [x] #5 bash scripts/validate-plugin.sh
- [x] #6 bash scripts/validate-plugin.sh
- [x] #7 test -f plugin/skills/loop-meta/SKILL.md
- [x] #8 grep -q 'contracts:' plugin/skills/loop-meta/SKILL.md
- [x] #9 grep -q 'idempotentReconcile' plugin/skills/loop-meta/SKILL.md
- [x] #10 grep -q 'decomposer' plugin/skills/loop-meta/SKILL.md
- [x] #11 grep -q 'Needs Human' plugin/skills/loop-meta/SKILL.md
- [x] #12 test -L .claude/skills/loop-meta
- [x] #13 test -f scripts/test-loop-meta-idempotent.sh
- [x] #14 bash scripts/test-loop-meta-idempotent.sh
<!-- DOD:END -->
