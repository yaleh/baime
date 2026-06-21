---
id: TASK-45
title: Exp-G：量化自评 V_instance 相对行为准确率的膨胀度
status: Basic: Done
assignee: []
created_date: '2026-06-19 12:51'
updated_date: '2026-06-19 14:57'
labels:
  - kind:basic
  - experiment
  - skill-quality
  - convergence
dependencies: []
references:
  - docs/baime-oca-process-refinements.md
  - experiments/skill-quality/artifacts/analysis/exp-e-results.json
  - experiments/skill-quality/lib/score.ts
priority: medium
ordinal: 1000
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Exp-G：量化自评 V_instance 相对行为准确率的膨胀度

## Context
BAIME OCA 第 5/9 步收敛判据中的 Accuracy 分量由 agent 自评，从未与 Layer 2.5 行为测量结果对比。Exp-E 的 scorer bug 表明 composite 自评（0.625）与 verdict-only 行为准确率（1.0）可支持截然相反的结论，直接动摇收敛判据的可信度。

## Phase 1: 读取自评 Accuracy

对三个目标 skill 分别读取 VALIDATION-REPORT 中的自评 Accuracy 值：
- `plugin/skills/task-from-template/VALIDATION-REPORT.md`
- `plugin/skills/task-to-backlog/VALIDATION-REPORT.md`
- `plugin/skills/loop-backlog/VALIDATION-REPORT.md`

将三者的自评 Accuracy 值写入 `experiments/skill-quality/exp-g/self-eval-accuracy.json`，格式：
```json
{ "task-from-template": 0.XX, "task-to-backlog": 0.XX, "loop-backlog": 0.XX }
```

### DoD
- [ ] `grep -q 'task-from-template' experiments/skill-quality/exp-g/self-eval-accuracy.json`
- [ ] `grep -q 'task-to-backlog' experiments/skill-quality/exp-g/self-eval-accuracy.json`
- [ ] `grep -q 'loop-backlog' experiments/skill-quality/exp-g/self-eval-accuracy.json`

## Phase 2: 准备 Layer 2.5 fixtures

确认每个 skill 各有 ≥6 个 CLEAR fixture 可用于行为准确率测量：
- task-from-template：复用 `experiments/skill-quality/fixtures/exp-a/`（10 个 freshnessCheck，已验证）
- loop-backlog：复用 `experiments/skill-quality/fixtures/exp-b/`（Class C verifyDod fixture）
- task-to-backlog：若 `experiments/skill-quality/fixtures/exp-g/task-to-backlog/` 不存在，构造 6-8 个 reviewPlan/finalise 决策点 fixture，每个 fixture 包含 `input`、`expected_verdict`（CLEAR/AMBIGUOUS/ERROR）、`ground_truth_rationale` 字段，保存为独立 `.json` 文件。

写入 `experiments/skill-quality/exp-g/fixture-inventory.json`，记录每个 skill 的 CLEAR fixture 数量。CLEAR < 6 的 skill 标记为 `"status": "defer"`。格式示例：
```json
{ "task-from-template": { "clear_count": 10, "status": "run" }, ... }
```

### DoD
- [ ] `grep -q '"clear_count"' experiments/skill-quality/exp-g/fixture-inventory.json`
- [ ] `grep -q '"task-from-template"' experiments/skill-quality/exp-g/fixture-inventory.json`
- [ ] `grep -q '"loop-backlog"' experiments/skill-quality/exp-g/fixture-inventory.json`
- [ ] `grep -q '"task-to-backlog"' experiments/skill-quality/exp-g/fixture-inventory.json`

## Phase 3: 运行 Layer 2.5 行为准确率测量

对 Phase 2 中 CLEAR ≥ 6 的 skill，使用已修复的 `experiments/skill-quality/lib/score.ts` 和 `lib/llm-client.ts`，P-full 注入，Haiku，k=5，测量 composite + verdict-only 准确率。

编写或复用 runner：`experiments/skill-quality/exp-g/run-exp-g.ts`

输出每个 skill 的结果到 `experiments/skill-quality/artifacts/analysis/exp-g-results.json`：
```json
{
  "skill-name": {
    "self_eval_accuracy": 0.XX,
    "behavioral_composite": 0.XX,
    "behavioral_verdict_only": 0.XX,
    "inflation": 0.XX
  },
  "hypothesis": "H-inflation CONFIRMED|H-negligible CONFIRMED|INCONCLUSIVE"
}
```

### DoD
- [ ] `test -f experiments/skill-quality/exp-g/run-exp-g.ts`
- [ ] `grep -q '"self_eval_accuracy"' experiments/skill-quality/artifacts/analysis/exp-g-results.json`
- [ ] `grep -q '"behavioral_verdict_only"' experiments/skill-quality/artifacts/analysis/exp-g-results.json`
- [ ] `grep -q '"inflation"' experiments/skill-quality/artifacts/analysis/exp-g-results.json`
- [ ] `grep -q '"hypothesis"' experiments/skill-quality/artifacts/analysis/exp-g-results.json`

## Phase 4: 分析并更新文档

根据 `experiments/skill-quality/artifacts/analysis/exp-g-results.json` 中的 hypothesis 字段更新 `docs/baime-oca-process-refinements.md` §2（收敛判据行为化替代的必要性），写入 Exp-G 结论段落（包含 hypothesis 实际值）。将 Exp-G 结论追加到 `docs/skill-quality-experiments-summary.md`。

### DoD
- [ ] `grep -q 'Exp-G' docs/skill-quality-experiments-summary.md`
- [ ] `grep -q 'Exp-G' docs/baime-oca-process-refinements.md`

## Constraints

- 使用已修复的 `lib/score.ts`（n=0 得 1.0；token Jaccard 模糊匹配）
- P-full 注入（非 specSection 片段）
- 假设文件在任何 LLM 调用前冻结
- CLEAR fixture < 6 的 skill 标记 defer，不计入结论
- 不修改 Exp-A/B/D/E/F 已有结果
- task-to-backlog 新构造的每个 fixture 须包含 `input`、`expected_verdict`（CLEAR/AMBIGUOUS/ERROR）、`ground_truth_rationale` 字段，并在 Phase 2 完成前进行人工审计确认 ground truth 标注正确

## Acceptance Gate

- [ ] `grep -q '"hypothesis"' experiments/skill-quality/artifacts/analysis/exp-g-results.json`
- [ ] `grep -q 'Exp-G' docs/skill-quality-experiments-summary.md`
- [ ] `grep -q 'Exp-G' docs/baime-oca-process-refinements.md`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review: 4 iterations, all revisions were substantive improvements (outcome-agnostic DoD checks, fixture schema, output field verification). Plan is production-quality.

claimed: 2026-06-19T14:44:54Z

Completed: 2026-06-19T14:57:57Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'task-from-template' experiments/skill-quality/exp-g/self-eval-accuracy.json
- [ ] #2 grep -q 'task-to-backlog' experiments/skill-quality/exp-g/self-eval-accuracy.json
- [ ] #3 grep -q 'loop-backlog' experiments/skill-quality/exp-g/self-eval-accuracy.json
- [ ] #4 grep -q '"clear_count"' experiments/skill-quality/exp-g/fixture-inventory.json
- [ ] #5 grep -q '"task-from-template"' experiments/skill-quality/exp-g/fixture-inventory.json
- [ ] #6 grep -q '"loop-backlog"' experiments/skill-quality/exp-g/fixture-inventory.json
- [ ] #7 grep -q '"task-to-backlog"' experiments/skill-quality/exp-g/fixture-inventory.json
- [ ] #8 test -f experiments/skill-quality/exp-g/run-exp-g.ts
- [ ] #9 grep -q '"self_eval_accuracy"' experiments/skill-quality/artifacts/analysis/exp-g-results.json
- [ ] #10 grep -q '"behavioral_verdict_only"' experiments/skill-quality/artifacts/analysis/exp-g-results.json
- [ ] #11 grep -q '"inflation"' experiments/skill-quality/artifacts/analysis/exp-g-results.json
- [ ] #12 grep -q '"hypothesis"' experiments/skill-quality/artifacts/analysis/exp-g-results.json
- [ ] #13 grep -q 'Exp-G' docs/skill-quality-experiments-summary.md
- [ ] #14 grep -q 'Exp-G' docs/baime-oca-process-refinements.md
- [ ] #15 bash scripts/validate-plugin.sh
<!-- DOD:END -->
