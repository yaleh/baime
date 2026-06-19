---
id: TASK-42
title: 将 run-quantitative-experiment 算子化为 Operator Skill
status: Proposal
assignee: []
created_date: '2026-06-19 12:25'
labels:
  - baime
  - experiment
  - skill-quality
  - operator-skill
dependencies: []
references:
  - docs/baime-and-quantitative-experiments.md
  - experiments/skill-quality/
  - plugin/skills/methodology-bootstrapping/SKILL.md
priority: medium
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Exp-A（TASK-37）、Exp-B（TASK-38）、Exp-C（TASK-39）的实验流程每次都手工写在 task description 里：预登记假设 → 构造 fixtures → 多模型 k=5 → 统计裁决 → 写回文档。这个流程完全符合 §2.1 Operator Skill 的定义（窄输入、离散、有可验证 postcondition），但当前没有被算子化。

每次启动新实验时，研究者需要从零重新描述这套流程，并手工决定哪些步骤可以省略——这是认识论纪律的主要失分点（参见 `docs/baime-and-quantitative-experiments.md` §二）。

此外，BAIME 原生的 `iteration-executor` agent 当前只产软分（自评 `V_instance`），缺少与外部 oracle 的挂钩。统一后 executor 应通过此 Skill 调用 oracle，产出硬裁决，才算完成一次迭代。

## Goals

1. 在 `plugin/skills/run-quantitative-experiment/` 创建新 Operator Skill
2. λ spec 覆盖完整的实验生命周期：预登记 → fixtures → 运行 → 裁决 → 回写
3. contracts 断言关键纪律约束（假设冻结、oracle 标定先于使用、`[measured]/[soft]` 标注）
4. 将此 skill 挂钩到 `iteration-executor` 的 Automate 步骤

## Proposed Approach

### λ spec 入口定义

```
runQuantitativeExperiment(
  domain: string,          // 实验域标识（如 "skill-quality"）
  hypotheses: Hypothesis[], // 预登记假设，含阈值，在运行前冻结
  fixtures: FixtureSet,    // held-out fixture 集合，schema 已校验
  models: ModelConfig[],   // 至少 2 个模型（cross-model 一致性）
  k: number                // 每个 fixture 的重复次数（默认 5）
) → ExperimentResult

ExperimentResult = {
  verdicts: HypothesisVerdict[],  // CONFIRMED / NULL / REJECTED
  V_meta_experiment: number,      // 实验本身的元质量分
  evidence_pointer: string        // 回写用的引用键
}
```

### V_meta(experiment) 分量（四项，均为 [measured]）

| 分量 | 度量方式 |
|---|---|
| 预登记纪律 | hypotheses.md 的 git commit 时间早于首次运行时间 |
| 统计功效 | k ≥ 5 且 n ≥ 8（每类 fixture），否则标 [underpowered] |
| oracle 标定度 | oracle model 在被用作裁判前有独立标定实验（如 Exp-B 标定 Haiku） |
| 混淆控制 | 无已知未隔离变量（若有，记入 open_confounds，触发 Evolve） |

### 实验记录布局（与 BAIME Bootstrap 目录对齐）

```
experiments/<domain>-<NNN>/
  hypotheses.md        # 预登记、冻结、带阈值（git commit 早于运行）
  ITERATION-PROMPTS.md # iteration-prompt-designer 产出（可选）
  fixtures/            # held-out，版本受控
  lib/                 # 共享 harness 或指向 experiments/skill-quality/lib/
  iteration-N.md       # 每轮：软观察 + 硬 V 分量，标 [measured]/[soft]
  results.md           # 最终裁决 + V_meta_experiment
  knowledge/           # knowledge-extractor 回写产物
```

### 与 BAIME agent 挂钩

| BAIME agent | 此 Skill 中的对应步骤 |
|---|---|
| `iteration-prompt-designer` | 生成 hypotheses.md + fixtures schema |
| `iteration-executor` | 调用 oracle harness，产出硬裁决（不再是软分） |
| `knowledge-extractor` | 读 evidence_pointer，写回 SKILL.md frontmatter |

### contracts（关键纪律约束）

```yaml
contracts:
  - grep: "hypotheses"
    target: self
  - grep: "CONFIRMED\|NULL\|REJECTED"
    target: self
  - grep: "\\[measured\\]"
    target: self
  - grep: "evidence_pointer\|evidence:"
    target: self
  - not-grep: "V_instance.*0\\.[0-9]"   # 禁止裸数字自评，必须标来源
    target: self
```

## Trade-offs

- **不抽共享库**：`lib/` 仍按实验域自包含，避免跨实验依赖；此 Skill 提供协议约束，不提供运行时代码
- **不强制统计检验**：当 n 较小时允许方向性裁决，但必须在 results.md 中标 `[underpowered: no Friedman]`
- **与现有 Exp-A..E 的关系**：现有实验不需要补齐，新实验从此 Skill 起步；旧实验的 evidence 指针可在 knowledge-extractor 回写时补入
<!-- SECTION:DESCRIPTION:END -->
