---
id: TASK-38
title: Exp-B：Haiku Oracle 标定实验（Layer 2.5 前置）
status: "Basic: Done"
assignee: []
created_date: '2026-06-19 08:54'
updated_date: '2026-06-19 10:04'
labels:
  - kind:basic
  - experiment
  - skill-quality
  - layer-2.5
dependencies:
  - TASK-36
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Layer 2.5 Decision Unit Tests（`docs/skill-quality-engineering.md` §5.2）的整个设计依赖 Haiku 能可靠地对 SKILL.md spec section 中的分支决策给出正确判断。当前无实验数据支撑这个假设。本实验在实施 Layer 2.5 之前对 Haiku 的 oracle 能力进行标定，确定哪些决策类型可以自动化、哪些需要人工审查。

## Goals

1. 量化 Haiku 在 BAIME 三类决策任务上的 F1
2. 确定每个类别的置信阈值，指导 Layer 2.5 的覆盖策略
3. 评估 `glm-4.5-flash` 与 Haiku 的一致性（cross-model check，复用 archguard H-model 模式）
4. 对 Class C 使用 `claude-sonnet-4-6` 作为上界，判断 Haiku 是否需要升级

## Experimental Design

**三个决策类别**（来自不同 Operator Skill 的 λ spec 分支）：

### Class A — Binary Gate（task-from-template / freshnessCheck）
与 Exp-A 共用 10 个 fixture，不额外造数据。
`answerType: "exact"`，答案：`FRESH` 或 `STALE`。

### Class B — Invariant Check（task-to-backlog / reviewPlan）
给定一个 Plan 对象，判断是否 APPROVED，并指出违反的哪条不变量。
reviewPlan 的 5 条不变量直接从 λ spec 提取。

8 个 fixture（`fixtures/exp-b/class-b/`）：

| id | 违反不变量 | ground truth |
|---|---|---|
| review-approved-01 | 无 | APPROVED |
| review-approved-02 | 无（复杂合法 plan） | APPROVED |
| review-fail-empty-phases | #1: ¬empty(phases) | NEEDS_REVISION |
| review-fail-no-instructions | #2: ¬empty(phase.instructions) | NEEDS_REVISION |
| review-fail-empty-dod | #3: ¬empty(phase.dod) | NEEDS_REVISION |
| review-fail-nl-dod | #4: isShellCmd（"make tests green"） | NEEDS_REVISION |
| review-fail-no-acceptance | #5: ¬empty(acceptance) | NEEDS_REVISION |
| review-fail-nl-acceptance | #5: isShellCmd（"confirm manually"） | NEEDS_REVISION |

`answerType: "partial"`：verdict 正确得 0.5 分，failing_invariants 每条正确得 0.5/n 分。

### Class C — Branch Selection（loop-backlog / verifyDod）
给定 `(exitCode, attempts_so_far)`，判断走哪条分支。

```
exitCode=0              → checkDod
exitCode≠0, attempts<3  → fix_retry
exitCode≠0, attempts≥3  → raise_Stuck
```

6 个 fixture（`fixtures/exp-b/class-c/`），覆盖所有 3 条分支及边界值（attempts=2 vs 3）。

**运行规模**：24 fixtures × 3 models × k=5 = **360 次调用**
（Class C 额外跑 `claude-sonnet-4-6` 作为上界）

**预注册假设**（在运行前冻结）：

| 假设 | 方向 | 含义 |
|---|---|---|
| H-oracle-A | haiku F1 ≥ 0.85 | binary gate 可用于 CI 自动化 |
| H-oracle-B | haiku F1 ≥ 0.70 | invariant check 可用，需人工审查 |
| H-oracle-C | haiku F1 ≥ 0.80 | branch selection 对 haiku 足够简单 |

若 H-oracle-X 被拒绝，对应类别的 Layer 2.5 fixture 输出 WARNING 而非 FAIL，并在 `docs/skill-quality-engineering.md` §5.2 注明 oracle 不可靠的类别范围。

## Trade-offs

- Class B 的 `answerType: "partial"` 评分比 archguard 实验更复杂；但 failing_invariants 的枚举对 Layer 2.5 的价值远高于纯 verdict
- Class C 的 verifyDod 分支逻辑极简（3 条），若 Haiku 不能处理则 Layer 2.5 整个设计需要重新评估
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Exp-B — Haiku Oracle 标定实验（Layer 2.5 前置）

## Context

验证 Haiku 能否可靠地对 BAIME operator skill 的 λ spec 分支做出正确决策判断，
作为 Layer 2.5 Decision Unit Tests 实施前的必要标定。
依赖 TASK-36（lib/ 就绪）和 TASK-37（fixtures/exp-a/ 已创建，Class A 直接复用）。

## Phase 1: 创建全部 fixtures（Class A 复用、Class B/C 新建）

**Class A**（`fixtures/exp-b/class-a/`，10 个）：
建立到 `fixtures/exp-a/` 的符号链接目录，或直接复制 10 个文件。
Class A 复用相同 fixture 格式，prompt 使用相同 freshnessCheck spec。

**Class B**（`fixtures/exp-b/class-b/`，8 个）：
每个 fixture 评估 `task-to-backlog` 的 `reviewPlan` 不变量，格式：

```json
{
  "id": "review-fail-nl-dod",
  "taskClass": "B",
  "taskType": "invariant-check",
  "specSection": "reviewPlan :: Plan → Verdict\nreviewPlan(P) = {\n  assert: ¬empty(P.phases),\n  ∀phase ∈ P.phases: {\n    assert: ¬empty(phase.instructions),\n    assert: ¬empty(phase.dod),\n    assert: ∀cmd ∈ phase.dod: isShellCmd(cmd)\n  },\n  assert: ¬empty(P.acceptance),\n  assert: ∀cmd ∈ P.acceptance: isShellCmd(cmd),\n  return: APPROVED | NEEDS_REVISION\n}",
  "plan": {
    "phases": [
      {
        "title": "Run tests",
        "instructions": "Execute the test suite and check coverage.",
        "dod": ["make tests green"]
      }
    ],
    "constraints": [],
    "acceptance": ["bash scripts/validate-plugin.sh"]
  },
  "answer": {
    "verdict": "NEEDS_REVISION",
    "failing_invariants": ["isShellCmd(dod[0])"]
  },
  "answerType": "partial"
}
```

8 个 fixture 覆盖所有 5 条 reviewPlan 不变量（含 2 个 APPROVED 正例，6 个 NEEDS_REVISION 反例各违反 1 条）：

| id | 违反不变量 | answer.verdict |
|---|---|---|
| review-approved-01 | 无（简单合法 plan） | APPROVED |
| review-approved-02 | 无（多 phase 合法 plan） | APPROVED |
| review-fail-empty-phases | ¬empty(phases) | NEEDS_REVISION |
| review-fail-no-instructions | ¬empty(phase.instructions) | NEEDS_REVISION |
| review-fail-empty-dod | ¬empty(phase.dod) | NEEDS_REVISION |
| review-fail-nl-dod | isShellCmd(dod item) | NEEDS_REVISION |
| review-fail-no-acceptance | ¬empty(acceptance) | NEEDS_REVISION |
| review-fail-nl-acceptance | isShellCmd(acceptance item) | NEEDS_REVISION |

**Class C**（`fixtures/exp-b/class-c/`，6 个）：
每个 fixture 评估 `loop-backlog` 的 `verifyDod` 分支，格式：

```json
{
  "id": "vdod-stuck-01",
  "taskClass": "C",
  "taskType": "branch-selection",
  "specSection": "verifyDod :: (Task, Int, ShellCmd) → ()\nverifyDod(T, n, cmd) =\n  | eval(cmd).exitCode == 0 → checkDod(T, n)\n  | attempts(n) < 3         → fix(); verifyDod(T, n, cmd)\n  | otherwise               → raise Stuck(n, cmd)",
  "state": {
    "exitCode": 1,
    "attempts_so_far": 3
  },
  "answer": "raise_Stuck",
  "answerType": "exact"
}
```

6 个 fixture 覆盖 3 条分支及关键边界值：

| id | exitCode | attempts | answer |
|---|---|---|---|
| vdod-pass-01 | 0 | 1 | checkDod |
| vdod-pass-02 | 0 | 3 | checkDod |
| vdod-retry-01 | 1 | 1 | fix_retry |
| vdod-retry-02 | 1 | 2 | fix_retry |
| vdod-stuck-01 | 1 | 3 | raise_Stuck |
| vdod-stuck-02 | 1 | 4 | raise_Stuck |

### DoD
- `ls experiments/skill-quality/fixtures/exp-b/class-a/*.json | wc -l | grep -q '10'`
- `ls experiments/skill-quality/fixtures/exp-b/class-b/*.json | wc -l | grep -q '8'`
- `ls experiments/skill-quality/fixtures/exp-b/class-c/*.json | wc -l | grep -q '6'`
- `grep -q '"answerType": "partial"' experiments/skill-quality/fixtures/exp-b/class-b/review-fail-nl-dod.json`
- `grep -q '"answerType": "exact"' experiments/skill-quality/fixtures/exp-b/class-c/vdod-stuck-01.json`
- `grep -q 'specSection' experiments/skill-quality/fixtures/exp-b/class-b/review-approved-01.json`
- `grep -q 'specSection' experiments/skill-quality/fixtures/exp-b/class-c/vdod-pass-01.json`
- `grep -q '"attempts_so_far": 3' experiments/skill-quality/fixtures/exp-b/class-c/vdod-stuck-01.json`

## Phase 2: 预注册假设（运行前冻结）

在任何 LLM 调用之前，写入
`experiments/skill-quality/artifacts/pre-registered-predictions-exp-b.json`：

```json
{
  "frozen_at": "<ISO timestamp>",
  "experiment": "exp-b-oracle-calibration",
  "hypotheses": {
    "H-oracle-A": {
      "model": "claude-haiku-4-5-20251001",
      "taskClass": "A",
      "threshold": 0.85,
      "test": "haiku mean F1 across 10 Class A fixtures ≥ 0.85",
      "verdict": "PENDING"
    },
    "H-oracle-B": {
      "model": "claude-haiku-4-5-20251001",
      "taskClass": "B",
      "threshold": 0.70,
      "test": "haiku mean partial-F1 across 8 Class B fixtures ≥ 0.70",
      "verdict": "PENDING"
    },
    "H-oracle-C": {
      "model": "claude-haiku-4-5-20251001",
      "taskClass": "C",
      "threshold": 0.80,
      "test": "haiku mean F1 across 6 Class C fixtures ≥ 0.80",
      "verdict": "PENDING"
    }
  },
  "models": {
    "primary": "claude-haiku-4-5-20251001",
    "secondary": "glm-4.5-flash",
    "upper_bound": "claude-sonnet-4-6"
  },
  "k": 5,
  "total_calls": 360
}
```

### DoD
- `test -f experiments/skill-quality/artifacts/pre-registered-predictions-exp-b.json`
- `grep -q 'H-oracle-A' experiments/skill-quality/artifacts/pre-registered-predictions-exp-b.json`
- `grep -q 'H-oracle-C' experiments/skill-quality/artifacts/pre-registered-predictions-exp-b.json`
- `grep -q 'frozen_at' experiments/skill-quality/artifacts/pre-registered-predictions-exp-b.json`
- `grep -q 'PENDING' experiments/skill-quality/artifacts/pre-registered-predictions-exp-b.json`

## Phase 3: 实现 scripts/run-exp-b.ts

参照 TASK-37 的 `run-exp-a.ts` 结构，但需处理 3 种不同的 fixture schema：

**Prompt 构建规则（按 taskClass）**：

- **Class A**：与 Exp-A 相同，inject 完整 task-from-template V0（spec-only 变体）+ templateMeta + recentChanges；输出 `{"answer": "FRESH"|"STALE"}`
- **Class B**：inject `specSection` 文本（reviewPlan spec）+ `plan` 对象（JSON 序列化）；输出 `{"verdict": "APPROVED"|"NEEDS_REVISION", "failing_invariants": [...]}`
- **Class C**：inject `specSection` 文本（verifyDod spec）+ `state` 对象；输出 `{"answer": "checkDod"|"fix_retry"|"raise_Stuck"}`

**模型配置**：
- Class A/B：haiku + glm（`thinking:disabled`）
- Class C：haiku + glm + sonnet（上界标定）

**Checkpoint/resume**：结果路径 `artifacts/runs/exp-b/<class>/<model>/<fixture_id>/result.json`，已存在则跳过。

支持命令行参数：
- `--classes A,B,C`（默认全部）
- `--k 5`
- `--fixtures experiments/skill-quality/fixtures/exp-b`
- `--out artifacts/runs/exp-b`

### DoD
- `test -f experiments/skill-quality/scripts/run-exp-b.ts`
- `grep -q 'taskClass' experiments/skill-quality/scripts/run-exp-b.ts`
- `grep -q 'failing_invariants' experiments/skill-quality/scripts/run-exp-b.ts`
- `grep -q 'claude-sonnet' experiments/skill-quality/scripts/run-exp-b.ts`
- `cd experiments/skill-quality && npx tsc --noEmit 2>&1 | grep -qv 'error TS'`

## Phase 4: 执行实验并产出分析报告

**前置条件**：`experiments/skill-quality/.env` 已填写 `LLM_BASE_URL` + `LLM_API_KEY`，
可选填写 `MODEL_UPPER=claude-sonnet-4-6`。

运行实验（约 360 次 API 调用）：

```bash
cd experiments/skill-quality
npx tsx scripts/run-exp-b.ts --k 5
```

实现并运行 `scripts/analyze-exp-b.ts`，计算：
- 每个 (class, model) 的 mean F1（Class B 用 partial scoring）
- H-oracle-A/B/C 各自的 verdict（haiku F1 vs threshold）
- Cross-model 一致性：haiku vs glm 的 Spearman ρ（按 fixture 配对）
- Class C sonnet 上界：haiku 与 sonnet 的差距

**Class B partial scoring 实现**：
```
score = 0
if answer.verdict == groundTruth.verdict: score += 0.5
n = len(groundTruth.failing_invariants)
for item in groundTruth.failing_invariants:
    if item in answer.failing_invariants: score += 0.5 / n
```

输出写入 `experiments/skill-quality/artifacts/analysis/exp-b-results.json`：

```json
{
  "generated": "<ISO timestamp>",
  "class_accuracy": {
    "A": { "haiku": 0.0, "glm": 0.0 },
    "B": { "haiku": 0.0, "glm": 0.0 },
    "C": { "haiku": 0.0, "glm": 0.0, "sonnet": 0.0 }
  },
  "hypotheses": {
    "H-oracle-A": { "verdict": "CONFIRMED|REJECTED", "haiku_f1": 0.0, "threshold": 0.85 },
    "H-oracle-B": { "verdict": "CONFIRMED|REJECTED", "haiku_f1": 0.0, "threshold": 0.70 },
    "H-oracle-C": { "verdict": "CONFIRMED|REJECTED", "haiku_f1": 0.0, "threshold": 0.80 }
  },
  "cross_model_rho": 0.0,
  "layer25_recommendations": {
    "A": "auto-CI|manual-review",
    "B": "auto-CI|manual-review",
    "C": "auto-CI|manual-review"
  }
}
```

`layer25_recommendations` 字段：每个类别若假设被拒绝则填 `"manual-review"`，
并在 `docs/skill-quality-engineering.md` §5.2 补充注释说明该类别 oracle 不可靠。

### DoD
- `ls experiments/skill-quality/artifacts/runs/exp-b/A/ 2>/dev/null | wc -l | grep -qv '^0$'`
- `ls experiments/skill-quality/artifacts/runs/exp-b/C/ 2>/dev/null | wc -l | grep -qv '^0$'`
- `test -f experiments/skill-quality/artifacts/analysis/exp-b-results.json`
- `grep -q 'H-oracle-A' experiments/skill-quality/artifacts/analysis/exp-b-results.json`
- `grep -q 'H-oracle-C' experiments/skill-quality/artifacts/analysis/exp-b-results.json`
- `grep -q 'layer25_recommendations' experiments/skill-quality/artifacts/analysis/exp-b-results.json`
- `grep -qv '"verdict": "PENDING"' experiments/skill-quality/artifacts/analysis/exp-b-results.json`

## Constraints

- Class A fixtures 不重新造数据，直接使用 fixtures/exp-a/ 的文件（复制或 symlink）
- 预注册文件在任何 LLM 调用前写入，之后不修改
- artifacts/runs/ 不提交 git；artifacts/analysis/exp-b-results.json 提交 git
- 若任一 H-oracle-X 被拒绝，必须在 layer25_recommendations 中标注且更新 §5.2 文档
- Class C sonnet 上界是补充数据，不影响 H-oracle-C 的主要 verdict（仍以 haiku 为准）

## Acceptance Gate
- `ls experiments/skill-quality/fixtures/exp-b/class-a/*.json | wc -l | grep -q '10'`
- `ls experiments/skill-quality/fixtures/exp-b/class-b/*.json | wc -l | grep -q '8'`
- `ls experiments/skill-quality/fixtures/exp-b/class-c/*.json | wc -l | grep -q '6'`
- `test -f experiments/skill-quality/artifacts/pre-registered-predictions-exp-b.json`
- `test -f experiments/skill-quality/scripts/run-exp-b.ts`
- `test -f experiments/skill-quality/artifacts/analysis/exp-b-results.json`
- `grep -q 'H-oracle-A' experiments/skill-quality/artifacts/analysis/exp-b-results.json`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## LLM 配置文件

运行前确认 `experiments/skill-quality/.env` 已填写 `LLM_BASE_URL` 和 `LLM_API_KEY`。`env.ts` 自动加载，无需手动 export。

```bash
cd experiments/skill-quality
npm install
npx tsx scripts/run-exp-b.ts   # 读取 .env，输出到 artifacts/runs/exp-b/
```

Class C 的 `claude-sonnet-4-6` 上界对比同样通过 `LLM_BASE_URL` 网关调用，`MODEL_UPPER=claude-sonnet-4-6` 可在 `.env` 中可选设置。

**注意**：`artifacts/runs/` 已加入根 `.gitignore`，运行结果不提交。`artifacts/analysis/` 中的报告文件需提交。

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 ls experiments/skill-quality/fixtures/exp-b/class-a/*.json | wc -l | grep -q '10'
- [ ] #2 ls experiments/skill-quality/fixtures/exp-b/class-b/*.json | wc -l | grep -q '8'
- [ ] #3 ls experiments/skill-quality/fixtures/exp-b/class-c/*.json | wc -l | grep -q '6'
- [ ] #4 test -f experiments/skill-quality/artifacts/pre-registered-predictions-exp-b.json
- [ ] #5 test -f experiments/skill-quality/scripts/run-exp-b.ts
- [ ] #6 test -f experiments/skill-quality/artifacts/analysis/exp-b-results.json
- [ ] #7 grep -q 'H-oracle-A' experiments/skill-quality/artifacts/analysis/exp-b-results.json
- [ ] #8 grep -q 'H-oracle-C' experiments/skill-quality/artifacts/analysis/exp-b-results.json
- [ ] #9 bash scripts/validate-plugin.sh
<!-- DOD:END -->
