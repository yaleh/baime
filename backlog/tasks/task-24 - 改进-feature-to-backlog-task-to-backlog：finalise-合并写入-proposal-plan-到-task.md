---
id: TASK-24
title: 改进 feature-to-backlog / task-to-backlog：finalise 合并写入 proposal + plan 到 task
status: Basic: Done
assignee: []
created_date: '2026-06-18 01:39'
updated_date: '2026-06-18 02:14'
labels:
  - kind:basic
  - skill
  - feature-to-backlog
  - task-to-backlog
dependencies: []
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
方案 B（你的期望：proposal + plan 都在 task 里）：finalise 合并写入

当前 feature-to-backlog 和 task-to-backlog skills 的 finalise 阶段只将 plan 文本提交到外部文件（docs/proposals/、docs/plans/），并在 task 的 Implementation Notes 里写文件路径引用。Task 的 Implementation Plan 区块仅保留最后一次 review loop 写入的版本，可能只是 proposal 文本，而非最终 plan 文本。

期望：执行完这两个 skill 后，task 的 Implementation Plan 区块应同时包含完整的 proposal 和 plan 内容，无需查阅外部文件。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: 改进 feature-to-backlog / task-to-backlog：finalise 合并写入 proposal + plan 到 task

## Background
feature-to-backlog 和 task-to-backlog 两个 skill 的 finalise 阶段均未将最终审定的文本写回 task。
前者的 finalise 只追加 notes（文件路径引用），后者同理。
Review loop 期间虽然有 `--planSet` 调用，但 finalise 没有做最终的覆盖写入，
若任意 review 迭代的写入失败，task 里的 planSet 就是旧版本。
实际观察到的问题：TASK-21 的 Implementation Plan 区块只有 proposal 文本，
完整 plan（554 行）只存在于 docs/plans/112-loop-backlog-parallel-agent.md，task 本身无法自给。
外部文件作为额外存储引入了同步负担：task 和文件可能不一致，需打开文件才能看完整内容。

## Goals
1. feature-to-backlog finalise 阶段将 proposal 和 plan 合并后通过 `--planSet` 写入 task，
   使 task 的 Implementation Plan 区块包含两份完整文本
2. task-to-backlog finalise 阶段将 plan 通过 `--planSet` 写入 task，
   使 task 的 Implementation Plan 区块包含完整 plan 文本
3. 两个 skill 不再 commit 外部 proposal/plan 文件（去掉 docs/proposals/ 和 docs/plans/ 的写入和 git commit 步骤）
4. finalise 完成后，task 是 proposal 和 plan 内容的唯一权威来源
5. 改动后 bash scripts/validate-plugin.sh 仍通过

## Proposed Approach

**feature-to-backlog Phase 5 finalise** 的 Step B/C（复制文件、git commit）替换为一步合并写入：

```bash
# 合并 proposal 和 plan 到 task planSet
{
  cat $TMPDIR/ftb-proposal.md
  echo ""
  echo "---"
  echo ""
  cat $TMPDIR/ftb-plan.md
} > $TMPDIR/ftb-combined.md

backlog task edit <TASK_ID> \
  --planSet "$(cat $TMPDIR/ftb-combined.md)" \
  --status "Backlog" \
  "${DOD_ARGS[@]}"
```

Step E 的完成提示去掉"文档已提交"字样，不再引用外部文件路径。

**task-to-backlog Phase 4 finalise** 的 Step B/C（复制文件、git commit）替换为：

```bash
backlog task edit <TASK_ID> \
  --planSet "$(cat $TMPDIR/ttb-plan.md)" \
  --status "Backlog" \
  "${DOD_ARGS[@]}"
```

Step E 的完成提示同理去掉文件引用。

两个 skill 的 `## Constraints` 删除"ephemeral $TMPDIR files"的外部文件相关约束。

## Trade-offs and Risks

**不做的事**：
- 不改变 proposal/plan 在 $TMPDIR 中的生成流程，只改 finalise 阶段的写入目标
- 不引入新的 review 逻辑，不修改 Spec 节的类型定义
- 不保留 docs/proposals/ 和 docs/plans/ 的归档（若需要可手动 commit）

**已知风险**：
- planSet 字段有 20000 字符上限（backlog task edit 的 maxLength: 20000）；
  若 proposal + plan 合并后超限，backlog CLI 会报错。
  缓解：plan review 阶段已有"每 Phase ≤ 200 行"约束，实践中合并文本不太可能超限；
  若超限，可在 finalise 里先写 plan，再 append proposal（plan 优先）。
- 已有的 task（如 TASK-21）里的 notes 仍引用旧路径，历史不受影响，新 task 行为正确即可。
- git history 里不再有 proposal/plan 的独立 commit；若团队依赖这些文件做 code review，需改用 task 作为 review 入口。

---

# Plan: 改进 feature-to-backlog / task-to-backlog：finalise 合并写入 proposal + plan 到 task

## Context
feature-to-backlog 和 task-to-backlog 两个 skill 的 finalise 阶段将文档写入外部文件（docs/proposals/、docs/plans/）并提交 git，而非将最终内容写入 task 的 planSet 区块。本次改造去掉外部文件写入步骤，改为直接将 proposal + plan 合并写入 task planSet，使 task 成为唯一内容来源。

## Phase A: feature-to-backlog finalise 改造

### Tests (write first)

在实现前，以下 grep 检查必须 **FAIL**（字符串尚不存在）：

```bash
# A-T1: 新的 Step B 标题应不存在
! grep -q 'Step B — Write combined proposal+plan into task and add DoD' \
  plugin/skills/feature-to-backlog/SKILL.md

# A-T2: 合并写入命令应不存在
! grep -q 'ftb-combined.md' plugin/skills/feature-to-backlog/SKILL.md

# A-T3: 旧的 Step A（Plan number）应仍存在（将被删除）
grep -q 'Step A — Plan number' plugin/skills/feature-to-backlog/SKILL.md

# A-T4: 旧的 Step B（Copy docs）应仍存在（将被删除）
grep -q 'Step B — Copy docs' plugin/skills/feature-to-backlog/SKILL.md

# A-T5: 旧的 Step C（Commit）应仍存在（将被删除）
grep -q 'Step C — Commit' plugin/skills/feature-to-backlog/SKILL.md

# A-T6: 旧的"文档已提交"字样应仍存在（将被删除）
grep -q '文档已提交' plugin/skills/feature-to-backlog/SKILL.md
```

### Implementation

文件：`plugin/skills/feature-to-backlog/SKILL.md`

**1. 更新 frontmatter description 字段**

旧文本：
```
description: "Converts a feature description into a single backlog task with TDD implementation plan, moving through Proposal Draft → Proposal Review → Plan Draft → Plan Review → Backlog. Two iterative review loops (each converges on APPROVED, soft limit 8 rounds). Ends with a git commit of the docs and the task in Backlog status with native DoD items. No branch creation, no PRs."
```

新文本：
```
description: "Converts a feature description into a single backlog task with TDD implementation plan, moving through Proposal Draft → Proposal Review → Plan Draft → Plan Review → Backlog. Two iterative review loops (each converges on APPROVED, soft limit 8 rounds). Ends with the proposal and plan written into the task planSet and the task in Backlog status with native DoD items. No branch creation, no PRs."
```

**2. 更新 Phase 5 finalise 的调用描述行**

旧文本：
```
> Finalise the backlog task and commit documents to the repository.
```

新文本：
```
> Finalise the backlog task: write combined proposal + plan into task and add DoD items.
```

**3. 替换 Phase 5 finalise 的步骤 A/B/C/D/E**

新文本：

```
> **Step B — Write combined proposal+plan into task and add DoD**:
> ```bash
> grep -oP '(?<=- \[ \] `)[^`]+(?=`)' $TMPDIR/ftb-plan.md \
>   > $TMPDIR/ftb-dod-cmds.txt
>
> DOD_ARGS=()
> while IFS= read -r cmd; do
>   DOD_ARGS+=("--dod" "$cmd")
> done < $TMPDIR/ftb-dod-cmds.txt
>
> {
>   cat $TMPDIR/ftb-proposal.md
>   printf '\n\n---\n\n'
>   cat $TMPDIR/ftb-plan.md
> } > $TMPDIR/ftb-combined.md
>
> backlog task edit <TASK_ID> \
>   --planSet "$(cat $TMPDIR/ftb-combined.md)" \
>   --status "Backlog" \
>   "${DOD_ARGS[@]}"
> ```
>
> **Step E — Print completion**:
> ```
> ✅ Task <TASK_ID> is now in Backlog.
>
> 两轮起草 + 两轮迭代审查已完成。
>
> 请在 web UI 审阅 Definition of Done 中的命令：
>   backlog browser --no-open --port 6421
>
> 确认无误后，将任务移入执行队列：
>   backlog task edit <TASK_ID> --status "Ready"
>
> 启动 L0 执行：
>   /loop-backlog
> ```
```

**4. 替换 Constraints 中关于 $TMPDIR 的行**

新增：
```
- Proposal and plan text live in the task's Implementation Plan field; no docs/ files are written
```

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'Step B — Write combined proposal+plan into task and add DoD' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'ftb-combined.md' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q 'Step A — Plan number' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q 'Step B — Copy docs' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q 'Step C — Commit' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q '文档已提交' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q 'docs(<SLUG>): add proposal and plan' plugin/skills/feature-to-backlog/SKILL.md`

## Phase B: task-to-backlog finalise 改造

### Tests (write first)

在实现前，以下 grep 检查必须 **FAIL**（字符串尚不存在）：

```bash
# B-T1: 新的 Step B 标题应不存在
! grep -q 'Step B — Write plan into task and add DoD' \
  plugin/skills/task-to-backlog/SKILL.md

# B-T2: 旧的 Step A（Plan number）应仍存在（将被删除）
grep -q 'Step A — Plan number' plugin/skills/task-to-backlog/SKILL.md

# B-T3: 旧的 Step B（Copy plan doc）应仍存在（将被删除）
grep -q 'Step B — Copy plan doc' plugin/skills/task-to-backlog/SKILL.md

# B-T4: 旧的 Step C（Commit）应仍存在（将被删除）
grep -q 'Step C — Commit' plugin/skills/task-to-backlog/SKILL.md

# B-T5: 旧的完成语句应仍存在（将被删除）
grep -q '计划草拟 + 审查已完成。文档已提交。' plugin/skills/task-to-backlog/SKILL.md
```

### Implementation

文件：`plugin/skills/task-to-backlog/SKILL.md`

**1. 更新 frontmatter description 字段**

新文本：
```
description: "Converts a non-development task (analysis, research, documentation, experiment, survey) into a backlog task. Single draft + review loop produces a phase-based execution plan with shell-verifiable DoD. No TDD structure required. Ends with the plan written into the task planSet and the task in Backlog status with native DoD items."
```

**2. 更新 Phase 4 finalise 的调用描述行**

新文本：
```
> Finalise the backlog task: write plan into task and add DoD items.
```

**3. 替换 Phase 4 finalise 的步骤 A/B/C/D/E**

新文本：

```
> **Step B — Write plan into task and add DoD**:
> ```bash
> grep -oP '(?<=- \[ \] `)[^`]+(?=`)' $TMPDIR/ttb-plan.md \
>   > $TMPDIR/ttb-dod-cmds.txt
>
> DOD_ARGS=()
> while IFS= read -r cmd; do
>   DOD_ARGS+=("--dod" "$cmd")
> done < $TMPDIR/ttb-dod-cmds.txt
>
> backlog task edit <TASK_ID> \
>   --planSet "$(cat $TMPDIR/ttb-plan.md)" \
>   --status "Backlog" \
>   "${DOD_ARGS[@]}"
> ```
>
> **Step E — Print completion**:
> ```
> ✅ Task <TASK_ID> is now in Backlog.
>
> 计划草拟 + 审查已完成。
>
> 请在 web UI 确认 Definition of Done 命令：
>   backlog browser --no-open --port 6421
>
> 确认无误后，将任务移入执行队列：
>   backlog task edit <TASK_ID> --status "Ready"
>
> 等待 loop-backlog 自动拾取，或立即启动：
>   /loop-backlog
> ```
```

**4. 新增 Constraints 行**

```
- Plan text lives in the task's Implementation Plan field; no docs/ files are written
```

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'Step B — Write plan into task and add DoD' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q 'Step A — Plan number' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q 'Step B — Copy plan doc' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q 'Step C — Commit' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q '计划草拟 + 审查已完成。文档已提交。' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q 'docs(<SLUG>): add task plan' plugin/skills/task-to-backlog/SKILL.md`

## Constraints

- 只修改两个 SKILL.md 文件的 finalise 阶段，不改 Spec 类型定义、review loop、draftProposal/draftPlan 阶段
- 不引入新依赖，不创建新文件
- 改动后 `bash scripts/validate-plugin.sh` 必须通过
- 不保留 docs/proposals/ 和 docs/plans/ 的写入逻辑
- planSet 字段上限 20000 字符；若合并后超限，finalise 实现时应优先写 plan，再 append proposal

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'ftb-combined.md' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'Step B — Write combined proposal+plan into task and add DoD' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'Step B — Write plan into task and add DoD' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q 'Step A — Plan number' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q 'Step A — Plan number' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q '文档已提交' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q '计划草拟 + 审查已完成。文档已提交。' plugin/skills/task-to-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Starting plan draft.

Plan review iteration 1: APPROVED

Proposal and plan written inline to task. No external files committed.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'Step B — Write combined proposal+plan into task and add DoD' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #3 grep -q 'ftb-combined.md' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #4 ! grep -q 'Step A — Plan number' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #5 ! grep -q 'Step B — Copy docs' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #6 ! grep -q 'Step C — Commit' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #7 ! grep -q '文档已提交' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #8 ! grep -q 'docs(<SLUG>): add proposal and plan' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #9 grep -q 'Step B — Write plan into task and add DoD' plugin/skills/task-to-backlog/SKILL.md
- [ ] #10 ! grep -q 'Step A — Plan number' plugin/skills/task-to-backlog/SKILL.md
- [ ] #11 ! grep -q 'Step B — Copy plan doc' plugin/skills/task-to-backlog/SKILL.md
- [ ] #12 ! grep -q 'Step C — Commit' plugin/skills/task-to-backlog/SKILL.md
- [ ] #13 ! grep -q '计划草拟 + 审查已完成。文档已提交。' plugin/skills/task-to-backlog/SKILL.md
- [ ] #14 ! grep -q 'docs(<SLUG>): add task plan' plugin/skills/task-to-backlog/SKILL.md
<!-- DOD:END -->
