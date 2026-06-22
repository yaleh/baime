---
id: TASK-133
title: >-
  epicDecompose 子任务质量：改用 feature-to-backlog / task-to-backlog 替代裸 backlog task
  create
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 15:30'
updated_date: '2026-06-21 16:36'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
epicDecompose 子任务质量：改用 feature-to-backlog / task-to-backlog 替代裸 backlog task create
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: epicDecompose Sub-Task Quality — Use feature-to-backlog / task-to-backlog Instead of Raw backlog task create

## Summary

Implements the approved proposal (TASK-133). Three phases update `plugin/skills/loop-backlog/SKILL.md`
(and its mirror `.claude/skills/loop-backlog/SKILL.md`) so the epic decomposer is unambiguously
required to invoke `/feature-to-backlog` (for code-change children) or `/task-to-backlog` (for
doc/config-only children) rather than raw `backlog task create`. Children exit the decomposer at
`Basic: Proposal` (advancing through their own review cycles independently); the epic parks at
`Epic: Awaiting Children` immediately after all children are created. A regression check is added
to `scripts/review-loop-bg.test.sh`.

---

## Constraints

- Do NOT change basic-lane code (claimBatch, spawnAgent, waitForAgents, merge, execute, etc.)
- Both `plugin/skills/loop-backlog/SKILL.md` and `.claude/skills/loop-backlog/SKILL.md` must
  receive identical edits in every phase.
- `task-to-backlog` remains available and is the correct path for pure-doc/config/research tasks.
- The DECOMP heredoc must instruct the agent to set `parent_task_id: EPIC_ID` on the child
  immediately after `feature-to-backlog` creates it (children arrive at `Basic: Proposal`).
- The DECOMP heredoc must explicitly forbid `backlog task create` as a child-creation mechanism.

---

## Phase A — Update `createSubTask` Spec pseudocode and add selection rule

### Tests

```bash
# A.1 — feature-to-backlog appears in the Spec section of plugin SKILL.md
grep -q 'feature-to-backlog' plugin/skills/loop-backlog/SKILL.md

# A.2 — both skill names appear in createSubTask block of plugin SKILL.md
grep -A8 'createSubTask :: ' plugin/skills/loop-backlog/SKILL.md | grep -q 'feature-to-backlog'

# A.3 — isCodeChangeTask predicate is defined
grep -q 'isCodeChangeTask' plugin/skills/loop-backlog/SKILL.md

# A.4 — mirror also updated
grep -q 'feature-to-backlog' .claude/skills/loop-backlog/SKILL.md
```

### Implementation

Edit `plugin/skills/loop-backlog/SKILL.md` lines 214–229 (the `decomposer` and `createSubTask`
spec comments and pseudocode).

**Replace** the existing `decomposer` comment and `createSubTask` spec block with:

```
-- decomposer: subagent that reads the epic plan's Sub-Task Decomposition and returns a
-- canonical [SubTaskSpec]. Each child is created via feature-to-backlog (code-change tasks)
-- or task-to-backlog (doc/config/research-only tasks) — never raw backlog task create.
-- Selection rule: isCodeChangeTask ≡ child creates or modifies files under plugin/, scripts/,
-- or any non-docs git-tracked path. Children park at Basic: Proposal after creation.
decomposer :: (TaskId, PlanText) → [SubTaskSpec]
decomposer(id, plan) = Agent(prompt=decomposerPrompt(id, plan), schema=SubTaskListSchema)

-- isCodeChangeTask: true when spec involves creating or modifying files under plugin/,
-- scripts/, or other code/config paths (not exclusively docs/ or backlog/ prose).
isCodeChangeTask :: SubTaskSpec → Bool
isCodeChangeTask(spec) = spec.touchesSourceFiles  -- plugin/, scripts/, *.sh, SKILL.md, etc.

-- createSubTask: create one kind:basic child at Basic: Proposal with parent_task_id:parent,
-- delegating to feature-to-backlog (code-change) or task-to-backlog (doc/config-only)
-- so it carries a multi-phase plan + shell-gate DoD (TASK-93 R1).
createSubTask :: (TaskId, SubTaskSpec) → ()
createSubTask(parent, spec) = {
  skill: if (isCodeChangeTask(spec)): "feature-to-backlog" else: "task-to-backlog",
  child: invoke(skill, spec.title),
  setLabel(child, "kind:basic"),
  setParentTaskId(child, parent),
  assert: hasDod(child)
}
```

Apply the identical edit to `.claude/skills/loop-backlog/SKILL.md`.

### Definition of Done

```bash
bash scripts/validate-plugin.sh
grep -q 'feature-to-backlog' plugin/skills/loop-backlog/SKILL.md
grep -A12 'createSubTask :: ' plugin/skills/loop-backlog/SKILL.md | grep -q 'feature-to-backlog'
grep -q 'isCodeChangeTask' plugin/skills/loop-backlog/SKILL.md
grep -q 'feature-to-backlog' .claude/skills/loop-backlog/SKILL.md
grep -q 'isCodeChangeTask' .claude/skills/loop-backlog/SKILL.md
```

---

## Phase B — Rewrite the DECOMP heredoc in `epicDecompose` bash implementation

### Tests

```bash
# B.1 — feature-to-backlog appears inside the DECOMP heredoc block in plugin SKILL.md
awk '/Agent run_in_background=true prompt/,/^DECOMP$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'feature-to-backlog'

# B.2 — task-to-backlog also present in DECOMP block (selection rule present)
awk '/Agent run_in_background=true prompt/,/^DECOMP$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'task-to-backlog'

# B.3 — raw backlog task create does NOT appear in DECOMP block
! awk '/Agent run_in_background=true prompt/,/^DECOMP$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'backlog task create'

# B.4 — parent_task_id setting is instructed in DECOMP block
awk '/Agent run_in_background=true prompt/,/^DECOMP$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'parent_task_id'

# B.5 — timeout raised to 1800s
grep -q 'DECOMP_WAIT.*1800\|1800.*DECOMP_WAIT\|-ge 1800' plugin/skills/loop-backlog/SKILL.md

# B.6 — mirror also updated
awk '/Agent run_in_background=true prompt/,/^DECOMP$/' .claude/skills/loop-backlog/SKILL.md | grep -q 'feature-to-backlog'
```

### Implementation

**Step 1**: In `plugin/skills/loop-backlog/SKILL.md`, replace the DECOMP heredoc comment block
(lines ~1455–1472) with:

```
  # decomposer subagent: create one kind:basic child per leaf. Code-change children
  # (touching plugin/, scripts/, SKILL.md, *.sh) → /feature-to-backlog. Doc-only children
  # → /task-to-backlog. Raw "backlog task create" is PROHIBITED. Children park at Basic: Proposal.
  SIGNAL="${REPO_ROOT}/backlog/.agent-done-${EPIC_ID}-decompose"
  rm -f "$SIGNAL"
  Agent run_in_background=true prompt="$(cat <<DECOMP
You are the epic decomposer for ${EPIC_ID}. Your job:

1. Read the Implementation Plan:
   backlog task view ${EPIC_ID} --plain
   Focus on the "Sub-Task Decomposition" section.

2. For EACH child sub-task, determine whether it involves code changes:
   - CODE-CHANGE: creates or modifies files under plugin/, scripts/, any SKILL.md, *.sh scripts.
   - DOC-ONLY: scope is exclusively reading, researching, writing prose docs, or updating backlog/ notes.

3. Create each child using the correct skill — NEVER use "backlog task create" directly:
   - CODE-CHANGE → run: /feature-to-backlog "<child title>"  (child arrives at Basic: Proposal)
   - DOC-ONLY    → run: /task-to-backlog "<child title>"     (child arrives at Basic: Backlog)

4. After each skill invocation and the child TASK-id is known:
   - Set frontmatter: backlog task edit <CHILD_ID> --set-field parent_task_id ${EPIC_ID}
   - Set label:       backlog task edit <CHILD_ID> --label kind:basic
   - Do NOT set status to Basic: Ready — leave children at their current status.

5. Do not create children that already exist (idempotent — check childrenOf ${EPIC_ID} first).

6. After ALL children are created, write the signal file:
   echo "done" > ${SIGNAL}
DECOMP
)"
```

**Step 2**: Raise the timeout from 300 to 1800 seconds:
- Change: `if [ "$DECOMP_WAIT" -ge 300 ]; then`
- To:     `if [ "$DECOMP_WAIT" -ge 1800 ]; then`
- Update the escalation note text from `300s` to `1800s`.

**Step 3**: Apply identical edits to `.claude/skills/loop-backlog/SKILL.md`.

### Definition of Done

```bash
bash scripts/validate-plugin.sh
awk '/Agent run_in_background=true prompt/,/^DECOMP$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'feature-to-backlog'
awk '/Agent run_in_background=true prompt/,/^DECOMP$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'task-to-backlog'
! awk '/Agent run_in_background=true prompt/,/^DECOMP$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'backlog task create'
awk '/Agent run_in_background=true prompt/,/^DECOMP$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'parent_task_id'
grep -q 'DECOMP_WAIT.*-ge 1800\|-ge 1800' plugin/skills/loop-backlog/SKILL.md
awk '/Agent run_in_background=true prompt/,/^DECOMP$/' .claude/skills/loop-backlog/SKILL.md | grep -q 'feature-to-backlog'
! awk '/Agent run_in_background=true prompt/,/^DECOMP$/' .claude/skills/loop-backlog/SKILL.md | grep -q 'backlog task create'
```

---

## Phase C — Add selection-rule regression tests to `scripts/review-loop-bg.test.sh`

### Implementation

Append two `check()` lines to `scripts/review-loop-bg.test.sh` before the final `echo`/exit line:

```bash
check "decomposer uses feature-to-backlog" "grep -q 'feature-to-backlog' plugin/skills/loop-backlog/SKILL.md"
check "decomposer no raw task create in DECOMP" "! awk '/Agent run_in_background=true prompt/,/^DECOMP\$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'backlog task create'"
```

### Definition of Done

```bash
bash scripts/validate-plugin.sh
bash scripts/review-loop-bg.test.sh
grep -q 'feature-to-backlog' scripts/review-loop-bg.test.sh
grep -q 'decomposer no raw task create' scripts/review-loop-bg.test.sh
```

---

## Acceptance Gate

```bash
bash scripts/validate-plugin.sh
grep -q 'feature-to-backlog' plugin/skills/loop-backlog/SKILL.md
grep -q 'isCodeChangeTask' plugin/skills/loop-backlog/SKILL.md
awk '/Agent run_in_background=true prompt/,/^DECOMP$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'feature-to-backlog'
! awk '/Agent run_in_background=true prompt/,/^DECOMP$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'backlog task create'
grep -q 'feature-to-backlog' .claude/skills/loop-backlog/SKILL.md
bash scripts/review-loop-bg.test.sh
```
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Proposal: epicDecompose 子任务质量：改用 feature-to-backlog / task-to-backlog 替代裸 backlog task create

## Background

When `epicDecompose` runs, it spawns a decomposer background agent whose prompt (loop-backlog SKILL.md §Epic dispatch, ~line 1461) instructs the agent to call `/task-to-backlog` for each child. In practice, however, the agent is free to bypass that instruction and call `backlog task create` directly with a manually-written description — and that is exactly what happens for current epic children (e.g. TASK-130.1). The result is child tasks that carry a shallow single-phase description, a one-line DoD with a single shell command, and no separately-drafted Proposal section reviewed by an architect agent. By contrast, tasks that passed through the `feature-to-backlog` pipeline (e.g. TASK-131) carry a full Proposal + Plan with per-phase Tests/Implementation/DoD triads, a multi-item Acceptance Gate, and traceability to architectural review. The fix is to make the decomposer prompt unambiguously enforce `feature-to-backlog` or `task-to-backlog` as the only permitted child-creation path, with a clear selection rule so the agent cannot fall back to raw `backlog task create`.

## Goals

1. The decomposer agent prompt no longer contains any instruction to call `backlog task create` directly — verifiable by `grep -n "backlog task create" plugin/skills/loop-backlog/SKILL.md` returning zero matches in the decomposer prompt block.

2. The decomposer agent prompt explicitly instructs the agent to invoke `/feature-to-backlog "<child title>"` or `/task-to-backlog "<child title>"` for each child sub-task.

3. The decomposer agent prompt contains a selection rule distinguishing code-change tasks from doc/config-only tasks, routing the former to `feature-to-backlog` and the latter to `task-to-backlog`.

## Proposed Approach

### createSubTask spec update

The `createSubTask` spec comment is updated to reference both `feature-to-backlog` and `task-to-backlog` with the `isCodeChangeTask` selection predicate.

### Decomposer background agent prompt

The `epicDecompose` bash implementation (~line 1461) rewrites the `DECOMP` heredoc prompt to:
- Explicitly forbid `backlog task create`
- Require `/feature-to-backlog "<title>"` for source-file-changing children, `/task-to-backlog "<title>"` for doc-only children
- Define "source files" as any file under `plugin/`, `scripts/`, or non-docs git-tracked paths
- Children park at `Basic: Proposal` for feature-to-backlog, `Basic: Backlog` for task-to-backlog

### Trade-offs and Risks

- **Longer decompose time**: Each child now goes through a full review cycle. Decompose time grows from ~2 minutes to potentially 15–30 minutes for 8-child epics. The 300s timeout must be raised to 1800s.
- **Children park at Proposal**: Feature-to-backlog children arrive at `Basic: Proposal` instead of `Basic: Backlog`; the human advances them through review cycles independently before promotion to Ready.

claimed: 2026-06-21T16:08:00Z

Completed: 2026-06-21T16:40:00Z
All 7 DoD checks PASS. Merged task/TASK-133 → main (no-ff). cap:execute=done
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'feature-to-backlog' plugin/skills/loop-backlog/SKILL.md
- [ ] #3 grep -q 'isCodeChangeTask' plugin/skills/loop-backlog/SKILL.md
- [ ] #4 awk '/Agent run_in_background=true prompt/,/^DECOMP$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'feature-to-backlog'
- [ ] #5 ! awk '/Agent run_in_background=true prompt/,/^DECOMP$/' plugin/skills/loop-backlog/SKILL.md | grep -q 'backlog task create'
- [ ] #6 grep -q 'feature-to-backlog' .claude/skills/loop-backlog/SKILL.md
- [ ] #7 bash scripts/review-loop-bg.test.sh
<!-- DOD:END -->
