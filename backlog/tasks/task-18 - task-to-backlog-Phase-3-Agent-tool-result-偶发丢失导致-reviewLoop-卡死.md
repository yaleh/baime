---
id: TASK-18
title: task-to-backlog Phase 3 Agent tool result 偶发丢失导致 reviewLoop 卡死
status: Basic: Proposal
assignee: []
created_date: '2026-06-17 16:22'
updated_date: '2026-06-18 02:27'
labels:
  - kind:basic
  - reliability
  - task-to-backlog
  - agent-tool
dependencies: []
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 观察到的现象

在 task-to-backlog Phase 3（reviewLoop）执行过程中，偶发出现主 Claude 无法收到 Agent 子调用返回结果的情况（日志中出现"又看不到 agents 了"字样，说明是已知复发问题）。

具体表现：
- Phase 3 调用 Agent 执行 review subagent
- Subagent 正常完成，并成功写入 `$TMPDIR/ttb-plan-<N>-verdict.txt`（内容为 `NEEDS_REVISION` 或 `APPROVED`）
- 但 Agent tool result 未传回主 Claude 上下文
- 主 Claude 执行停滞，未继续到"读 verdict 文件"步骤
- 需要用户手动介入：直接读取 plan 和 verdict 文件，判断状态，手动推进到下一阶段

实际案例中还观察到附带问题：subagent 写入了 `NEEDS_REVISION`，但 plan 实际已符合要求（review agent 判断偏严），导致用户在手动介入时直接跳过了原本多余的一轮 revision。

## 相关上下文

- 失效位置：`plugin/skills/task-to-backlog/SKILL.md` Phase 3 reviewLoop
- `Agent` 工具在 Claude Code 中理论上是同步（阻塞）调用，但在某些条件下 tool result 在 harness 层丢失
- `$TMPDIR/ttb-plan-verdict.txt` 文件在 subagent 完成后确实存在，是目前唯一可手动恢复的状态依据

## 待调查

- 触发条件尚不明确（上下文长度？并发？harness 版本？）
- 是否同样影响 feature-to-backlog（结构相似）
- 是否属于 Claude Code Agent 工具的已知 bug，还是 task-to-backlog 使用方式触发了边界条件
- 是否有可在 skill 层面实施的缓解措施，或需要 harness 层修复
<!-- SECTION:DESCRIPTION:END -->
