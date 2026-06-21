---
id: TASK-15
title: 修复 reviewPlan 从 λ 入口不可达的问题
status: Basic: Proposal
assignee: []
created_date: '2026-06-17 16:04'
updated_date: '2026-06-18 02:27'
labels:
  - kind:basic
  - spec-quality
  - feature-to-backlog
  - task-to-backlog
dependencies: []
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 问题

`feature-to-backlog` 和 `task-to-backlog` 中，`reviewPlan` 被单独定义为约束规格，但从 λ 入口的调用链中无法显式追踪到它：

```
λ → featureToBacklog → reviewLoop → review()   ← review() 未定义
                                                  reviewPlan()  ← 孤立，无调用者
```

`reviewLoop` 内部调用的是未定义的 `review(T, doc)`，而 `reviewPlan` 应该是 `review` 在 doc 为 Plan 时的具体实现，但这个分派关系没有在 spec 中表达。

## 建议方向

在 spec 中显式建立 `review → reviewPlan` 的分派关系，或将 `reviewPlan` 改写为 `review` 的一个模式匹配分支：
```haskell
review :: (Task, Doc) → Verdict
review(T, doc) = case doc of
  | Plan     → reviewPlan(T, doc)
  | Proposal → reviewProposal(T, doc)
```
同时补全 `reviewProposal` 的约束（目前完全缺失）。
<!-- SECTION:DESCRIPTION:END -->
