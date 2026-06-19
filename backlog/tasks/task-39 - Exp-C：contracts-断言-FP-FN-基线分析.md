---
id: TASK-39
title: Exp-C：contracts 断言 FP/FN 基线分析
status: Done
assignee: []
created_date: '2026-06-19 08:54'
updated_date: '2026-06-19 10:03'
labels:
  - experiment
  - skill-quality
  - contracts
dependencies: []
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

`validate-plugin.sh` 的 Layer 2 contracts 使用 grep/not-grep 机械断言。这类词法检查必然产生误报（false positive）和漏报（false negative），但当前没有任何数据。FP/FN 率决定了：
- `ignore-if` 豁免机制的优先级（`docs/skill-quality-engineering.md` §4.3）
- Layer 2.5 语义确认环节是否真正必要
- TASK-35（为 5 个无 contracts skill 补充断言）的断言设计策略

本实验是纯回溯分析，不需要 LLM，成本极低，是 Exp-B 的前置参考依据。

## Goals

1. 计算当前 18 个有 contracts 的 skill 的 FP 率（正常 skill 被误报为违规）
2. 计算 FN 率（通过构造对立变体，检测断言是否能发现真实违规）
3. 识别"脆弱断言"（FP 或 FN 率高的单条 contracts 规则）
4. 输出基线报告，为后续断言设计和 Layer 2.5 优先级决策提供依据

## Proposed Approach

### Phase 1：FP 分析（人工标注）

1. 对 18 个有 contracts 的 skill 逐一运行 `bash scripts/validate-plugin.sh`，捕获每条断言的 PASS/FAIL 状态
2. 对每条 FAIL，人工标注：`TRUE_VIOLATION`（spec 里真的缺少该约束）还是 `FALSE_ALARM`（内容等价但措辞不同、或断言过于宽泛）
3. 计算 FP 率 = FALSE_ALARM / total_FAIL

### Phase 2：FN 分析（构造对立变体）

针对每条 contracts 断言，构造一个"违规变体"——删掉或替换被 grep 的关键词，但保留等价的语义逻辑。例如：

```yaml
contracts:
  - grep: "Monitor(persistent=true"
    target: self
```

对立变体：将 `Monitor(persistent=true` 替换为语义等价的描述 `Monitor with persistent flag enabled`，运行断言，检查是否 FAIL（应 FAIL；若 PASS 则为 FN）。

FN 率 = TRUE_PASS_ON_VIOLATION / total_contracts

### Phase 3：输出报告

`experiments/skill-quality/artifacts/analysis/contracts-baseline.json`，包含：
- 每个 skill 的每条断言：状态、标注类型
- 全局 FP 率和 FN 率
- "脆弱断言"列表（FP 或 FN）及改写建议

## Trade-offs

- FN 分析需要为每条断言手工构造对立变体，工作量与 contracts 总数成正比（当前约 35 条）；可以先做高价值的 not-grep 断言
- 人工标注 FP 有主观性，每个 FALSE_ALARM 应记录判断理由，供后续审查
- 本实验结果直接影响 TASK-33（行数软警告阈值）和 TASK-35（新断言设计）的决策
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Exp-C：contracts 断言 FP/FN 基线分析

## Context

`validate-plugin.sh` Layer 2 contracts 使用 grep/not-grep 词法断言，必然产生误报（FP）和漏报（FN），但当前没有任何基线数据。FP/FN 率决定了 `ignore-if` 豁免机制优先级、Layer 2.5 语义确认是否必要，以及 TASK-35 新断言设计策略。本实验是纯回溯分析，不需要 LLM 调用，成本极低。

## Phase 1: FP 分析 — 运行断言并人工标注

1. 列出所有含 `contracts:` 前置数据的 SKILL.md 文件：
   ```bash
   grep -rl '^contracts:' plugin/*/SKILL.md
   ```
2. 对每个 skill 运行 `bash scripts/validate-plugin.sh <skill-dir>`，将输出重定向到 `experiments/skill-quality/artifacts/analysis/fp-raw.txt`（追加模式，每次标注 skill 名）。
3. 解析输出，将每条 FAIL 行记录到 `experiments/skill-quality/artifacts/analysis/fp-annotations.jsonl`，格式：
   ```json
   {"skill":"<name>","assertion":"<grep-pattern>","result":"FAIL","annotation":"TRUE_VIOLATION|FALSE_ALARM","reason":"<one-line>"}
   ```
4. 对每条 FAIL，人工标注 `TRUE_VIOLATION`（内容真正缺失）或 `FALSE_ALARM`（措辞等价、断言过宽），并记录判断理由。
5. 计算 `fp_rate = FALSE_ALARM_count / total_FAIL_count`，写入 `fp-annotations.jsonl` 末尾一行 summary。

### DoD
- [ ] `grep -rl '^contracts:' plugin/*/SKILL.md | wc -l | awk '{if($1>=18) exit 0; else exit 1}'`
- [ ] `test -f experiments/skill-quality/artifacts/analysis/fp-raw.txt`
- [ ] `test -f experiments/skill-quality/artifacts/analysis/fp-annotations.jsonl`
- [ ] `grep -q '"annotation"' experiments/skill-quality/artifacts/analysis/fp-annotations.jsonl`

## Phase 2: FN 分析 — 构造对立变体

1. 从 Phase 1 的 `fp-annotations.jsonl` 提取所有 `grep:` 类型断言的关键词列表。
2. 对每条 `grep:` 断言，在 `/tmp/fn-variants/` 目录下创建对应 skill 的 SKILL.md 临时副本（保留完整文件结构），将被 grep 的关键词删除或替换为语义等价描述（如将 `Monitor(persistent=true` 替换为 `Monitor with persistent flag`）。
3. 对每个临时副本运行 `bash scripts/validate-plugin.sh /tmp/fn-variants/<skill-dir>`，将输出追加到 `experiments/skill-quality/artifacts/analysis/fn-raw.txt`。
4. 解析结果：若断言在违规变体上 PASS（未报错），则记为 FN；若 FAIL，则记为 TP（断言有效捕获违规）。
5. 将结果记录到 `experiments/skill-quality/artifacts/analysis/fn-annotations.jsonl`，格式：
   ```json
   {"skill":"<name>","assertion":"<grep-pattern>","variant_action":"delete|replace","validate_result":"FAIL|PASS","fn":"true|false"}
   ```
6. 计算 `fn_rate = FN_count / total_grep_assertions`。

### DoD
- [ ] `test -f experiments/skill-quality/artifacts/analysis/fn-raw.txt`
- [ ] `test -f experiments/skill-quality/artifacts/analysis/fn-annotations.jsonl`
- [ ] `grep -q '"fn"' experiments/skill-quality/artifacts/analysis/fn-annotations.jsonl`

## Phase 3: 汇总报告

1. 从 `fp-annotations.jsonl` 和 `fn-annotations.jsonl` 汇总数据，识别"脆弱断言"（`FALSE_ALARM` 或 `fn:true` 的断言）。
2. 创建目录（如不存在）：
   ```bash
   mkdir -p experiments/skill-quality/artifacts/analysis
   ```
3. 将以下内容写入 `experiments/skill-quality/artifacts/analysis/contracts-baseline.json`：
   ```json
   {
     "generated_at": "<ISO-8601 timestamp>",
     "total_contracts": <number>,
     "fp_rate": <float 0-1>,
     "fn_rate": <float 0-1>,
     "fragile_assertions": [
       {"skill": "<name>", "assertion": "<pattern>", "issue": "FP|FN", "suggestion": "<rewrite>"}
     ],
     "per_skill": [
       {"skill": "<name>", "assertions": [...], "fp_count": <n>, "fn_count": <n>}
     ]
   }
   ```

### DoD
- [ ] `test -f experiments/skill-quality/artifacts/analysis/contracts-baseline.json`
- [ ] `grep -q 'total_contracts' experiments/skill-quality/artifacts/analysis/contracts-baseline.json`
- [ ] `grep -q 'fp_rate' experiments/skill-quality/artifacts/analysis/contracts-baseline.json`
- [ ] `grep -q 'fn_rate' experiments/skill-quality/artifacts/analysis/contracts-baseline.json`
- [ ] `grep -q 'fragile_assertions' experiments/skill-quality/artifacts/analysis/contracts-baseline.json`

## Constraints

- FN 分析中，对立变体必须保留等价语义（只改 surface form，不改行为逻辑），以确保 FN 标注有效。
- 每条 FALSE_ALARM 标注须附带判断理由（`reason` 字段），以便后续审查主观性。
- 本实验不修改任何 plugin/ 目录下的生产文件；临时副本仅存于 `/tmp/fn-variants/`。
- FN 分析优先覆盖 `grep:` 类型断言；`not-grep:` 类型可作为后续扩展。
- 实验结果直接影响 TASK-33（行数软警告阈值）和 TASK-35（新断言设计）决策，需在报告中明确引用影响项。

## Acceptance Gate
- [ ] `test -f experiments/skill-quality/artifacts/analysis/contracts-baseline.json`
- [ ] `grep -q 'fp_rate' experiments/skill-quality/artifacts/analysis/contracts-baseline.json`
- [ ] `grep -q 'fn_rate' experiments/skill-quality/artifacts/analysis/contracts-baseline.json`
- [ ] `grep -q 'fragile_assertions' experiments/skill-quality/artifacts/analysis/contracts-baseline.json`
- [ ] `grep -q 'total_contracts' experiments/skill-quality/artifacts/analysis/contracts-baseline.json`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## LLM 配置文件

Exp-C 是纯回溯分析，**不调用任何 LLM**，无需填写 `.env`。只依赖：
- `bash scripts/validate-plugin.sh`（现有脚本）
- 人工标注（直接编辑 `artifacts/analysis/contracts-baseline.json`）
- 对立变体构造（手动编辑 SKILL.md 临时副本，运行 validate，还原）

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f experiments/skill-quality/artifacts/analysis/contracts-baseline.json
- [ ] #2 grep -q 'fp_rate' experiments/skill-quality/artifacts/analysis/contracts-baseline.json
- [ ] #3 grep -q 'fn_rate' experiments/skill-quality/artifacts/analysis/contracts-baseline.json
- [ ] #4 grep -q 'fragile_assertions' experiments/skill-quality/artifacts/analysis/contracts-baseline.json
- [ ] #5 grep -q 'total_contracts' experiments/skill-quality/artifacts/analysis/contracts-baseline.json
- [ ] #6 grep -rl '^contracts:' plugin/*/SKILL.md | wc -l | awk '{if($1>=18) exit 0; else exit 1}'
- [ ] #7 test -f experiments/skill-quality/artifacts/analysis/fp-raw.txt
- [ ] #8 test -f experiments/skill-quality/artifacts/analysis/fp-annotations.jsonl
- [ ] #9 grep -q '"annotation"' experiments/skill-quality/artifacts/analysis/fp-annotations.jsonl
- [ ] #10 test -f experiments/skill-quality/artifacts/analysis/fn-raw.txt
- [ ] #11 test -f experiments/skill-quality/artifacts/analysis/fn-annotations.jsonl
- [ ] #12 grep -q '"fn"' experiments/skill-quality/artifacts/analysis/fn-annotations.jsonl
- [ ] #13 test -f experiments/skill-quality/artifacts/analysis/contracts-baseline.json
- [ ] #14 grep -q 'total_contracts' experiments/skill-quality/artifacts/analysis/contracts-baseline.json
- [ ] #15 grep -q 'fp_rate' experiments/skill-quality/artifacts/analysis/contracts-baseline.json
- [ ] #16 grep -q 'fn_rate' experiments/skill-quality/artifacts/analysis/contracts-baseline.json
- [ ] #17 grep -q 'fragile_assertions' experiments/skill-quality/artifacts/analysis/contracts-baseline.json
- [ ] #18 bash scripts/validate-plugin.sh
<!-- DOD:END -->
