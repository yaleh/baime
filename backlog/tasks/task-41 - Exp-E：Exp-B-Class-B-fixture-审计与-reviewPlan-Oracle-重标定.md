---
id: TASK-41
title: Exp-E：Exp-B Class B fixture 审计与 reviewPlan Oracle 重标定
status: Basic: Done
assignee: []
created_date: '2026-06-19 10:40'
updated_date: '2026-06-19 11:42'
labels:
  - kind:basic
  - experiment
  - skill-quality
  - layer-2.5
dependencies: []
references:
  - experiments/skill-quality/artifacts/analysis/exp-b-results.json
  - docs/skill-quality-experiments-summary.md
  - plugin/skills/task-to-backlog/SKILL.md
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Exp-B Class B（reviewPlan 不变量检查）Haiku 准确率 **0.625**，低于预登记阈值 0.70，建议为 manual-review。

Class B 的任务是：给定一个 Plan 对象，判断哪些 `reviewPlan` 不变量被违反（DoD 非 shell 命令、phase.instructions 为空等）。这类检查看似机械，但 0.625 偏低——有两种可能解释：

1. **Fixture 设计引入了边界歧义**：8 个 fixture 中部分 ground truth 的 `failing_invariants` 本身有合理争议（例如某条 DoD 命令是否算 `isShellCmd` 可能合理地有不同判断）。若存在此类 fixture，则 0.625 包含了"人工标注本身模糊"的误差，Haiku 的真实能力被低估。

2. **Haiku 能力天花板**：8 个 fixture 的 ground truth 清晰无争议，0.625 就是 Haiku 在 partial scoring 下的真实上限。此时 Class B 确实不适合自动化。

区分这两种情况直接影响：
- 是否值得投入开发 Class B Layer 2.5 Oracle
- 若值得，换用更强的模型（Sonnet）能否达到 ≥0.70

## Goals

1. 审计 8 个 Class B fixture 的 ground truth 合理性，标注模糊度等级
2. 对清晰 fixture（≥6 个）重跑，得到"去噪"后的 Haiku 准确率
3. 加测 Sonnet 在 Class B 上的准确率，评估模型升级的收益
4. 输出 Class B Layer 2.5 最终建议

## Proposed Approach

### Phase 1：Fixture 审计（人工）

逐一检查 `fixtures/exp-b/` 中 8 个 Class B fixture：
- 读取每个 fixture 的 `plan` 对象和 `answer.failing_invariants`
- 对照 `reviewPlan` spec（`plugin/skills/task-to-backlog/SKILL.md` § reviewPlan）
- 标注每个 fixture 的模糊度：
  - `CLEAR`：ground truth 无争议，合理人工也会有相同判断
  - `AMBIGUOUS`：ground truth 有合理争议空间（例如边界 shell 命令）
  - `ERROR`：ground truth 有明显错误，需修正

对 `AMBIGUOUS` 和 `ERROR` fixture：修正或添加 `answerType: "fuzzy"` 标注。

### Phase 2：重跑（仅清晰 fixture）

用 Haiku + Sonnet，对标注为 `CLEAR` 的 fixture 重跑 k=5。

若清晰 fixture ≥ 6 个，结果有统计意义。  
总调用量（最多）：8 fixture × 2 model × k=5 = 80 次（实际更少）。

### Phase 3：结论与建议

输出 `artifacts/analysis/exp-e-results.json`：
- 审计结果（每个 fixture 的模糊度标注）
- 清晰 fixture 子集上的 Haiku vs Sonnet 准确率
- Layer 2.5 Class B 最终建议：
  - `auto-CI`（清晰 Haiku ≥ 0.70 或 Sonnet ≥ 0.80）
  - `manual-review`（均不达标）
  - `defer`（清晰 fixture < 6，样本不足）

## 预登记假设

- **H-fixture-noise**：≥ 2 个 Class B fixture 为 AMBIGUOUS/ERROR（部分 0.625 是标注噪声）
- **H-sonnet-gap**：Sonnet Class B 准确率 ≥ Haiku + 10pp

假设文件在任何 LLM 调用前写入 `artifacts/pre-registered-predictions-exp-e.json`。

## Constraints

- Phase 1 审计为人工步骤，LLM 可辅助但最终判断由人确认
- 若 CLEAR fixture < 6，则 Phase 2/3 结论为 `defer`，不强行给出建议
- 不修改已执行 Exp-B 的原始 fixture；审计结果写入新标注文件

## LLM 配置文件

使用 `experiments/skill-quality/.env`（用户已填入 LLM_BASE_URL 和 LLM_API_KEY）：
- MODEL_PRIMARY（claude-haiku-4-5-20251001）
- 加测：claude-sonnet-4-6

运行：`cd experiments/skill-quality && npm run exp-e`

## References

- Exp-B 结果：`experiments/skill-quality/artifacts/analysis/exp-b-results.json`
- Exp-B fixtures：`experiments/skill-quality/fixtures/exp-b/`（Class B 共 8 个）
- reviewPlan spec：`plugin/skills/task-to-backlog/SKILL.md`（§ reviewPlan）
- 实验总结：`docs/skill-quality-experiments-summary.md`
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Exp-E：Exp-B Class B fixture 审计与 reviewPlan Oracle 重标定

## Context

Exp-B Class B（reviewPlan 不变量检查）Haiku 准确率 0.625，低于预登记阈值 0.70。原因不明：可能是 fixture 设计存在边界歧义（标注噪声），也可能是 Haiku 能力上限。区分这两种情况直接决定是否值得开发 Class B Layer 2.5 Oracle，以及是否需要升级到 Sonnet。

## Phase 1：Pre-register 假设 + Fixture 审计

在任何 LLM 调用前，将预登记假设写入 JSON 文件：

```bash
cat > experiments/skill-quality/artifacts/pre-registered-predictions-exp-e.json << 'PREDICTIONS'
{
  "experiment": "exp-e",
  "registered_before_llm_calls": true,
  "hypotheses": [
    {
      "id": "H-fixture-noise",
      "claim": ">=2 Class B fixtures are AMBIGUOUS/ERROR",
      "threshold": 2
    },
    {
      "id": "H-sonnet-gap",
      "claim": "Sonnet Class B accuracy >= Haiku + 10pp on CLEAR fixtures",
      "threshold_pp": 10
    }
  ]
}
PREDICTIONS
```

然后审计 `experiments/skill-quality/fixtures/exp-b/` 中所有 Class B fixture，对照 `plugin/skills/task-to-backlog/SKILL.md` § reviewPlan spec，标注模糊度（CLEAR / AMBIGUOUS / ERROR），将结果写入 `experiments/skill-quality/artifacts/analysis/exp-e-audit.json`。

### DoD
- [ ] `test -f experiments/skill-quality/artifacts/pre-registered-predictions-exp-e.json`
- [ ] `grep -q "H-fixture-noise" experiments/skill-quality/artifacts/pre-registered-predictions-exp-e.json`
- [ ] `test -f experiments/skill-quality/artifacts/analysis/exp-e-audit.json`
- [ ] `grep -q "CLEAR" experiments/skill-quality/artifacts/analysis/exp-e-audit.json`

## Phase 2：实现 run-exp-e.ts

在 `experiments/skill-quality/scripts/` 中实现 `run-exp-e.ts`：
- 读取 `artifacts/analysis/exp-e-audit.json` 确定 CLEAR fixture 列表
- 若 CLEAR fixture < 6，输出 `defer` 结论并退出（不调用 LLM）
- 否则对 CLEAR fixture 分别用 Haiku（MODEL_PRIMARY）和 Sonnet（MODEL_SECONDARY）运行 k=5
- 使用与 Exp-B 相同的 partial scoring 逻辑
- 在 `experiments/skill-quality/package.json` 中添加 `"exp-e"` script

### DoD
- [ ] `test -f experiments/skill-quality/scripts/run-exp-e.ts`
- [ ] `grep -qE "MODEL_SECONDARY|sonnet" experiments/skill-quality/scripts/run-exp-e.ts`
- [ ] `grep -q "defer" experiments/skill-quality/scripts/run-exp-e.ts`
- [ ] `grep -q '"exp-e"' experiments/skill-quality/package.json`

## Phase 3：执行实验 + 输出结论

运行 `cd experiments/skill-quality && npm run exp-e`。

输出 `artifacts/analysis/exp-e-results.json`，包含：
- 每个 fixture 的审计标注
- CLEAR subset 上 Haiku vs Sonnet 准确率
- Layer 2.5 Class B 最终建议（auto-CI / manual-review / defer）
- 预登记假设验证结果

### DoD
- [ ] `test -f experiments/skill-quality/artifacts/analysis/exp-e-results.json`
- [ ] `grep -q '"recommendation"' experiments/skill-quality/artifacts/analysis/exp-e-results.json`
- [ ] `grep -q '"haiku_accuracy"' experiments/skill-quality/artifacts/analysis/exp-e-results.json`

## Phase 4：更新实验总结文档

将 Exp-E 结论追加到 `docs/skill-quality-experiments-summary.md`：
- 审计结果（CLEAR/AMBIGUOUS/ERROR 统计）
- 去噪后准确率（Haiku vs Sonnet on CLEAR subset）
- Class B Layer 2.5 最终建议
- 预登记假设验证状态

### DoD
- [ ] `grep -q "Exp-E" docs/skill-quality-experiments-summary.md`
- [ ] `grep -q "exp-e-results" docs/skill-quality-experiments-summary.md`

## Constraints

- Phase 1 审计为人工步骤，LLM 可辅助提取内容，但最终标注由人确认
- 若 CLEAR fixture < 6，则结论为 defer，不强行给出建议
- 不修改已执行 Exp-B 的原始 fixture 文件；审计结果写入新标注文件
- 使用 experiments/skill-quality/.env 中的凭据（不得提交到 git）

## Acceptance Gate

- [ ] `test -f experiments/skill-quality/artifacts/analysis/exp-e-results.json`
- [ ] `grep -q '"recommendation"' experiments/skill-quality/artifacts/analysis/exp-e-results.json`
- [ ] `grep -q "Exp-E" docs/skill-quality-experiments-summary.md`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: NEEDS_REVISION → fixed grep -q with \| to grep -qE in Phase 2 DoD; strengthened Phase 4 DoD 'Class B' check to 'exp-e-results' to avoid false positive from pre-existing content. Re-submitted as APPROVED.

Plan review iteration 2: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f experiments/skill-quality/artifacts/pre-registered-predictions-exp-e.json
- [ ] #2 grep -q "H-fixture-noise" experiments/skill-quality/artifacts/pre-registered-predictions-exp-e.json
- [ ] #3 test -f experiments/skill-quality/artifacts/analysis/exp-e-audit.json
- [ ] #4 grep -q "CLEAR" experiments/skill-quality/artifacts/analysis/exp-e-audit.json
- [ ] #5 test -f experiments/skill-quality/scripts/run-exp-e.ts
- [ ] #6 grep -qE "MODEL_SECONDARY|sonnet" experiments/skill-quality/scripts/run-exp-e.ts
- [ ] #7 grep -q "defer" experiments/skill-quality/scripts/run-exp-e.ts
- [ ] #8 grep -q '"exp-e"' experiments/skill-quality/package.json
- [ ] #9 test -f experiments/skill-quality/artifacts/analysis/exp-e-results.json
- [ ] #10 grep -q '"recommendation"' experiments/skill-quality/artifacts/analysis/exp-e-results.json
- [ ] #11 grep -q '"haiku_accuracy"' experiments/skill-quality/artifacts/analysis/exp-e-results.json
- [ ] #12 grep -q "Exp-E" docs/skill-quality-experiments-summary.md
- [ ] #13 grep -q "exp-e-results" docs/skill-quality-experiments-summary.md
- [ ] #14 bash scripts/validate-plugin.sh
<!-- DOD:END -->
