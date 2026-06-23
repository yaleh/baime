---
id: TASK-172
title: 'P1: loop-backlog worktree 孤儿清理保证'
status: 'Basic: Proposal'
assignee: []
created_date: '2026-06-23 14:48'
labels:
  - 'kind:basic'
  - 'priority:p1'
  - 'component:loop-backlog'
dependencies: []
references:
  - plugin/skills/loop-backlog/SKILL.md
  - docs/adr/ADR-002-monitor-lifecycle.md
  - plugin/scripts/basic-daemon.js
priority: high
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
48h 内 Bash 工具出现 13 次 exit code 128（git worktree 冲突），说明失败的 basic task 没有可靠清理 worktree。孤儿 worktree 会在下次 git worktree add 时引发冲突，且无报警。

stopStaleMon() 目前只处理 Monitor 进程，不处理孤儿 worktree。

改进方向：
1. 在 daemonBootstrap 启动时：扫描 .claude/worktrees/ 下已不对应活跃 task 的 worktree 并清理
2. 在 stopStaleMon() 中：同步清理该 Monitor 对应的 worktree
3. worktree 清理失败时记录日志并继续（不应阻塞 loop 启动）
4. 在 smoke test 中覆盖：task 执行失败后 worktree 是否被正确移除
<!-- SECTION:DESCRIPTION:END -->
