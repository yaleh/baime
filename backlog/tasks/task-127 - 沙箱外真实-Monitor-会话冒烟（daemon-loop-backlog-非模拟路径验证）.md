---
id: TASK-127
title: 沙箱外真实 Monitor 会话冒烟（daemon + loop-backlog 非模拟路径验证）
status: 'Basic: Proposal'
assignee: []
created_date: '2026-06-21 11:21'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
unified-loop-smoke.sh 的 Tier 2 是确定性模拟，不启动真实 Monitor 会话或 Claude agent。需要在沙箱外（真实终端）执行一次端到端冒烟：启动 basic-daemon.js，将一个 kind:basic 任务推入 Basic: Ready，运行 /loop-backlog，观察 worker 真实执行并验证 Basic: Done 状态变更。这是对非模拟路径的必要验证。
<!-- SECTION:DESCRIPTION:END -->
