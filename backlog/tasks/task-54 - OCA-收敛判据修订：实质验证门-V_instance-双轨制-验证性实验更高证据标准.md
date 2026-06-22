---
id: TASK-54
title: OCA 收敛判据修订：实质验证门 + V_instance 双轨制 + 验证性实验更高证据标准
status: "Basic: Done"
assignee: []
created_date: '2026-06-19 15:58'
updated_date: '2026-06-19 23:21'
labels:
  - kind:basic
  - skill-quality
  - methodology
  - convergence
  - process
dependencies:
  - TASK-52
  - TASK-53
references:
  - docs/baime-oca-process-refinements.md
  - experiments/skill-quality/artifacts/analysis/exp-g-results.json
  - experiments/skill-quality/artifacts/analysis/exp-h-results.json
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Exp-G（TASK-45）与 Exp-H（TASK-46）暴露了 OCA 流程在方法论层面的三个缺口：

1. **Exp-G 结论**：自评 Accuracy 相对行为准确率**无系统性膨胀**（均值 -5.5pp，loop-backlog 甚至自评低估 15pp），判决 INCONCLUSIVE。建议 OCA 第 5/9 步采用双轨制——VALIDATION-REPORT 同时列出自评 Accuracy 与行为准确率。注意 Exp-G 本身是 prior-data 模式（复用旧测量 + 一个估计值），样本仅 2 个真实点，结论方向可信但需补强。

2. **"Done" 状态可逆性缺口**：TASK-46 一度被标 Done + CONFIRMED，但实验根本没真跑——因为完成门把"文件存在 + validate 通过"等同于"任务完成"。需要区分 `mechanically-passed`（机械门过）与 `substantively-verified`（结论由真实数据支撑），实验/验证类任务的 Done 需要后者。

3. **自我应用盲点**：Exp-G 立项正是为了警惕"代理指标不追踪真实行为"，而验证这个担忧的 Exp-H 自己却用估计代替了测量——BAIME 在自己身上犯了它要研究的错。OCA 需要一条原则：**用来验证测量方法的实验，必须达到比被测对象更高的证据标准，不可自我豁免**。

## Goal

把上述三点固化进 OCA 10 步流程文档与相关 skill 的判据描述，使收敛判据本身抗"代理指标/未测量"漏洞。

## Scope（文档/方法论层面，非工具实现）

1. OCA 第 5/9 步：V_instance 的 Accuracy 分量采纳双轨制（自评 + 行为准确率），且行为分量必须 `data_source: measured`。
2. OCA 流程加入 `mechanically-passed` vs `substantively-verified` 的区分，规定实验/验证类任务 Done 需后者。
3. OCA 收敛判据加入"验证性实验需更高证据标准、不可自我豁免"条款。
4. 更新 docs/baime-oca-process-refinements.md 对应章节，并在 Exp-G/Exp-H 结论段落补注这些流程改动的由来。

## Dependencies / 关系

- 实质验证门的机械落地依赖 provenance 门任务与 fixture/harness 质量任务提供的检查能力；本任务负责方法论判据与文档，那两个任务负责工具强制。

## Out of Scope

- runner / lint / harness 的具体代码实现（见另两个任务）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 OCA 第 5/9 步文档说明 V_instance 采用自评 + 行为准确率双轨制，行为分量须为 measured
- [ ] #2 OCA 流程文档定义 mechanically-passed 与 substantively-verified 的区别，并规定实验/验证类任务 Done 需后者
- [ ] #3 OCA 收敛判据文档加入验证性实验需更高证据标准、不可自我豁免的条款
- [ ] #4 docs/baime-oca-process-refinements.md 在 Exp-G/Exp-H 段落补注流程改动由来
- [ ] #5 若涉及 OCA 相关 skill 的 SKILL.md 判据描述，同步更新
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: OCA 收敛判据修订：实质验证门 + V_instance 双轨制 + 验证性实验更高证据标准

## Context
Exp-G/Exp-H 暴露 OCA 三处方法论缺口：自评 Accuracy 无系统性膨胀但需双轨制报告；Done 状态把"文件存在"等同"任务完成"；验证测量方法的实验自己却用了估计。本任务把三点固化进 OCA 10 步流程文档与相关 skill 判据描述。依赖 TASK-52/53 提供机械强制能力。

## Phase 1: V_instance 双轨制写入第 5/9 步
在 `docs/baime-oca-process-refinements.md` 的 OCA 第 5 步（收敛验证）与第 9 步（验证报告）说明：V_instance 的 Accuracy 分量采用「自评 Accuracy + 行为准确率」双轨制并排报告，且行为分量必须标注 `data_source: measured`。引用 Exp-G 结论（无系统性膨胀，INCONCLUSIVE，建议双轨）。
### DoD
- [ ] `grep -q 'data_source' docs/baime-oca-process-refinements.md`

## Phase 2: 定义 mechanically-passed vs substantively-verified
在流程文档加入两类完成态的定义与区别，并规定：实验/验证类任务的 Done 需 `substantively-verified`（结论由真实测量支撑），不能仅靠 `mechanically-passed`（grep/validate 过）。
### DoD
- [ ] `grep -q 'substantively-verified' docs/baime-oca-process-refinements.md`
- [ ] `grep -q 'mechanically-passed' docs/baime-oca-process-refinements.md`

## Phase 3: 验证性实验更高证据标准条款
在收敛判据章节加入条款：用来验证测量方法本身的实验，须达到比被测对象更高的证据标准，不可自我豁免（不得用估计代替测量）。
### DoD
- [ ] `grep -qE '自我豁免|更高.*证据标准' docs/baime-oca-process-refinements.md`

## Phase 4: 补注由来 + 同步 skill 判据
在 Exp-G/Exp-H 结论段落补注这些流程改动的由来（明确写出 Exp-H 伪造结果与 Class A 误判事件）。检查 OCA 相关 skill（如 loop-backlog、baime-meta 等）的 SKILL.md 是否含 V/收敛判据描述，若有则同步更新；若无需改动，在任务 notes 记录"已核查，无 skill 需同步"。
### DoD
- [ ] `grep -qE '伪造|Class A 误判|由来' docs/baime-oca-process-refinements.md`
- [ ] `grep -q 'substantively-verified' docs/baime-oca-process-refinements.md`

## Constraints
- 本任务为方法论/文档层面，不实现 runner/lint/harness 代码（见 TASK-52、TASK-53）
- 不修改 Exp-G/Exp-H 已记录的结果数值
- 流程条款须可被 TASK-52/53 的机械检查落地，不引入无法验证的判据

## Acceptance Gate
- [ ] `grep -q 'substantively-verified' docs/baime-oca-process-refinements.md`
- [ ] `grep -qE '自我豁免|更高.*证据标准' docs/baime-oca-process-refinements.md`
- [ ] `grep -q 'data_source' docs/baime-oca-process-refinements.md`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
claimed: 2026-06-19T23:17:45Z

Completed: 2026-06-19T23:21:57Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'data_source' docs/baime-oca-process-refinements.md
- [ ] #2 grep -q 'substantively-verified' docs/baime-oca-process-refinements.md
- [ ] #3 grep -q 'mechanically-passed' docs/baime-oca-process-refinements.md
- [ ] #4 grep -qE '自我豁免|更高.*证据标准' docs/baime-oca-process-refinements.md
- [ ] #5 grep -qE '伪造|Class A 误判|由来' docs/baime-oca-process-refinements.md
- [ ] #6 bash scripts/validate-plugin.sh
<!-- DOD:END -->
