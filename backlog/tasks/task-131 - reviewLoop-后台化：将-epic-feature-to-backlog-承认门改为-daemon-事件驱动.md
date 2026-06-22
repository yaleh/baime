---
id: TASK-131
title: reviewLoop 后台化：将 epic/feature-to-backlog 承认门改为 daemon 事件驱动
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 14:12'
updated_date: '2026-06-21 14:56'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
epic-to-backlog reviewLoop 后台化：将 proposal/plan 承认门改为 daemon 事件驱动
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: reviewLoop 后台化 — 将 epic/feature-to-backlog 承认门改为 daemon 事件驱动

## Background

When `/epic-to-backlog` or `/feature-to-backlog` is invoked today, every review
agent (proposalLoop iterations 1–8, planLoop iterations 1–8) runs in the
foreground, holding the developer's terminal for 5–15 minutes per invocation
(`epic-to-backlog/SKILL.md` line 343 auto-advances `Epic: Proposal → Epic: Plan`
inside the same blocking session). This is inconsistent with the `basic-ready`
execution pattern (`loop-backlog/SKILL.md` lines 247, 373, 433), where workers are
spawned with `run_in_background=true` and monitored via signal files.

The same blocking anti-pattern appears at `loop-backlog/SKILL.md` line 1431, where
`epicDecompose` uses `Agent run_in_background=false`, stalling the daemon worker
thread through the entire decomposition instead of yielding the daemon to handle
other events. Converting these three sites to `run_in_background=true` with
signal-file coordination is the scope of this task.

## Goals

1. `/epic-to-backlog` proposalLoop and planLoop spawn each review iteration as a
   background agent (`run_in_background=true`) and the orchestrator session exits
   (prints guidance and stops) after spawning the first iteration — verifiable by
   `grep -n "run_in_background=true" plugin/skills/epic-to-backlog/SKILL.md`
   returning matches in Phase 2 and Phase 4.

2. `/feature-to-backlog` Phase 2 and Phase 4 review agents are likewise backgrounded
   with the same signal-file protocol — verifiable by
   `grep -n "run_in_background=true" plugin/skills/feature-to-backlog/SKILL.md`
   returning matches in those phases.

3. The human approval gates between Proposal→Plan and Plan→Backlog become explicit
   developer `backlog task edit --status` commands, not automatic orchestrator
   transitions — verifiable by confirming neither SKILL.md advances the status
   automatically after an APPROVED verdict (the orchestrator prints instructions and
   stops; the developer runs the status command manually).

4. `loop-backlog` `epicDecompose` (`SKILL.md` line 1431) changes from
   `run_in_background=false` to `run_in_background=true` with a signal file,
   consistent with the basic-task worker pattern — verifiable by
   `grep "run_in_background=false" plugin/skills/loop-backlog/SKILL.md` returning
   no matches.

5. `basic-daemon.js` detects the human-set approval gate status transitions by
   polling for tasks whose status is `"Epic: Plan"` or `"Basic: Plan"` AND that
   carry a pipeline marker file (`backlog/.etb-awaiting-plan-$TASK_ID` or
   `backlog/.ftb-awaiting-plan-$TASK_ID`) written by the orchestrator on APPROVED —
   verifiable by `grep "awaiting-plan\|proposal-approved\|plan-approved"` in
   `scripts/basic-daemon.js` and by confirming marker files are written in the
   respective SKILL.md files.

## Proposed Approach

### a) epic-to-backlog / feature-to-backlog: backgrounded reviewLoop + developer approval gates

In Phases 2 and 4 of both skills, replace the synchronous `spawn Task agent` /
`read verdict file` loop with:

- Spawn the review agent with `run_in_background=true`; immediately after spawning,
  the orchestrator prints a guidance message and **exits** (does not wait for the
  signal file). The background agent writes its verdict to
  `$TMPDIR/etb-proposal-verdict.txt` (or equivalent) and updates task notes, as today.
- If the background agent writes `NEEDS_REVISION`, it re-spawns the next iteration
  itself (the agent becomes self-chaining via the same `run_in_background=true`
  pattern), continuing until APPROVED or the 8-iteration limit.
- On APPROVED, the background agent writes `APPROVED` to the verdict file, appends
  the iteration note to the task, and writes a marker file
  `backlog/.etb-awaiting-plan-$TASK_ID` (proposal approved, awaiting human gate to
  Plan) or `backlog/.etb-awaiting-backlog-$TASK_ID` (plan approved, awaiting human
  gate to Backlog). It does NOT auto-advance status.
- The background agent prints: "Proposal APPROVED. Run:
  `backlog task edit TASK-N --status 'Epic: Plan'` to start plan drafting."
- The daemon sees the marker file + matching status and fires the appropriate
  continuation (see section c).

Affected files:
- `plugin/skills/epic-to-backlog/SKILL.md` — Phases 2 and 4 rewritten to spawn
  self-chaining background agents that write marker files on APPROVED.
- `plugin/skills/feature-to-backlog/SKILL.md` — same change for its Phases 2 and 4.

### b) loop-backlog epicDecompose: change to run_in_background=true + signal file

In `plugin/skills/loop-backlog/SKILL.md` around line 1431, replace:

```
Agent run_in_background=false prompt="..."
```

with:

```
Agent run_in_background=true prompt="..."
```

Add a signal file check (`backlog/.agent-done-$EPIC_ID-decompose`) that the
decomposer writes when done, analogous to the existing `backlog/.agent-done-TASK-N`
pattern used for basic-task workers (SKILL.md lines 247, 373, 433). The daemon
worker monitors this signal file before proceeding to the R1 guard and child
verification steps.

Affected file: `plugin/skills/loop-backlog/SKILL.md`

### c) basic-daemon.js: add proposal-approved and plan-approved event channels

Add two new predicates and channels to `scripts/basic-daemon.js`, keyed on marker
files rather than raw status values (to avoid collision with tasks that reach
`"Basic: Plan"` or `"Epic: Plan"` via other paths):

- `proposal-approved:TASK-N` — fires when marker file
  `backlog/.etb-awaiting-plan-$id` or `backlog/.ftb-awaiting-plan-$id` exists AND
  the task status equals `"Epic: Plan"` or `"Basic: Plan"` (respectively). This
  signals the human has approved the proposal and promoted the status; the daemon
  triggers plan-drafting (Phase 3) as a background agent and removes the marker file.
- `plan-approved:TASK-N` — fires when marker file
  `backlog/.etb-awaiting-backlog-$id` or `backlog/.ftb-awaiting-backlog-$id` exists
  AND the task status equals `"Epic: Backlog"` or `"Basic: Ready"`. The daemon
  triggers finalise (Phase 5 / epic finalise) as a background agent and removes the
  marker file.

Using marker files as the primary predicate eliminates the overlap with the existing
`basic-ready` channel (which has no marker file) and makes the "notified" set reset
unnecessary — the marker file is deleted on first dispatch, preventing re-fire.

The `workerLoop` event dispatcher in `loop-backlog/SKILL.md` (lines 91–96) gains two
new branches:

```
| event matches "proposal-approved:TASK-*" → startPlanDraft(extractId(event)); workerLoop()
| event matches "plan-approved:TASK-*"     → startFinalise(extractId(event));  workerLoop()
```

Affected files:
- `scripts/basic-daemon.js` — add two new channel definitions with marker-file-based
  predicates; predicate deletes the marker file on first fire.
- `plugin/skills/loop-backlog/SKILL.md` — extend workerLoop dispatch table and add
  `startPlanDraft` / `startFinalise` handler stubs.

## Trade-offs and Risks

**What we are NOT doing:**
- We are not changing the draftProposal or draftPlan sub-agents (Phases 1b and 3 of
  epic-to-backlog, Phases 1b and 3 of feature-to-backlog); those remain synchronous
  for now since they run once and are fast (< 1 min each). They will be invoked by
  the daemon's `startPlanDraft` handler.
- We are not fully automating the approval gates — the human must still explicitly set
  the status; this is an intentional design constraint per the dev-workflow preference
  (human owns gates).
- We are not changing the basic-task execution path (basic-ready → worker); that
  already uses `run_in_background=true` correctly and has no overlap with the new
  channels.

**Known risks:**
- Self-chaining review agent: if a background review agent crashes before writing its
  verdict or spawning the next iteration, the chain stops silently. Mitigation: add a
  timeout check or "failed" sentinel; the human can re-invoke `/epic-to-backlog
  TASK-N` to resume from the current status.
- Marker file lifecycle: if the daemon process restarts between marker file creation
  and deletion, it may re-fire `proposal-approved` for an already-dispatched task.
  Mitigation: the `startPlanDraft` handler checks whether Phase 3 is already
  in progress (task status `"Epic: Plan"` with no marker file) before spawning.
- The self-chaining review agent pattern is new to these skills; it adds complexity
  vs. the current simple outer loop. Mitigation: the pattern is documented once in
  a shared spec-stdlib section and referenced from both skills.

---

# Plan: reviewLoop 后台化 — 将 epic/feature-to-backlog 承认门改为 daemon 事件驱动

Proposal: docs/proposals/proposal-daemon-approval-gate.md

## Phase A: basic-daemon.js 新增 proposal-approved / plan-approved 事件通道

### Tests (write first)

Add the following test cases to `scripts/basic-daemon.test.js`:

- `isProposalApproved` — returns true when `backlog/.etb-awaiting-plan-TASK-N` exists AND status is `epic: plan`
- `isProposalApproved` — returns false when marker exists but status is NOT `epic: plan`
- `isProposalApproved` — returns false when status is `epic: plan` but no marker exists
- `isProposalApproved` (ftb) — returns true when `backlog/.ftb-awaiting-plan-TASK-N` exists AND status is `basic: plan`
- `isPlanApproved` — returns true when `backlog/.etb-awaiting-backlog-TASK-N` exists AND status is `epic: backlog`
- `isPlanApproved` (ftb) — returns true when `backlog/.ftb-awaiting-backlog-TASK-N` exists AND status is `basic: ready`
- `isPlanApproved` — returns false when marker is absent
- `scanIds` proposal-approved — finds TASK-5 but not TASK-6 when only TASK-5 has marker + matching status
- `scanIds` plan-approved — finds TASK-7 when `backlog/.ftb-awaiting-backlog-TASK-7` exists and status is `basic: ready`

### Implementation

Changes to `scripts/basic-daemon.js`:

1. Add status constants after line 26: `EPIC_PLAN_STATUS`, `BASIC_PLAN_STATUS`, `EPIC_BACKLOG_STATUS`.

2. Add `backlogDir(tasksDir)` helper and two predicate factories `isProposalApproved(tasksDir)` / `isPlanApproved(tasksDir)` after `isChildDone`.

3. Add two new channels to the `channels` array: `proposal-approved` and `plan-approved`.

4. In the polling loop, after emitting a `proposal-approved` or `plan-approved` event, delete all four possible marker file stems for the task id (idempotent try/catch).

5. Update the header comment to document the two new channels.

6. Bump daemon version tag from `v7` to `v8`.

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `node scripts/basic-daemon.test.js`
- [ ] `grep -q "proposal-approved" scripts/basic-daemon.js`
- [ ] `grep -q "plan-approved" scripts/basic-daemon.js`
- [ ] `grep -q "awaiting-plan|awaiting-backlog" scripts/basic-daemon.js`
- [ ] `grep -q "daemon-version: v8" scripts/basic-daemon.js`

---

## Phase B: loop-backlog SKILL.md — epicDecompose 后台化 + workerLoop 新分支

### Tests (write first)

New file `scripts/daemon-routing-skill.test.sh` (NOT replacing `scripts/daemon-routing.test.js`):

```bash
#!/usr/bin/env bash
set -e; PASS=0; FAIL=0
check() { if eval "$2"; then echo "  PASS: $1"; PASS=$((PASS+1)); else echo "  FAIL: $1"; FAIL=$((FAIL+1)); fi; }
check "proposal-approved branch" "grep -q 'proposal-approved:TASK-*' plugin/skills/loop-backlog/SKILL.md"
check "plan-approved branch"     "grep -q 'plan-approved:TASK-*' plugin/skills/loop-backlog/SKILL.md"
check "startPlanDraft present"   "grep -q 'startPlanDraft' plugin/skills/loop-backlog/SKILL.md"
check "startFinalise present"    "grep -q 'startFinalise' plugin/skills/loop-backlog/SKILL.md"
check "no run_in_background=false" "! grep -q 'run_in_background=false' plugin/skills/loop-backlog/SKILL.md"
echo "$PASS passed, $FAIL failed"; [ "$FAIL" -eq 0 ]
```

### Implementation

1. Extend workerLoop pseudocode dispatch table (before `| otherwise`):
   ```
   | event matches "proposal-approved:TASK-*" → startPlanDraft(extractId(event)); workerLoop()
   | event matches "plan-approved:TASK-*"     → startFinalise(extractId(event));  workerLoop()
   ```

2. Add pseudocode stubs after `epicEvaluate`:
   `startPlanDraft(id)` and `startFinalise(id)` each spawn a background agent.

3. Change `epicDecompose` line 1431 from `run_in_background=false` to `run_in_background=true`; add signal-file wait before R1 guard.

4. Add bash `startPlanDraft` / `startFinalise` functions after `epicDecompose()`.

5. Add bash workerLoop dispatch: `proposal-approved:*) startPlanDraft ...` and `plan-approved:*) startFinalise ...`

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/daemon-routing-skill.test.sh`
- [ ] `! grep -q "run_in_background=false" plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "proposal-approved:TASK-*" plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "plan-approved:TASK-*" plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "startPlanDraft" plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "startFinalise" plugin/skills/loop-backlog/SKILL.md`

---

## Phase C: epic-to-backlog / feature-to-backlog — reviewLoop 后台化 + 自链接模式

### Tests (write first)

New file `scripts/review-loop-bg.test.sh`:

```bash
#!/usr/bin/env bash
set -e; PASS=0; FAIL=0
check() { if eval "$2"; then echo "  PASS: $1"; PASS=$((PASS+1)); else echo "  FAIL: $1"; FAIL=$((FAIL+1)); fi; }
check "etb run_in_background=true"         "grep -q 'run_in_background=true' plugin/skills/epic-to-backlog/SKILL.md"
check "etb writes awaiting-plan marker"    "grep -q 'etb-awaiting-plan' plugin/skills/epic-to-backlog/SKILL.md"
check "etb writes awaiting-backlog marker" "grep -q 'etb-awaiting-backlog' plugin/skills/epic-to-backlog/SKILL.md"
check "etb no auto status advance"         "! grep -q 'advance status.*Epic: Proposal' plugin/skills/epic-to-backlog/SKILL.md"
check "ftb run_in_background=true"        "grep -q 'run_in_background=true' plugin/skills/feature-to-backlog/SKILL.md"
check "ftb writes awaiting-plan marker"   "grep -q 'ftb-awaiting-plan' plugin/skills/feature-to-backlog/SKILL.md"
check "ftb writes awaiting-backlog marker""grep -q 'ftb-awaiting-backlog' plugin/skills/feature-to-backlog/SKILL.md"
check "ftb no auto Phase 3 advance"       "! grep -q 'APPROVED.*proceed to Phase 3' plugin/skills/feature-to-backlog/SKILL.md"
check "ftb no auto Phase 5 advance"       "! grep -q 'APPROVED.*proceed to Phase 5' plugin/skills/feature-to-backlog/SKILL.md"
echo "$PASS passed, $FAIL failed"; [ "$FAIL" -eq 0 ]
```

### Implementation

**epic-to-backlog Phase 2 (~line 310)**: Replace synchronous loop with self-chaining background agent. On APPROVED, write `backlog/.etb-awaiting-plan-$TASK_ID`. Remove automatic status advancement.

**epic-to-backlog Phase 4 (~line 415)**: Same. On APPROVED, write `backlog/.etb-awaiting-backlog-$TASK_ID`. Remove `Epic: Plan → Epic: Backlog` auto-advancement.

**feature-to-backlog Phase 2 (~line 274)**: Same with `backlog/.ftb-awaiting-plan-$TASK_ID`. Remove "proceed to Phase 3" auto-advancement.

**feature-to-backlog Phase 4 (~line 387)**: Same with `backlog/.ftb-awaiting-backlog-$TASK_ID`. Remove "proceed to Phase 5" auto-advancement.

Both skills: update Phase 3 / Phase 5 preambles to note they are triggered by the daemon.

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/review-loop-bg.test.sh`
- [ ] `grep -q "run_in_background=true" plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `grep -q "run_in_background=true" plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q "etb-awaiting-plan" plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `grep -q "ftb-awaiting-plan" plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q "etb-awaiting-backlog" plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `grep -q "ftb-awaiting-backlog" plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q "advance status.*Epic: Proposal → Epic: Plan" plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `! grep -q "APPROVED.*proceed to Phase 3" plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q "APPROVED.*proceed to Phase 5" plugin/skills/feature-to-backlog/SKILL.md`

---

## Constraints

- Human must explicitly run `backlog task edit TASK-N --status '...'` to cross each approval gate.
- Self-chaining review agents must not exceed 8 iterations; exhaustion parks at Needs Human.
- Daemon marker-file deletion must be idempotent.
- Phase B must not start until Phase A tests pass; Phase C must not start until Phase B tests pass.
- `scripts/basic-daemon.js` must remain pure Node.js stdlib.
- `ensureDaemonScript` in `loop-backlog/SKILL.md` must be updated to copy the v8 daemon.

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `node scripts/basic-daemon.test.js`
- [ ] `bash scripts/daemon-routing-skill.test.sh`
- [ ] `bash scripts/review-loop-bg.test.sh`
- [ ] `grep -q "proposal-approved" scripts/basic-daemon.js`
- [ ] `grep -q "plan-approved" scripts/basic-daemon.js`
- [ ] `! grep -q "run_in_background=false" plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "run_in_background=true" plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `grep -q "run_in_background=true" plugin/skills/feature-to-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 2: APPROVED

All five checks passed. Key implementation note flagged: review background agents must explicitly include Agent in allowed-tools for self-chaining to work (distinct from basic-task worker agents which exclude Agent). This is an implementation-time detail, not a design flaw. Marker-file collision avoidance and daemon double-dispatch mitigation are sound.

Proposal approved. Starting plan draft.

Plan review iteration 1: NEEDS_REVISION — 3 defects fixed before re-approval:
1. CRITICAL naming collision: Phase B proposed creating scripts/daemon-routing.test.js as bash content, but that file already exists as a Node.js test and validate-plugin.sh dispatches .test.js files with `node`. Fixed by renaming to scripts/daemon-routing-skill.test.sh.
2. grep -qv anti-pattern: Phase C test script used `grep -c ... | grep -qv '^0$'` on lines for etb/ftb Phase 4 checks. Replaced with direct `grep -q`.
3. Broken PASS counter: Phase C check() function used `FAIL_CNT=$((FAIL))` on success branch instead of `PASS=$((PASS+1))`. Fixed so PASS is correctly incremented.
All three defects corrected in-place. Plan is now APPROVED.

Plan review iteration 2: APPROVED

claimed: 2026-06-21T14:31:00Z

Completed: 2026-06-21T14:45:00Z

cap:execute=done
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 node scripts/basic-daemon.test.js
- [ ] #3 grep -q "proposal-approved" scripts/basic-daemon.js
- [ ] #4 grep -q "plan-approved" scripts/basic-daemon.js
- [ ] #5 grep -q "awaiting-plan|awaiting-backlog" scripts/basic-daemon.js
- [ ] #6 grep -q "daemon-version: v8" scripts/basic-daemon.js
- [ ] #7 bash scripts/daemon-routing-skill.test.sh
- [ ] #8 ! grep -q "run_in_background=false" plugin/skills/loop-backlog/SKILL.md
- [ ] #9 grep -q "proposal-approved:TASK-*" plugin/skills/loop-backlog/SKILL.md
- [ ] #10 grep -q "plan-approved:TASK-*" plugin/skills/loop-backlog/SKILL.md
- [ ] #11 grep -q "startPlanDraft" plugin/skills/loop-backlog/SKILL.md
- [ ] #12 grep -q "startFinalise" plugin/skills/loop-backlog/SKILL.md
- [ ] #13 bash scripts/review-loop-bg.test.sh
- [ ] #14 grep -q "run_in_background=true" plugin/skills/epic-to-backlog/SKILL.md
- [ ] #15 grep -q "run_in_background=true" plugin/skills/feature-to-backlog/SKILL.md
- [ ] #16 grep -q "etb-awaiting-plan" plugin/skills/epic-to-backlog/SKILL.md
- [ ] #17 grep -q "ftb-awaiting-plan" plugin/skills/feature-to-backlog/SKILL.md
- [ ] #18 grep -q "etb-awaiting-backlog" plugin/skills/epic-to-backlog/SKILL.md
- [ ] #19 grep -q "ftb-awaiting-backlog" plugin/skills/feature-to-backlog/SKILL.md
- [ ] #20 ! grep -q "APPROVED.*proceed to Phase 3" plugin/skills/feature-to-backlog/SKILL.md
- [ ] #21 ! grep -q "APPROVED.*proceed to Phase 5" plugin/skills/feature-to-backlog/SKILL.md
<!-- DOD:END -->
