---
id: TASK-32
title: 为 validate-plugin.sh 的 trigger 重叠检测建立语义覆盖补充方案
status: "Basic: Done"
assignee: []
created_date: '2026-06-18 12:53'
updated_date: '2026-06-18 15:58'
labels:
  - kind:basic
  - prompt-quality
  - skill-descriptions
dependencies:
  - TASK-30
priority: medium
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
# Proposal: 为 skill trigger 重叠检测补充语义维度

## Background

TASK-30 的 trigram Jaccard 在 threshold=0.45 下对所有 23 个 skill 对 PASS，说明词法层面没有严重重复。但观察 description 内容可发现以下簇存在语义重叠：

- methodology-bootstrapping / ci-cd-optimization / testing-strategy / build-quality-gates / baseline-quality-assessment：都以"Systematic methodology for [domain] using BAIME"为核心句式，description 里都含有"Validated in X experiments"、"X% transferability"等模式
- feature-to-backlog / task-to-backlog / task-from-template：三者都涉及"创建 backlog task"，但触发条件不同（feature vs non-dev task vs template）
- feature-developer / feature-to-backlog：两者都接受 feature 描述作为输入

现有 Jaccard 检测对前一类（用词不同但句式相同）无效，对后两类（用词相近但边界明确）则可能误报。

## Goals

1. 分析当前 23 个 skill 的 description，在 0.20–0.45 的 Jaccard 区间内找出所有对，人工标注为 TRUE_OVERLAP（用不同词表达相同功能）或 FALSE_POSITIVE（用相近词但触发条件互斥）
2. 对 TRUE_OVERLAP 对，改写其中一个的 description 使其更精确地区分触发场景（例如加入"Do not use when X"短语）
3. 确认改写后在 threshold=0.35 下全部通过（更严格的阈值成为新基线）
4. 在 validate-plugin.sh 中将阈值从 0.45 下调到 0.35

## Non-goals

- 不引入外部 NLP 库或 embedding 服务
- 不修改 skill 的核心 workflow，只改 description 字段

# Plan: 语义重叠分析与 description 改写

## Phase 1: 分析（~1h）

1. 运行 `python3 -c "..."` 计算所有 skill 对在 0.20–0.45 区间内的 Jaccard 分数，输出排名列表
2. 人工阅读每对 description，判断 TRUE_OVERLAP vs FALSE_POSITIVE，记录结论
3. 生成报告：哪些对需要改写，改写建议

## Phase 2: 改写（~30min/pair）

4. 对每个 TRUE_OVERLAP 对，改写描述精确度较低的一方的 description
5. 在每个 description 中增加"Do not use when [条件]"短语区分相似 skill
6. 运行 validate-plugin.sh 验证 PASS

## Phase 3: 阈值收紧（~15min）

7. 将 validate-plugin.sh 中的 OVERLAP_THRESHOLD 从 0.45 改为 0.35
8. 确认全部 PASS
9. 提交

## DoD

- [ ] 所有 Jaccard 在 0.20–0.45 的 skill 对都有人工标注结论
- [ ] 所有 TRUE_OVERLAP 对的 description 已改写
- [ ] `bash scripts/validate-plugin.sh` 在 threshold=0.35 下 PASS
- [ ] OVERLAP_THRESHOLD 常量已从 0.45 改为 0.35
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 所有 Jaccard 在 0.20–0.45 的 skill 对都有人工标注结论
- [ ] #2 所有 TRUE_OVERLAP 对的 description 已改写
- [ ] #3 `bash scripts/validate-plugin.sh` 在 threshold=0.35 下 PASS
- [ ] #4 OVERLAP_THRESHOLD 常量已从 0.45 改为 0.35
<!-- DOD:END -->
