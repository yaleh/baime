---
id: TASK-132
title: epicDecompose spawn-and-forget 重构：去掉前台信号文件轮询，background agent 完全自治
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 15:28'
updated_date: '2026-06-21 16:04'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
epicDecompose spawn-and-forget 重构：去掉前台信号文件轮询，background agent 完全自治
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: epicDecompose spawn-and-forget 重构：去掉前台信号文件轮询，background agent 完全自治

## Background

The current `epicDecompose` implementation (SKILL.md, bash Implementation section) spawns a
background decomposer agent and then immediately enters a foreground `while [ ! -f "$SIGNAL" ]; do sleep 5`
polling loop that blocks the Monitor session for up to 300 seconds. This is structurally different
from — and unjustified compared to — the basic-task lane. In the basic lane, the orchestrator
MUST block after spawning because it needs to read the signal file content ("done" vs.
"needs-human: <reason>") to decide whether to merge or escalate, and it must perform the merge
itself. In the epic lane, no such follow-up action exists: the decomposer agent can itself set
`Epic: Decomposing`, create children via `/task-to-backlog`, run the R1 guard
(`verify-subtask-dod.sh`), and advance to `Epic: Awaiting Children` or `Epic: Needs Human`
directly. Because the orchestrator has nothing to do after spawning, blocking it on a signal file
prevents the Monitor loop from processing other arriving events (e.g. `basic-ready`, `child-done`,
or a second `epic-ready` for a different epic) during the entire decomposition window, creating an
artificial serialisation bottleneck with no compensating benefit.

## Goals

1. The `epicDecompose` bash function in the Implementation section contains no `while [ ! -f`
   signal-file polling loop — verifiable by `grep -n 'while \[ ! -f' plugin/skills/loop-backlog/SKILL.md`
   returning no match inside the `epicDecompose()` body.

2. The `epicDecompose` bash function spawns the decomposer agent with
   `Agent run_in_background=true` and returns immediately (spawn-and-forget pattern) — verifiable
   by `grep -A5 'epicDecompose()' plugin/skills/loop-backlog/SKILL.md` showing an `Agent
   run_in_background=true` call with no subsequent poll loop.

3. The decomposer agent prompt (the heredoc passed to the background `Agent` call) includes all
   state-transition instructions: set `Epic: Decomposing`, create children, run the R1 guard, and
   set `Epic: Awaiting Children` or `Epic: Needs Human` — verifiable by inspecting the prompt
   heredoc in the updated `epicDecompose()` for the presence of the strings `Epic: Awaiting
   Children` and `Epic: Needs Human`.

## Proposed Approach

Two coordinated changes are needed, one in the Spec pseudocode and one in the bash Implementation.

**Spec pseudocode (`epicDecompose`):** Remove the inline `decomposer(id, plan)` call, the
`verifySubTaskDod` R1 guard call, and the `setStatus(id, "Epic: Awaiting Children")` / error-path
`escalateEpic` calls from the orchestrator body. Replace the entire body after
`setStatus(id, "Epic: Decomposing")` with a single `Agent(run_in_background=true,
prompt=decomposerPrompt(id, plan))` call that returns immediately. The `decomposerPrompt` function
is extended to encode the full state-machine: create children, run R1 guard, then set Awaiting
Children or Needs Human depending on the guard result. The `decomposer` helper spec entry is
updated to reflect that it is now a self-contained autonomous agent rather than a synchronous
subagent returning a list.

**Bash Implementation (`epicDecompose()`):** Remove the `SIGNAL` variable, the `rm -f "$SIGNAL"`
setup, the `while [ ! -f "$SIGNAL" ]` polling loop with its 300-second timeout and escalation
branch, and the `rm -f "$SIGNAL"` teardown. Remove the post-wait R1 guard call
(`bash scripts/verify-subtask-dod.sh`) and the `backlog task edit ... "Epic: Awaiting Children"`
call from the orchestrator. Move all of these into the decomposer agent prompt heredoc so the
background agent executes them autonomously. After the `Agent run_in_background=true` spawn, the
function returns immediately (or echoes a trace line and returns). The signal file
`backlog/.agent-done-${EPIC_ID}-decompose` is eliminated entirely; no new signal file replaces it.

## Trade-offs and Risks

**What we are NOT doing:** We are not changing the basic-task lane's `waitForAgents` polling
loop — that blocking is justified because the orchestrator must read signal content and perform
the merge. We are not adding a new monitoring mechanism to detect decomposer agent failures from
the orchestrator side; failure handling is entirely inside the background agent via `Epic: Needs
Human` status transitions.

**Known risks:**

- **Observability gap**: If the background decomposer agent crashes silently (OOM, Claude Code
  process killed) before writing any status update, the epic will remain stuck at
  `Epic: Decomposing` indefinitely with no timeout mechanism in the orchestrator. The existing
  300-second timeout in the poll loop is removed. A reaper for stale `Epic: Decomposing` tasks
  is out of scope for this task but should be tracked as follow-up.

- **Error attribution**: Failures previously surfaced synchronously to the orchestrator's log
  (e.g. "decomposer did not complete within 300s") will now only appear as task note entries
  written by the background agent. The orchestrator will not log decomposition errors, which may
  make debugging harder.

- **Idempotency during restart**: If the orchestrator is restarted while a background decomposer
  agent is running, the `cap:decompose=done` guard on `epicDecompose` prevents re-entry only
  after the agent writes it. A restart between agent spawn and `cap:decompose=done` write could
  result in two concurrent decomposer agents for the same epic. The existing `hasCap` check at
  function entry does not cover this window; the background agent must be written to handle or
  tolerate a concurrent sibling (e.g. by checking for existing children before creating new ones).

---

# Plan: epicDecompose spawn-and-forget 重構：去掉前台信号文件轮询，background agent 完全自治

Proposal: docs/proposals/proposal-epicdecompose-spawn-and-forget-bg-agent.md

## Phase A: 更新 Spec 伪代码
### Tests (write first)
- `scripts/review-loop-bg.test.sh` — add check: `grep -q 'spawn-and-forget' plugin/skills/loop-backlog/SKILL.md` (or equivalent absence-of-poll check)
### Implementation
- Edit `plugin/skills/loop-backlog/SKILL.md`: `epicDecompose` Spec section
  - Remove signal file variable, remove `waitForSignal` call
  - Change decomposer subagent call to spawn-and-forget: agent handles all state transitions
  - Add note that agent sets `Epic: Decomposing`, creates children, runs R1 guard, sets `Epic: Awaiting Children` / `Epic: Needs Human`
- Edit `.claude/skills/loop-backlog/SKILL.md`: same Spec changes (mirror)
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q 'while \[ ! -f.*SIGNAL' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'run_in_background=true' plugin/skills/loop-backlog/SKILL.md`

## Phase B: 更新 bash 实现
### Tests (write first)
- `scripts/daemon-routing-skill.test.sh` — add check: absence of `sleep 5` poll in epicDecompose body (or check for spawn-and-forget comment)
### Implementation
- Edit `plugin/skills/loop-backlog/SKILL.md`: `epicDecompose()` bash section
  - Remove: `SIGNAL=...`, `rm -f "$SIGNAL"`, the inner `Agent run_in_background=true` (decomposer sub-agent), the entire `while [ ! -f "$SIGNAL" ]; do sleep 5 ... done` poll loop, `rm -f "$SIGNAL"`, the R1 guard block, and the `Epic: Awaiting Children` status set
  - Replace with: single `Agent run_in_background=true` with a self-contained prompt heredoc that:
    1. Reads `cap:decompose` — returns if already done (idempotency)
    2. Writes `cap:decompose=started`
    3. Sets status `Epic: Decomposing`
    4. Reads epic plan Sub-Task Decomposition
    5. Creates children (using existing child-creation logic from old decomposer prompt)
    6. Runs R1 guard: `bash scripts/verify-subtask-dod.sh $EPIC_ID`
    7. On R1 pass: sets `Epic: Awaiting Children`, writes `cap:decompose=done`
    8. On R1 fail or any error: sets `Epic: Needs Human`, writes `cap:decompose=failed | <reason>`
  - The function returns immediately after spawning (no wait)
- Edit `.claude/skills/loop-backlog/SKILL.md`: same bash changes (mirror)
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q 'while \[ ! -f' plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'while \[ ! -f' .claude/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'Epic: Awaiting Children' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'Epic: Needs Human' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'cap:decompose=done' plugin/skills/loop-backlog/SKILL.md`

## Constraints
- Do NOT change any basic-lane code (waitForAgents, basic-ready handling, merge logic)
- Do NOT change startPlanDraft or startFinalise — they already use spawn-and-forget
- The background agent prompt MUST include idempotency check (cap:decompose guard) to handle restarts
- Mirror every change to both plugin/skills/ and .claude/skills/ versions

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q 'while \[ ! -f.*SIGNAL' plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'while \[ ! -f.*SIGNAL' .claude/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'Epic: Needs Human' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'cap:decompose=done' plugin/skills/loop-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Starting plan draft.

Plan review iteration 1: NEEDS_REVISION — Two issues fixed: (1) Goal 3 requires 'Epic: Needs Human' in decomposer prompt but no DoD/Acceptance Gate item verified it; added grep checks to Phase B DoD and Acceptance Gate. (2) Mirror file .claude/skills/loop-backlog/SKILL.md was mentioned in Implementation but never verified in any DoD or Acceptance Gate; added absence-of-poll checks for the mirror file in Phase B DoD and Acceptance Gate.

Plan review iteration 2: APPROVED

claimed: 2026-06-21T15:59:21Z

Completed: 2026-06-21T16:05:00Z
All 8 DoD checks PASS. Merged task/TASK-132 → main (no-ff). cap:execute=done
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 ! grep -q 'while \[ ! -f.*SIGNAL' plugin/skills/loop-backlog/SKILL.md
- [ ] #3 grep -q 'run_in_background=true' plugin/skills/loop-backlog/SKILL.md
- [ ] #4 bash scripts/validate-plugin.sh
- [ ] #5 ! grep -q 'while \[ ! -f' plugin/skills/loop-backlog/SKILL.md
- [ ] #6 ! grep -q 'while \[ ! -f' .claude/skills/loop-backlog/SKILL.md
- [ ] #7 grep -q 'Epic: Awaiting Children' plugin/skills/loop-backlog/SKILL.md
- [ ] #8 grep -q 'Epic: Needs Human' plugin/skills/loop-backlog/SKILL.md
- [ ] #9 grep -q 'cap:decompose=done' plugin/skills/loop-backlog/SKILL.md
- [ ] #10 bash scripts/validate-plugin.sh
- [ ] #11 ! grep -q 'while \[ ! -f.*SIGNAL' plugin/skills/loop-backlog/SKILL.md
- [ ] #12 ! grep -q 'while \[ ! -f.*SIGNAL' .claude/skills/loop-backlog/SKILL.md
- [ ] #13 grep -q 'Epic: Needs Human' plugin/skills/loop-backlog/SKILL.md
- [ ] #14 grep -q 'cap:decompose=done' plugin/skills/loop-backlog/SKILL.md
<!-- DOD:END -->
