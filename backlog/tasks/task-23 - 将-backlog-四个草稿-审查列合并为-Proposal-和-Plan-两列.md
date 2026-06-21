---
id: TASK-23
title: 将 backlog 四个草稿/审查列合并为 Proposal 和 Plan 两列
status: Basic: Done
assignee: []
created_date: '2026-06-18 01:37'
updated_date: '2026-06-18 02:29'
labels:
  - kind:basic
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
方案三：将现有的 Proposal Draft、Proposal Review、Plan Draft、Plan Review 四个列合并为 Proposal 和 Plan 两个列，不使用 tag 区分子状态。同步更新 backlog/config.yml 和所有相关 skill（feature-to-backlog、task-to-backlog、backlog-setup）中的状态引用。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 将 backlog 四个草稿/审查列合并为 Proposal 和 Plan 两列

Proposal: docs/proposals/proposal-backlog-column-consolidation.md

## Phase A: 迁移当前 in-flight 任务到新状态名

In-flight tasks found in old statuses (must migrate before config change):

- TASK-14, TASK-15, TASK-16, TASK-17, TASK-18, TASK-19, TASK-20 → currently "Proposal Draft" → migrate to "Proposal"
- TASK-24 → currently "Plan Draft" → migrate to "Plan"
- TASK-23 → currently "Plan Draft" → migrate to "Plan"

### Tests (write first)
```bash
# These must currently PASS — they confirm old-status tasks exist that need migration
backlog task list --plain | grep -E "Proposal Draft|Proposal Review|Plan Draft|Plan Review"
```

### Implementation
```bash
backlog task edit TASK-14 --status "Proposal"
backlog task edit TASK-15 --status "Proposal"
backlog task edit TASK-16 --status "Proposal"
backlog task edit TASK-17 --status "Proposal"
backlog task edit TASK-18 --status "Proposal"
backlog task edit TASK-19 --status "Proposal"
backlog task edit TASK-20 --status "Proposal"
backlog task edit TASK-24 --status "Plan"
backlog task edit TASK-23 --status "Plan"
```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! backlog task list --plain | grep -qE "Proposal Draft|Proposal Review|Plan Draft|Plan Review"`

## Phase B: 更新 backlog/config.yml

### Tests (write first)
```bash
# These currently FAIL (old strings exist):
! grep -q "Proposal Draft" backlog/config.yml
! grep -q "Proposal Review" backlog/config.yml
! grep -q "Plan Draft" backlog/config.yml
! grep -q "Plan Review" backlog/config.yml
```

### Implementation
Edit `backlog/config.yml`:
- Replace `statuses` array with: `["Proposal", "Plan", "Backlog", "Ready", "In Progress", "Done", "Needs Human"]`
- Change `default_status` from `"Proposal Draft"` to `"Proposal"`

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q "Proposal Draft" backlog/config.yml`
- [ ] `! grep -q "Plan Draft" backlog/config.yml`
- [ ] `grep -q '"Proposal"' backlog/config.yml`
- [ ] `grep -q '"Plan"' backlog/config.yml`
- [ ] `grep -q 'default_status: "Proposal"' backlog/config.yml`

## Phase C: 更新 feature-to-backlog/SKILL.md

### Tests (write first)
```bash
# Currently FAIL:
! grep -q '"Proposal Draft"' .claude/skills/feature-to-backlog/SKILL.md
! grep -q '"Proposal Review"' .claude/skills/feature-to-backlog/SKILL.md
! grep -q '"Plan Draft"' .claude/skills/feature-to-backlog/SKILL.md
! grep -q '"Plan Review"' .claude/skills/feature-to-backlog/SKILL.md
```

### Implementation
Edit `.claude/skills/feature-to-backlog/SKILL.md`:
- In `description:` field: replace narrative `"Proposal Draft → Proposal Review → Plan Draft → Plan Review"` with `"Proposal → Plan"`
- In `fromStatus()` spec: replace two lines `fromStatus("Plan Draft") = PlanLoop` and `fromStatus("Plan Review") = PlanLoop` with single line `fromStatus("Plan") = PlanLoop`; update fallthrough comment from `-- Proposal Draft/Review or other` to `-- Proposal or other`
- In `EntryPoint` spec comment: replace `"Proposal Draft/Review status"` with `"Proposal status"` and `"Plan Draft or Plan Review status"` with `"Plan status"`
- In Phase 1 shell block: replace `"Plan Draft"|"Plan Review") echo "PlanLoop"` with `"Plan") echo "PlanLoop"`
- Replace all occurrences of `--status "Proposal Draft"` with `--status "Proposal"`
- Replace all occurrences of `--status "Proposal Review"` with `--status "Proposal"`
- Replace all occurrences of `--status "Plan Draft"` with `--status "Plan"`
- Replace all occurrences of `--status "Plan Review"` with `--status "Plan"`

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q '"Proposal Draft"' .claude/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q '"Proposal Review"' .claude/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q '"Plan Draft"' .claude/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q '"Plan Review"' .claude/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q '"Plan"' .claude/skills/feature-to-backlog/SKILL.md`

## Phase D: 更新 task-to-backlog/SKILL.md 和 backlog-setup/SKILL.md

### Tests (write first)
```bash
# Currently FAIL:
! grep -q '"Plan Draft"' .claude/skills/task-to-backlog/SKILL.md
! grep -q '"Plan Review"' .claude/skills/task-to-backlog/SKILL.md
! grep -q '"Proposal Draft"' .claude/skills/backlog-setup/SKILL.md
! grep -q '"Plan Draft"' .claude/skills/backlog-setup/SKILL.md
```

### Implementation
Edit `.claude/skills/task-to-backlog/SKILL.md`:
- Replace `--status "Plan Draft"` (line 145) with `--status "Plan"`
- Replace `--status "Plan Review"` (line 215) with `--status "Plan"`

Edit `.claude/skills/backlog-setup/SKILL.md`:
- In required statuses list (lines 14–15, 101–102, 114–115): remove `"Proposal Draft"`, `"Proposal Review"`, `"Plan Draft"`, `"Plan Review"`; add `"Proposal"`, `"Plan"`
- Update `default_status` assertion (line 143): change `"Proposal Draft"` to `"Proposal"`

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q '"Plan Draft"' .claude/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q '"Plan Review"' .claude/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q '"Proposal Draft"' .claude/skills/backlog-setup/SKILL.md`
- [ ] `! grep -q '"Plan Draft"' .claude/skills/backlog-setup/SKILL.md`
- [ ] `grep -q '"Proposal"' .claude/skills/backlog-setup/SKILL.md`
- [ ] `grep -q '"Plan"' .claude/skills/backlog-setup/SKILL.md`

## Constraints
- 不修改任何 skill 的核心逻辑，只替换状态字符串字面量
- 在修改 backlog/config.yml 之前，必须先完成 in-flight 任务迁移（Phase A）
- feature-to-backlog 的 fromStatus() 分支：从匹配 `"Plan Draft"|"Plan Review"` 改为只匹配 `"Plan"`

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -qrE '"Proposal Draft"|"Proposal Review"|"Plan Draft"|"Plan Review"' backlog/config.yml .claude/skills/feature-to-backlog/SKILL.md .claude/skills/task-to-backlog/SKILL.md .claude/skills/backlog-setup/SKILL.md`
- [ ] `grep -q 'default_status: "Proposal"' backlog/config.yml`
- [ ] `python3 -c "import yaml; c=yaml.safe_load(open('backlog/config.yml')); assert len(c['statuses'])==7"`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved in 1 iteration. Starting plan draft.

Plan review iteration 1: NEEDS_REVISION — fixed TASK-24 migration: was incorrectly described as 'Proposal Review' and migrated to 'Proposal'; actual current status is 'Plan Draft', correctly migrated to 'Plan' now.

Plan review iteration 2: APPROVED

Docs committed: docs/proposals/proposal-backlog-column-consolidation.md + docs/plans/114-backlog-column-consolidation.md
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'Step B — Write combined proposal+plan into task and add DoD' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #3 grep -q 'ftb-combined.md' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #4 ! grep -q 'Step A — Plan number' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #5 ! grep -q 'Step B — Copy docs' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #6 ! grep -q 'Step C — Commit' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #7 ! grep -q '文档已提交' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #8 ! grep -q 'docs(<SLUG>): add proposal and plan' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #9 bash scripts/validate-plugin.sh
- [ ] #10 grep -q 'Step B — Write plan into task and add DoD' plugin/skills/task-to-backlog/SKILL.md
- [ ] #11 ! grep -q 'Step A — Plan number' plugin/skills/task-to-backlog/SKILL.md
- [ ] #12 ! grep -q 'Step B — Copy plan doc' plugin/skills/task-to-backlog/SKILL.md
- [ ] #13 ! grep -q 'Step C — Commit' plugin/skills/task-to-backlog/SKILL.md
- [ ] #14 ! grep -q '计划草拟 + 审查已完成。文档已提交。' plugin/skills/task-to-backlog/SKILL.md
- [ ] #15 ! grep -q 'docs(<SLUG>): add task plan' plugin/skills/task-to-backlog/SKILL.md
- [ ] #16 bash scripts/validate-plugin.sh
- [ ] #17 grep -q 'ftb-combined.md' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #18 grep -q 'Step B — Write combined proposal+plan into task and add DoD' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #19 grep -q 'Step B — Write plan into task and add DoD' plugin/skills/task-to-backlog/SKILL.md
- [ ] #20 ! grep -q 'Step A — Plan number' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #21 ! grep -q 'Step A — Plan number' plugin/skills/task-to-backlog/SKILL.md
- [ ] #22 ! grep -q '文档已提交' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #23 ! grep -q '计划草拟 + 审查已完成。文档已提交。' plugin/skills/task-to-backlog/SKILL.md
<!-- DOD:END -->
