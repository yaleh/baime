---
id: TASK-12
title: 消除跨 skill 的 Config 类型名冲突
status: 'Basic: Done'
assignee: []
created_date: '2026-06-17 16:03'
updated_date: '2026-06-23 07:24'
labels:
  - 'kind:basic'
  - spec-quality
  - architecture
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
# Plan: 消除跨 skill 的 Config 类型名冲突

## Context

三个 skill 的 `## Spec` 节中均声明了名为 `Config` 的 Haskell 类型，但字段结构完全不同。LLM 在跨 skill 上下文中同时读到多个 `Config` 定义时会产生语义歧义。解决方案是将三者重命名为各自专属类型名，并同步更新 `loadConfig` 的返回类型注解。

## Phase 1: 重命名 loop-backlog 中的 Config → WorktreeConfig

文件：`/home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`

修改第 11 行：`Config :: {` → `WorktreeConfig :: {`
修改第 15 行：`loadConfig :: () → Config` → `loadConfig :: () → WorktreeConfig`
修改第 20 行：`autoDetect :: () → Config` → `autoDetect :: () → WorktreeConfig`
修改第 78 行：`withWorktree :: Task → Config → (Task → a) → a` → `withWorktree :: Task → WorktreeConfig → (Task → a) → a`

不改动第 16-19 行、第 79 行以后的函数实现体，不改动 bash 变量名（`cfg`）。

### DoD
- [ ] `grep -q 'WorktreeConfig :: {' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'loadConfig :: () → WorktreeConfig' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'autoDetect :: () → WorktreeConfig' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'withWorktree :: Task → WorktreeConfig' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q '^Config :: {' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`

## Phase 2: 重命名 feature-to-backlog 中的 Config → BuildConfig

文件：`/home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md`

修改第 12 行：`Config :: {` → `BuildConfig :: {`
修改第 18 行：`loadConfig :: () → Config` → `loadConfig :: () → BuildConfig`
修改第 23 行：`autoDetect :: () → Config` → `autoDetect :: () → BuildConfig`
修改第 107 行：`reviewPlan :: (Plan, Config) → Verdict` → `reviewPlan :: (Plan, BuildConfig) → Verdict`

不改动函数实现体，不改动 bash 变量名（`cfg`）。

### DoD
- [ ] `grep -q 'BuildConfig :: {' /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'loadConfig :: () → BuildConfig' /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'autoDetect :: () → BuildConfig' /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'reviewPlan :: (Plan, BuildConfig)' /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q '^Config :: {' /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md`

## Phase 3: 重命名 task-to-backlog 中的 Config → DocConfig

文件：`/home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`

修改第 12 行：`Config :: {` → `DocConfig :: {`
修改第 16 行：`loadConfig :: () → Config` → `loadConfig :: () → DocConfig`
修改第 21 行：`autoDetect :: () → Config` → `autoDetect :: () → DocConfig`

不改动函数实现体，不改动 bash 变量名（`cfg`）。

### DoD
- [ ] `grep -q 'DocConfig :: {' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q 'loadConfig :: () → DocConfig' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q 'autoDetect :: () → DocConfig' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q '^Config :: {' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`

## Constraints

- 仅修改 `## Spec` 节中的 Haskell 类型注解（类型声明行与函数签名行）
- 不重命名 bash 实现中的变量名（`cfg`、`loadConfig` 函数名本身保留）
- 不修改任何其他 skill 文件
- 不新增或删除文件
- 不修改 `### loadConfig` 下方的 bash 实现代码块

## Acceptance Gate
- [ ] `! grep -rq '^Config :: {' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q 'WorktreeConfig' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'BuildConfig' /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'DocConfig' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 消除跨 skill 的 Config 类型名冲突

## Context

四个 skill 的 `## Spec` 节中均声明了名为 `Config` 的 Haskell 类型，但字段结构完全不同。LLM 在跨 skill 上下文中同时读到多个 `Config` 定义时会产生语义歧义。解决方案是将四者重命名为各自专属类型名，并同步更新 `loadConfig` 的返回类型注解。

受影响文件（2026-06-23 实测确认）：
- `plugin/skills/loop-backlog/SKILL.md`（第 71/76/82/318 行）
- `plugin/skills/feature-to-backlog/SKILL.md`（第 21/27/32/99 行）
- `plugin/skills/task-to-backlog/SKILL.md`（第 21/25/30 行）
- `plugin/skills/epic-to-backlog/SKILL.md`（第 25/31/36 行）— 原 Plan 遗漏，2026-06-23 补入

## Phase 1: 重命名 loop-backlog 中的 Config → WorktreeConfig

文件：`plugin/skills/loop-backlog/SKILL.md`

修改第 71 行：`Config :: {` → `WorktreeConfig :: {`
修改第 76 行：`loadConfig :: () → Config` → `loadConfig :: () → WorktreeConfig`
修改第 82 行：`autoDetect :: () → Config` → `autoDetect :: () → WorktreeConfig`
修改第 318 行：`withWorktree :: Task → Config → (Task → a) → a` → `withWorktree :: Task → WorktreeConfig → (Task → a) → a`

不改动函数实现体，不改动 bash 变量名（`cfg`）。

### DoD
- [ ] `grep -q 'WorktreeConfig :: {' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'loadConfig :: () → WorktreeConfig' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'autoDetect :: () → WorktreeConfig' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'withWorktree :: Task → WorktreeConfig' plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q '^Config :: {' plugin/skills/loop-backlog/SKILL.md`

## Phase 2: 重命名 feature-to-backlog 中的 Config → BuildConfig

文件：`plugin/skills/feature-to-backlog/SKILL.md`

修改第 21 行：`Config :: {` → `BuildConfig :: {`
修改第 27 行：`loadConfig :: () → Config` → `loadConfig :: () → BuildConfig`
修改第 32 行：`autoDetect :: () → Config` → `autoDetect :: () → BuildConfig`
修改第 99 行：`reviewPlan :: (Plan, Config) → Verdict` → `reviewPlan :: (Plan, BuildConfig) → Verdict`

不改动函数实现体，不改动 bash 变量名（`cfg`）。

### DoD
- [ ] `grep -q 'BuildConfig :: {' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'loadConfig :: () → BuildConfig' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'autoDetect :: () → BuildConfig' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'reviewPlan :: (Plan, BuildConfig)' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q '^Config :: {' plugin/skills/feature-to-backlog/SKILL.md`

## Phase 3: 重命名 task-to-backlog 中的 Config → DocConfig

文件：`plugin/skills/task-to-backlog/SKILL.md`

修改第 21 行：`Config :: {` → `DocConfig :: {`
修改第 25 行：`loadConfig :: () → Config` → `loadConfig :: () → DocConfig`
修改第 30 行：`autoDetect :: () → Config` → `autoDetect :: () → DocConfig`

不改动函数实现体，不改动 bash 变量名（`cfg`）。

### DoD
- [ ] `grep -q 'DocConfig :: {' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q 'loadConfig :: () → DocConfig' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q 'autoDetect :: () → DocConfig' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q '^Config :: {' plugin/skills/task-to-backlog/SKILL.md`

## Phase 4: 重命名 epic-to-backlog 中的 Config → EpicConfig（原 Plan 遗漏）

文件：`plugin/skills/epic-to-backlog/SKILL.md`

修改第 25 行：`Config :: {` → `EpicConfig :: {`
修改第 31 行：`loadConfig :: () → Config` → `loadConfig :: () → EpicConfig`
修改第 36 行：`autoDetect :: () → Config` → `autoDetect :: () → EpicConfig`

不改动函数实现体，不改动 bash 变量名（`cfg`）。

### DoD
- [ ] `grep -q 'EpicConfig :: {' plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `grep -q 'loadConfig :: () → EpicConfig' plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `grep -q 'autoDetect :: () → EpicConfig' plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `! grep -q '^Config :: {' plugin/skills/epic-to-backlog/SKILL.md`

## Constraints

- 仅修改 `## Spec` 节中的 Haskell 类型注解（类型声明行与函数签名行）
- 不重命名 bash 实现中的变量名（`cfg`、`loadConfig` 函数名本身保留）
- 不修改任何其他 skill 文件
- 不新增或删除文件
- 不修改 `### loadConfig` 下方的 bash 实现代码块

## Acceptance Gate
- [ ] `! grep -rq '^Config :: {' plugin/skills/loop-backlog/SKILL.md plugin/skills/feature-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `grep -q 'WorktreeConfig' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'BuildConfig' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'DocConfig' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q 'EpicConfig' plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 3: APPROVED

Plan committed: docs/plans/110-config-type-rename.md

2026-06-23 验证：问题仍存在，三文件均有 Config :: { 未重命名。但 Plan 中的行号已过时：loop-backlog 实际第 71 行（Plan 说第 11 行）；feature-to-backlog 和 task-to-backlog 均在第 21 行（Plan 说第 12 行）。DoD 的 grep 命令不依赖行号，仍然有效。执行前需先根据实际行号更新 Plan 中 Phase 1/2/3 的「修改第 N 行」说明。

2026-06-23 影响评估：发现 epic-to-backlog/SKILL.md 也有 Config :: { （第 25/31/36 行），原 Plan 完全遗漏。已新增 Phase 4（EpicConfig）并更新 Acceptance Gate 包含四个文件。

claimed: 2026-06-23T07:19:49Z

Completed: 2026-06-23T07:24:37Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'WorktreeConfig :: {' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
- [ ] #2 grep -q 'loadConfig :: () → WorktreeConfig' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
- [ ] #3 grep -q 'autoDetect :: () → WorktreeConfig' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
- [ ] #4 grep -q 'withWorktree :: Task → WorktreeConfig' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
- [ ] #5 ! grep -q '^Config :: {' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
- [ ] #6 grep -q 'BuildConfig :: {' /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md
- [ ] #7 grep -q 'loadConfig :: () → BuildConfig' /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md
- [ ] #8 grep -q 'autoDetect :: () → BuildConfig' /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md
- [ ] #9 grep -q 'reviewPlan :: (Plan, BuildConfig)' /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md
- [ ] #10 ! grep -q '^Config :: {' /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md
- [ ] #11 grep -q 'DocConfig :: {' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md
- [ ] #12 grep -q 'loadConfig :: () → DocConfig' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md
- [ ] #13 grep -q 'autoDetect :: () → DocConfig' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md
- [ ] #14 ! grep -q '^Config :: {' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md
- [ ] #15 ! grep -rq '^Config :: {' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md
- [ ] #16 grep -q 'WorktreeConfig' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
- [ ] #17 grep -q 'BuildConfig' /home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md
- [ ] #18 grep -q 'DocConfig' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md
- [ ] #19 bash /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #20 grep -q 'EpicConfig :: {' plugin/skills/epic-to-backlog/SKILL.md
- [ ] #21 grep -q 'loadConfig :: () → EpicConfig' plugin/skills/epic-to-backlog/SKILL.md
- [ ] #22 grep -q 'autoDetect :: () → EpicConfig' plugin/skills/epic-to-backlog/SKILL.md
- [ ] #23 ! grep -q '^Config :: {' plugin/skills/epic-to-backlog/SKILL.md
- [ ] #24 grep -q 'EpicConfig' plugin/skills/epic-to-backlog/SKILL.md
<!-- DOD:END -->
