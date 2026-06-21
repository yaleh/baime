---
id: TASK-4
title: 使用 meta-cc 检查本项目历史，更新 backlog+loop 使用文档
status: Basic: Done
assignee: []
created_date: '2026-06-16 16:15'
updated_date: '2026-06-16 16:25'
labels:
  - kind:basic
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
# Plan: 使用 meta-cc 检查本项目历史，更新 backlog+loop 使用文档

## Context

本项目（baime）提供了 backlog-setup、feature-to-backlog、task-to-backlog、loop-backlog 四个技能，但 README.md 中缺乏系统性的 backlog+loop 使用流程引导。通过 meta-cc 分析本项目近期的 Claude Code 会话历史，可以从真实使用记录中提炼完整工作流，并以此更新文档，使新用户能够从零完整初始化并自主运行 backlog+loop 机制。

## Phase 1: 用 meta-cc 查询本项目近期会话历史

按以下步骤调用 meta-cc MCP 工具，将结果追加写入 `/tmp/meta-cc-summary.txt`：

1. 调用 `mcp__plugin_meta-cc_meta-cc__query_summaries`，参数 `query="backlog loop worktree"`，将返回文本追加写入文件，前缀标记 `=== query_summaries ===`。
2. 调用 `mcp__plugin_meta-cc_meta-cc__query_tool_blocks`，参数 `query="backlog-setup feature-to-backlog task-to-backlog loop-backlog"`，将返回文本追加写入文件，前缀标记 `=== query_tool_blocks ===`。

重点从结果中提取：
- 哪些技能被调用、按什么顺序
- 初始化步骤（backlog-setup）有哪些子步骤
- 创建任务（task-to-backlog / feature-to-backlog）的典型交互模式
- loop-backlog 的启动条件和轮询行为

### DoD
- [ ] `grep -q "=== query_summaries ===" /tmp/meta-cc-summary.txt`
- [ ] `grep -q "=== query_tool_blocks ===" /tmp/meta-cc-summary.txt`
- [ ] `grep -q "backlog" /tmp/meta-cc-summary.txt`

## Phase 2: 整理 backlog+loop 完整工作流摘要

基于 Phase 1 的查询结果，在 `/tmp/backlog-loop-workflow.md` 中写出完整工作流描述，涵盖：
1. 前置条件（安装 baime、meta-cc 可选）
2. 初始化：`/backlog-setup`
3. 创建任务：`/feature-to-backlog` 或 `/task-to-backlog`
4. 启动自治执行：`/loop-backlog`
5. 查看结果：`backlog task list`

每步须包含典型提示词示例和预期输出说明。

### DoD
- [ ] `grep -q "backlog-setup" /tmp/backlog-loop-workflow.md`
- [ ] `grep -q "loop-backlog" /tmp/backlog-loop-workflow.md`
- [ ] `grep -q "task-to-backlog" /tmp/backlog-loop-workflow.md`
- [ ] `grep -q "feature-to-backlog" /tmp/backlog-loop-workflow.md`
- [ ] `grep -q "backlog task list" /tmp/backlog-loop-workflow.md`

## Phase 3: 更新 README.md — 新增 Backlog + Loop Workflow 章节

在 `/home/yale/work/baime/README.md` 的 `## Quick Start` 章节之后，新增 `## Backlog + Loop Workflow` 章节，内容基于 Phase 2 的摘要，结构为：

```
## Backlog + Loop Workflow

### 1. Initialize
### 2. Create Tasks
### 3. Run the Autonomous Worker
### 4. Monitor Progress
```

每个子节须含可复制的命令示例或提示词示例。同时更新 `## What's Included` 中 backlog-setup / feature-to-backlog / task-to-backlog / loop-backlog 的 Purpose 描述，确保与新章节保持一致。

### DoD
- [ ] `grep -q "## Backlog + Loop Workflow" /home/yale/work/baime/README.md`
- [ ] `grep -q "### 1. Initialize" /home/yale/work/baime/README.md`
- [ ] `grep -q "### 2. Create Tasks" /home/yale/work/baime/README.md`
- [ ] `grep -q "### 3. Run the Autonomous Worker" /home/yale/work/baime/README.md`
- [ ] `grep -q "### 4. Monitor Progress" /home/yale/work/baime/README.md`
- [ ] `grep -q "## Quick Start" /home/yale/work/baime/README.md`
- [ ] `grep -q "loop-backlog" /home/yale/work/baime/README.md`
- [ ] `grep -q "task-to-backlog" /home/yale/work/baime/README.md`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`

## Constraints

- README.md 中新增章节须使用英文，与现有文档语言风格一致
- 不得删除或破坏 README.md 中已有的任何章节（包括 ## Quick Start、## What's Included 等）
- meta-cc 查询仅读取历史，不产生任何副作用
- 工作流描述须基于 meta-cc 查询到的真实会话记录，而非纯粹推断

## Acceptance Gate
- [ ] `grep -q "## Backlog + Loop Workflow" /home/yale/work/baime/README.md`
- [ ] `grep -q "### 1. Initialize" /home/yale/work/baime/README.md`
- [ ] `grep -q "### 2. Create Tasks" /home/yale/work/baime/README.md`
- [ ] `grep -q "### 3. Run the Autonomous Worker" /home/yale/work/baime/README.md`
- [ ] `grep -q "### 4. Monitor Progress" /home/yale/work/baime/README.md`
- [ ] `grep -q "## Quick Start" /home/yale/work/baime/README.md`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q "=== query_summaries ===" /tmp/meta-cc-summary.txt
- [ ] #2 grep -q "=== query_tool_blocks ===" /tmp/meta-cc-summary.txt
- [ ] #3 grep -q "backlog" /tmp/meta-cc-summary.txt
- [ ] #4 grep -q "backlog-setup" /tmp/backlog-loop-workflow.md
- [ ] #5 grep -q "loop-backlog" /tmp/backlog-loop-workflow.md
- [ ] #6 grep -q "task-to-backlog" /tmp/backlog-loop-workflow.md
- [ ] #7 grep -q "feature-to-backlog" /tmp/backlog-loop-workflow.md
- [ ] #8 grep -q "backlog task list" /tmp/backlog-loop-workflow.md
- [ ] #9 grep -q "## Backlog + Loop Workflow" /home/yale/work/baime/README.md
- [ ] #10 grep -q "### 1. Initialize" /home/yale/work/baime/README.md
- [ ] #11 grep -q "### 2. Create Tasks" /home/yale/work/baime/README.md
- [ ] #12 grep -q "### 3. Run the Autonomous Worker" /home/yale/work/baime/README.md
- [ ] #13 grep -q "### 4. Monitor Progress" /home/yale/work/baime/README.md
- [ ] #14 grep -q "## Quick Start" /home/yale/work/baime/README.md
- [ ] #15 grep -q "loop-backlog" /home/yale/work/baime/README.md
- [ ] #16 grep -q "task-to-backlog" /home/yale/work/baime/README.md
- [ ] #17 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: NEEDS_REVISION — fixed issues: (1) Phase 1 DoD replaced bare `test -f` with content checks for both `=== query_summaries ===` and `=== query_tool_blocks ===` markers, and Phase 1 instructions now specify exact tool names, parameters, and output format; (2) Phase 2 DoD replaced bare `test -f` with `grep -q` content check for `feature-to-backlog` and `backlog task list`; (3) Phase 3 DoD and Acceptance Gate now verify all four required subsections (### 1–4) and that `## Quick Start` is preserved; (4) Constraints clarified to explicitly list protected existing sections.

Plan review iteration 2: APPROVED

Plan committed: docs/plans/104-update-backlog-loop-docs.md

claimed: 2026-06-16T16:22:18Z

Phase 1 ✓ 2026-06-16T16:23:19Z
Queried meta-cc tool_blocks history; extracted skill invocation sequence (backlog-setup → task creation → loop-backlog) and key backlog CLI commands used in real sessions

Phase 2 ✓ 2026-06-16T16:23:51Z
Wrote /tmp/backlog-loop-workflow.md with complete 4-step workflow (backlog-setup → feature-to-backlog/task-to-backlog → loop-backlog → monitor); all DoD content checks pass

Phase 3 ✓ 2026-06-16T16:24:38Z
Added '## Backlog + Loop Workflow' section to README.md with 4 subsections (Initialize, Create Tasks, Run Worker, Monitor Progress); updated skill descriptions for backlog-setup, feature-to-backlog, task-to-backlog, loop-backlog; all 17 DoD checks pass including validate-plugin.sh

Completed: 2026-06-16T16:25:01Z
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Execution Summary

**Result:** Done  
**Commit:** c32b78f2177acad5b469e8d8f900bf59266e187f

### Execution Log
Phase 1 ✓: Queried meta-cc tool_blocks history; extracted skill invocation sequence
Phase 2 ✓: Wrote /tmp/backlog-loop-workflow.md with complete 4-step workflow; all DoD content checks pass
Phase 3 ✓: Added '## Backlog + Loop Workflow' section to README.md; updated 4 skill descriptions; all 17 DoD checks pass including validate-plugin.sh
DoD #1 ✓: grep -q '=== query_summaries ===' /tmp/meta-cc-summary.txt
DoD #2 ✓: grep -q '=== query_tool_blocks ===' /tmp/meta-cc-summary.txt
DoD #3 ✓: grep -q 'backlog' /tmp/meta-cc-summary.txt
DoD #4 ✓: grep -q 'backlog-setup' /tmp/backlog-loop-workflow.md
DoD #5 ✓: grep -q 'loop-backlog' /tmp/backlog-loop-workflow.md
DoD #6 ✓: grep -q 'task-to-backlog' /tmp/backlog-loop-workflow.md
DoD #7 ✓: grep -q 'feature-to-backlog' /tmp/backlog-loop-workflow.md
DoD #8 ✓: grep -q 'backlog task list' /tmp/backlog-loop-workflow.md
DoD #9 ✓: grep -q '## Backlog + Loop Workflow' README.md
DoD #10 ✓: grep -q '### 1. Initialize' README.md
DoD #11 ✓: grep -q '### 2. Create Tasks' README.md
DoD #12 ✓: grep -q '### 3. Run the Autonomous Worker' README.md
DoD #13 ✓: grep -q '### 4. Monitor Progress' README.md
DoD #14 ✓: grep -q '## Quick Start' README.md
DoD #15 ✓: grep -q 'loop-backlog' README.md
DoD #16 ✓: grep -q 'task-to-backlog' README.md
DoD #17 ✓: bash scripts/validate-plugin.sh — ALL CHECKS PASSED (4 agents, 22 skills)
<!-- SECTION:FINAL_SUMMARY:END -->
