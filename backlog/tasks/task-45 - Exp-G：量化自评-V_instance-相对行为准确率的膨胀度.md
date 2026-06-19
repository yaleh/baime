---
id: TASK-45
title: Exp-G：量化自评 V_instance 相对行为准确率的膨胀度
status: Proposal
assignee: []
created_date: '2026-06-19 12:51'
labels:
  - experiment
  - skill-quality
  - convergence
dependencies: []
references:
  - docs/baime-oca-process-refinements.md
  - experiments/skill-quality/artifacts/analysis/exp-e-results.json
  - experiments/skill-quality/lib/score.ts
priority: medium
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

BAIME OCA 第 5/9 步的收敛判据使用 `V_instance = (Accuracy + ...) / 4 ≥ 0.80`，其中 Accuracy 由 agent 自评。这个判据从未与行为测量结果对比过。

Exp-E 的警示：scorer bug 导致 composite 准确率 0.625，但 verdict-only 为 1.0——两个数字支持截然相反的结论。若 VALIDATION-REPORT 里的 Accuracy 存在系统性高估，则 OCA 收敛判据在测量一个与真实行为质量相关性未知的代理指标。

## Goals

1. 测量至少 3 个已收敛 skill 的自评 Accuracy 与 Layer 2.5 行为准确率之间的差距
2. 量化膨胀度分布（均值、最大值）
3. 决定 OCA 第 5/9 步 Accuracy 分量是否需要行为化替代

## Proposed Approach

### Phase 1：选取目标 skill

- task-from-template（已有 10 个 freshnessCheck fixture，直接复用）
- task-to-backlog（构造 reviewPlan / finalise 阶段 fixture，约 6-8 个）
- loop-backlog（复用 Exp-B Class C 的 verifyDod fixture）

### Phase 2：并排比较

从每个 skill 的 VALIDATION-REPORT 读取自评 Accuracy，同时用 Layer 2.5 runner（P-full，Haiku，k=5）测行为准确率（composite + verdict-only）。

### Phase 3：分析

输出 `artifacts/analysis/exp-g-results.json`，含每个 skill 的自评/行为对比、膨胀度、假设验证结果。

## Pre-registered Hypotheses

- **H-inflation**：自评 Accuracy ≥ 行为准确率（composite）+ 10pp
- **H-negligible**：差距 < 5pp（自评可信）

## Decision Table

| 结果 | 建议 |
|---|---|
| H-inflation CONFIRMED | 第 5/9 步 Accuracy 必须替换为行为准确率 |
| H-negligible CONFIRMED | 自评可保留，须加注"已与行为准确率比对" |
| 介于两者之间 | 双轨制：自评 + 行为准确率均列入 VALIDATION-REPORT |

## Constraints

- 使用已修复的 `lib/score.ts`（n=0 得 1.0；token Jaccard 模糊匹配）
- P-full 注入（非 specSection 片段）
- 假设文件在任何 LLM 调用前冻结
- CLEAR fixture < 6 的 skill 标记为 defer，不计入结论
<!-- SECTION:DESCRIPTION:END -->
