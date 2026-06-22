---
id: TASK-47
title: Class D：为编排型 skill 建立 tool-invocation 合规测试框架
status: "Basic: Done"
assignee: []
created_date: '2026-06-19 15:00'
updated_date: '2026-06-19 15:04'
labels:
  - kind:basic
  - experiment
  - skill-quality
  - layer-2.5
  - orchestration
dependencies: []
references:
  - plugin/skills/loop-backlog/SKILL.md
  - docs/skill-quality-engineering.md
  - docs/skill-quality-experiments-summary.md
  - experiments/skill-quality/
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

现有 Layer 2.5 实验框架（Exp-A/B/D/E/F）覆盖了三类 **leaf skill** 的决策质量：

| Class | 决策类型 | 验证方式 |
|---|---|---|
| A | binary-gate（FRESH/STALE） | LLM 输出文本 |
| B | invariant-check（枚举违反项） | LLM 输出文本 |
| C | branch-selection（选分支） | LLM 输出文本 |

这三类测的都是"给 fixture → 验输出文本"。但 loop-backlog 这类 **orchestration skill** 的关键质量问题完全不同：

> 执行 `/loop-backlog` 的 agent 是否真的调用了 `Agent(run_in_background=true, ...)` 并在此之前先执行了 `backlog task edit --status "In Progress"`？

此问题无法通过文本输出验证——需要检查 **tool call trace**（工具调用序列）。这是 Layer 2.5 尚未覆盖的盲区，也是本 session 实测中发现 loop-backlog 跳过"In Progress"状态的根本原因：contracts 通过了（结构型），但行为合规没有被任何测试检验。

## Goals

1. 定义 **Class D**：orchestration skill 的 tool-invocation 合规测试
2. 为 loop-backlog 编写 Class D fixtures，覆盖核心编排协议
3. 实现测试 runner：提取 agent 执行的 tool call trace，对比 fixture 期望
4. 将 Class D 结果纳入 validate-plugin.sh 或独立 CI step

## Class D 测试格式

### Fixture 结构

```json
{
  "id": "lb-claim-before-spawn-01",
  "taskClass": "D",
  "taskType": "tool-invocation-compliance",
  "skill": "loop-backlog",
  "trigger": "task-ready:TASK-99",
  "context": {
    "daemon_log_entry": "task-ready:TASK-99",
    "task_status": "Ready"
  },
  "required_sequence": [
    {
      "step": 1,
      "tool": "Bash",
      "pattern": "backlog task edit TASK-99.*In Progress",
      "label": "claim before spawn"
    },
    {
      "step": 2,
      "tool": "Agent",
      "pattern": "run_in_background.*true",
      "label": "spawn background agent"
    }
  ],
  "forbidden_before_step_1": [
    {"tool": "EnterWorktree", "label": "must not enter worktree before claim"},
    {"tool": "Agent", "label": "must not spawn before claim"}
  ],
  "answer": "sequence_compliant",
  "answerType": "trace"
}
```

### 验证逻辑

1. 触发 agent 执行 skill（通过 meta-cc session recording 或 claude -p）
2. 提取 tool call trace（工具名 + 参数序列）
3. 对每个 `required_sequence` 条目，检查 trace 中是否按顺序出现
4. 对每个 `forbidden_before_step_1`，检查在第 1 步之前是否违规调用

### 需要解决的技术问题

- **Trace 提取**：meta-cc MCP 工具可以提取 session 的 tool call 历史（`query_tool_blocks`）；或使用 claude -p 的 `--output-format json` 获取结构化输出
- **触发机制**：需要真实触发 skill 执行，而非 mock；可以用测试用 task（状态 Ready）+ 触发 daemon 事件
- **k 重复**：与 Class A/B/C 一致，k=5 重复以评估稳定性
- **Oracle**：tool call trace 是确定性的（机器可判断），不需要 LLM 作为 oracle

## Proposed Approach

### Phase 1：定义 fixtures

为 loop-backlog 的核心协议编写 Class D fixtures（最少 6 个）：

- `lb-claim-before-spawn`：In Progress 必须先于 Agent(run_in_background)
- `lb-no-inline-impl`：禁止在主 agent 内直接做 implementation（用 EnterWorktree 替代 Agent spawn）
- `lb-signal-file-wait`：必须等待 `.agent-done-TASK-XX` 再 merge
- `lb-done-after-merge`：Done 状态必须在 merge 成功后设置
- `lb-needs-human-on-failure`：merge 失败 → Needs Human（不是 Done）
- `lb-no-direct-worktree`：主 agent 不得 EnterWorktree（只有 implementation agent 在 worktree 内工作）

### Phase 2：实现 runner

基于 meta-cc `query_tool_blocks` 提取 trace，或使用 `claude -p` JSON 输出，实现 `run-exp-g-class-d.ts`（编号待定）。

### Phase 3：确定阈值和建议

- compliance_rate ≥ 0.90 → auto-CI eligible
- compliance_rate < 0.90 → SKILL.md Critical Protocol 节需要进一步强化

## Trade-offs

- **Trace 提取依赖 meta-cc 或 claude -p**：与 Class A/B/C 不同，Class D 需要 agent 真实执行 skill（不能只做 API 注入）；成本较高但必要
- **非确定性**：agent 执行路径可能因 session 状态不同而略有差异；k=5 重复缓解此问题
- **先决条件**：需要 loop-backlog Critical Protocol 节已存在（已在方向 2 完成），否则 SKILL.md 没有明确的合规规范

## Acceptance Criteria

- Class D fixture 格式定义完毕并文档化
- loop-backlog 有 ≥6 个 Class D fixture
- runner 能提取 tool call trace 并判断 compliance
- 实验结果写入 `experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Class D — 为编排型 skill 建立 tool-invocation 合规测试框架

## Context
现有 Layer 2.5 实验框架仅覆盖 leaf skill 的文本输出验证，无法检测 loop-backlog 等编排型 skill 的工具调用序列合规性。本任务定义 Class D 测试格式、为 loop-backlog 编写 fixtures，并实现 trace-based runner，填补 tool-invocation compliance 这一盲区。

## Phase 1: 定义 Class D Fixture 格式并编写 loop-backlog Fixtures

在 `experiments/skill-quality/fixtures/class-d/` 目录下创建 ≥6 个 JSON fixture 文件，每个文件遵循 Class D schema：`id`, `taskClass: "D"`, `taskType: "tool-invocation-compliance"`, `skill`, `trigger`, `context`, `required_sequence`, `forbidden_before_step_1`, `answer: "sequence_compliant"`, `answerType: "trace"`。

覆盖以下协议点：
- `lb-claim-before-spawn-01.json`：In Progress claim 必须先于 Agent(run_in_background=true)
- `lb-no-inline-impl-01.json`：主 agent 禁止直接在主 context 中做 implementation（需 spawn 子 agent）
- `lb-signal-file-wait-01.json`：必须等待 `.agent-done-TASK-XX` signal file 再 merge
- `lb-done-after-merge-01.json`：Done 状态必须在 merge 成功后设置
- `lb-needs-human-on-failure-01.json`：merge 失败 → Needs Human（不是 Done）
- `lb-no-direct-worktree-01.json`：主 agent 不得 EnterWorktree

### DoD
- [ ] `test -f experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json`
- [ ] `grep -q '"taskClass": "D"' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json`
- [ ] `grep -q '"tool-invocation-compliance"' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json`
- [ ] `[ $(ls experiments/skill-quality/fixtures/class-d/*.json 2>/dev/null | wc -l) -ge 6 ]`

## Phase 2: 实现 Class D Test Runner

创建 `experiments/skill-quality/scripts/run-class-d.ts`。Runner 需要：

1. 读取 `experiments/skill-quality/fixtures/class-d/*.json` 中所有 Class D fixtures
2. 对每个 fixture 触发 skill 执行（使用 `claude -p` 或通过 meta-cc session recording），获取 tool call trace
3. 使用 meta-cc `query_tool_blocks` 提取 tool call 序列（工具名 + 参数）
4. 对 `required_sequence` 中每个步骤验证 trace 中是否按序出现（pattern match）
5. 对 `forbidden_before_step_1` 验证在第 1 步之前不存在违规调用
6. k=5 重复执行，计算 `compliance_rate`
7. 将结果写入 `experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`，格式含 `compliance_rate` 字段

### DoD
- [ ] `test -f experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `grep -q 'query_tool_blocks' experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `grep -q 'required_sequence' experiments/skill-quality/scripts/run-class-d.ts`

## Phase 3: 运行实验并写入结果

执行 runner（`npx ts-node experiments/skill-quality/scripts/run-class-d.ts` 或等效命令），将结果写入 artifacts。结果需包含每个 fixture 的 per-fixture compliance，以及整体 `compliance_rate`。

若 compliance_rate ≥ 0.90，在结果中标注 `"auto_ci_eligible": true`；否则标注改进建议。

### DoD
- [ ] `test -f experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`
- [ ] `grep -q '"compliance_rate"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`
- [ ] `grep -q '"per_fixture"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`

## Constraints

- Runner 不得 mock tool call trace；需要真实触发 agent 执行
- Fixtures 仅覆盖 loop-backlog skill；不扩展到其他 skill（本任务范围）
- 不修改 validate-plugin.sh 的现有逻辑；Class D 结果可以作为独立 CI step
- 不创建 docs/ 文件；输出只写入 experiments/ 目录

## Acceptance Gate
- [ ] `test -f experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json`
- [ ] `grep -q '"taskClass": "D"' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json`
- [ ] `grep -q '"tool-invocation-compliance"' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json`
- [ ] `[ $(ls experiments/skill-quality/fixtures/class-d/*.json 2>/dev/null | wc -l) -ge 6 ]`
- [ ] `test -f experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `grep -q 'query_tool_blocks' experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `grep -q 'required_sequence' experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `test -f experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`
- [ ] `grep -q '"compliance_rate"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`
- [ ] `grep -q '"per_fixture"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: NEEDS_REVISION — two fixes applied: (1) Phase 2 DoD grep pattern `tool.*trace` replaced with `toolBlocks\|required_sequence` (too broad, could match comments); (2) Acceptance Gate was missing the ≥6 fixture count check and `test -f` for the results file — both added.

Plan review iteration 3: APPROVED

claimed: 2026-06-19T14:58:58Z

Completed: 2026-06-19T15:04:33Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #2 grep -q '"taskClass": "D"' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #3 grep -q '"tool-invocation-compliance"' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #4 test -f experiments/skill-quality/scripts/run-class-d.ts
- [ ] #5 grep -q 'query_tool_blocks\|tool_blocks\|tool.*trace' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #6 grep -q '"compliance_rate"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #7 bash scripts/validate-plugin.sh
- [ ] #8 test -f experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #9 grep -q '"taskClass": "D"' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #10 grep -q '"tool-invocation-compliance"' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #11 [ $(ls experiments/skill-quality/fixtures/class-d/*.json 2>/dev/null | wc -l) -ge 6 ]
- [ ] #12 test -f experiments/skill-quality/scripts/run-class-d.ts
- [ ] #13 grep -q 'query_tool_blocks' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #14 grep -q 'required_sequence' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #15 test -f experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #16 grep -q '"compliance_rate"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #17 grep -q '"per_fixture"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #18 test -f experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #19 grep -q '"taskClass": "D"' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #20 grep -q '"tool-invocation-compliance"' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #21 [ $(ls experiments/skill-quality/fixtures/class-d/*.json 2>/dev/null | wc -l) -ge 6 ]
- [ ] #22 test -f experiments/skill-quality/scripts/run-class-d.ts
- [ ] #23 grep -q 'query_tool_blocks' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #24 grep -q 'required_sequence' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #25 test -f experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #26 grep -q '"compliance_rate"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #27 grep -q '"per_fixture"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #28 bash scripts/validate-plugin.sh
- [ ] #29 bash scripts/validate-plugin.sh
<!-- DOD:END -->
