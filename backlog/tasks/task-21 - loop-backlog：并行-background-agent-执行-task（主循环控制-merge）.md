---
id: TASK-21
title: loop-backlog：并行 background agent 执行 task（主循环控制 merge）
status: Basic: Done
assignee: []
created_date: '2026-06-17 23:48'
updated_date: '2026-06-18 01:47'
labels:
  - kind:basic
  - loop-backlog
  - skill
  - parallelism
dependencies: []
modified_files:
  - plugin/skills/loop-backlog/SKILL.md
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

当前 loop-backlog skill 串行执行：claim → execute → merge → claim → ...
每次只处理一个 task，execute 全程阻塞主 Claude session。

本任务将 execute 阶段改为 background agent 并行执行，主循环保留 merge 的串行控制权。

## Design Decisions（已确认）

**原则**：task agent 只写自己的 worktree 和 branch，不操作其他目录，不 merge 到 main。

**主循环职责**：claim、建 worktree、spawn agents、等待信号文件、串行 merge。

**agent 职责**：execute + commit，写信号文件，退出。

## New Flow

```
workerLoop() = {
  cfg: loadConfig()            // 新增 maxParallel 字段
  reap(inProgressTasks())

  tasks: readyTasks()[:cfg.maxParallel]
  if empty(tasks): Monitor wait for task-ready event

  // 1. 主循环 claim + 建 worktree
  claimed: tasks.map(t => { claim(t); withWorktree(t, cfg) })

  // 2. 并行 spawn background agents（run_in_background=true）
  claimed.map(t => Agent(executePrompt(t), run_in_background=true))

  // 3. 等待所有 agent 写信号文件
  waitForAgents(claimed)

  // 4. 主循环串行 merge
  for t in claimed: merge(t, readSignal(t))

  return workerLoop()
}
```

## Signal Protocol

agent 完成时写：`backlog/.agent-done-TASK-N`

内容：
- `done` — 正常完成，已 commit
- `needs-human: <reason>` — 无法继续，需人工介入

主循环 merge 后删除信号文件。

## Config 扩展

`CLAUDE.md` 中 `## L0 Config` 新增字段：

```
max-parallel: 3   # 默认 2
```

## Agent Prompt Contract（executePrompt）

自包含 prompt，包含：
- 任务 ID、title、description、DoD commands
- worktree 路径、branch 名
- 执行规则：只写此 worktree；commit 如有变更；不 merge；完成后写信号文件
- escalation 规则：写 needs-human 信号文件后退出，不等待人工

## Files to Modify

- `plugin/skills/loop-backlog/SKILL.md`
  - Spec 节：更新 Config 类型、workerLoop、新增 spawnAgent / waitForAgents
  - Implementation 节：loadConfig（解析 max-parallel）、新增 waitForAgents bash 实现、新增 executePrompt 模板、更新主循环 bash 代码、allowed-tools 加 Agent
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SKILL.md Spec 节包含更新后的 Config 类型（含 maxParallel）、workerLoop 新流程、spawnAgent、waitForAgents 函数定义
- [ ] #2 SKILL.md Implementation 节包含 loadConfig 解析 max-parallel、waitForAgents bash 实现（轮询信号文件）、executePrompt 模板文本
- [ ] #3 allowed-tools 字段新增 Agent
- [ ] #4 executePrompt 明确规定 agent 不操作 worktree 以外的路径、不执行 git merge、完成后写信号文件
- [ ] #5 信号协议文档化：文件路径格式 backlog/.agent-done-TASK-N、两种内容格式（done / needs-human: reason）
- [ ] #6 merge 循环读取信号文件内容，done 走正常 merge，needs-human 走 escalate，merge 后删除信号文件
- [ ] #7 bash scripts/validate-plugin.sh 通过
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Proposal: loop-backlog 并行 background agent 执行 task（主循环控制 merge）

当前 loop-backlog skill 串行执行：claim → execute → merge → claim → ...
每次只处理一个 task，execute 全程阻塞主 Claude session。当 backlog 中有多个
Ready task 时，后续 task 必须等待前一个完整执行周期结束才能开始，吞吐量受限于
单个 task 的执行时间。

本提案将 execute 阶段改为 background agent 并行执行，主循环保留 worktree 创建
和 merge 的串行控制权，从而在不引入 merge conflict 风险的前提下提升并发吞吐。

### Goals
1. 主循环能同时 spawn 多个 background agent，每个 agent 独立执行一个 task
2. task agent 只写自己的 worktree 和 branch，不操作其他路径，不执行 git merge
3. 主循环在所有 agent 完成后串行 merge 各 branch，消除 merge conflict 风险
4. max-parallel 并发数可通过 CLAUDE.md 的 ## L0 Config 段落配置（默认 2）
5. agent 通过信号文件向主循环报告完成状态（done 或 needs-human: reason）

---

Proposal approved. Starting plan draft.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal approved after 3 review iterations. Starting plan draft.

Docs committed: docs/proposals/proposal-loop-backlog-parallel-agent.md + docs/plans/112-loop-backlog-parallel-agent.md

Completed: 2026-06-18T01:47:26Z

## Execution Summary

**Result:** Done
**Commit:** c9d196d

All 11 DoD checks passed. Modified plugin/skills/loop-backlog/SKILL.md with:
- Phase A: added Agent to allowed-tools, maxParallel to Config type, CFG_MAX_PARALLEL to loadConfig bash
- Phase B: replaced claim with claimBatch, added spawnAgent/waitForAgents specs, updated workerLoop spec to parallel flow
- Phase C: replaced claim impl with claimBatch, added waitForAgents/executePrompt/buildExecutePrompt bash sections, added workerLoop (parallel) orchestration section
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q "Agent" plugin/skills/loop-backlog/SKILL.md
- [ ] #3 grep -q "maxParallel" plugin/skills/loop-backlog/SKILL.md
- [ ] #4 grep -q "max-parallel" plugin/skills/loop-backlog/SKILL.md
- [ ] #5 grep -q "CFG_MAX_PARALLEL" plugin/skills/loop-backlog/SKILL.md
- [ ] #6 grep -q "claimBatch" plugin/skills/loop-backlog/SKILL.md
- [ ] #7 grep -q "spawnAgent" plugin/skills/loop-backlog/SKILL.md
- [ ] #8 grep -q "waitForAgents" plugin/skills/loop-backlog/SKILL.md
- [ ] #9 grep -q "agent-done-TASK" plugin/skills/loop-backlog/SKILL.md
- [ ] #10 grep -q "run_in_background" plugin/skills/loop-backlog/SKILL.md
- [ ] #11 grep -q "executePrompt\|buildExecutePrompt" plugin/skills/loop-backlog/SKILL.md
<!-- DOD:END -->
