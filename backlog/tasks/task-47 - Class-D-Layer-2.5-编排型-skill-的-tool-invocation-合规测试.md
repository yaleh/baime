---
id: TASK-47
title: 'Class D：为编排型 skill 建立 tool-invocation 合规测试框架'
status: Proposal
assignee: []
created_date: '2026-06-19 15:00'
updated_date: '2026-06-19 15:00'
labels:
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

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #2 grep -q '"taskClass": "D"' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #3 grep -q '"tool-invocation-compliance"' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #4 test -f experiments/skill-quality/scripts/run-class-d.ts
- [ ] #5 grep -q 'query_tool_blocks\|tool_blocks\|tool.*trace' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #6 grep -q '"compliance_rate"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #7 bash scripts/validate-plugin.sh
<!-- DOD:END -->
