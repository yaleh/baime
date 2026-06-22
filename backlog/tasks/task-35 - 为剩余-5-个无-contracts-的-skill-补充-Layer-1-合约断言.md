---
id: TASK-35
title: 为剩余 5 个无 contracts 的 skill 补充 Layer 1 合约断言
status: "Basic: Done"
assignee: []
created_date: '2026-06-18 12:54'
updated_date: '2026-06-18 13:02'
labels:
  - kind:basic
  - prompt-quality
  - contracts
  - spec-quality
dependencies: []
priority: medium
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-16 完成后，23 个 skill 中 18 个持有 contracts: 字段，5 个仍缺少：agent-prompt-evolution、feature-to-backlog、methodology-bootstrapping、task-from-template、task-to-backlog。其中 feature-to-backlog / task-from-template / task-to-backlog 是使用频率最高的核心 workflow skill，却没有任何可机器验证的不变量。本任务为这 5 个 skill 各补充 ≥2 条 contracts: 断言，使 validate-plugin.sh Layer 1 合约测试对全部 23 个 skill 产生覆盖。

# Proposal: 为 5 个无 contracts skill 补充合约断言

## Background

当前缺少 contracts: 的 5 个 skill 和它们可以断言的不变量分析：

**feature-to-backlog**（478→506 行，6 commits）：
- 函数 `featureToBacklog` 必须出现在 SKILL.md 中（λ 入口）
- 字符串 "proposalLoop" 和 "planLoop" 必须存在（核心两阶段）
- "APPROVED" 必须出现（收敛条件）
- "No branch creation" 必须出现（排他性约束，防止误解功能边界）

**task-from-template**（242 行，2 commits）：
- 函数 `taskFromTemplate` 必须出现
- "FRESH" 和 "STALE" 必须出现（freshness verdict）
- "backlog/templates/" 必须出现（模板路径约定）

**task-to-backlog**（330→358 行，6 commits）：
- 函数 `taskToBacklog` 必须出现
- "No TDD" 必须出现（排他性约束，区分于 feature-to-backlog）
- "reviewLoop" 必须出现（单 review 循环）

**methodology-bootstrapping**（647 行，3 commits）：
- "Observe-Codify-Automate" 必须出现（核心框架名称）
- "V_meta" 和 "V_instance" 必须出现（双层价值函数）
- "convergence" 必须出现

**agent-prompt-evolution**（404 行，3 commits）：
- "specialization" 必须出现（核心概念）
- "M₀" 或 "M0" 必须出现（meta-agent 演化跟踪）

## Goals

1. 为以上 5 个 skill 各添加 contracts: 字段，每个至少 2 条，尽量 3 条
2. 所有 contracts 使用 grep 或 not-grep 形式（与现有 loop-backlog 格式一致）
3. `bash scripts/validate-plugin.sh` PASS，且所有 5 个 skill 有 ≥1 条 contract PASS 记录

## 合约类型策略

对 workflow skill（feature-to-backlog / task-from-template / task-to-backlog）：
- 优先用 **函数名 grep**：确保 λ 规格与实现对齐
- 用 **排他性 not-grep**：防止错误混入（如 feature-to-backlog 不得有 "TDD"）
- 用 **关键词 grep**：确保核心术语存在（收敛条件、路径约定等）

对框架类 skill（methodology-bootstrapping / agent-prompt-evolution）：
- 用 **框架术语 grep**：确保概念体系的核心术语存在
- 用 **版本/数量标记 grep**：确保 validated 数据未被无意删除

# Plan: 执行计划

## Phase 1: 实现（~45min）

逐一修改 5 个 SKILL.md，在 frontmatter 中添加 contracts: 字段：

1. feature-to-backlog/SKILL.md：添加 4 条 contracts
2. task-from-template/SKILL.md：添加 3 条 contracts
3. task-to-backlog/SKILL.md：添加 3 条 contracts
4. methodology-bootstrapping/SKILL.md：添加 3 条 contracts
5. agent-prompt-evolution/SKILL.md：添加 2 条 contracts

## Phase 2: 验证（~10min）

6. `bash scripts/validate-plugin.sh` PASS
7. 确认 5 个 skill 各有 ≥1 条 contract PASS 输出
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 5 个 skill 的 frontmatter 各有 contracts: 字段
- [ ] #2 每个 skill 的 contracts 条数 ≥2
- [ ] #3 `bash scripts/validate-plugin.sh` PASS（0 errors）
- [ ] #4 validate-plugin.sh 输出显示所有新增 contract 均为 PASS
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
claimed: 2026-06-18T12:59:02Z

Phase 1 ✓ 2026-06-18T13:01:51Z
Added contracts to 5 skills: feature-to-backlog (4), task-from-template (3), task-to-backlog (3), methodology-bootstrapping (3), agent-prompt-evolution (3)

## Execution Summary
Result: Done
Commit: e747b5c
All 5 skills now have contracts:, validate-plugin.sh PASS

workerLoop DoD verified: 6/6 passed (all 5 skills now have contracts:)
Completed: 2026-06-18T13:02:32Z
<!-- SECTION:NOTES:END -->
