---
id: TASK-37
title: Exp-A：task-from-template P3 内容消融实验
status: Basic: Done
assignee: []
created_date: '2026-06-19 08:53'
updated_date: '2026-06-19 09:44'
labels:
  - kind:basic
  - experiment
  - skill-quality
dependencies:
  - TASK-36
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

文档 `docs/skill-quality-engineering.md` §3.1 主张"P3 内容（Implementation 步骤）是主动干扰，不只是零价值噪声"，目前借用的是 archguard granularity 实验的支撑（任务类型为图查询，与 SKILL.md 决策任务不同）。本实验在 BAIME 自己的任务域内验证该假设。

## Goals

1. 量化 `## Implementation` 内容（P3）对模型执行 `freshnessCheck` 决策精度的影响
2. 产出预注册假设 H-P3 的统计检验结果
3. 为 TASK-33 的行数软警告阈值提供数据支撑（"多少行 P3 开始显著劣化"）

## Experimental Design

**语料**：`task-from-template/SKILL.md`，4 个静态变体（存入 `experiments/skill-quality/variants/`）：

| 变体 | 内容 | 预计行数 |
|---|---|---|
| V0 | frontmatter + λ + ## Spec（类型定义 + 函数签名 + 分支逻辑） | ~75 行 |
| V1 | V0 + ## Constraints（底部 8 条 prose 约束） | ~86 行 |
| V2 | V0 + ## Implementation（Step 1–6 bash 代码块） | ~249 行（当前完整文件） |
| V3 | V2 + 150 行额外 P3 噪声（## Background + ## Anti-patterns，插在 ## Spec 前） | ~400 行 |

**Fixture 集合**（`experiments/skill-quality/fixtures/exp-a/`，10 个 JSON）：

测试 `freshnessCheck` 步骤的 FRESH/STALE 二元判断。每个 fixture 包含：模板元数据（slug, lastUsed, applicableWhen）+ 近期 git 变更列表 + ground truth（`FRESH` 或 `STALE`）。

信号强度分布：明显 FRESH ×2，中等 FRESH ×2，弱 FRESH ×1，明显 STALE ×3，中等 STALE ×1，弱 STALE ×1。

Prompt 格式：`"You are executing the freshnessCheck step of task-from-template.\n\n[spec section]\n\n[state]\n\nOutput JSON: {\"answer\": \"FRESH\"} or {\"answer\": \"STALE\", \"reason\": \"...\"}"`

**运行规模**：4 variants × 10 fixtures × 2 models × k=5 = **400 次调用**

**模型**：
- Primary：`claude-haiku-4-5-20251001`
- Secondary：`glm-4.5-flash`（`thinking:disabled`）

**预注册假设**（在运行前冻结）：
- **H-P3**：V0/V1 的 mean F1 显著高于 V2/V3（Friedman 检验，p < 0.05）
- **H-null**（对立）：Implementation 内容对 freshnessCheck 精度无显著影响

**Scoring**：`answerType: "exact"`，提取 `{"answer": ...}` JSON，k=5 取均值 F1。

## Trade-offs

- V3 是刻意构造的极端噪声，现实中 task-from-template 没这么长；但需要一个对照点来确认效应方向
- freshnessCheck 是单步 LLM 决策，测试结果不能直接外推到多步骤 skill（loop-backlog）
- 若 H-P3 不成立，需修正文档 §3.1 的"P3 有害"假设
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Exp-A — task-from-template P3 内容消融实验

## Context

验证 `docs/skill-quality-engineering.md` §3.1 的核心假设：P3 内容（## Implementation 步骤）
是否主动损害模型执行 `freshnessCheck` 决策的精度。
依赖 TASK-36 完成（lib/env.ts、lib/llm-client.ts、lib/score.ts 已就绪）。

## Phase 1: 构建 4 个变体 SKILL.md

读取 `plugin/skills/task-from-template/SKILL.md`，按以下规则切出 4 个静态文件，
写入 `experiments/skill-quality/variants/`：

- **V0** (`task-from-template-v0.md`)：frontmatter（含 contracts）+ `λ(slug)` 行 + `## Spec` 节
  全部内容（到 `## Implementation` 前一行为止）。约 75 行。
- **V1** (`task-from-template-v1.md`)：V0 内容 + `## Constraints` 节（文件末尾 8 条约束列表）。约 86 行。
- **V2** (`task-from-template-v2.md`)：完整 SKILL.md 原文（直接复制）。约 249 行。
- **V3** (`task-from-template-v3.md`)：在 V2 基础上，于 `## Spec` 节**之前**插入约 150 行 P3 噪声：
  一个 `## Background` 节（含虚构的历史使用数据、决策案例描述）
  和一个 `## Anti-patterns` 节（列举 10 条"不要这样做"示例）。约 400 行。

V3 的插入内容与 freshnessCheck 逻辑无关，目的是使 P1 约束在文件中的位置大幅后移。

### DoD
- `test -f experiments/skill-quality/variants/task-from-template-v0.md`
- `test -f experiments/skill-quality/variants/task-from-template-v1.md`
- `test -f experiments/skill-quality/variants/task-from-template-v2.md`
- `test -f experiments/skill-quality/variants/task-from-template-v3.md`
- `grep -q '## Spec' experiments/skill-quality/variants/task-from-template-v0.md`
- `! grep -q '## Implementation' experiments/skill-quality/variants/task-from-template-v0.md`
- `grep -q '## Implementation' experiments/skill-quality/variants/task-from-template-v2.md`
- `grep -q '## Background' experiments/skill-quality/variants/task-from-template-v3.md`
- `[ $(wc -l < experiments/skill-quality/variants/task-from-template-v3.md) -ge 350 ]`

## Phase 2: 创建 10 个 fixture JSON

在 `experiments/skill-quality/fixtures/exp-a/` 下创建 10 个 JSON 文件，
每个文件格式：

```json
{
  "id": "tft-fresh-01",
  "taskClass": "A",
  "taskType": "binary-gate",
  "templateMeta": {
    "slug": "ci-node-setup",
    "lastUsed": "2026-06-18",
    "applicableWhen": "Add Node.js setup step to a CI workflow"
  },
  "recentChanges": [
    "docs: fix typo in README (2026-06-18)"
  ],
  "answer": "FRESH",
  "answerType": "exact"
}
```

10 个 fixture 的信号强度分布（ground truth 括号内）：

| id | 信号 | answer |
|---|---|---|
| tft-fresh-01 | 明显：变更仅为 docs typo，与模板无关 | FRESH |
| tft-fresh-02 | 明显：lastUsed 当天，只有一行 chore 提交 | FRESH |
| tft-fresh-03 | 中等：变更在不相关模块（loop-backlog 内部） | FRESH |
| tft-fresh-04 | 中等：较多提交但模板 entry point（backlog CLI）未动 | FRESH |
| tft-fresh-05 | 弱：临近文件有变更，但 task-from-template 本身未改 | FRESH |
| tft-stale-01 | 明显：git log 显示模板引用的脚本被 rename | STALE |
| tft-stale-02 | 明显：loop-backlog 改为并行执行，模板假设串行流程 | STALE |
| tft-stale-03 | 明显：模板 DoD 命令引用的工具（validate-plugin.sh）被删除 | STALE |
| tft-stale-04 | 中等：多个提交暗示 workflow 重组，非直接命中模板 | STALE |
| tft-stale-05 | 弱：需推断两步影响才能判断为 STALE | STALE |

`recentChanges` 字段填入真实格式的 git log 行（`hash: message (date)`），
不使用占位符。

### DoD
- `ls experiments/skill-quality/fixtures/exp-a/*.json | wc -l | grep -q '10'`
- `grep -q '"answerType": "exact"' experiments/skill-quality/fixtures/exp-a/tft-fresh-01.json`
- `grep -q '"answer": "FRESH"' experiments/skill-quality/fixtures/exp-a/tft-fresh-01.json`
- `grep -q '"answer": "STALE"' experiments/skill-quality/fixtures/exp-a/tft-stale-01.json`
- `grep -q 'templateMeta' experiments/skill-quality/fixtures/exp-a/tft-stale-05.json`

## Phase 3: 预注册假设（运行前冻结）

在任何 LLM 调用之前，写入
`experiments/skill-quality/artifacts/pre-registered-predictions-exp-a.json`：

```json
{
  "frozen_at": "<ISO timestamp>",
  "experiment": "exp-a-p3-ablation",
  "hypotheses": {
    "H-P3": {
      "direction": "V0_V1_mean_f1 > V2_V3_mean_f1",
      "test": "Friedman on per-fixture paired scores across 4 variants",
      "threshold": "p < 0.05",
      "verdict": "PENDING"
    },
    "H-null": {
      "direction": "no significant difference across variants",
      "verdict": "PENDING"
    }
  },
  "models": ["claude-haiku-4-5-20251001", "glm-4.5-flash"],
  "k": 5,
  "total_calls": 400
}
```

`frozen_at` 填写实际时间戳。此文件在运行后**不修改**，只有 `artifacts/analysis/exp-a-results.json` 写入最终 verdict。

### DoD
- `test -f experiments/skill-quality/artifacts/pre-registered-predictions-exp-a.json`
- `grep -q 'H-P3' experiments/skill-quality/artifacts/pre-registered-predictions-exp-a.json`
- `grep -q 'PENDING' experiments/skill-quality/artifacts/pre-registered-predictions-exp-a.json`
- `grep -q 'frozen_at' experiments/skill-quality/artifacts/pre-registered-predictions-exp-a.json`

## Phase 4: 实现 scripts/run-exp-a.ts

在 `experiments/skill-quality/scripts/run-exp-a.ts` 实现实验运行脚本，
参照 archguard format-encoding `scripts/run-tasks.ts` 的结构：

**行为**：
- 从 `lib/env.ts` 加载 LLM 配置（自动读取 `.env`）
- 遍历 4 个变体 × 10 个 fixture × 配置的模型列表 × k=5
- 每次调用构建 prompt：
  ```
  You are executing the freshnessCheck step of task-from-template.

  [variant SKILL.md 的完整文本]

  Template:
    slug: <templateMeta.slug>
    lastUsed: <templateMeta.lastUsed>
    applicableWhen: <templateMeta.applicableWhen>

  Recent git changes since <templateMeta.lastUsed>:
  <recentChanges 列表>

  Based on the freshnessCheck spec above, output ONLY valid JSON:
  {"answer": "FRESH"} or {"answer": "STALE", "reason": "<one line>"}
  ```
- 结果写入 `artifacts/runs/exp-a/<variant>/<model>/<fixture_id>/result.json`
- Checkpoint/resume：若 `result.json` 已存在则跳过该 (variant, model, fixture, k) 组合
- 运行完成后调用 `scripts/score-exp-a.ts`（或在同文件内）输出每 variant 的 mean F1

支持命令行参数：
- `--variants V0,V1,V2,V3`（默认全部）
- `--models claude-haiku-4-5-20251001,glm-4.5-flash`（默认从 env 读）
- `--k 5`
- `--fixtures experiments/skill-quality/fixtures/exp-a`
- `--out artifacts/runs/exp-a`

### DoD
- `test -f experiments/skill-quality/scripts/run-exp-a.ts`
- `grep -q 'createLlmClient' experiments/skill-quality/scripts/run-exp-a.ts`
- `grep -q 'checkpoint' experiments/skill-quality/scripts/run-exp-a.ts || grep -q 'fileExists' experiments/skill-quality/scripts/run-exp-a.ts`
- `grep -q 'freshnessCheck' experiments/skill-quality/scripts/run-exp-a.ts`
- `cd experiments/skill-quality && npx tsc --noEmit 2>&1 | grep -qv 'error TS'`

## Phase 5: 执行实验并产出分析报告

**前置条件**：`experiments/skill-quality/.env` 已填写 `LLM_BASE_URL` + `LLM_API_KEY`。

运行实验（约 400 次 API 调用，支持 checkpoint 断点续跑）：

```bash
cd experiments/skill-quality
npx tsx scripts/run-exp-a.ts --k 5
```

运行完成后，实现并运行 `scripts/analyze-exp-a.ts`，计算：
- 每个 (variant, model) 的 per-fixture F1，以及 mean F1
- 每个 variant 间的配对 F1 差值（用于 Friedman 检验输入）
- H-P3 结论（V0/V1 mean vs V2/V3 mean，及方向）
- 若 n≥5 可用数据点，用 Python subprocess 调用 scipy 做 Friedman 检验；
  否则报告均值对比和效应方向

输出写入 `experiments/skill-quality/artifacts/analysis/exp-a-results.json`：

```json
{
  "generated": "<ISO timestamp>",
  "variant_accuracy": {
    "V0": { "haiku": 0.0, "glm": 0.0 },
    "V1": { "haiku": 0.0, "glm": 0.0 },
    "V2": { "haiku": 0.0, "glm": 0.0 },
    "V3": { "haiku": 0.0, "glm": 0.0 }
  },
  "hypotheses": {
    "H-P3": { "verdict": "CONFIRMED|NULL|INSUFFICIENT_DATA", "p_value": null, "notes": "" },
    "H-null": { "verdict": "CONFIRMED|NULL", "notes": "" }
  },
  "implications": ""
}
```

### DoD
- `ls experiments/skill-quality/artifacts/runs/exp-a/V0/ 2>/dev/null | wc -l | grep -qv '^0$'`
- `ls experiments/skill-quality/artifacts/runs/exp-a/V3/ 2>/dev/null | wc -l | grep -qv '^0$'`
- `test -f experiments/skill-quality/artifacts/analysis/exp-a-results.json`
- `grep -q 'H-P3' experiments/skill-quality/artifacts/analysis/exp-a-results.json`
- `grep -q 'variant_accuracy' experiments/skill-quality/artifacts/analysis/exp-a-results.json`
- `grep -qv '"verdict": "PENDING"' experiments/skill-quality/artifacts/analysis/exp-a-results.json`

## Constraints

- 变体文件是静态 Markdown 文件，不由脚本动态生成；人工核对后提交到 git
- 预注册文件（pre-registered-predictions-exp-a.json）在任何 LLM 调用前写入，之后不修改
- artifacts/runs/ 目录不提交 git（已在根 .gitignore 排除）
- artifacts/analysis/exp-a-results.json 提交 git
- 若 H-P3 为 NULL，必须在 `implications` 字段中说明对 §3.1 文档的修订建议

## Acceptance Gate
- `test -f experiments/skill-quality/variants/task-from-template-v0.md`
- `test -f experiments/skill-quality/variants/task-from-template-v3.md`
- `ls experiments/skill-quality/fixtures/exp-a/*.json | wc -l | grep -q '10'`
- `test -f experiments/skill-quality/artifacts/pre-registered-predictions-exp-a.json`
- `test -f experiments/skill-quality/scripts/run-exp-a.ts`
- `test -f experiments/skill-quality/artifacts/analysis/exp-a-results.json`
- `grep -q 'H-P3' experiments/skill-quality/artifacts/analysis/exp-a-results.json`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## LLM 配置文件

运行前确认 `experiments/skill-quality/.env` 已填写 `LLM_BASE_URL` 和 `LLM_API_KEY`。`env.ts` 自动加载，无需手动 export。

```bash
cd experiments/skill-quality
npm install
npx tsx scripts/run-exp-a.ts   # 读取 .env，输出到 artifacts/runs/exp-a/
```

**注意**：`artifacts/runs/` 已加入根 `.gitignore`，运行结果不提交。`artifacts/analysis/` 中的报告文件需提交。

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f experiments/skill-quality/variants/task-from-template-v0.md
- [ ] #2 test -f experiments/skill-quality/variants/task-from-template-v3.md
- [ ] #3 ls experiments/skill-quality/fixtures/exp-a/*.json | wc -l | grep -q '10'
- [ ] #4 test -f experiments/skill-quality/artifacts/pre-registered-predictions-exp-a.json
- [ ] #5 test -f experiments/skill-quality/scripts/run-exp-a.ts
- [ ] #6 ls experiments/skill-quality/artifacts/runs/exp-a/V0/ 2>/dev/null | wc -l | grep -qv '^0$'
- [ ] #7 test -f experiments/skill-quality/artifacts/analysis/exp-a-results.json
- [ ] #8 grep -q 'H-P3' experiments/skill-quality/artifacts/analysis/exp-a-results.json
- [ ] #9 bash scripts/validate-plugin.sh
<!-- DOD:END -->
