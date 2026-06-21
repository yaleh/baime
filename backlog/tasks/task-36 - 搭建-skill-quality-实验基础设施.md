---
id: TASK-36
title: 搭建 skill-quality 实验基础设施
status: Basic: Done
assignee: []
created_date: '2026-06-19 08:53'
updated_date: '2026-06-19 09:11'
labels:
  - kind:basic
  - experiment
  - infrastructure
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

为执行 Exp-A（P3 消融）和 Exp-B（Oracle 标定）两个 skill 质量实验，需要先搭建与 archguard format-encoding/granularity 实验对齐的 TypeScript 实验基础设施。

## Goals

1. 在 `experiments/skill-quality/` 下建立实验目录结构
2. 认证方案与 archguard env.ts 一致：`LLM_BASE_URL` + `LLM_API_KEY` 环境变量，fail-fast，不写入任何文件
3. LLM 客户端复用 archguard format-encoding `lib/llm-client.ts` 模式（HTTP POST，checkpoint/resume by file）
4. 支持与 archguard 实验相同的模型：`claude-haiku-4-5-20251001`（primary）和 `glm-4.5-flash`（secondary，带 `extra_body:{thinking:{type:"disabled"}}`）
5. fixture 格式与 archguard `tasks.json` 对齐（`id`, `taskClass`, `taskType`, `prompt`, `answer`, `answerType`）
6. scoring 逻辑复用 archguard score.ts 的 `exact` / `set` / `partial` 评分模式，支持 JSON 提取

## Proposed Approach

目录结构：

```
experiments/skill-quality/
  package.json         # tsx + vitest，private: true
  tsconfig.json
  .gitignore           # artifacts/runs/、.env
  lib/
    env.ts             # LLM_BASE_URL + LLM_API_KEY，validateEnv()
    llm-client.ts      # createLlmClient()，与 format-encoding 版本一致
    score.ts           # extractAnswer(), scoreResponse(answer, gt, answerType)
  fixtures/            # Exp-A 和 Exp-B 的 JSON fixture 文件
  variants/            # Exp-A 的 SKILL.md 静态变体文件
  scripts/             # run-exp-a.ts, run-exp-b.ts, analyze.ts
  artifacts/           # .gitignore 排除 runs/；analysis/ 提交报告
```

`lib/env.ts` 额外支持 `MODEL_PRIMARY`（默认 `claude-haiku-4-5-20251001`）和 `MODEL_SECONDARY`（默认 `glm-4.5-flash`），与 archguard 一致。

## Trade-offs

- 直接复用 archguard 的 lib 模式而非抽象共享库：避免跨项目依赖，保持实验自包含
- 不用 Python（archguard 统计分析用 Python/scipy）：统计分析脚本用 TypeScript 实现简单版（均值、排名），如需 Friedman/Wilcoxon 则调用 Python subprocess 或手写
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 搭建 skill-quality 实验基础设施

## Context

TASK-37（Exp-A）和 TASK-38（Exp-B）依赖统一的 TypeScript 实验框架。
该框架与 archguard format-encoding 实验的 lib 层对齐，
支持 dotenv 加载 `.env` 配置、checkpoint/resume、exact/partial 评分。

## Phase 1: 项目脚手架（package.json、tsconfig、目录结构）

从 archguard format-encoding 的 package.json 和 tsconfig.json 为参照，
在 `experiments/skill-quality/` 下创建：
- `package.json`：devDependencies 包含 `tsx`、`vitest`、`dotenv`、`tiktoken`；
  scripts 包含 `test`（vitest run）
- `tsconfig.json`：module ESNext，moduleResolution bundler，strict true
- `.gitignore`：排除 `artifacts/runs/`、`.env`、`node_modules/`
- 空目录占位：`lib/`、`fixtures/`、`variants/`、`scripts/`、
  `artifacts/runs/`、`artifacts/analysis/`

### DoD
- [ ] `test -f experiments/skill-quality/package.json`
- [ ] `grep -q '"tsx"' experiments/skill-quality/package.json`
- [ ] `grep -q '"dotenv"' experiments/skill-quality/package.json`
- [ ] `test -f experiments/skill-quality/tsconfig.json`
- [ ] `test -f experiments/skill-quality/.gitignore && grep -q 'artifacts/runs' experiments/skill-quality/.gitignore`
- [ ] `test -d experiments/skill-quality/lib && test -d experiments/skill-quality/fixtures && test -d experiments/skill-quality/scripts`

## Phase 2: lib/env.ts 和 lib/llm-client.ts

**env.ts** — 按以下优先级加载配置：
1. `process.env` 中已有变量时直接使用（CI 环境）
2. 否则用 `dotenv` 加载 `<repo-root>/experiments/skill-quality/.env`
3. 缺少 `LLM_BASE_URL` 或 `LLM_API_KEY` 时 `validateEnv()` 抛出明确错误

导出：`validateEnv()`、`getLLMBaseUrl()`、`getLLMApiKey()`、
`getModelPrimary()`（默认 `claude-haiku-4-5-20251001`）、
`getModelSecondary()`（默认 `glm-4.5-flash`）

**llm-client.ts** — 与 archguard format-encoding `lib/llm-client.ts` 相同接口：
- `createLlmClient()` 返回 `{ chat(req): Promise<ChatResponse> }`
- POST `${LLM_BASE_URL}/v1/chat/completions`，Bearer token
- 支持 `extra_body`（GLM thinking:disabled 用）
- 超时默认 120s，支持 per-call 覆盖
- 单次自动重试（非 HttpError）

### DoD
- [ ] `test -f experiments/skill-quality/lib/env.ts`
- [ ] `grep -q 'validateEnv' experiments/skill-quality/lib/env.ts`
- [ ] `grep -q 'dotenv' experiments/skill-quality/lib/env.ts`
- [ ] `test -f experiments/skill-quality/lib/llm-client.ts`
- [ ] `grep -q 'createLlmClient' experiments/skill-quality/lib/llm-client.ts`
- [ ] `grep -q 'extra_body' experiments/skill-quality/lib/llm-client.ts`

## Phase 3: lib/score.ts 和冒烟测试

**score.ts** — 评分工具函数：
- `extractAnswer(response: string): unknown` — 从 LLM 回复中提取 `{"answer": ...}` JSON；先尝试直接解析，再尝试 code fence
- `scoreResponse(answer, groundTruth, answerType: 'exact'|'set'|'partial'): number`
  - `exact`：归一化后字符串相等得 1，否则 0
  - `set`：answer 在 groundTruth 数组中得 1，数组完全匹配也得 1
  - `partial`：groundTruth 为 `{verdict, items}`，verdict 正确得 0.5，每个 item 命中得 `0.5/n`

冒烟测试：安装依赖，验证 `validateEnv()` 在缺少环境变量时抛出。

### DoD
- [ ] `test -f experiments/skill-quality/lib/score.ts`
- [ ] `grep -q 'extractAnswer' experiments/skill-quality/lib/score.ts`
- [ ] `grep -q 'scoreResponse' experiments/skill-quality/lib/score.ts`
- [ ] `grep -q "'partial'" experiments/skill-quality/lib/score.ts`
- [ ] `cd experiments/skill-quality && npm install 2>&1 | tail -1 | grep -qv 'error'`
- [ ] `test -f experiments/skill-quality/lib/env.ts && grep -q 'LLM_BASE_URL' experiments/skill-quality/lib/env.ts`

## Constraints

- 不从 archguard 目录直接 copy 文件；以其为参照手写，保持实验目录自包含
- `lib/` 只包含工具函数，不包含任何 fixture 数据或实验逻辑
- `artifacts/runs/` 必须在 `.gitignore` 中，`artifacts/analysis/` 不排除
- 不创建 scripts/run-exp-a.ts 或 scripts/run-exp-b.ts（留给 TASK-37/38）

## Acceptance Gate
- [ ] `test -d experiments/skill-quality`
- [ ] `test -f experiments/skill-quality/lib/env.ts && grep -q 'LLM_BASE_URL' experiments/skill-quality/lib/env.ts`
- [ ] `test -f experiments/skill-quality/lib/llm-client.ts`
- [ ] `test -f experiments/skill-quality/lib/score.ts`
- [ ] `test -f experiments/skill-quality/.gitignore && grep -q 'artifacts/runs' experiments/skill-quality/.gitignore`
- [ ] `grep -q '.env' experiments/skill-quality/.gitignore`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## LLM 配置文件约定

配置文件已创建：`experiments/skill-quality/.env`（已加入根 `.gitignore`，不提交）。

```
LLM_BASE_URL=https://...
LLM_API_KEY=sk-...
# MODEL_PRIMARY=claude-haiku-4-5-20251001   # 可选覆盖
# MODEL_SECONDARY=glm-4.5-flash             # 可选覆盖
```

`lib/env.ts` 实现要求：
1. 优先从 `process.env` 读取（支持 CI 环境通过 shell export 注入）
2. 若未设置，尝试用 `dotenv` 加载 `experiments/skill-quality/.env`
3. 仍缺少时 `validateEnv()` throw，提示用户填写配置文件

因此 `package.json` 需要加入 `dotenv` 依赖（devDependencies）。运行实验时无需手动 export，直接 `npx tsx scripts/run-exp-a.ts` 即可。

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -d experiments/skill-quality
- [ ] #2 test -f experiments/skill-quality/lib/env.ts && grep -q 'LLM_BASE_URL' experiments/skill-quality/lib/env.ts
- [ ] #3 test -f experiments/skill-quality/lib/llm-client.ts
- [ ] #4 test -f experiments/skill-quality/.gitignore && grep -q 'artifacts/runs' experiments/skill-quality/.gitignore
- [ ] #5 grep -q 'LLM_API_KEY' experiments/skill-quality/.gitignore || grep -q '.env' experiments/skill-quality/.gitignore
- [ ] #6 cd experiments/skill-quality && npm install && npx tsx -e 'import { validateEnv } from "./lib/env.js"' 2>&1 | grep -q 'Missing required'
- [ ] #7 bash scripts/validate-plugin.sh
<!-- DOD:END -->
