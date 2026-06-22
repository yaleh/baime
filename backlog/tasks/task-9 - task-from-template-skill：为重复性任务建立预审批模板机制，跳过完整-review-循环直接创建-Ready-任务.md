---
id: TASK-9
title: task-from-template skill：为重复性任务建立预审批模板机制，跳过完整 review 循环直接创建 Ready 任务
status: "Basic: Done"
assignee: []
created_date: '2026-06-17 11:03'
updated_date: '2026-06-17 11:17'
labels:
  - kind:basic
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
# Plan: task-from-template skill：为重复性任务建立预审批模板机制

## Context
backlog 中频繁出现的操作性任务（如 git push/发布、定期检查）每次都要经过 6-8 轮
Draft→Review 循环，耗时且重复。通过在 backlog/templates/ 存储预审批计划文件，新的
task-from-template skill 只需一次 freshness check 即可直接创建 Ready 状态任务，
消除重复审查开销。首次计划仍需走完整 task-to-backlog 流程，模板是那次流程的产出。

## Phase 1: 设计 template 文件格式和目录结构
创建 backlog/templates/ 目录并定义 template 文件格式规范。Template 文件与
docs/plans/ 中的 plan 文档结构相同（带 `## Phase N:` + `### DoD` + `## Acceptance Gate`
段落），但顶部增加 YAML front-matter 块记录元数据（slug、last-used 日期、
applicable-when 条件摘要）。在 backlog/templates/README.md 中记录格式规范，
说明各 front-matter 字段含义、freshness check 输入格式、以及模板生命周期（首次由
task-to-backlog 产出，后续由人工或 skill 更新 last-used）。

### DoD
- [ ] `test -d /home/yale/work/baime/backlog/templates`
- [ ] `test -f /home/yale/work/baime/backlog/templates/README.md`
- [ ] `grep -q 'slug' /home/yale/work/baime/backlog/templates/README.md`
- [ ] `grep -q 'last-used' /home/yale/work/baime/backlog/templates/README.md`
- [ ] `grep -q 'applicable-when' /home/yale/work/baime/backlog/templates/README.md`

## Phase 2: 实现 task-from-template skill
在 plugin/skills/task-from-template/ 创建 SKILL.md，风格与
plugin/skills/task-to-backlog/SKILL.md 一致（含 Spec 伪代码节和 Implementation bash 节）。

Skill 逻辑：
1. 接受参数 `<template-slug>`，定位 backlog/templates/<template-slug>.md。
2. 读取 front-matter 的 `last-used` 字段；执行
   `git log --oneline --since=<last-used> HEAD | head -20` 获取变更摘要。
3. Freshness check：单次 LLM 调用，输入为模板全文 + git 变更摘要 + 当前日期，
   要求输出第一行为 `FRESH` 或 `STALE:<one-line-reason>`；若 STALE 则打印原因并退出，
   提示人工用 task-to-backlog 重新生成模板。
4. 若 FRESH：调用 `backlog task create` 以模板 title 字段为任务名、
   模板正文（front-matter 之后的全部内容）为 description、状态为 Ready；
   然后用 `sed -i` 更新模板文件中的 `last-used` 为今日日期并提交。

### DoD
- [ ] `test -f /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md`
- [ ] `grep -q '## Spec' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md`
- [ ] `grep -q '## Implementation' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md`
- [ ] `grep -q 'freshness' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md`
- [ ] `grep -q 'FRESH' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md`
- [ ] `grep -q 'STALE' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md`
- [ ] `grep -q 'last-used' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md`

## Phase 3: 为"检查 git 状态；push；发布"创建首个 template 示例
将 docs/plans/101-git-status-push-release.md 内容改写为通用模板格式，写入
backlog/templates/git-push-release.md。改写要点：
- 顶部加 YAML front-matter（slug、title、last-used、applicable-when）
- 去除版本号硬编码，改用 `<VERSION>` 占位符
- 去除具体 commit 描述等一次性上下文，保留通用的 Phase 结构
- DoD 命令中路径改为 `$(git rev-parse --show-toplevel)` 形式
- 保留完整的 `## Acceptance Gate`

### DoD
- [ ] `test -f /home/yale/work/baime/backlog/templates/git-push-release.md`
- [ ] `grep -q '^---$' /home/yale/work/baime/backlog/templates/git-push-release.md`
- [ ] `grep -q 'slug: git-push-release' /home/yale/work/baime/backlog/templates/git-push-release.md`
- [ ] `grep -q 'applicable-when' /home/yale/work/baime/backlog/templates/git-push-release.md`
- [ ] `grep -q '<VERSION>' /home/yale/work/baime/backlog/templates/git-push-release.md`
- [ ] `grep -q '## Phase 1' /home/yale/work/baime/backlog/templates/git-push-release.md`
- [ ] `grep -q '## Acceptance Gate' /home/yale/work/baime/backlog/templates/git-push-release.md`

## Phase 4: 验证 skill 端到端可用
运行 validate-plugin.sh 确认插件仍通过验证；确认 .claude/skills/task-from-template
软链接存在；检查 backlog/templates/ 中的文件已 git-tracked（不被 .gitignore 排除）。

### DoD
- [ ] `! bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q 'ERROR'`
- [ ] `test -L /home/yale/work/baime/.claude/skills/task-from-template`
- [ ] `git -C /home/yale/work/baime ls-files --error-unmatch backlog/templates/git-push-release.md`
- [ ] `git -C /home/yale/work/baime ls-files --error-unmatch backlog/templates/README.md`

## Constraints
- 不修改现有的 task-to-backlog 或 feature-to-backlog skill
- template 首次创建时仍需走完整 task-to-backlog 流程（template 就是那次流程的产出）
- freshness check 不是完整 review，只判断模板是否仍然适用；不允许多轮迭代
- backlog/templates/ 中的文件须提交到版本库，不得被 .gitignore 排除
- task-from-template 创建的任务直接设为 Ready 状态，不经过 Plan Draft/Review 列
- SKILL.md 格式须与现有 task-to-backlog/SKILL.md 风格一致（Spec 伪代码 + Implementation bash 片段）

## Acceptance Gate
- [ ] `test -f /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md`
- [ ] `test -f /home/yale/work/baime/backlog/templates/git-push-release.md`
- [ ] `grep -q 'FRESH' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md`
- [ ] `! bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q 'ERROR'`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -d /home/yale/work/baime/backlog/templates
- [ ] #2 test -f /home/yale/work/baime/backlog/templates/README.md
- [ ] #3 grep -q 'slug' /home/yale/work/baime/backlog/templates/README.md
- [ ] #4 grep -q 'last-used' /home/yale/work/baime/backlog/templates/README.md
- [ ] #5 grep -q 'applicable-when' /home/yale/work/baime/backlog/templates/README.md
- [ ] #6 test -f /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md
- [ ] #7 grep -q '## Spec' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md
- [ ] #8 grep -q '## Implementation' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md
- [ ] #9 grep -q 'freshness' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md
- [ ] #10 grep -q 'FRESH' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md
- [ ] #11 grep -q 'STALE' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md
- [ ] #12 grep -q 'last-used' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md
- [ ] #13 test -f /home/yale/work/baime/backlog/templates/git-push-release.md
- [ ] #14 grep -q '^---$' /home/yale/work/baime/backlog/templates/git-push-release.md
- [ ] #15 grep -q 'slug: git-push-release' /home/yale/work/baime/backlog/templates/git-push-release.md
- [ ] #16 grep -q 'applicable-when' /home/yale/work/baime/backlog/templates/git-push-release.md
- [ ] #17 grep -q '<VERSION>' /home/yale/work/baime/backlog/templates/git-push-release.md
- [ ] #18 grep -q '## Phase 1' /home/yale/work/baime/backlog/templates/git-push-release.md
- [ ] #19 grep -q '## Acceptance Gate' /home/yale/work/baime/backlog/templates/git-push-release.md
- [ ] #20 ! bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q 'ERROR'
- [ ] #21 test -L /home/yale/work/baime/.claude/skills/task-from-template
- [ ] #22 git -C /home/yale/work/baime ls-files --error-unmatch backlog/templates/git-push-release.md
- [ ] #23 git -C /home/yale/work/baime ls-files --error-unmatch backlog/templates/README.md
- [ ] #24 test -f /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md
- [ ] #25 test -f /home/yale/work/baime/backlog/templates/git-push-release.md
- [ ] #26 grep -q 'FRESH' /home/yale/work/baime/plugin/skills/task-from-template/SKILL.md
- [ ] #27 ! bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q 'ERROR'
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: NEEDS_REVISION — grep -qv used for absence checks in Phase 4 DoD and Acceptance Gate; replaced with ! grep -q

Plan review iteration 2: NEEDS_REVISION — Phase 4 description omitted the required `bash scripts/install/setup-skill-symlinks.sh` step that creates the .claude/skills/task-from-template symlink. Without it, the Phase 4 DoD check `test -L .claude/skills/task-from-template` would fail. Fixed: added explicit execution block to Phase 4 instructions.

Plan review iteration 3: APPROVED

Plan committed: docs/plans/109-task-from-template-skill.md

claimed: 2026-06-17T11:14:12Z

Completed: 2026-06-17T11:17:40Z
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Execution Summary

**Result:** Done
**Commit:** c97a714

### Execution Log
Phase 1 ✓ Created backlog/templates/ and README.md with format spec
Phase 2 ✓ Created plugin/skills/task-from-template/SKILL.md (Spec + Implementation)
Phase 3 ✓ Created backlog/templates/git-push-release.md from plan 101
Phase 4 ✓ Symlink created, validate-plugin.sh passes (23 skills), all git-tracked
DoD #1-27 all passed
<!-- SECTION:FINAL_SUMMARY:END -->
