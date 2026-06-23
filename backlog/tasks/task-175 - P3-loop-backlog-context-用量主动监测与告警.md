---
id: TASK-175
title: 'P3: loop-backlog context 用量主动监测与告警'
status: 'Basic: Proposal'
assignee: []
created_date: '2026-06-23 14:49'
labels:
  - 'kind:basic'
  - 'priority:p3'
  - 'component:loop-backlog'
dependencies:
  - TASK-170
references:
  - plugin/skills/loop-backlog/SKILL.md
  - docs/adr/ADR-003-monitor-prompt-self-contained.md
priority: low
ordinal: 113000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Loop 目前被动等待 context 耗尽后靠摘要恢复，摘要重建状态不可靠。48h 内多次出现"This session is being continued..."接续摘要，每次接续都依赖 LLM 正确重建 Monitor 状态。

改进方向：
1. loop-backlog 在每次 worker 循环开始时，通过 meta-cc 或其他手段估算当前 context 使用量
2. 当 context 使用量超过阈值（如 80%）时，主动向用户输出告警：建议在当前 task 完成后执行 /clear 并重启 loop
3. 评估是否可以在 Monitor prompt 中注入 context 使用量作为感知依据
4. 该功能依赖 TASK-170（P0 context 解耦）的方向决策，建议在 TASK-170 设计完成后再实施
<!-- SECTION:DESCRIPTION:END -->
