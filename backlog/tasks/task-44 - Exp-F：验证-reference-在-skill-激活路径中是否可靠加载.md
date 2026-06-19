---
id: TASK-44
title: Exp-F：验证 reference/ 在 skill 激活路径中是否可靠加载
status: Proposal
assignee: []
created_date: '2026-06-19 12:51'
labels:
  - experiment
  - skill-quality
  - knowledge-extractor
dependencies: []
references:
  - docs/baime-oca-process-refinements.md
  - experiments/skill-quality/artifacts/analysis/exp-a-results.json
  - experiments/skill-quality/artifacts/analysis/exp-d-results.json
  - plugin/agents/knowledge-extractor.md
priority: high
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

`knowledge-extractor` 的原约束 `|lines(SKILL.md)| ≤ 40` 要求把详细内容推到 `reference/`。Exp-A（+16pp）和 Exp-D（+20pp）证明 `## Implementation` 中的执行规格内容对 LLM 准确率有实质贡献——这引发了一个至今未被验证的关键问题：

**当 Claude Code 通过 skill 描述触发激活时，`reference/` 目录下的文件是否被自动加载到上下文？**

若 `reference/` 未被加载，则把 load-bearing 内容推到 `reference/` 等于主动丢弃 20pp 准确率。若被加载，则 ≤40 行约束是可行的，但需要在 contracts 中验证加载机制。

这是 OCA 第 6-7 步行数约束的唯一直接实证方法，也是阻塞后续修订的关键决策。

## Goals

1. 测量 Claude Code skill 激活路径下 `reference/` 文件的实际加载情况
2. 量化"执行规格放 reference/"与"放 SKILL.md Implementation"的准确率差距
3. 给出明确架构建议：废除 ≤40 行 / 保留 ≤40 行并强制加载验证

## Proposed Approach

### Phase 1：构造对照变体

取 task-from-template 的 freshnessCheck 决策点，构造两个 SKILL.md 变体：

- **变体 A（Implementation 内嵌）**：Step 4 判断准则保留在 SKILL.md `## Implementation`，完整 249 行（等同 Exp-A V2，已知准确率 0.92）
- **变体 B（推到 reference/）**：SKILL.md 仅保留 Spec 节（≤40 行），Step 4 内容移至 `reference/freshnessCheck-criteria.md`

### Phase 2：通过 Claude Code skill 激活路径测试

使用与 Exp-D 相同的 10 个 freshnessCheck fixture，通过 **Claude Code skill 触发**（而非直接 API 注入），分别测量变体 A/B 的准确率。

### Phase 3：分析与决策

| 结果 | 含义 | 建议 |
|---|---|---|
| H-ref CONFIRMED（B < A − 10pp） | reference/ 未被可靠加载 | 废除 ≤40 行；执行规格必须留 SKILL.md |
| H-ref REFUTED（差距 < 10pp） | reference/ 加载有效 | ≤40 行可行，需在 contracts 中验证加载 |

## Pre-registered Hypotheses

- **H-ref**：变体 B 准确率 < 变体 A − 10pp（reference/ 未被可靠加载）
- **H-load**：变体 B 准确率 ≥ 变体 A − 5pp（reference/ 加载有效）

## Constraints

- 必须走正常 Claude Code skill 激活路径，不能用直接 API 注入（不等价于生产路径）
- 假设文件在任何 LLM 调用前冻结
- 结果直接影响 knowledge-extractor.md 的最终修订
<!-- SECTION:DESCRIPTION:END -->
