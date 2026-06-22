# GCL 语料库：BAIME Gate 事件标注

**状态**：研究基线（TASK-150 Phase 2 输出）
**日期**：2026-06-22
**语料来源**：backlog/tasks/*.md、git log（实际提交历史）、Implementation Notes

---

## 说明

本语料库收录 BAIME backlog 任务历史中的实际 gate 事件，按 GCL 三分量（显性项 E、跨界项 C、隐性项 H）标注。

**Gate 类型**：
- `proposal`：人类审查 proposal 是否 APPROVED
- `plan`：人类审查 plan 是否 APPROVED
- `merge`：人类或 CI 判断 worktree 是否可以 merge 回 main
- `dod-eval`：automated DoD guard 验证 DoD 是否全部通过
- `epic-evaluate`：人类确认 Epic evaluate 输出的 FINISH/ITERATE 建议

**E（显性项）**：DoD 条目数 + Plan Phase 数  
**C（跨界项）**：跨任务引用数 + 跨文档引用数 + 父任务存在标志  
**H（隐性项）**：估算，见各事件说明

---

## Gate 事件表

| # | TASK-ID | Gate 类型 | E | C | H | GCL | 测量方法 | 数据来源 |
|---|---------|-----------|---|---|---|-----|---------|---------|
| 1 | TASK-125 | proposal | 4 | 3 | 2 | 9 | [measured] E=Plan子任务描述项+接受标准,C=TASK-124/TASK-118/TASK-131,H=B″架构约定(未写artifacts) | Notes: cap:propose=approved |
| 2 | TASK-125 | plan | 14 | 3 | 1 | 18 | [measured] E=Plan checkboxes(16 plan items)，精简4,C=同上,H=TASK-124并入决策 | Notes: cap:plan=approved |
| 3 | TASK-125 | epic-evaluate | 7 | 5 | 3 | 15 | [estimated: 负空间+引用追踪] E=7子任务验收信号,C=validate✓config-16✓smoke-terminal✓routing-34/34+parent,H=背景架构不变量 | Notes: cap:evaluate=FINISH |
| 4 | TASK-136 | proposal | 3 | 7 | 1 | 11 | [measured] E=3 proposal goals(背景+目标+方法),C=TASK-134+TASK-135+cross_doc=3,H=实验null结果有效性规则 | Notes: Proposal review APPROVED |
| 5 | TASK-136 | plan | 6 | 7 | 2 | 15 | [measured] E=6 DoD items,C=7,H=TASK-135 baseline timing知识+实验null规则 | Notes: Plan review APPROVED |
| 6 | TASK-136 | merge | 6 | 7 | 1 | 14 | [measured] E=6 DoD items，均通过,C=7,H=merge策略决策(fast-forward vs squash) | git: merge(TASK-136) commit |
| 7 | TASK-137 | proposal | 3 | 5 | 1 | 9 | [measured] E=3 goals,C=TASK-134+TASK-135+cross_doc=2,H=实验质量guard标准 | Notes: Proposal review APPROVED |
| 8 | TASK-137 | plan | 8 | 5 | 2 | 15 | [measured] E=8 DoD items,C=5,H=planLoop iteration count对比baseline的判断标准 | Notes: Plan review APPROVED |
| 9 | TASK-138 | proposal | 4 | 9 | 2 | 15 | [measured] E=3 goals+1接受标准,C=TASK-136+TASK-137+cross_doc=5+has_parent=1,H=Exp-A+B null case处理规则+epic parent策略 | Notes: Proposal review APPROVED |
| 10 | TASK-138 | plan | 9 | 9 | 2 | 20 | [measured] E=9 DoD items,C=9,H=同上 | Notes: Plan review APPROVED |
| 11 | TASK-144 | dod-eval | 2 | 2 | 1 | 5 | [measured] E=2 DoD checkboxes,C=TASK-130+has_parent=1,H=unit test PASS阈值(≥14) | Notes: DoD PASS |
| 12 | TASK-146 | proposal | 5 | 3 | 1 | 9 | [measured] E=3 phases+2 setup/scenario goals,C=TASK-130+TASK-145+has_parent,H=smoke test质量基准 | Notes: cap:propose=approved |
| 13 | TASK-146 | plan | 15 | 3 | 2 | 20 | [measured] E=15 DoD items,C=3,H=smoke test收敛标准+Layer 3测试范围边界 | Notes: Plan review APPROVED |
| 14 | TASK-146 | merge | 15 | 3 | 1 | 19 | [measured] E=15 DoD items,C=3,H=merge策略 | git: merge(TASK-146) commit |
| 15 | TASK-147 | proposal | 5 | 5 | 3 | 13 | [measured] E=4 goals+1接受标准,C=TASK-143+TASK-144+TASK-145+TASK-146+has_parent(0)+cross_doc(0),H=去gate后自治deadlock风险判断+R1 guard范围边界+task-to-backlog豁免规则 | Notes: Proposal approved |
| 16 | TASK-147 | plan | 21 | 5 | 3 | 29 | [measured] E=21 DoD items,C=5,H=同上 | Notes: Plan review APPROVED |
| 17 | TASK-147 | merge | 21 | 5 | 2 | 28 | [measured] E=21 DoD items通过,C=5,H=merge策略+gate removal对下游影响 | git: merge(TASK-147) commit |
| 18 | TASK-149 | proposal | 4 | 1 | 1 | 6 | [measured] E=3 phases+1 goal,C=TASK-146引用,H=Notes字段行为变更的安全范围 | Notes: proposal implied by plan immediately following |
| 19 | TASK-149 | plan | 13 | 1 | 2 | 16 | [measured] E=13 DoD items,C=1,H=--append-notes安全边界+Notes长度可接受性 | Notes: plan inline with proposal |
| 20 | TASK-145 | dod-eval | 2 | 2 | 1 | 5 | [measured] E=2 DoD checkboxes,C=TASK-130+has_parent,H=smoke harness质量基准 | Notes: claimed/Completed |

---

## 事件摘要

**覆盖的 gate 类型**：
- `proposal`：#1, #4, #7, #9, #12, #15, #18（7 个）
- `plan`：#2, #5, #8, #10, #13, #16, #19（7 个）
- `merge`：#6, #14, #17（3 个）
- `dod-eval`：#11, #20（2 个）
- `epic-evaluate`：#3（1 个）

**总计**：20 个 gate 事件，覆盖 5 种 gate 类型，来自 7 个实际 BAIME 任务。

---

## 测量注记

### H（隐性项）估算依据

所有 H 值基于**负空间法 + 引用追踪法**（见 gcl-definition.md §隐性项）：
1. 列出 gate 判断所需的全部前提
2. 从 E 和 C 中识别有 artifact 支撑的前提
3. 剩余作为隐性项

H 值范围：1–3。典型隐性项：
- 系统不变量（"daemon 是单进程"）
- 实验质量判断标准（"null result is valid"，在 Description 中提及但 gate 时未显式引用）
- merge 策略（fast-forward vs squash）：未在任何 artifact 中明确，依赖判断者记忆

所有 H 估算标注 `[estimated: 负空间+引用追踪]`。

### 数据可信度

| 分量 | 可信度 | 理由 |
|------|--------|------|
| E | 高 | 直接从 artifact 计数，可机械复现 |
| C | 高 | 从 artifact 中提取引用，可机械复现 |
| H | 中低 | 人工估算，依赖分析者对系统的理解 |

---

## 关联任务文件路径

- `backlog/tasks/task-125 - Epic-统一-loop-backlog-双泳道-对称-Epic-看板-交互式-epic-to-backlog.md`
- `backlog/tasks/task-136 - 实验-A：finalise-去-agent-化（bash-直接替换）.md`
- `backlog/tasks/task-137 - 实验-B：draftProposal-proposalLoop-合并为单-agent-self-review.md`
- `backlog/tasks/task-138 - 实施：将胜出方案落地-feature-to-backlog-和-epic-to-backlog-SKILL.md.md`
- `backlog/tasks/task-144 - TASK-130-B-Layer-1-unit-tests-for-epic-to-backlog-and-feature-to-backlog-branching-logic.md`
- `backlog/tasks/task-145 - TASK-130-C-Layer-3-run-smoke-test.sh-harness-loop-backlog-smoke-test.md`
- `backlog/tasks/task-146 - TASK-130-D-Layer-3-feature-to-backlog-smoke-test.md`
- `backlog/tasks/task-147 - Remove-human-gates-from-feature-to-backlog-and-epic-to-backlog-upgrade-R1-guard-to-enforce-plan-depth.md`
- `backlog/tasks/task-149 - Improve-loop-backlog-execution-Notes-per-command-DoD-records-and-agent-summary-enforcement.md`
