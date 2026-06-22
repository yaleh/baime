---
id: TASK-12
title: 消除跨 skill 的 Config 类型名冲突
status: "Basic: Backlog"
assignee: []
created_date: '2026-06-17 16:03'
updated_date: '2026-06-17 16:44'
labels:
  - kind:basic
  - spec-quality
  - architecture
dependencies: []
priority: high
ordinal: 3000
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
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 3: APPROVED

Plan committed: docs/plans/110-config-type-rename.md
<!-- SECTION:NOTES:END -->
