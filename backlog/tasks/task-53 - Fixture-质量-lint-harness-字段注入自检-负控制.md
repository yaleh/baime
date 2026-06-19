---
id: TASK-53
title: Fixture 质量 lint + harness 字段注入自检 + 负控制
status: Proposal
assignee: []
created_date: '2026-06-19 15:58'
labels:
  - skill-quality
  - experiment-tooling
  - layer-2.5
dependencies: []
references:
  - experiments/skill-quality/exp-h/run-exp-h.ts
  - experiments/skill-quality/fixtures/exp-h/
  - experiments/skill-quality/lib/score.ts
priority: high
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Exp-H（TASK-46）第一次真实测量时，两个新 skill 的 Class A 准确率全为 0 / 0.333，差点得出"Class A 阈值不跨 skill 泛化"的**错误否定结论**。根因全部是 fixture 与 harness 缺陷，而非被测模型能力：

1. **Fixture 设计缺陷**：ground truth 答案标签（`TASK_ID`、`INIT`、`SEED`）不在 fixture 的 `specSection` 词汇中。模型正确计算了函数输出，但无从猜到这些抽象标签。
2. **Harness bug**：fixture 用 `state` 字段描述环境（如 `backlogDirExists: false`），但 `buildPromptExact` 只注入 `fixture.input`，`state` 被静默丢弃。模型只能从 SKILL.md 上下文瞎猜环境状态。

修复后（答案改为 spec 内分支关键词 + state 注入）Class A 升至 0.867 / 1.0，阈值实际成立。

这暴露出：**fixture/harness 质量是测量结论的未受保护前提**。一个字段被默默丢弃，就能把 harness bug 伪装成"被测对象不合格"。

## Goal

在任何 LLM 调用前，用机械检查抓出 fixture 与 harness 缺陷，并用负控制把 harness 故障与真实实验结论区分开。

## Scope

1. **Fixture lint**（进 validate-plugin.sh 或独立 lint 脚本）：对 `answerType: "exact"` 的 fixture，校验 `answer` 值出现在 `specSection` 文本中，或在 fixture 显式声明的答案词汇表里；否则 FAIL。
2. **Harness 字段注入自检**：当 fixture 含 `state`/`input`/`plan`/`config` 等字段，但对应 prompt builder 未注入该字段时报错——禁止字段被静默丢弃。
3. **负控制（negative control）**：每个实验在正式 fixture 前先跑 1-2 个"答案显然正确"的 sanity fixture；若 sanity fixture 都失败，判定为 harness 故障并中止，避免把 harness bug 误读为实验结论。

## Out of Scope

- 结果 provenance（estimated vs measured）防护，另起独立任务
- OCA 流程文档判据修订，另起独立任务
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 fixture lint 校验 exact 型 fixture 的 answer 出现在 specSection 或显式答案词汇表中，否则报错
- [ ] #2 prompt builder 在 fixture 含未注入字段（state/input/plan/config）时报错而非静默丢弃
- [ ] #3 实验框架支持负控制 sanity fixture，sanity 全挂时判 harness 故障并中止
- [ ] #4 lint/自检对当前 exp-h fixture 全部通过（回归基线）
- [ ] #5 用一个故意构造的坏 fixture（answer 不在 spec）验证 lint 能抓出
- [ ] #6 更新 docs 记录这些质量门及其动机（Exp-H Class A 误判事件）
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 fixture lint 与 harness 自检有自动化测试覆盖
- [ ] #3 故意坏 fixture 能被 lint 捕获的测试存在
<!-- DOD:END -->
