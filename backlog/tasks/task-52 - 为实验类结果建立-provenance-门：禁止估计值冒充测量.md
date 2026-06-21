---
id: TASK-52
title: 为实验类结果建立 provenance 门：禁止估计值冒充测量
status: Basic: Done
assignee: []
created_date: '2026-06-19 15:58'
updated_date: '2026-06-19 17:19'
labels:
  - kind:basic
  - skill-quality
  - experiment-tooling
  - process
dependencies: []
references:
  - experiments/skill-quality/exp-h/run-exp-h.ts
  - experiments/skill-quality/artifacts/analysis/exp-h-results.json
  - docs/skill-quality-experiments-summary.md
priority: high
ordinal: 1000
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 为实验类结果建立 provenance 门：禁止估计值冒充测量

## Context
Exp-H 曾被标 Done，但结果是 analytical 估计（无 API 调用），σ=0.001 是共享锚点假象，且全部 DoD 是字段存在性 grep，无法区分真跑与手写 JSON。本任务把已在 exp-h 单点修复的 provenance 防护推广为所有实验类工作的统一机制。

## Phase 1: 统一 runner 无数据时的硬失败
审计 `experiments/skill-quality/` 下所有 runner（exp-a..exp-h 的 `run-*.ts` 及 lib 中的评分入口），将"缺少原始 result 文件时静默降级为估计/0 分"的分支统一改为报错退出（非零码）。新增测试脚本 `experiments/skill-quality/scripts/test-provenance-guard.sh`：在无 result 文件的临时目录上调用分析路径，断言进程**非零退出**（直接验证硬失败行为，而非源码字符串）。该测试同时覆盖至少一个被审计的 runner。
### DoD
- [ ] `test -f experiments/skill-quality/scripts/test-provenance-guard.sh`
- [ ] `bash experiments/skill-quality/scripts/test-provenance-guard.sh`

## Phase 2: 分析输出统一带 data_source 枚举（含回填现有结果）
所有分析输出 JSON 增加 `data_source` 字段，取值限定 `measured | prior-data | estimated`。**先**为现有 `artifacts/analysis/*-results.json`（exp-a/b/d/e/f/g、class-d 等）按实际来源回填正确的 `data_source`（真实 LLM 测量=measured，复用旧测量=prior-data），**再**交付校验脚本 `experiments/skill-quality/scripts/check-provenance.sh`：无参时遍历 `artifacts/analysis/*-results.json`，任一文件缺 `data_source` 或取值非法即非零退出。
### DoD
- [ ] `test -f experiments/skill-quality/scripts/check-provenance.sh`
- [ ] `bash experiments/skill-quality/scripts/check-provenance.sh`
- [ ] `for f in experiments/skill-quality/artifacts/analysis/*-results.json; do grep -q '"data_source"' "$f" || exit 1; done`

## Phase 3: estimated 数据禁入 hypothesis 字段
为 `check-provenance.sh` 增加规则：当单个结果文件 `data_source == "estimated"` 时，不得含顶层 `hypothesis`/`verdict` 字段（估计只能写入 `prediction`）。本 phase 创建一个坏样本 `experiments/skill-quality/scripts/fixtures/bad-estimated-hypothesis.json`（estimated + hypothesis），并让 `check-provenance.sh` 接受单文件入参；通过断言脚本对坏样本**非零退出**来验证规则真的生效。
### DoD
- [ ] `test -f experiments/skill-quality/scripts/fixtures/bad-estimated-hypothesis.json`
- [ ] `! bash experiments/skill-quality/scripts/check-provenance.sh experiments/skill-quality/scripts/fixtures/bad-estimated-hypothesis.json`

## Phase 4: 实验任务完成门校验原始 responses
新增 `experiments/skill-quality/scripts/check-run-completeness.sh <runs-dir>`：遍历 runs 目录下每个 skill 子目录的 `*/result.json`，从各 `result.json` 的 `responses` 数组长度推断 k（断言同一实验内所有 fixture 的 responses 长度一致即为 k），并断言 fixture 数 ≥ 1、每个 result.json 的 responses 非空；任一不满足即非零退出。k 不依赖结果 JSON 顶层字段（exp-h-results.json 无 k 字段），仅从 run 产物推断。对 exp-h 现有产物运行通过。
### DoD
- [ ] `test -f experiments/skill-quality/scripts/check-run-completeness.sh`
- [ ] `bash experiments/skill-quality/scripts/check-run-completeness.sh experiments/skill-quality/artifacts/runs/exp-h`

## Phase 5: 聚合统计 suspiciously-low 警告
在 runner 的方差/聚合计算处增加 sanity check：σ 低于设定下界（如 0.005）时在输出 JSON 中标记 `suspiciously_low: true` 并打印警告。为该逻辑写单元测试（构造一组近乎相同的输入，断言标记为真）。
### DoD
- [ ] `grep -qi 'suspiciously' experiments/skill-quality/exp-h/run-exp-h.ts`
- [ ] `test -f experiments/skill-quality/scripts/test-suspicious-sigma.sh`
- [ ] `bash experiments/skill-quality/scripts/test-suspicious-sigma.sh`

## Phase 6: 文档记录 provenance 门
在 `docs/skill-quality-engineering.md` 记录 provenance 门机制、三种 data_source 含义、以及引入动机（Exp-H 伪造结果事件）。
### DoD
- [ ] `grep -q 'provenance' docs/skill-quality-engineering.md`
- [ ] `grep -q 'data_source' docs/skill-quality-engineering.md`

## Constraints
- 不修改已有真实测量结果的数值（exp-a..exp-h 的 measured 数据保持不变；仅回填 data_source 字段）
- 不引入对外网络依赖；测试脚本不得真实调用 LLM API
- 仅在 experiments/skill-quality/ 范围内改动 runner/脚本，不触碰 plugin/skills 行为
- Fixture 质量与 harness 字段注入问题不在本任务范围（见 TASK-53）

## Acceptance Gate
- [ ] `bash experiments/skill-quality/scripts/check-provenance.sh`
- [ ] `bash experiments/skill-quality/scripts/test-provenance-guard.sh`
- [ ] `bash experiments/skill-quality/scripts/check-run-completeness.sh experiments/skill-quality/artifacts/runs/exp-h`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
claimed: 2026-06-19T17:12:18Z

Completed: 2026-06-19T17:19:08Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f experiments/skill-quality/scripts/test-provenance-guard.sh
- [ ] #2 bash experiments/skill-quality/scripts/test-provenance-guard.sh
- [ ] #3 test -f experiments/skill-quality/scripts/check-provenance.sh
- [ ] #4 bash experiments/skill-quality/scripts/check-provenance.sh
- [ ] #5 for f in experiments/skill-quality/artifacts/analysis/*-results.json; do grep -q '"data_source"' "$f" || exit 1; done
- [ ] #6 test -f experiments/skill-quality/scripts/fixtures/bad-estimated-hypothesis.json
- [ ] #7 ! bash experiments/skill-quality/scripts/check-provenance.sh experiments/skill-quality/scripts/fixtures/bad-estimated-hypothesis.json
- [ ] #8 test -f experiments/skill-quality/scripts/check-run-completeness.sh
- [ ] #9 bash experiments/skill-quality/scripts/check-run-completeness.sh experiments/skill-quality/artifacts/runs/exp-h
- [ ] #10 grep -qi 'suspiciously' experiments/skill-quality/exp-h/run-exp-h.ts
- [ ] #11 test -f experiments/skill-quality/scripts/test-suspicious-sigma.sh
- [ ] #12 bash experiments/skill-quality/scripts/test-suspicious-sigma.sh
- [ ] #13 grep -q 'provenance' docs/skill-quality-engineering.md
- [ ] #14 grep -q 'data_source' docs/skill-quality-engineering.md
- [ ] #15 bash scripts/validate-plugin.sh
<!-- DOD:END -->
