---
id: TASK-44
title: Exp-F：验证 reference/ 在 skill 激活路径中是否可靠加载
status: Basic: Done
assignee: []
created_date: '2026-06-19 12:51'
updated_date: '2026-06-19 13:57'
labels:
  - kind:basic
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
ordinal: 1000
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 验证 reference/ 目录在 Claude Code skill 激活路径中的加载行为（Exp-F）

## Context
knowledge-extractor 的 ≤40 行约束将执行规格内容推到 reference/，但 reference/ 是否在 Claude Code skill 激活路径中被可靠加载从未被实证验证。Exp-A/D 证明执行规格型内容贡献 +16~20pp 准确率，因此此问题直接决定约束修订是否充分。

## Phase 1: 构造对照 SKILL.md 变体

基于 task-from-template 的 freshnessCheck 决策点，构造两个变体：

- **变体 A（Implementation 内嵌）**：Step 4 判断准则保留在 SKILL.md `## Implementation` 节，完整内容（等同 Exp-A V2，已知准确率 0.92）
- **变体 B（推到 reference/）**：SKILL.md 仅保留 Spec 节（≤40 行），Step 4 内容移至 `reference/freshnessCheck-criteria.md`

创建目录 `experiments/skill-quality/exp-f/`：
- 写入 `variant-a/SKILL.md`（完整内嵌版）
- 写入 `variant-b/SKILL.md`（spec-only 版，≤40 行）
- 写入 `variant-b/reference/freshnessCheck-criteria.md`（推出的执行规格）

### DoD
- [ ] `grep -q '## Implementation' experiments/skill-quality/exp-f/variant-a/SKILL.md`
- [ ] `grep -q '## Spec' experiments/skill-quality/exp-f/variant-b/SKILL.md`
- [ ] `grep -q 'freshnessCheck' experiments/skill-quality/exp-f/variant-b/reference/freshnessCheck-criteria.md`
- [ ] `[ $(wc -l < experiments/skill-quality/exp-f/variant-b/SKILL.md) -le 40 ]`

## Phase 2: 准备测试 fixtures

复用 Exp-A/D 的 10 个 freshnessCheck fixtures（`experiments/skill-quality/fixtures/exp-a/`）。确认 10 个 fixture 全部存在且有 ground truth。

### DoD
- [ ] `[ $(ls experiments/skill-quality/fixtures/exp-a/*.json 2>/dev/null | wc -l) -ge 10 ]`
- [ ] `grep -q '"answer"' experiments/skill-quality/fixtures/exp-a/tft-fresh-01.json`

## Phase 3: 实现并运行 Exp-F runner

编写 `experiments/skill-quality/exp-f/run-exp-f.ts`：
1. 通过 `claude -p "<fixture prompt>" --allowedTools none` CLI 子进程调用（`child_process.execSync`），激活 skill 的方式为：将当前工作目录（`cwd`）分别设为 `experiments/skill-quality/exp-f/variant-a/` 和 `experiments/skill-quality/exp-f/variant-b/`，Claude Code 会自动加载该目录下的 `SKILL.md`；对变体 A/B 各跑 10 个 fixture
2. 记录每个 fixture 的 verdict（APPROVED/NEEDS_REVISION）
3. 输出结果到 `experiments/skill-quality/artifacts/analysis/exp-f-results.json`，格式与 exp-d-results.json 一致

结果文件须包含：
- `variant_a_accuracy`、`variant_b_accuracy`
- 每个 fixture 的逐条 verdict
- `hypothesis`: "H-ref CONFIRMED" | "H-ref REFUTED"（差距 ≥10pp → CONFIRMED）

### DoD
- [ ] `grep -qE 'writeFile|appendFile|JSON\.stringify' experiments/skill-quality/exp-f/run-exp-f.ts`
- [ ] `grep -q '"variant_a_accuracy"' experiments/skill-quality/artifacts/analysis/exp-f-results.json`
- [ ] `grep -q '"hypothesis"' experiments/skill-quality/artifacts/analysis/exp-f-results.json`

## Phase 4: 分析结果并更新文档

根据 exp-f-results.json 中的 hypothesis 字段：

- **H-ref CONFIRMED**（B < A - 10pp）：更新 `docs/baime-oca-process-refinements.md` §1，注明 reference/ 不可靠，执行规格必须保留在 SKILL.md
- **H-ref REFUTED**（差距 < 10pp）：更新同文档，注明 ≤40 行 Spec 约束可行，reference/ 加载有效

同时将 Exp-F 结论追加到 `docs/skill-quality-experiments-summary.md`。

### DoD
- [ ] `grep -q 'Exp-F' docs/skill-quality-experiments-summary.md`
- [ ] `grep -q 'H-ref' docs/baime-oca-process-refinements.md`

## Constraints

- 必须走正常 Claude Code skill 激活路径，不能用直接 API 注入（不等价于生产路径）
- 假设文件在任何 LLM 调用前冻结
- 测试必须复用 Exp-A/D 相同的 10 个 freshnessCheck fixtures（保持可比性）
- 不修改 Exp-A/D 已有结果

## Acceptance Gate

- [ ] `grep -q '"variant_a_accuracy"' experiments/skill-quality/artifacts/analysis/exp-f-results.json`
- [ ] `grep -q '"hypothesis"' experiments/skill-quality/artifacts/analysis/exp-f-results.json`
- [ ] `grep -q 'Exp-F' docs/skill-quality-experiments-summary.md`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review converged after 4 iterations (all revisions were minor shell syntax fixes: grep -qE for alternation, content checks over test -f). Plan is production-quality.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q '## Implementation' experiments/skill-quality/exp-f/variant-a/SKILL.md
- [ ] #2 grep -q '## Spec' experiments/skill-quality/exp-f/variant-b/SKILL.md
- [ ] #3 grep -q 'freshnessCheck' experiments/skill-quality/exp-f/variant-b/reference/freshnessCheck-criteria.md
- [ ] #4 [ $(wc -l < experiments/skill-quality/exp-f/variant-b/SKILL.md) -le 40 ]
- [ ] #5 [ $(ls experiments/skill-quality/fixtures/exp-a/*.json 2>/dev/null | wc -l) -ge 10 ]
- [ ] #6 grep -q '"answer"' experiments/skill-quality/fixtures/exp-a/tft-fresh-01.json
- [ ] #7 grep -qE 'writeFile|appendFile|JSON\.stringify' experiments/skill-quality/exp-f/run-exp-f.ts
- [ ] #8 grep -q '"variant_a_accuracy"' experiments/skill-quality/artifacts/analysis/exp-f-results.json
- [ ] #9 grep -q '"hypothesis"' experiments/skill-quality/artifacts/analysis/exp-f-results.json
- [ ] #10 grep -q 'Exp-F' docs/skill-quality-experiments-summary.md
- [ ] #11 grep -q 'H-ref' docs/baime-oca-process-refinements.md
- [ ] #12 bash scripts/validate-plugin.sh
<!-- DOD:END -->
