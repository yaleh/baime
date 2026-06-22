---
id: TASK-146
title: 'TASK-130-D: Layer 3: feature-to-backlog smoke test'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-22 04:58'
updated_date: '2026-06-22 07:42'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-130
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## What

Create `plugin/skills/feature-to-backlog/smoke/`:
- `setup.sh` — fixture that places a task at Basic: Proposal
- `scenario.md` — two-round "proposal APPROVED → plan APPROVED" convergence scenario
- `expect.sh` — pure shell assertions: task reaches Basic: Backlog status, plan field populated; NO LLM output content assertions

Depends on TASK-130-C (run-smoke-test.sh harness) being merged first.

Parent epic: TASK-130

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `bash scripts/run-smoke-test.sh feature-to-backlog` exits 0
- [ ] #2 `bash scripts/validate-plugin.sh` exits 0
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Layer 3: feature-to-backlog smoke test

## Context

TASK-146 adds a smoke test suite for the `feature-to-backlog` skill, following the same
three-file pattern established by `plugin/skills/loop-backlog/smoke/`. The harness entry
point `scripts/run-smoke-test.sh` already exists (from TASK-130-C) and expects a
`plugin/skills/feature-to-backlog/smoke/` directory containing `setup.sh`, `scenario.md`,
and `expect.sh`. The `--dry-run` flag checks structure only (no LLM calls); full mode
invokes the skill and runs `expect.sh` assertions.

## Phase 1: Create smoke/setup.sh

Create `plugin/skills/feature-to-backlog/smoke/setup.sh` (executable). The script must:
- Accept `$1` as the fixture repo directory and `cd` into it
- Initialize a minimal BAIME backlog (`mkdir -p backlog/tasks backlog/.caps`)
- Initialize a CLAUDE.md with an `## L0 Config` section so `feature-to-backlog` can call
  `loadConfig()` without auto-detect fallback (use `test-cmd: bash scripts/validate-plugin.sh`
  and `test-all: bash scripts/validate-plugin.sh`)
- Create one task file `backlog/tasks/task-1-add-greeting.md` with
  `status: Basic: Proposal` and a short description asking to add a `greeting.sh` script
- `git add` and `git commit` the fixture so the task is tracked

### DoD
- [ ] `test -x plugin/skills/feature-to-backlog/smoke/setup.sh`
- [ ] `grep -q 'status: Basic: Proposal' plugin/skills/feature-to-backlog/smoke/setup.sh`
- [ ] `grep -q 'L0 Config' plugin/skills/feature-to-backlog/smoke/setup.sh`

## Phase 2: Create smoke/scenario.md

Create `plugin/skills/feature-to-backlog/smoke/scenario.md`. The file must describe:
- **Setup**: the fixture repo with TASK-1 at Basic: Proposal
- **Trigger**: run `/feature-to-backlog TASK-1` (existing task path → ProposalLoop)
- **Expected Outcome**: TASK-1 advances to Basic: Backlog; `planSet` field is populated
- **Assertions**: reference the three checks in `expect.sh`

### DoD
- [ ] `grep -q 'Basic: Backlog' plugin/skills/feature-to-backlog/smoke/scenario.md`
- [ ] `grep -q 'feature-to-backlog' plugin/skills/feature-to-backlog/smoke/scenario.md`
- [ ] `grep -q 'planSet' plugin/skills/feature-to-backlog/smoke/scenario.md`

## Phase 3: Create smoke/expect.sh

Create `plugin/skills/feature-to-backlog/smoke/expect.sh` (executable). The script must:
- Accept `$1` as the fixture repo directory and `cd` into it
- Use the same `check()` helper pattern as `loop-backlog/smoke/expect.sh` (eval, PASS/FAIL counters, exit `[[ $FAIL -eq 0 ]]`)
- Assertion 1: TASK-1 task file contains `status: Basic: Backlog`
  (find via `ls backlog/tasks/task-1-*.md | head -1`)
- Assertion 2: The same task file contains a non-empty `planSet` or `plan` field
  (use `grep -q 'planSet\|## Phase'` as a proxy that the plan was written)
- Assertion 3: No task file still has `status: Basic: Proposal`
- No LLM calls; pure shell only

### DoD
- [ ] `test -x plugin/skills/feature-to-backlog/smoke/expect.sh`
- [ ] `grep -q 'Basic: Backlog' plugin/skills/feature-to-backlog/smoke/expect.sh`
- [ ] `grep -q 'PASS' plugin/skills/feature-to-backlog/smoke/expect.sh`
- [ ] `! grep -q 'claude\b' plugin/skills/feature-to-backlog/smoke/expect.sh`

## Constraints

- `expect.sh` must contain zero LLM invocations — purely shell assertions
- The fixture task description must be realistic enough that the skill can draft a proposal
  and plan without hallucinating non-existent files
- Do not modify `scripts/run-smoke-test.sh` or any file outside `plugin/skills/feature-to-backlog/smoke/`
- The smoke test must not depend on the fixture repo having a working `validate-plugin.sh`
  since the fixture is a minimal repo, not the full BAIME checkout

## Acceptance Gate
- [ ] `bash scripts/run-smoke-test.sh feature-to-backlog --dry-run`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

cap:propose=approved

claimed: 2026-06-22T07:38:33Z

Completed: 2026-06-22T07:42:05Z
<!-- SECTION:NOTES:END -->

- [ ] #3 test -x plugin/skills/feature-to-backlog/smoke/setup.sh
- [ ] #4 grep -q 'status: Basic: Proposal' plugin/skills/feature-to-backlog/smoke/setup.sh
- [ ] #5 grep -q 'L0 Config' plugin/skills/feature-to-backlog/smoke/setup.sh
- [ ] #6 grep -q 'Basic: Backlog' plugin/skills/feature-to-backlog/smoke/scenario.md
- [ ] #7 grep -q 'feature-to-backlog' plugin/skills/feature-to-backlog/smoke/scenario.md
- [ ] #8 grep -q 'planSet' plugin/skills/feature-to-backlog/smoke/scenario.md
- [ ] #9 test -x plugin/skills/feature-to-backlog/smoke/expect.sh
- [ ] #10 grep -q 'Basic: Backlog' plugin/skills/feature-to-backlog/smoke/expect.sh
- [ ] #11 grep -q 'PASS' plugin/skills/feature-to-backlog/smoke/expect.sh
- [ ] #12 ! grep -q 'claude\b' plugin/skills/feature-to-backlog/smoke/expect.sh
- [ ] #13 bash scripts/run-smoke-test.sh feature-to-backlog --dry-run
- [ ] #14 bash scripts/validate-plugin.sh
- [ ] #15 bash scripts/validate-plugin.sh
<!-- DOD:END -->
