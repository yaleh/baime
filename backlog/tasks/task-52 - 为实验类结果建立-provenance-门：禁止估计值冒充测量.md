---
id: TASK-52
title: 为实验类结果建立 provenance 门：禁止估计值冒充测量
status: Proposal
assignee: []
created_date: '2026-06-19 15:58'
labels:
  - skill-quality
  - experiment-tooling
  - process
dependencies: []
references:
  - experiments/skill-quality/exp-h/run-exp-h.ts
  - experiments/skill-quality/artifacts/analysis/exp-h-results.json
  - docs/skill-quality-experiments-summary.md
priority: high
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Exp-H（TASK-46）曾被标记 Done，但 `exp-h-results.json` 的 `data_source` 是 `analytical`（spec 推断估计，**无任何 LLM API 调用**）。被报告的 σ=0.001 是"把两个新 skill 的准确率都锚定到同一组参考值再算方差"的算术假象，并非真实跨 skill 方差。该任务全部 15 条 DoD 是 `grep -q '"hypothesis"'` 之类的字段存在性检查，无法区分"真跑了"和"手写了一个 JSON"。

已对 exp-h 单点修复：
- runner 的静默 analytical fallback 改为 `throw`（无 result 文件即报错）
- `exp-h-results.json` 增加 `data_source: "measured"` 字段
- TASK-46 DoD 增加 provenance 检查（data_source=measured + 原始 responses 存在）

本任务的目标是把这套 provenance 防护**推广为所有实验类工作的统一机制**，而不是只在 exp-h 上打补丁。

## Goal

让"实验没真正跑测量"在机械门上必然失败，无法被标记完成。

## Scope

1. 所有 experiment runner（exp-a..exp-h 及未来 runner）统一：无原始 result 文件时报错退出（非零码），禁止静默降级到估计；分析输出统一带 `data_source` 枚举字段（`measured | prior-data | estimated`）。
2. `estimated` 数据禁止进入 `hypothesis`/verdict 字段，只能进 `prediction` 字段。
3. 实验任务完成门（loop-backlog 的 DoD 校验 / task 完成路径）：当任务 labels 含 `experiment` 时，强制要求存在 `artifacts/runs/**/result.json`，且 responses 条数 = k × fixture 数，否则拒绝置 Done。
4. 聚合统计 sanity check：σ 之类指标低于最小历史测量噪声一个量级时，输出 `suspiciously-low` 警告（σ=0.001 本应当场触发）。

## Out of Scope

- Fixture 质量与 harness 字段注入问题（另起独立任务）
- OCA 流程文档层面的判据修订（另起独立任务）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 所有 experiment runner 在缺少原始 result 文件时报错退出（非零码），不再静默产出估计结果
- [ ] #2 分析输出 JSON 统一包含 data_source 枚举字段（measured | prior-data | estimated）
- [ ] #3 estimated 来源的数据不会出现在 hypothesis/verdict 字段中（有测试或检查脚本验证）
- [ ] #4 实验类任务（labels 含 experiment）的完成门校验原始 responses 文件存在且条数 = k × fixture 数
- [ ] #5 聚合统计 σ 异常偏低时输出 suspiciously-low 警告
- [ ] #6 更新 docs 记录该 provenance 机制（含为何引入：Exp-H 伪造结果事件）
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 实验 runner 无数据时报错退出有自动化测试覆盖
- [ ] #3 docs/skill-quality-experiments-summary.md 或 docs/skill-quality-engineering.md 记录 provenance 门
<!-- DOD:END -->
