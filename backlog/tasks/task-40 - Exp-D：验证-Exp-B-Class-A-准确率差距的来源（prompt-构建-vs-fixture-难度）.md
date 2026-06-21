---
id: TASK-40
title: Exp-D：验证 Exp-B Class A 准确率差距的来源（prompt 构建 vs fixture 难度）
status: Basic: Done
assignee: []
created_date: '2026-06-19 10:39'
updated_date: '2026-06-19 11:29'
labels:
  - kind:basic
  - experiment
  - skill-quality
  - layer-2.5
dependencies: []
references:
  - experiments/skill-quality/artifacts/analysis/exp-a-results.json
  - experiments/skill-quality/artifacts/analysis/exp-b-results.json
  - docs/skill-quality-experiments-summary.md
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Exp-A 和 Exp-B 之间存在一个无法解释的 22pp 准确率差距：

- Exp-A：Haiku + V2（完整 SKILL.md）+ freshnessCheck fixtures → 准确率 **0.92**
- Exp-B Class A：Haiku + freshnessCheck fixtures → 准确率 **0.70**

两个实验都是 freshnessCheck 二元门控（FRESH/STALE），都用 Haiku，都用 k=5。差距只可能来自两处：

1. **Prompt 构建不同**：Exp-A 将完整 SKILL.md 内容（249 行 V2）注入 prompt；Exp-B 按规格片段（specSection 字段）注入，内容可能不含 Step 4 的判断准则
2. **Fixture 难度不同**：Exp-B 的 10 个 Class A fixture 可能边界情况更多（STALE 理由更隐晦，FRESH 判断更模糊）

这个差距决定了 Layer 2.5 对 Class A（freshnessCheck）的最终建议：
- 若是 prompt 问题 → 用完整 SKILL.md 注入即可达到 ≥0.85，Class A 可进 auto-CI
- 若是 fixture 难度 → 0.70 是 Haiku 的真实上限，Class A 应维持 manual-review

当前结论（manual-review for Class A）基于不确定的数据，本实验用于消除歧义。

## Goals

1. 确认 Exp-A（0.92）与 Exp-B Class A（0.70）差距的主因
2. 若主因是 prompt 构建，测量正确 prompt 下的 Class A 准确率
3. 输出明确的 Layer 2.5 Class A 建议：auto-CI（≥0.85）或 manual-review（<0.85）

## Proposed Approach

### Phase 1：Prompt 差异隔离

在 Exp-B 框架下，对 10 个 Class A fixture 用两种 prompt 各跑 k=5：

- **P-spec**：当前 Exp-B 方式，仅注入 `specSection` 片段（约 20 行）
- **P-full**：注入完整 task-from-template SKILL.md V2 内容（249 行，等同 Exp-A V2）

模型：Haiku + GLM（与 Exp-B 一致）。总调用量：10 fixture × 2 prompt × 2 model × k=5 = 200 次。

### Phase 2：Fixture 难度标注

对 P-full 仍然答错的 fixture，人工标注难度类型：
- `AMBIGUOUS`：ground truth 本身有合理争议空间
- `HARD_CLEAR`：ground truth 明确，但需要深度推理
- `MODEL_ERROR`：ground truth 明确，模型犯了明显错误

若 P-full 错误全部集中在 `AMBIGUOUS` fixture，则说明 0.70 中有相当部分是合理分歧，而非真正模型失误。

### Phase 3：输出结论

输出 `artifacts/analysis/exp-d-results.json`，包含：
- P-spec vs P-full 准确率对比（per-fixture + 均值）
- P-full 错误的难度标注分布
- Layer 2.5 Class A 最终建议（auto-CI 或 manual-review）及置信度

## 预登记假设

- **H-prompt**：P-full 准确率 ≥ P-spec + 15pp（差距主因是 prompt）
- **H-fixture**：P-full 准确率 < P-spec + 5pp（差距主因是 fixture 难度）

假设文件在任何 LLM 调用前写入 `artifacts/pre-registered-predictions-exp-d.json`。

## LLM 配置文件

使用 `experiments/skill-quality/.env`（用户已填入 LLM_BASE_URL 和 LLM_API_KEY）：
- MODEL_PRIMARY（默认 claude-haiku-4-5-20251001）
- MODEL_SECONDARY（默认 glm-4.5-flash）

运行：`cd experiments/skill-quality && npm run exp-d`

## References

- Exp-A 结果：`experiments/skill-quality/artifacts/analysis/exp-a-results.json`
- Exp-B 结果：`experiments/skill-quality/artifacts/analysis/exp-b-results.json`
- 实验总结：`docs/skill-quality-experiments-summary.md`
- 基础设施：`experiments/skill-quality/lib/`（TASK-36 产出，可直接复用）
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Exp-D：验证 Exp-B Class A 准确率差距的来源

## Context

Exp-A（Haiku + 完整 SKILL.md V2 + freshnessCheck fixtures）准确率 0.92，Exp-B Class A（Haiku + specSection 片段 + 同类 freshnessCheck fixtures）准确率 0.70，差距 22pp。本实验对同一组 10 个 Class A fixture 用两种 prompt 风格（P-spec = specSection 片段；P-full = 完整 SKILL.md V2）各跑 k=5，以隔离差距来源是 prompt 构建还是 fixture 难度，并最终确定 Layer 2.5 对 Class A 的建议（auto-CI ≥0.85 或 manual-review）。

## Phase 1: 预登记假设

Instructions: 在任何 LLM 调用前，将 H-prompt 和 H-fixture 两条假设写入 pre-registered-predictions-exp-d.json。H-prompt：P-full 准确率 ≥ P-spec + 15pp；H-fixture：P-full 准确率 < P-spec + 5pp。文件冻结后不可修改。

### DoD
- [ ] `test -f experiments/skill-quality/artifacts/pre-registered-predictions-exp-d.json`
- [ ] `grep -q '"H-prompt"' experiments/skill-quality/artifacts/pre-registered-predictions-exp-d.json`
- [ ] `grep -q '"H-fixture"' experiments/skill-quality/artifacts/pre-registered-predictions-exp-d.json`
- [ ] `grep -q '"frozen_at"' experiments/skill-quality/artifacts/pre-registered-predictions-exp-d.json`

## Phase 2: 实现 run-exp-d.ts

Instructions: 在 experiments/skill-quality/scripts/ 下实现 run-exp-d.ts。复用 lib/env.ts、lib/llm-client.ts、lib/score.ts。对 fixtures/exp-b/class-a/ 下全部 10 个 fixture，用 P-spec（仅注入 specSection 字段）和 P-full（注入 variants/task-from-template-v2.md 完整内容）各调用 Haiku + GLM，k=5，共 200 次调用。结果写入 artifacts/analysis/exp-d-results.json。

### DoD
- [ ] `test -f experiments/skill-quality/scripts/run-exp-d.ts`
- [ ] `grep -q 'P-spec\|p_spec\|pSpec\|prompt_spec' experiments/skill-quality/scripts/run-exp-d.ts`
- [ ] `grep -q 'P-full\|p_full\|pFull\|prompt_full' experiments/skill-quality/scripts/run-exp-d.ts`
- [ ] `grep -q 'task-from-template-v2\|variants/' experiments/skill-quality/scripts/run-exp-d.ts`
- [ ] `[ $(ls experiments/skill-quality/fixtures/exp-b/class-a/*.json 2>/dev/null | wc -l) -ge 10 ]`

## Phase 3: 执行实验并标注难度

Instructions: 运行 run-exp-d.ts 完成 200 次 LLM 调用，写出原始结果。然后对 P-full 仍答错的 fixture 人工标注难度类型：AMBIGUOUS（ground truth 有合理争议）、HARD_CLEAR（ground truth 明确但需深度推理）、MODEL_ERROR（ground truth 明确且模型犯明显错误）。标注写入同一 exp-d-results.json 的 annotations 字段。

### DoD
- [ ] `test -f experiments/skill-quality/artifacts/analysis/exp-d-results.json`
- [ ] `grep -q '"p_spec_accuracy"' experiments/skill-quality/artifacts/analysis/exp-d-results.json`
- [ ] `grep -q '"p_full_accuracy"' experiments/skill-quality/artifacts/analysis/exp-d-results.json`
- [ ] `grep -q '"annotations"' experiments/skill-quality/artifacts/analysis/exp-d-results.json`
- [ ] `grep -qE '"AMBIGUOUS"|"HARD_CLEAR"|"MODEL_ERROR"' experiments/skill-quality/artifacts/analysis/exp-d-results.json`

## Phase 4: 分析并输出结论

Instructions: 在 exp-d-results.json 中写入 per-fixture 对比、均值准确率、难度标注分布、H-prompt/H-fixture 裁决（CONFIRMED/REFUTED），以及 Layer 2.5 Class A 最终建议（auto-CI 或 manual-review）及置信度字段。

### DoD
- [ ] `grep -q '"verdict"' experiments/skill-quality/artifacts/analysis/exp-d-results.json`
- [ ] `grep -qE '"CONFIRMED"|"REFUTED"' experiments/skill-quality/artifacts/analysis/exp-d-results.json`
- [ ] `grep -q '"layer_2_5_recommendation"' experiments/skill-quality/artifacts/analysis/exp-d-results.json`
- [ ] `grep -qE '"auto-CI"|"manual-review"' experiments/skill-quality/artifacts/analysis/exp-d-results.json`
- [ ] `grep -q '"confidence"' experiments/skill-quality/artifacts/analysis/exp-d-results.json`

## Constraints

- 预登记文件必须在任何 LLM 调用前写入且冻结，不可事后修改
- P-full 使用 variants/task-from-template-v2.md 的完整 249 行内容，不可裁剪
- k=5 每 prompt/model/fixture 组合固定，不可事后追加调用
- 难度标注为人工判断，不可用 LLM 自动生成
- 复用现有 lib/ 基础设施，不重新实现 LLM 调用或评分逻辑

## Acceptance Gate

- [ ] `test -f experiments/skill-quality/artifacts/pre-registered-predictions-exp-d.json`
- [ ] `test -f experiments/skill-quality/scripts/run-exp-d.ts`
- [ ] `test -f experiments/skill-quality/artifacts/analysis/exp-d-results.json`
- [ ] `grep -qE '"CONFIRMED"|"REFUTED"' experiments/skill-quality/artifacts/analysis/exp-d-results.json`
- [ ] `grep -qE '"auto-CI"|"manual-review"' experiments/skill-quality/artifacts/analysis/exp-d-results.json`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f experiments/skill-quality/artifacts/pre-registered-predictions-exp-d.json
- [ ] #2 grep -q '"H-prompt"' experiments/skill-quality/artifacts/pre-registered-predictions-exp-d.json
- [ ] #3 grep -q '"H-fixture"' experiments/skill-quality/artifacts/pre-registered-predictions-exp-d.json
- [ ] #4 grep -q '"frozen_at"' experiments/skill-quality/artifacts/pre-registered-predictions-exp-d.json
- [ ] #5 test -f experiments/skill-quality/scripts/run-exp-d.ts
- [ ] #6 grep -q 'P-spec\|p_spec\|pSpec\|prompt_spec' experiments/skill-quality/scripts/run-exp-d.ts
- [ ] #7 grep -q 'P-full\|p_full\|pFull\|prompt_full' experiments/skill-quality/scripts/run-exp-d.ts
- [ ] #8 grep -q 'task-from-template-v2\|variants/' experiments/skill-quality/scripts/run-exp-d.ts
- [ ] #9 [ $(ls experiments/skill-quality/fixtures/exp-b/class-a/*.json 2>/dev/null | wc -l) -ge 10 ]
- [ ] #10 test -f experiments/skill-quality/artifacts/analysis/exp-d-results.json
- [ ] #11 grep -q '"p_spec_accuracy"' experiments/skill-quality/artifacts/analysis/exp-d-results.json
- [ ] #12 grep -q '"p_full_accuracy"' experiments/skill-quality/artifacts/analysis/exp-d-results.json
- [ ] #13 grep -q '"annotations"' experiments/skill-quality/artifacts/analysis/exp-d-results.json
- [ ] #14 grep -qE '"AMBIGUOUS"|"HARD_CLEAR"|"MODEL_ERROR"' experiments/skill-quality/artifacts/analysis/exp-d-results.json
- [ ] #15 grep -q '"verdict"' experiments/skill-quality/artifacts/analysis/exp-d-results.json
- [ ] #16 grep -qE '"CONFIRMED"|"REFUTED"' experiments/skill-quality/artifacts/analysis/exp-d-results.json
- [ ] #17 grep -q '"layer_2_5_recommendation"' experiments/skill-quality/artifacts/analysis/exp-d-results.json
- [ ] #18 grep -qE '"auto-CI"|"manual-review"' experiments/skill-quality/artifacts/analysis/exp-d-results.json
- [ ] #19 grep -q '"confidence"' experiments/skill-quality/artifacts/analysis/exp-d-results.json
- [ ] #20 bash scripts/validate-plugin.sh
<!-- DOD:END -->
