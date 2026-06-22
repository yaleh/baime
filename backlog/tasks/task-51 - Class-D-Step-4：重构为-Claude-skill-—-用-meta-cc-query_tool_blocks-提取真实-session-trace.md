---
id: TASK-51
title: >-
  Class D Step 4：重构为 Claude skill — 用 meta-cc query_tool_blocks 提取真实 session
  trace
status: "Basic: Proposal"
assignee: []
created_date: '2026-06-19 15:13'
labels:
  - kind:basic
  - class-d
  - runner
  - skill-quality
  - meta-cc
  - long-term
dependencies:
  - TASK-47
references:
  - experiments/skill-quality/scripts/run-class-d.ts
  - experiments/skill-quality/fixtures/class-d/
  - plugin/skills/
priority: low
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Step 2/3 用 `claude -p --output-format stream-json` 解析 stdout 中的 tool_use 事件，这是一种间接方式。根本限制在于：TypeScript runner 无法直接调用 MCP 工具（`query_tool_blocks`），因此无法获取 Claude Code session 中的完整 tool call trace（包括嵌套调用、子 agent 调用等）。

方案 C 将 runner 重构为 Claude skill：Claude 本身可以调用 `mcp__plugin_meta-cc_meta-cc__query_tool_blocks`，从而获取任意 session 的完整 tool call 历史，包括跨 turn 的调用序列。

## Goal

新建 `plugin/skills/run-class-d/SKILL.md`，实现基于 meta-cc 的 Class D 合规测试 skill。

## Skill 执行流程

### Phase 1: 环境准备
```bash
backlog task create "Class D live test task" --status "Ready" --plain > /tmp/class-d-task.txt
TEST_TASK_ID=$(grep -oP 'TASK-\d+' /tmp/class-d-task.txt | head -1)
```

### Phase 2: 逐 fixture 触发 + 提取 trace

对每个 fixture：
1. 读取 fixture JSON，取 `prompt_template`，替换 `{task_id}` 为 `$TEST_TASK_ID`
2. 用 Bash 调用 `claude -p "<prompt>" 2>&1`，从输出中提取 `session_id`（格式：`Session: <id>` 或 JSON 字段）
3. 调用 MCP 工具：
   ```
   mcp__plugin_meta-cc_meta-cc__query_tool_blocks(session_id=<id>, limit=200)
   ```
4. 对返回的 tool block 列表执行 required_sequence / forbidden_before_step_1 检查（inline JS via `node --eval`）
5. 写入 per-fixture 结果

### Phase 3: 汇总 + 写结果

将所有 fixture 结果汇总，写入 `experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`，`mode: "meta-cc-live"`。

### Phase 4: 清理
```bash
backlog task edit "$TEST_TASK_ID" --status "Done"
```

## 技术前提

- meta-cc session recording 在 `claude -p` 调用期间处于激活状态
- `claude -p` 的输出中包含可提取的 session_id（需先验证 claude CLI 实际输出格式）
- 若 session_id 无法从 stdout 提取，fallback 到 Step 2/3 的 stream-json 方式

## Constraints

- 保留 `run-class-d.ts`（Step 2/3 成果）作为 fallback；新 skill 是增量补充，不是替换
- SKILL.md 合规：需通过 `bash scripts/validate-plugin.sh`
- 不修改 fixture 文件格式
- 若 meta-cc session_id 提取不可行，在 SKILL.md 中文档化限制并提出替代方案
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f plugin/skills/run-class-d/SKILL.md
- [ ] #2 grep -q 'query_tool_blocks' plugin/skills/run-class-d/SKILL.md
- [ ] #3 grep -q 'meta-cc-live' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->
