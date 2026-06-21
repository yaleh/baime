---
id: TASK-97
title: >-
  Fix 4: Downgrade TASK-93.11–20 from Meta-Plan to Backlog (enforce 2-level
  structure)
status: Basic: Done
assignee: []
created_date: '2026-06-20 11:41'
updated_date: '2026-06-20 12:18'
labels:
  - kind:basic
  - loop-meta
  - architecture
  - cleanup
dependencies: []
modified_files:
  - >-
    backlog/tasks/task-93.11 -
    Exp-K-subject-1-validate-plugin-severity-tiers-contracts-density-warning.md
  - >-
    backlog/tasks/task-93.12 -
    Exp-K-subject-2-loop-backlog-daemon-structured-JSON-event-emission.md
  - >-
    backlog/tasks/task-93.13 -
    Exp-K-subject-3-loop-meta-draftDecomposition-idempotency-test-CI.md
  - >-
    backlog/tasks/task-93.14 -
    Exp-K-subject-4-run-quantitative-experiment-replication-mode-comparison-report.md
  - >-
    backlog/tasks/task-93.15 -
    Exp-K-subject-5-backlog-archival-automation-weekly-CI-cron.md
  - >-
    backlog/tasks/task-93.16 -
    Exp-K-subject-6-loop-meta-WIP_CAP-auto-tuning-probe-schema-validator.md
  - >-
    backlog/tasks/task-93.17 -
    Exp-K-subject-7-cross-skill-duplicate-detection-linter-regression-fixtures.md
  - >-
    backlog/tasks/task-93.18 -
    Exp-K-subject-8-provenance-pre-commit-hook-install-script-tests.md
  - >-
    backlog/tasks/task-93.19 -
    Exp-K-subject-9-Class-D-execution-trace-log-methodology-maturity-scorecard.md
  - >-
    backlog/tasks/task-93.20 -
    Exp-K-subject-10-task-to-backlog-auto-inject-default-DoD-regression-contract.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-93.11 through TASK-93.20 are currently in Meta-Plan status while having parent_task_id: TASK-93 (itself Meta-Done). This creates a forbidden 3-level hierarchy: Meta→Meta→Task. They must be downgraded to Backlog so the structure is flat: TASK-93 (closed) → TASK-93.11 (Backlog grouper) → TASK-93.11.1 (Backlog leaf).

## Problem
These 10 tasks were created as experiment subjects intended to be driven by loop-meta (draftDecomposition → Meta-Active → Meta-Done). But:
1. TASK-93 is already Meta-Done — loop-meta will not process its remaining Meta-Plan children
2. The children already have their own sub-tasks (TASK-93.11.1 etc.) created by a prior draftDecomposition run — they do not need loop-meta's decomposition step again
3. Meta-Plan status on a child of a Meta-Done parent violates the intended 2-level structure

## Proposed Change
Set status Backlog on all 10 tasks:
  TASK-93.11, TASK-93.12, TASK-93.13, TASK-93.14, TASK-93.15,
  TASK-93.16, TASK-93.17, TASK-93.18, TASK-93.19, TASK-93.20

Their leaf sub-tasks (TASK-93.11.1 etc., already in Backlog) are unaffected. After this change:
- TASK-93.11–20 become organisational grouper tasks (Backlog containers)
- Their leaves become independently promotable to Ready by the human when work begins
- loop-meta will not pick them up (loop-meta only processes Meta-* status tasks)
- loop-backlog will process the leaf tasks normally when they reach Ready

No content changes are needed — only the status field in each task's YAML frontmatter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 backlog task list --status Meta-Plan returns no tasks with parent_task_id: TASK-93
- [ ] #2 All 10 tasks (TASK-93.11 through TASK-93.20) show status Backlog
- [ ] #3 Their leaf sub-tasks (TASK-93.11.1 etc.) remain in Backlog status unchanged
- [ ] #4 bash scripts/validate-plugin.sh passes (Fix 1 static check finds no nested Meta Tasks)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Background

TASK-93.11 through TASK-93.20 were created as experiment subjects intended to be driven by loop-meta (draftDecomposition → Meta-Active → Meta-Done). Their parent TASK-93 is already Meta-Done, meaning loop-meta will not process these children. Meanwhile these tasks carry Meta-Plan status, creating a forbidden 3-level hierarchy (Meta→Meta→Task). Each already has its own sub-tasks (TASK-93.11.1 etc.) created by a prior draftDecomposition run — they do not need loop-meta's decomposition step again. Leaving them as Meta-Plan causes the nested-meta static check (Fix 1) to flag a structural violation and prevents the normal loop-backlog worker from ever seeing the leaf tasks.

## Goals

1. All 10 tasks (TASK-93.11 through TASK-93.20) have status Backlog after the change.
2. No tasks with parent_task_id: TASK-93 remain in Meta-Plan status.
3. Leaf sub-tasks (TASK-93.11.1 etc.) remain in Backlog status — their content is unchanged.
4. loop-meta will not pick up any of the 10 tasks (only Meta-* status tasks are processed by loop-meta).
5. bash scripts/validate-plugin.sh reports no nested-meta structural violations attributable to these tasks.

## Approach

Use `backlog task edit TASK-93.XX --status Backlog` for each of the 10 tasks in sequence. No content changes are needed — only the status field in each task's YAML frontmatter is updated. The leaf sub-tasks (TASK-93.11.1 etc.) are already in Backlog and are not touched.

## Trade-offs and Risks

- **Risk**: Running the 10 edits non-atomically means a partial run leaves some tasks in Meta-Plan. Mitigation: verify with a list check after all edits complete.
- **Trade-off**: Status change is manual (no bulk-edit). Accepted because there are only 10 tasks and the CLI is deterministic.
- **Risk**: validate-plugin.sh may still report the check-roi-gate.test.sh failure (pre-existing, unrelated to this fix). Acceptance criteria scoped to the nested-meta check only.
- **Out of scope**: Fix 1 static check implementation — that is a separate task. This fix only corrects the data so Fix 1 (once implemented) will find nothing to complain about.

---

## Phase A: Verify Pre-conditions

Confirm all 10 grouper tasks are in Meta-Plan and all leaf sub-tasks are in Backlog.

### Tests

```bash
# Verify all 10 grouper tasks are in Meta-Plan
for t in 93.11 93.12 93.13 93.14 93.15 93.16 93.17 93.18 93.19 93.20; do
  status=$(grep "^status:" /home/yale/work/baime/backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}')
  [ "$status" = "Meta-Plan" ] || { echo "FAIL: TASK-$t has status=$status, expected Meta-Plan"; exit 1; }
done
echo "PASS: all 10 grouper tasks are Meta-Plan"
```

```bash
# Verify all leaf sub-tasks are in Backlog (spot-check 93.11.1, 93.15.1, 93.20.2)
for t in 93.11.1 93.15.1 93.20.2; do
  status=$(grep "^status:" /home/yale/work/baime/backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}')
  [ "$status" = "Backlog" ] || { echo "FAIL: TASK-$t has status=$status, expected Backlog"; exit 1; }
done
echo "PASS: leaf spot-check passed"
```

### Implementation

No changes in this phase — verification only.

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `for t in 93.11 93.12 93.13 93.14 93.15 93.16 93.17 93.18 93.19 93.20; do status=$(grep "^status:" backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}'); [ "$status" = "Meta-Plan" ] || { echo "FAIL: TASK-$t"; exit 1; }; done && echo PASS`

---

## Phase B: Downgrade All 10 Tasks to Backlog

Set status Backlog on each of the 10 grouper tasks. No content changes.

### Tests

Verify that Phase A pre-conditions hold (all 10 tasks in Meta-Plan) immediately before executing the status changes. These checks must pass for Phase B implementation to proceed.

```bash
# Pre-flight: confirm all 10 grouper tasks are still Meta-Plan before editing
for t in 93.11 93.12 93.13 93.14 93.15 93.16 93.17 93.18 93.19 93.20; do
  status=$(grep "^status:" backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}')
  [ "$status" = "Meta-Plan" ] || { echo "FAIL: TASK-$t has status=$status, expected Meta-Plan before edit"; exit 1; }
done
echo "PASS: pre-flight check — all 10 tasks are Meta-Plan, safe to proceed"
```

### Implementation

Run the following 10 commands in sequence:

```bash
cd /home/yale/work/baime
backlog task edit TASK-93.11 --status Backlog
backlog task edit TASK-93.12 --status Backlog
backlog task edit TASK-93.13 --status Backlog
backlog task edit TASK-93.14 --status Backlog
backlog task edit TASK-93.15 --status Backlog
backlog task edit TASK-93.16 --status Backlog
backlog task edit TASK-93.17 --status Backlog
backlog task edit TASK-93.18 --status Backlog
backlog task edit TASK-93.19 --status Backlog
backlog task edit TASK-93.20 --status Backlog
```

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `for t in 93.11 93.12 93.13 93.14 93.15 93.16 93.17 93.18 93.19 93.20; do status=$(grep "^status:" backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}'); [ "$status" = "Backlog" ] || { echo "FAIL: TASK-$t status=$status"; exit 1; }; done && echo PASS: all 10 updated to Backlog`

---

## Phase C: Verify Post-conditions

Confirm no TASK-93 children remain in Meta-Plan and leaves are still Backlog.

### Tests

```bash
# No TASK-93.xx tasks in Meta-Plan
result=$(grep -rl "^status: Meta-Plan" /home/yale/work/baime/backlog/tasks/ | xargs grep -l "^parent_task_id: TASK-93$" 2>/dev/null)
if [ -n "$result" ]; then
  echo "FAIL: still found Meta-Plan tasks with parent TASK-93:"
  echo "$result"
  exit 1
fi
echo "PASS: no nested Meta-Plan tasks under TASK-93"
```

```bash
# All 10 grouper tasks show Backlog
for t in 93.11 93.12 93.13 93.14 93.15 93.16 93.17 93.18 93.19 93.20; do
  status=$(grep "^status:" /home/yale/work/baime/backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}')
  [ "$status" = "Backlog" ] || { echo "FAIL: TASK-$t status=$status"; exit 1; }
done
echo "PASS: all 10 tasks in Backlog"
```

```bash
# Leaf tasks still in Backlog (spot-check)
for t in 93.11.1 93.13.2 93.16.4 93.20.2; do
  status=$(grep "^status:" /home/yale/work/baime/backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}')
  [ "$status" = "Backlog" ] || { echo "FAIL: TASK-$t status=$status"; exit 1; }
done
echo "PASS: leaf spot-check"
```

### Implementation

No changes in this phase — verification only.

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! { grep -rl "^status: Meta-Plan" backlog/tasks/ 2>/dev/null | xargs grep -l "^parent_task_id: TASK-93$" 2>/dev/null | grep -q .; }`
- [ ] `for t in 93.11 93.12 93.13 93.14 93.15 93.16 93.17 93.18 93.19 93.20; do status=$(grep "^status:" backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}'); [ "$status" = "Backlog" ] || { echo "FAIL: TASK-$t"; exit 1; }; done && echo PASS`
- [ ] `for t in 93.11.1 93.13.2 93.16.4 93.20.2; do status=$(grep "^status:" backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}'); [ "$status" = "Backlog" ] || { echo "FAIL: TASK-$t"; exit 1; }; done && echo PASS: leaves unchanged`

---

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! { grep -rl "^status: Meta-Plan" backlog/tasks/ 2>/dev/null | xargs grep -l "^parent_task_id: TASK-93$" 2>/dev/null | grep -q .; }`
- [ ] `for t in 93.11 93.12 93.13 93.14 93.15 93.16 93.17 93.18 93.19 93.20; do status=$(grep "^status:" backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}'); [ "$status" = "Backlog" ] || { echo "FAIL: TASK-$t"; exit 1; }; done && echo PASS`
- [ ] `for t in 93.11.1 93.15.1 93.20.2; do status=$(grep "^status:" backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}'); [ "$status" = "Backlog" ] || { echo "FAIL leaf TASK-$t"; exit 1; }; done && echo PASS: leaves unchanged`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Starting plan draft.

Plan review iteration 1: APPROVED. Plan finalized with 3 phases, 12 DoD items, 4 Acceptance Gate items.

claimed: 2026-06-20T12:13:44Z

Completed: 2026-06-20T12:18:12Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 for t in 93.11 93.12 93.13 93.14 93.15 93.16 93.17 93.18 93.19 93.20; do status=$(grep "^status:" backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}'); [ "$status" = "Meta-Plan" ] || { echo "FAIL: TASK-$t"; exit 1; }; done && echo PASS
- [ ] #3 for t in 93.11 93.12 93.13 93.14 93.15 93.16 93.17 93.18 93.19 93.20; do status=$(grep "^status:" backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}'); [ "$status" = "Backlog" ] || { echo "FAIL: TASK-$t status=$status"; exit 1; }; done && echo PASS: all 10 updated to Backlog
- [ ] #4 ! { grep -rl "^status: Meta-Plan" backlog/tasks/ 2>/dev/null | xargs grep -l "^parent_task_id: TASK-93$" 2>/dev/null | grep -q .; }
- [ ] #5 for t in 93.11 93.12 93.13 93.14 93.15 93.16 93.17 93.18 93.19 93.20; do status=$(grep "^status:" backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}'); [ "$status" = "Backlog" ] || { echo "FAIL: TASK-$t"; exit 1; }; done && echo PASS
- [ ] #6 for t in 93.11.1 93.13.2 93.16.4 93.20.2; do status=$(grep "^status:" backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}'); [ "$status" = "Backlog" ] || { echo "FAIL: TASK-$t"; exit 1; }; done && echo PASS: leaves unchanged
- [ ] #7 for t in 93.11.1 93.15.1 93.20.2; do status=$(grep "^status:" backlog/tasks/task-$t\ -*.md 2>/dev/null | head -1 | awk '{print $2}'); [ "$status" = "Backlog" ] || { echo "FAIL leaf TASK-$t"; exit 1; }; done && echo PASS: leaves unchanged
<!-- DOD:END -->
