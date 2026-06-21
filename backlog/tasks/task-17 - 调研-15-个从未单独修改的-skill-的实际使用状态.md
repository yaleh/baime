---
id: TASK-17
title: 调研 15 个从未单独修改的 skill 的实际使用状态
status: Basic: Proposal
assignee: []
created_date: '2026-06-17 16:04'
updated_date: '2026-06-18 02:27'
labels:
  - kind:basic
  - health-check
  - maintenance
dependencies: []
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 问题

git 历史显示，以下 15 个 skill 自加入项目后从未因实际问题被单独修改，所有变更均来自整体迁移提交（`1a40cbe`、`53f4f9b`）：

agent-prompt-evolution, api-design, baseline-quality-assessment, build-quality-gates, ci-cd-optimization, cross-cutting-concerns, dependency-health, documentation-management, knowledge-transfer, methodology-bootstrapping, next-step-generation, observability-instrumentation, rapid-convergence, technical-debt-management, testing-strategy

对比之下，backlog workflow 相关的 skill（loop-backlog: 6次，backlog-setup: 5次）有频繁的实战改进。

"从未单独修改"可能意味着：（a）设计稳定无需改动，（b）实际未被使用过，（c）有问题但没人发现。

## 建议方向

1. 收集这些 skill 的实际调用记录（可借助 meta-cc session 历史）
2. 对每个 skill 做最小可用性测试（实际调用一次，观察输出质量）
3. 对确认未使用或质量不足的 skill，评估是修缮还是标记为 experimental/deprecated
4. 考虑在 README 或 plugin.json 中增加 `maturity` 字段（stable / experimental / untested）
<!-- SECTION:DESCRIPTION:END -->
