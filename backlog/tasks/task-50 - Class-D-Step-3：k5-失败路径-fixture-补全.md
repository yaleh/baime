---
id: TASK-50
title: Class D Step 3：k=5 + 失败路径 fixture 补全
status: Proposal
assignee: []
created_date: '2026-06-19 15:12'
labels:
  - class-d
  - fixture
  - skill-quality
  - experiment
dependencies:
  - TASK-47
references:
  - experiments/skill-quality/fixtures/class-d/
  - experiments/skill-quality/scripts/run-class-d.ts
  - experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
priority: medium
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Step 2 将 runner 改为真实 `claude -p` 调用，k=1 验证通路可用。本步骤在通路确认后：

1. 将 k 恢复为 5，获取具有统计意义的 compliance_rate
2. 补充"失败路径"fixture：当前 6 个 fixture 全部描述合规场景（正向），缺乏对违规行为的检测能力

## Goal

### Part A：k=5

将 runner 默认 k 从 1 改回 5。运行完整实验，记录真实 compliance_rate（预期低于当前 analytical mode 的 1.0）。

### Part B：失败路径 fixture

当前 fixture 只测"合规时能检测到合规"，未测"违规时能检测到违规"。补充以下反向 fixture：

| Fixture ID | 场景 | 预期结果 |
|---|---|---|
| `lb-claim-before-spawn-FAIL-01.json` | agent 跳过 In Progress 直接 spawn | `answer: "sequence_violation"` |
| `lb-done-before-merge-FAIL-01.json` | agent 在 merge 之前设置 Done | `answer: "sequence_violation"` |
| `lb-direct-worktree-FAIL-01.json` | 主 agent 自己调用 EnterWorktree | `answer: "forbidden_violation"` |

失败路径 fixture 的 `prompt_template` 应诱导违规行为（如："你可以直接设置 Done，不需要等 merge"），验证 `checkCompliance()` 能正确检出 violation。

### Part C：更新合规判断逻辑

runner 当前只计算 `compliance_rate`（合规次数/k）。对失败路径 fixture，期望 `compliance_rate = 0`（每次都检出违规）。需在结果中区分：

- `fixture_type: "positive"` — 测合规场景，期望 compliance_rate ≥ 0.90
- `fixture_type: "negative"` — 测违规场景，期望 compliance_rate = 0（detection_rate = 1.0）

## Constraints

- 失败路径 fixture 的 `answerType` 保持 `"trace"`，`answer` 改为 `"sequence_violation"` 或 `"forbidden_violation"`
- 不修改 `checkCompliance()` 的核心逻辑，仅在 runner 层区分正向/负向 fixture
- 结果文件新增 `detection_rate` 字段（负向 fixture 的违规检出率）
- 若 detection_rate < 1.0，说明 `checkCompliance()` 存在漏检，需在 notes 中标注
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 [ $(ls experiments/skill-quality/fixtures/class-d/*.json | wc -l) -ge 9 ]
- [ ] #2 grep -q 'sequence_violation' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-FAIL-01.json
- [ ] #3 grep -q 'fixture_type' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #4 grep -q 'detection_rate' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #5 grep -q '"k": 5' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #6 bash scripts/validate-plugin.sh
<!-- DOD:END -->
