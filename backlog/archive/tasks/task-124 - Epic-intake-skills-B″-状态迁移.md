---
id: TASK-124
title: 'Epic: intake skills B″ 状态迁移'
status: 'Epic: Proposal'
assignee: []
created_date: '2026-06-21 09:40'
labels:
  - 'kind:epic'
dependencies: []
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Epic 目标
TASK-122 新增的裸状态守卫暴露:3 个任务创建类 skill 仍写入 pre-B″ 裸状态(看板 B″ 列已无这些)。新建/流转的 Basic 任务会落到不存在的列。本 Epic 将其迁移到 Basic:* 命名空间,并把守卫范围扩展到 intake skills 以防回归。

## 范围(已核实,共 13 处 --status 写入)
- feature-to-backlog:7 处(Proposal×2, Plan×2, Backlog, Ready, Needs Human)
- task-to-backlog:5 处(Plan×2, Backlog, Ready, Needs Human)
- task-from-template:1 处(Ready)
- (排除)backlog-setup 的 Proposed/Accepted 是 backlog decision (ADR) 状态,非看板状态,不迁移

## 状态映射
Proposal→Basic: Proposal | Plan→Basic: Plan | Backlog→Basic: Backlog | Ready→Basic: Ready | Needs Human→Basic: Needs Human

## 关键风险(比 TASK-121 复杂)
这些 skill 还含"状态匹配逻辑"(如 feature-to-backlog 的 fromStatus("Plan")=PlanLoop、case 语句、resolveOrCreate 的状态分支)。--status 写入与状态读取/匹配必须同步迁移,否则流转断裂。每个子任务需同时改写 写入 + 匹配,并通过 skill 自身契约(validate-plugin.sh)。

## 拟拆分(decompose 阶段细化为 3 个 Basic)
1. 迁移 feature-to-backlog(7 写入 + fromStatus/case 匹配逻辑)
2. 迁移 task-to-backlog(5 写入 + 状态匹配逻辑)
3. 迁移 task-from-template(1 写入)+ 把 validate-plugin.sh 裸状态守卫的 WORKER_SKILLS 范围扩展到这 3 个 intake skills(锁定防回归)

## 备选设计(propose 阶段需权衡)
proposal-epic-split-board.md Phase E 曾设想把 task-to-backlog/feature-to-backlog 改为 seed-only(只写 cap:propose=approved 后退出,由 basic worker 接管)。那是更大的重构。本 Epic 默认走"最小状态串迁移",但 propose 评审时应决定是否合并到 seed-only 方向。

## 验收信号(Epic)
bash scripts/validate-plugin.sh
intake skills 无裸 --status 写入(守卫扩展后由 validate-plugin.sh 强制)
<!-- SECTION:DESCRIPTION:END -->
