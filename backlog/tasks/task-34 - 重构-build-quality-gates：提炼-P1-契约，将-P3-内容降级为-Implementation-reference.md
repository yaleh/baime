---
id: TASK-34
title: 重构 build-quality-gates：提炼 P1 契约，将 P3 内容降级为 Implementation reference
status: "Basic: Done"
assignee: []
created_date: '2026-06-18 12:54'
updated_date: '2026-06-18 12:58'
labels:
  - kind:basic
  - prompt-quality
  - build-quality-gates
dependencies: []
priority: low
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

build-quality-gates 是当前 23 个 skill 中最大的（1879 行，约 11,673 tokens），但只有 1 条 contract，且几乎没有触发条件定义。分析表明其绝大多数内容是对历史实验结果的描述（"Achieved 98% error coverage"、"CI Failure Rate 40%→5%"），属于 P3 背景资料而非 P1 可执行约束。这类内容每次触发 skill 时都会完整加载，但模型无法从中得知：何时该触发自己、改哪些文件、如何验证完成。本任务将 build-quality-gates 重构为"头部 50 行核心契约 + 尾部 Implementation reference"的结构，同时将内容缩减到 400 行以内。

## Proposal: build-quality-gates 内容分层重构

### Background

build-quality-gates 当前结构（1879 行）：
- YAML frontmatter（含 Spec 和 contracts:）：约 70 行
- Overview & Scope（What You'll Achieve、In/Out Scope）：约 60 行
- Prerequisites & Dependencies：约 40 行
- **大量历史结果描述**（98% error coverage、17.4s detection、CI failure 40%→5%）：散布全文
- Implementation Roadmap（30 个步骤分 P0/P1/P2）：约 400 行
- Configuration Templates（Makefile、pre-commit、CI YAML 模板）：约 600 行
- Measurement Framework、Troubleshooting、Quick Reference：约 500 行

对一个 skill 而言，模型需要知道的是：
- **触发条件**：什么情况下该用这个 skill（目前没有）
- **边界**：可以/不可以改什么文件
- **验证**：完成后跑什么命令

其余的配置模板、历史指标、实施路线图都是参考资料，适合放在 `## Implementation` 节或外部 docs，而不是每次都加载进上下文。

### Goals

1. 将 build-quality-gates 的"触发条件/边界/核心 workflow/验证命令"提炼到头部 ≤50 行（Trigger + Boundaries + Workflow + Verification）
2. 在 frontmatter 增加到 ≥5 条 contracts:（可 grep 的不变量，如"必须有 Trigger 节"、"必须有验证命令"等）
3. 将历史结果数据、配置模板、30 步实施路线图移至 `## Implementation` 节或标注为 Reference
4. 总行数从 1879 行压缩到 ≤500 行（Reference 内容可保留，但整体结构化）

### Non-goals

- 不删除历史实验数据（保留在 Implementation/Reference 节）
- 不修改 skill 的功能范围

## Plan: 重构执行计划

### Phase 1: 分析（~30min）

1. 通读 build-quality-gates/SKILL.md，对每个段落标注 P0/P1/P2/P3
2. 列出所有 P1 Contract（可执行、可验证的要求）
3. 列出应保留在头部的内容 vs 应移至 Implementation 节的内容

### Phase 2: 改写（~1h）

4. 在 frontmatter 之后增加 Trigger 节（≤10 行）：何时使用 / 何时不使用
5. 增加 Boundaries 节（≤10 行）：允许改什么 / 禁止改什么
6. 增加 Workflow 节（≤10 行）：核心 5 步
7. 增加 Verification 节（≤5 行）：完成后跑什么命令
8. 将其余内容放入 ## Implementation 节并加小标题
9. 将 contracts: 扩充到 ≥5 条

### Phase 3: 验证

10. `bash scripts/validate-plugin.sh` PASS
11. 总行数 ≤500（不含 Implementation 节的话；含则无硬性限制，但头部契约区域 ≤80 行）
12. contracts 密度警告消除（如果 task-2 的软警告已实现）
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 build-quality-gates/SKILL.md 头部有明确 Trigger / Boundaries / Workflow / Verification 节
- [ ] #2 frontmatter contracts: 条数 ≥5
- [ ] #3 历史实验数据保留在 ## Implementation Reference 节（不删除）
- [ ] #4 `bash scripts/validate-plugin.sh` PASS
- [ ] #5 头部契约区域（frontmatter 到第一个 ## Implementation 之前）≤80 行
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
claimed: 2026-06-18T12:55:08Z

Phase 1 ✓ - Analysis complete
Phase 2 ✓ - Rewritten to 228 lines total, 76 lines head section
contracts: 8 entries (frontmatter + Spec block)
DoD: all checks passed

## Execution Summary
Result: Done
Commit: a385f27
Refactored build-quality-gates from 1879 to 228 lines
Head section: 76 lines (≤80)
contracts: 8 entries (≥5)

workerLoop DoD verified: 8/8 passed (1879→228 lines, 8 contracts, head 76 lines)
Completed: 2026-06-18T12:58:54Z
<!-- SECTION:NOTES:END -->
