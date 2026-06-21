---
id: TASK-126
title: 清理 meta-task-to-backlog 死技能并更新 backlog-setup B″ 列配置
status: 'Basic: Backlog'
assignee: []
created_date: '2026-06-21 11:21'
updated_date: '2026-06-21 11:49'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
两项清理工作：

1. **删除 meta-task-to-backlog 死技能**：该技能存在于 `.claude/skills/meta-task-to-backlog/`（真实目录，非 plugin/skills/ 下的 symlink），硬引用已退役的 Meta-Plan、Meta-Proposal 状态和 loop-meta worker（均在 TASK-125 中删除）。直接删除该目录即可；不影响 validate-plugin.sh 的 EXPECTED_SKILLS 计数（该脚本只扫描 plugin/skills/）。

2. **更新 backlog-setup REQUIRED_COLUMNS**：当前 SKILL.md 中 REQUIRED_COLUMNS 仅有 7 个通用列（Proposal/Plan/Backlog/Ready/In Progress/Done/Needs Human），与 B″ 重构（TASK-125）后的 16 列双泳道板不符。在新环境运行 /backlog-setup 会生成错误 config.yml。需将 spec 和实现两处的列列表替换为完整 16 列 B″ 集合（Epic: Proposal … Basic: Needs Human），并更新 description。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: 清理 meta-task-to-backlog 死技能并更新 backlog-setup B″ 列配置

## Background

TASK-125 完成了 B″ 重构，将 loop-meta 工作流（Meta-Proposal、Meta-Plan 状态及 loop-meta worker）整体退役，切换为统一的 loop-backlog 双泳道架构（Epic/Basic 16 列）。该重构完成后，两处遗留物仍指向已退役的概念：

1. `.claude/skills/meta-task-to-backlog/` 是一个真实目录（非 plugin/skills/ 下的 symlink），其 SKILL.md 在 description、spec 和实现三处均硬引用了 Meta-Proposal 状态、Meta-Plan 状态以及 loop-meta worker 作为下游消费者。这些状态和 worker 在当前代码库中均不再存在，使该技能在语义上完全失效，且会在 validate-plugin.sh 的 symlink 一致性检查中产生 FAIL（脚本对 .claude/skills/ 下的真实目录报错）。

2. `plugin/skills/backlog-setup/SKILL.md` 中的 REQUIRED_COLUMNS 仅包含 7 个旧列（Proposal、Plan、Backlog、Ready、In Progress、Done、Needs Human），与 backlog/config.yml 已写入的 16 列 B″ 集合不符。在新环境中运行 /backlog-setup 会将 config.yml 中的 statuses 覆写回旧的 7 列，破坏双泳道看板。

## Goals

1. `.claude/skills/meta-task-to-backlog/` 目录被完全删除，`ls .claude/skills/meta-task-to-backlog/` 返回"No such file or directory"。
2. `validate-plugin.sh` 的 `.claude/skills` symlink 一致性检查不再产生关于 meta-task-to-backlog 的 FAIL 项。
3. `plugin/skills/backlog-setup/SKILL.md` 中的 REQUIRED_COLUMNS 列表（Spec 和 Implementation 两处）均替换为完整 16 列 B″ 集合：Epic: Proposal、Epic: Plan、Epic: Backlog、Epic: Ready、Epic: Decomposing、Epic: Awaiting Children、Epic: Evaluating、Epic: Done、Epic: Needs Human、Basic: Proposal、Basic: Plan、Basic: Backlog、Basic: Ready、Basic: In Progress、Basic: Done、Basic: Needs Human。
4. 在全新环境中运行 /backlog-setup 后，backlog/config.yml 的 statuses 字段与上述 16 列完全一致，default_status 为 "Basic: Proposal"。
5. `bash scripts/validate-plugin.sh` 全程通过（exit 0）。

## Proposed Approach

**Subject A — 删除 meta-task-to-backlog 技能目录**

直接删除 `.claude/skills/meta-task-to-backlog/`（整个目录）。由于该目录不在 `plugin/skills/` 下，validate-plugin.sh 的 EXPECTED_SKILLS 计数（25）不受影响；symlink 一致性检查仅遍历 `plugin/skills/*/` 的条目，因此删除后不会留下悬空检查。无需修改任何其他文件。

**Subject B — 更新 backlog-setup SKILL.md 的 REQUIRED_COLUMNS**

在 `plugin/skills/backlog-setup/SKILL.md` 中：
- Spec 部分：将 FEATURE_TO_BACKLOG_COLUMNS、LOOP_BACKLOG_COLUMNS、REQUIRED_COLUMNS 替换为完整 B″ 16 列的单一 REQUIRED_COLUMNS 定义，并更新 skill description 中的列描述。
- Implementation 部分：将 `REQUIRED_COLUMNS=(...)` bash 数组及 Python 脚本中的 REQUIRED 列表均替换为 16 列 B″ 集合，确保 default_status 写为 "Basic: Proposal"。

## Trade-offs and Risks

- **不迁移现有使用记录**：历史 backlog 任务中若有 Meta-Proposal/Meta-Plan 状态引用，不做批量更新；本提案只删除技能定义，不清理历史任务数据。
- **不在 plugin/skills/ 中保留存根**：meta-task-to-backlog 完全删除，不提供向后兼容包装器；B″ 架构下的对应功能由 epic-to-backlog 技能承担。
- **风险：backlog-setup 的 Python 正则**：实现中用正则重写 config.yml statuses 行；若 config.yml 格式在 CLI 版本升级后改变（如换用多行 YAML 序列），正则可能失效。但该风险已存在于当前实现，本提案不引入新风险。
- **不更新 backlog-setup 的 seedExamples 内容**：种子文档/决策的中文示例文本不在本次清理范围内。

---

# Plan: 清理 meta-task-to-backlog 死技能并更新 backlog-setup B″ 列配置

Proposal: docs/proposals/proposal-task-126.md

## Phase A: 删除 .claude/skills/meta-task-to-backlog/ 真实目录

### Tests (write first)

Before deletion, verify the real directory exists (not a symlink) and that validate-plugin.sh
reports a FAIL for it:

```bash
# Confirm it is a real directory, not a symlink
test -d .claude/skills/meta-task-to-backlog && ! test -L .claude/skills/meta-task-to-backlog
```

After deletion, verify absence:

```bash
! test -d .claude/skills/meta-task-to-backlog
```

The validate-plugin.sh symlink consistency section iterates only `plugin/skills/*/` entries,
so deleting `.claude/skills/meta-task-to-backlog/` (which has no counterpart in `plugin/skills/`)
removes the FAIL without affecting the EXPECTED_SKILLS count (25).

### Implementation

```bash
rm -rf .claude/skills/meta-task-to-backlog
```

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! test -d .claude/skills/meta-task-to-backlog`

---

## Phase B: 更新 backlog-setup SKILL.md 的 REQUIRED_COLUMNS

### Tests (write first)

Verify the old 7-column list is gone:

```bash
! grep -q '"Proposal", "Plan"' plugin/skills/backlog-setup/SKILL.md
! grep -q 'FEATURE_TO_BACKLOG_COLUMNS' plugin/skills/backlog-setup/SKILL.md
! grep -q 'LOOP_BACKLOG_COLUMNS' plugin/skills/backlog-setup/SKILL.md
! grep -q 'default_status: "Proposal"' plugin/skills/backlog-setup/SKILL.md
```

Verify the new 16-column B″ list is present (in both Spec and Implementation sections):

```bash
grep -q 'Epic: Proposal' plugin/skills/backlog-setup/SKILL.md
grep -q 'Epic: Done' plugin/skills/backlog-setup/SKILL.md
grep -q 'Basic: Proposal' plugin/skills/backlog-setup/SKILL.md
grep -q 'Basic: Done' plugin/skills/backlog-setup/SKILL.md
grep -q 'default_status: "Basic: Proposal"' plugin/skills/backlog-setup/SKILL.md
```

### Implementation

Edit `plugin/skills/backlog-setup/SKILL.md` in two places:

**1. Spec section** — replace the two-variable union definition with a single flat REQUIRED_COLUMNS:

Old (lines 29–38):
```
FEATURE_TO_BACKLOG_COLUMNS := [
  "Proposal", "Plan",
  "Backlog"
]

LOOP_BACKLOG_COLUMNS := [
  "Ready", "In Progress", "Done", "Needs Human"
]

REQUIRED_COLUMNS := FEATURE_TO_BACKLOG_COLUMNS ∪ LOOP_BACKLOG_COLUMNS
```

New:
```
REQUIRED_COLUMNS := [
  "Epic: Proposal", "Epic: Plan", "Epic: Backlog", "Epic: Ready",
  "Epic: Decomposing", "Epic: Awaiting Children", "Epic: Evaluating",
  "Epic: Done", "Epic: Needs Human",
  "Basic: Proposal", "Basic: Plan", "Basic: Backlog", "Basic: Ready",
  "Basic: In Progress", "Basic: Done", "Basic: Needs Human"
]
```

**2. Implementation section** — replace the `REQUIRED_COLUMNS=(...)` bash array and the Python `REQUIRED` list, and fix `default_status`:

Old bash array (lines 115–121):
```bash
REQUIRED_COLUMNS=(
  "Proposal" "Plan"
  "Backlog"
  "Ready"    "In Progress"
  "Done"     "Needs Human"
)
```

New bash array:
```bash
REQUIRED_COLUMNS=(
  "Epic: Proposal" "Epic: Plan" "Epic: Backlog" "Epic: Ready"
  "Epic: Decomposing" "Epic: Awaiting Children" "Epic: Evaluating"
  "Epic: Done" "Epic: Needs Human"
  "Basic: Proposal" "Basic: Plan" "Basic: Backlog" "Basic: Ready"
  "Basic: In Progress" "Basic: Done" "Basic: Needs Human"
)
```

Old Python REQUIRED list (lines 127–133):
```python
REQUIRED = [
  "Proposal", "Plan",
  "Backlog",
  "Ready",    "In Progress",
  "Done",     "Needs Human",
]
```

New Python REQUIRED list:
```python
REQUIRED = [
  "Epic: Proposal", "Epic: Plan", "Epic: Backlog", "Epic: Ready",
  "Epic: Decomposing", "Epic: Awaiting Children", "Epic: Evaluating",
  "Epic: Done", "Epic: Needs Human",
  "Basic: Proposal", "Basic: Plan", "Basic: Backlog", "Basic: Ready",
  "Basic: In Progress", "Basic: Done", "Basic: Needs Human",
]
```

Old default_status Python line (line 154):
```python
    'default_status: "Proposal"',
```

New:
```python
    'default_status: "Basic: Proposal"',
```

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "Epic: Proposal" plugin/skills/backlog-setup/SKILL.md`
- [ ] `grep -q "Basic: Done" plugin/skills/backlog-setup/SKILL.md`
- [ ] `! grep -q 'FEATURE_TO_BACKLOG_COLUMNS' plugin/skills/backlog-setup/SKILL.md`
- [ ] `! grep -q 'default_status: "Proposal"' plugin/skills/backlog-setup/SKILL.md`

---

## Constraints

- Do not modify backlog/config.yml (already correct from TASK-125)
- Do not create any new files; only delete .claude/skills/meta-task-to-backlog/ and edit plugin/skills/backlog-setup/SKILL.md
- Do not migrate historical backlog tasks that reference Meta-Proposal/Meta-Plan statuses
- Do not add a backward-compatibility stub for meta-task-to-backlog in plugin/skills/

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! test -d .claude/skills/meta-task-to-backlog`
- [ ] `grep -q "Epic: Proposal" plugin/skills/backlog-setup/SKILL.md`
- [ ] `grep -q "Basic: Done" plugin/skills/backlog-setup/SKILL.md`
- [ ] `! grep -q 'FEATURE_TO_BACKLOG_COLUMNS' plugin/skills/backlog-setup/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Starting plan draft.

Plan review iteration 1: APPROVED

Phase A done: git rm -r .claude/skills/meta-task-to-backlog (SKILL.md removed, dir gone)

Phase B done: backlog-setup/SKILL.md REQUIRED_COLUMNS updated to 16-column B″ set in Spec list, bash array, and Python list; default_status changed to 'Basic: Proposal'

DoD #1: PASS — bash scripts/validate-plugin.sh (Errors:0, ALL CHECKS PASSED)

DoD #2: PASS — ! test -d .claude/skills/meta-task-to-backlog

DoD #3: PASS — bash scripts/validate-plugin.sh (re-run, ALL CHECKS PASSED)

DoD #4: PASS — grep -q 'Epic: Proposal'

DoD #5: PASS — grep -q 'Basic: Done'

DoD #6: PASS — ! grep -q 'FEATURE_TO_BACKLOG_COLUMNS' (also LOOP_BACKLOG_COLUMNS absent)

DoD #7: PASS — ! grep -q 'default_status: "Proposal"'
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 ! test -d .claude/skills/meta-task-to-backlog
- [ ] #3 bash scripts/validate-plugin.sh
- [ ] #4 grep -q "Epic: Proposal" plugin/skills/backlog-setup/SKILL.md
- [ ] #5 grep -q "Basic: Done" plugin/skills/backlog-setup/SKILL.md
- [ ] #6 ! grep -q 'FEATURE_TO_BACKLOG_COLUMNS' plugin/skills/backlog-setup/SKILL.md
- [ ] #7 ! grep -q 'default_status: "Proposal"' plugin/skills/backlog-setup/SKILL.md
- [ ] #8 bash scripts/validate-plugin.sh
- [ ] #9 ! test -d .claude/skills/meta-task-to-backlog
- [ ] #10 grep -q "Epic: Proposal" plugin/skills/backlog-setup/SKILL.md
- [ ] #11 grep -q "Basic: Done" plugin/skills/backlog-setup/SKILL.md
- [ ] #12 ! grep -q 'FEATURE_TO_BACKLOG_COLUMNS' plugin/skills/backlog-setup/SKILL.md
<!-- DOD:END -->
