---
id: TASK-171
title: 'P1: 中心化 MCP backlog task 创建合约，消除 schema 偏移'
status: 'Basic: Proposal'
assignee: []
created_date: '2026-06-23 14:48'
labels:
  - 'kind:basic'
  - 'priority:p1'
  - 'component:skills'
dependencies: []
references:
  - plugin/skills/feature-to-backlog/SKILL.md
  - plugin/skills/epic-to-backlog/SKILL.md
  - plugin/skills/task-to-backlog/SKILL.md
  - plugin/skills/task-from-template/SKILL.md
  - plugin/scripts/validate-plugin.sh
priority: high
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
当前 feature-to-backlog、epic-to-backlog、task-to-backlog、task-from-template、loop-backlog 五个 skill 各自独立调用 mcp__backlog__task_create，内联字段名和 label 规范。

问题：
- MCP schema 变更会导致多处同时静默失效（48h 内观察到 22 次 task_create 错误）
- kind:basic 标签在 3 个 skill 中同时漏写（TASK-165）
- 无编译期或 pre-run 校验

改进方向：
1. 在 SKILL.md 或共享规范文档中提取 canonical task 创建字段清单（title、status、labels 必选项）
2. 添加 validate-plugin.sh 检查项：扫描各 skill 中 task_create 调用是否包含 kind:basic label
3. 评估是否需要一个 shared 的 task-creation spec 被所有 skill 引用（类似 archguard 的 check-adr.ts）
<!-- SECTION:DESCRIPTION:END -->
