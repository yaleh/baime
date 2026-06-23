---
id: TASK-173
title: 'P2: loop-backlog 完整委托链 E2E smoke test'
status: 'Basic: Proposal'
assignee: []
created_date: '2026-06-23 14:49'
labels:
  - 'kind:basic'
  - 'priority:p2'
  - 'component:testing'
dependencies: []
references:
  - plugin/skills/loop-backlog/smoke/
  - scripts/run-smoke-test.sh
  - plugin/skills/loop-backlog/SKILL.md
priority: medium
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
当前 smoke test（TASK-144/145/146）覆盖的是孤立 skill 行为。loop-backlog → epic-to-backlog → feature-to-backlog → task-to-backlog 完整委托链没有端到端测试。

TASK-132/147 改变了 epicDecompose 的后台机制后，集成行为的正确性目前只靠人工在宿主项目里观察。

改进方向：
1. 设计一个 integration smoke test：从一个 epic task 创建开始，驱动完整 loop 流程（epic decompose → child tasks → basic execution → done）
2. 使用 mock/stub backlog（已有 fixture 机制）在 CI 环境运行，不依赖真实 LLM 执行
3. 验证：所有状态转换是否正确触发、子任务 kind:basic label 是否存在、最终 parent epic 是否正确标记 Done
4. 整合进 validate-plugin.sh 或单独的 test-integration.sh
<!-- SECTION:DESCRIPTION:END -->
