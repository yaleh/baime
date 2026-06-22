---
id: TASK-42
title: 将 run-quantitative-experiment 算子化为 Operator Skill
status: "Basic: Done"
assignee: []
created_date: '2026-06-19 12:25'
updated_date: '2026-06-19 13:24'
labels:
  - kind:basic
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
ordinal: 1000
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Context

Exp-A..E 的实验流程（预登记假设 → 构造 fixtures → 多模型 k=5 → 统计裁决 → 写回文档）每次都手工写在 task description 里，缺乏算子化协议约束，是认识论纪律的主要失分点。将此流程封装为 `run-quantitative-experiment` Operator Skill，可为新实验提供统一入口，并通过 contracts 强制执行关键纪律（假设冻结、oracle 标定先于使用、`[measured]/[soft]` 标注）。此外，`iteration-executor` agent 需要一个明确的挂钩点调用外部 oracle，产出硬裁决而非软自评。

## Phase 1: 读取参考文件，理解 SKILL.md 格式与现有合约

读取以下文件，提取 frontmatter 结构、contracts 格式、λ spec 写法：
- `plugin/skills/methodology-bootstrapping/SKILL.md` — 参考 frontmatter + contracts 字段格式
- `plugin/agents/iteration-executor.md` — 理解 λ spec 记法（函数式伪代码风格）
- `docs/baime-and-quantitative-experiments.md` — 读取 §二 Codify 小节，确认 λ 入口签名
- `docs/skill-spec-standard.md`（若存在）— 补充规范

### DoD
- [ ] `test -f /home/yale/work/baime/plugin/skills/methodology-bootstrapping/SKILL.md`
- [ ] `test -f /home/yale/work/baime/plugin/agents/iteration-executor.md`
- [ ] `grep -q "contracts:" /home/yale/work/baime/plugin/skills/methodology-bootstrapping/SKILL.md`

## Phase 2: 创建 Skill 目录与 SKILL.md 骨架

创建目录 `plugin/skills/run-quantitative-experiment/`，写入 SKILL.md，包含：

**frontmatter**（YAML）：
```yaml
---
name: run-quantitative-experiment
description: Run a pre-registered quantitative experiment with held-out fixtures, multi-model k=5 execution, statistical verdict, and evidence write-back. Use when starting a new domain experiment that requires hard verdicts (CONFIRMED/NULL/REJECTED) rather than soft self-assessment.
allowed-tools: Read, Bash, Write, Edit, Grep, Glob
contracts:
  - grep: "hypotheses"
    target: self
  - grep: "CONFIRMED\\|NULL\\|REJECTED"
    target: self
  - grep: "\\[measured\\]"
    target: self
  - grep: "evidence_pointer\\|evidence:"
    target: self
  - not-grep: "V_instance.*0\\.[0-9]"
    target: self
---
```

**正文**必须涵盖：
1. `## λ spec` — `runQuantitativeExperiment(domain, hypotheses, fixtures, models, k) → ExperimentResult` 的完整函数签名与返回类型定义
2. `## contracts` — 与 frontmatter 的 contracts 对应的人类可读说明
3. `## lifecycle` — 五步生命周期（预登记 → fixtures → run → verdict → write-back），每步说明触发条件和产物
4. `## V_meta(experiment) components` — 四个 [measured] 分量（预登记纪律、统计功效、oracle 标定度、混淆控制）及度量方式
5. `## directory layout` — `experiments/<domain>-<NNN>/` 目录树（hypotheses.md、fixtures/、iteration-N.md、results.md、knowledge/）
6. `## integration` — 与 `iteration-executor` 的挂钩点说明（iteration-executor 在 work_execution 阶段调用此 Skill，产出硬裁决替代软 V_instance）
7. `## [measured]/[soft] annotation rules` — 说明何时标 `[measured]`、何时标 `[underpowered]`

### DoD
- [ ] `test -d /home/yale/work/baime/plugin/skills/run-quantitative-experiment`
- [ ] `test -s /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "^name: run-quantitative-experiment" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "## λ spec" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "## contracts" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "## lifecycle" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "## V_meta" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "## directory layout" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "## integration" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "\[measured\]" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "CONFIRMED" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "evidence_pointer" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`

## Phase 3: 在 iteration-executor.md 中添加挂钩注释

在 `plugin/agents/iteration-executor.md` 的 `work_execution` 阶段（`lifecycle_execution` 函数中 `work_execution:` 行）之后，追加注释行，说明当 domain 有外部 oracle 时应调用 `run-quantitative-experiment` skill 产出硬裁决，而非依赖软 `V_instance` 自评。

具体格式（与文件现有 `--` 注释风格一致）：
```
-- hard_verdict: when oracle available, invoke run-quantitative-experiment skill
--   to produce CONFIRMED/NULL/REJECTED instead of soft V_instance.
```

### DoD
- [ ] `grep -q "run-quantitative-experiment" /home/yale/work/baime/plugin/agents/iteration-executor.md`
- [ ] `grep -q "hard_verdict" /home/yale/work/baime/plugin/agents/iteration-executor.md`

## Phase 4: 运行校验脚本

运行项目标准校验，确认新 Skill 通过插件结构和 contracts 完整性检查：
```bash
bash /home/yale/work/baime/scripts/validate-plugin.sh
```

如果校验失败，根据错误信息修复 SKILL.md frontmatter 或 contracts 字段，再重新运行直至通过。

### DoD
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`

## Constraints

- SKILL.md 中所有性能断言（speedup、success rate）必须标 `[soft]` 或引用具体实验 evidence；不得出现裸数字自评（contracts 的 `not-grep` 规则会检测到违规的 `V_instance.*0.[0-9]` 模式）
- 不提供运行时代码（`lib/` 目录留给各实验域自包含），Skill 仅提供协议约束与文档指引
- 不要求现有 Exp-A..E 补齐，Skill 仅约束新实验
- iteration-executor.md 的修改只能是注释追加，不得改动现有 λ spec 逻辑

## Acceptance Gate

- [ ] `test -s /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "^name: run-quantitative-experiment" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "CONFIRMED" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "\[measured\]" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "evidence_pointer" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q "run-quantitative-experiment" /home/yale/work/baime/plugin/agents/iteration-executor.md`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f /home/yale/work/baime/plugin/skills/methodology-bootstrapping/SKILL.md
- [ ] #2 test -f /home/yale/work/baime/plugin/agents/iteration-executor.md
- [ ] #3 grep -q "contracts:" /home/yale/work/baime/plugin/skills/methodology-bootstrapping/SKILL.md
- [ ] #4 test -d /home/yale/work/baime/plugin/skills/run-quantitative-experiment
- [ ] #5 test -s /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #6 grep -q "^name: run-quantitative-experiment" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #7 grep -q "## λ spec" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #8 grep -q "## contracts" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #9 grep -q "## lifecycle" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #10 grep -q "## V_meta" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #11 grep -q "## directory layout" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #12 grep -q "## integration" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #13 grep -q "\[measured\]" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #14 grep -q "CONFIRMED" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #15 grep -q "evidence_pointer" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #16 grep -q "run-quantitative-experiment" /home/yale/work/baime/plugin/agents/iteration-executor.md
- [ ] #17 grep -q "hard_verdict" /home/yale/work/baime/plugin/agents/iteration-executor.md
- [ ] #18 bash /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #19 test -s /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #20 grep -q "^name: run-quantitative-experiment" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #21 grep -q "CONFIRMED" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #22 grep -q "\[measured\]" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #23 grep -q "evidence_pointer" /home/yale/work/baime/plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #24 grep -q "run-quantitative-experiment" /home/yale/work/baime/plugin/agents/iteration-executor.md
- [ ] #25 bash /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #26 bash scripts/validate-plugin.sh
<!-- DOD:END -->
