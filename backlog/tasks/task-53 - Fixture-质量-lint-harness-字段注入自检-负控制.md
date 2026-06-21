---
id: TASK-53
title: Fixture 质量 lint + harness 字段注入自检 + 负控制
status: Basic: Done
assignee: []
created_date: '2026-06-19 15:58'
updated_date: '2026-06-19 23:12'
labels:
  - kind:basic
  - skill-quality
  - experiment-tooling
  - layer-2.5
dependencies: []
references:
  - experiments/skill-quality/exp-h/run-exp-h.ts
  - experiments/skill-quality/fixtures/exp-h/
  - experiments/skill-quality/lib/score.ts
priority: high
ordinal: 1000
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Fixture 质量 lint + harness 字段注入自检 + 负控制

## Context
Exp-H 首次真测 Class A 全 0，根因是 fixture 答案标签不在 spec 词汇中 + harness 把 `state` 字段静默丢弃，差点误判为"阈值不泛化"。本任务用 LLM 调用前的机械检查抓出此类缺陷，并用负控制把 harness 故障与实验结论区分开。

## Phase 1: Fixture lint —— answer 必须在 spec 词汇内
新增 `experiments/skill-quality/scripts/fixture-lint.sh`：遍历 `fixtures/**/*.json`，对 `answerType == "exact"` 的 fixture，断言 `answer` 值（大小写无关）出现在 `specSection` 文本中，或出现在 fixture 显式声明的答案词汇表里；否则 FAIL 并打印 fixture id。
### DoD
- [ ] `test -f experiments/skill-quality/scripts/fixture-lint.sh`
- [ ] `bash experiments/skill-quality/scripts/fixture-lint.sh experiments/skill-quality/fixtures/exp-h`

## Phase 2: Harness 字段注入自检
在 runner 的 prompt 构建路径加入断言：当 fixture 含 `state`/`input`/`plan`/`config` 字段，但所选 prompt builder 未把该字段注入 prompt 文本时，报错退出而非静默丢弃。为该自检写单元测试（构造一个含 state 但 builder 忽略的场景，断言报错）。
### DoD
- [ ] `test -f experiments/skill-quality/scripts/test-harness-injection.sh`
- [ ] `bash experiments/skill-quality/scripts/test-harness-injection.sh`

## Phase 3: 负控制 sanity fixture
实验框架支持在正式 fixture 前运行 1-2 个"答案显然正确"的负控制 sanity fixture；若 sanity 全部失败，判定为 harness 故障并以非零码中止（不输出实验结论）。新增 sanity fixture 目录与对应测试。
### DoD
- [ ] `test -d experiments/skill-quality/fixtures/sanity`
- [ ] `grep -rqi 'sanity\|negative.control' experiments/skill-quality/exp-h/run-exp-h.ts experiments/skill-quality/scripts`

## Phase 4: 回归与坏样本验证
对当前 exp-h 全部 fixture 运行 fixture-lint 通过（回归基线）。再构造一个故意坏 fixture（answer 不在 spec）放入临时路径，断言 lint 能将其判 FAIL。
### DoD
- [ ] `bash experiments/skill-quality/scripts/fixture-lint.sh experiments/skill-quality/fixtures/exp-h`
- [ ] `test -f experiments/skill-quality/scripts/test-fixture-lint.sh`
- [ ] `bash experiments/skill-quality/scripts/test-fixture-lint.sh`

## Phase 5: 文档记录质量门
在 `docs/skill-quality-engineering.md` 记录三道质量门（fixture lint / harness 自检 / 负控制）及其动机（Exp-H Class A 误判事件）。
### DoD
- [ ] `grep -q 'fixture' docs/skill-quality-engineering.md`
- [ ] `grep -qi 'negative control\|负控制\|sanity' docs/skill-quality-engineering.md`

## Constraints
- 检查必须在任何 LLM 调用前可独立运行（纯静态/本地，不需 API）
- 不修改 exp-h 已修复的 fixture 内容（它们是回归基线）
- 结果 provenance（estimated vs measured）防护不在本任务范围（见 TASK-52）
- 不改动 plugin/skills 的运行时行为

## Acceptance Gate
- [ ] `bash experiments/skill-quality/scripts/fixture-lint.sh experiments/skill-quality/fixtures/exp-h`
- [ ] `bash experiments/skill-quality/scripts/test-fixture-lint.sh`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
claimed: 2026-06-19T23:06:22Z

Completed: 2026-06-19T23:12:45Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f experiments/skill-quality/scripts/fixture-lint.sh
- [ ] #2 bash experiments/skill-quality/scripts/fixture-lint.sh experiments/skill-quality/fixtures/exp-h
- [ ] #3 test -f experiments/skill-quality/scripts/test-harness-injection.sh
- [ ] #4 bash experiments/skill-quality/scripts/test-harness-injection.sh
- [ ] #5 test -d experiments/skill-quality/fixtures/sanity
- [ ] #6 grep -rqi 'sanity\|negative.control' experiments/skill-quality/exp-h/run-exp-h.ts experiments/skill-quality/scripts
- [ ] #7 test -f experiments/skill-quality/scripts/test-fixture-lint.sh
- [ ] #8 bash experiments/skill-quality/scripts/test-fixture-lint.sh
- [ ] #9 grep -q 'fixture' docs/skill-quality-engineering.md
- [ ] #10 grep -qi 'negative control\|负控制\|sanity' docs/skill-quality-engineering.md
- [ ] #11 bash scripts/validate-plugin.sh
<!-- DOD:END -->
