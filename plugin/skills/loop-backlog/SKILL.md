---
name: loop-backlog
description: "Autonomous unified B″ Worker for the backlog.md board. Drives BOTH lanes from one Monitor session: basic-ready events execute kind:basic tasks in isolated git worktrees that merge back on success; epic-ready events auto-decompose a kind:epic task (Epic: Ready → Decomposing → children at Basic: Backlog → Awaiting Children); child-done events reconcile the parent epic and, when all children are Basic: Done, run evaluate and write a FINISH/ITERATE recommendation for human confirmation. Invoke /loop-backlog once; it runs until the backlog/.loop-stop sentinel is written."
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Monitor, Agent
contracts:
  - grep: "Monitor(persistent=true"
    target: self
  - grep: "description=\""
    target: self
  - grep: "description : String"
    target: self
  - not-grep: "schedule("
    target: self
  - grep: "loop-stop"
    target: self
  - grep: "## Shutdown"
    target: self
  - grep: "daemonBootstrap"
    target: self
  - not-grep: "ScheduleWakeup"
    target: self
  - grep: "basic-daemon"
    target: self
  - grep: ".daemon.pid"
    target: self
  - grep: "Agent(run_in_background=true"
    target: self
  - grep: "\"Basic: In Progress\""
    target: self
  - grep: ".agent-done-"
    target: self
  - grep: "executePrompt"
    target: self
  - grep: '"DoD #.*: PASS"'
    target: self
  - grep: '"DoD #.*: FAIL"'
    target: self
  - grep: "epic-ready"
    target: self
  - grep: "child-done"
    target: self
  - grep: "epicDecompose"
    target: self
  - grep: "decomposer"
    target: self
  - grep: "recommendation"
    target: self
  - grep: "Epic: Awaiting Children"
    target: self
---

λ() → workerLoop()

## Spec

-- External primitives (provided by the Claude Code harness / shell environment;
-- not implemented in this skill)
Monitor      :: { persistent : Bool, command : String, description : String } → Event
exists       :: Path → Bool
fromClaudeMd :: () → RawText

-- Business logic signatures
ensureDaemonScript :: () → ()  -- intentional primitive: implemented in Implementation section
daemonBootstrap :: () → ()  -- intentional primitive: implemented in Implementation section
inProgressTasks :: () → [Task]  -- spec gap: no implementation body defined
stopSentinel :: () → Bool  -- spec gap: no implementation body defined
createWorktree :: Task → Path  -- spec gap: no implementation body defined
readyTasks :: () → [Task]  -- spec gap: no implementation body defined
followDescription :: (Description, Context) → ()  -- spec gap: no implementation body defined
appendNote :: (Task, String) → ()  -- spec gap: no implementation body defined
reset :: (Task, Status) → ()  -- spec gap: no implementation body defined
removeWorktree :: Task → ()  -- spec gap: no implementation body defined
checkDod :: (Task, Int) → ()  -- spec gap: no implementation body defined

Config :: {
  symlinks    : [Path]   -- dirs to symlink into worktree ([] = none)
  maxParallel : Int      -- max concurrent background agents (default 2)
}

loadConfig :: () → Config  -- see spec-stdlib § loadConfig
loadConfig() =
  | fromClaudeMd()   -- explicit: "## L0 Config" section in CLAUDE.md
                     -- reads: worktree-symlinks, max-parallel (default 2)
  | autoDetect()     -- implicit: probe package.json, go.mod, Cargo.toml, etc.

autoDetect :: () → Config
autoDetect() = -- see spec-stdlib § loadConfig

detectLang :: () → Lang  -- see spec-stdlib § detectLang
-- see spec-stdlib § detectLang

data Outcome = Done CommitHash | NeedsHuman Reason | Idle | Stopped

ensureDaemonTest :: () → ()
-- Write scripts/basic-daemon.test.js if it doesn't exist or is outdated.
-- Runs node on the test file to verify the daemon helpers are correct.

workerLoop :: () → Outcome
workerLoop() = {
  cfg:    loadConfig(),
  _:      ensureDaemonScript(),
  _:      ensureDaemonTest(),
  _:      daemonBootstrap(),
  _:      reap(inProgressTasks()),
  tasks:  claimBatch(cfg.maxParallel),

  if (stopSentinel()):
    return: Stopped,

  if (empty(tasks)):
    -- No basic task to claim; block persistently and dispatch the next daemon event.
    -- The unified daemon (basic-daemon.js v8) emits FIVE channels; this one worker
    -- session handles all of them (no separate loop-meta session needed).
    event: Monitor(persistent=true,
        command="tail -f -n 0 \"$DAEMON_LOG\"",
        description="loop-backlog daemon notification. An event line (basic-ready:TASK-N, epic-ready:TASK-N, child-done:TASK-N, proposal-approved:TASK-N, or plan-approved:TASK-N) has arrived from the backlog task board. If this is a new Claude session, invoke /loop-backlog in the project root to resume the worker loop — it will re-claim and dispatch this event automatically."
      ),
    | stopSentinel()                            → return Stopped
    | event matches "basic-ready:TASK-*"        → workerLoop()              -- re-claim & execute
    | event matches "epic-ready:TASK-*"         → epicDecompose(extractId(event)); workerLoop()
    | event matches "child-done:TASK-*"         → onChildDone(extractId(event)); workerLoop()
    | event matches "proposal-approved:TASK-*"  → startPlanDraft(extractId(event)); workerLoop()
    | event matches "plan-approved:TASK-*"      → startFinalise(extractId(event));  workerLoop()
    | otherwise                                 → workerLoop(),             -- noise: loop back

  -- Parallel: create worktrees and spawn one background agent per task
  worktrees: ∀t ∈ tasks: withWorktree(t, cfg),
  _:         ∀(t, wt) ∈ zip(tasks, worktrees): spawnAgent(t, wt),

  -- Wait for all agents to signal completion
  results: waitForAgents(tasks),

  -- Serial: merge each branch in order; read signal file to decide merge vs. escalate
  ∀t ∈ tasks: {
    sig: results[t],
    _:   deleteSignalFile("backlog/.agent-done-" + t.id),
    if (sig == "done"):
      verifyDod(t),
      merge(t, t.branch)
    else:
      escalate(t, stripPrefix("needs-human: ", sig))
  },

  return: Done
}

-- ─────────────────────────────────────────────────────────────────────────────
-- Epic lane dispatch (B″). The unified daemon delivers epic-ready / child-done to
-- this same worker. epic-ready means the human promoted Epic: Backlog → Epic: Ready
-- (authorizing autonomous decomposition). child-done means a kind:basic child reached
-- Basic: Done; we re-check its parent epic. All transitions write cap:* idempotency
-- markers, mirroring the basic lane. See spec-stdlib § reviewLoop is NOT used here —
-- proposal/plan review happens interactively in epic-to-backlog, not in this worker.
-- ─────────────────────────────────────────────────────────────────────────────

-- epicDecompose: triggered by epic-ready (status Epic: Ready). Checks preconditions then
-- spawns a single background agent that handles ALL decomposition work autonomously.
-- Orchestrator returns immediately after spawning (spawn-and-forget pattern).
-- The background agent: sets Decomposing, creates children via task-to-backlog, runs R1
-- guard, advances to Awaiting Children or escalates to Needs Human on failure.
epicDecompose :: TaskId → Outcome
epicDecompose(id) = {
  if (¬isEpicReady(id)):        return Idle,     -- status changed out from under us
  if (hasCap(id, "decompose")): return Idle,     -- already decomposed (idempotent)
  _:    Agent(run_in_background=true, prompt=decomposeAgentPrompt(id)),
  return: Reconciled                              -- orchestrator returns immediately; agent is autonomous
}

-- decomposeAgentPrompt: the background agent performs ALL decomposition steps:
-- 1. Idempotency check: if cap:decompose=done already set, exit immediately.
-- 2. Write cap:decompose=started.
-- 3. setStatus(id, "Epic: Decomposing").
-- 4. Read Sub-Task Decomposition from epic plan.
-- 5. ∀t ∈ subs: createSubTask(id, t) via feature-to-backlog (code-change tasks) or
--    task-to-backlog (doc/config/research-only tasks) — never raw backlog task create.
--    (kind:basic, parent_task_id:id, shell-gate DoD).
-- 6. R1 guard: verifySubTaskDod(id).
-- 7. On R1 pass: appendNote(id, "cap:decompose=done") + setStatus(id, "Epic: Awaiting Children").
-- 8. On R1 fail or any error: escalateEpic(id, reason, "cap:decompose=failed|<reason>")
--    → setStatus(id, "Epic: Needs Human").
decomposeAgentPrompt :: TaskId → Prompt

-- onChildDone: triggered by child-done (a kind:basic child hit Basic: Done). Find the
-- parent epic; if it is a kind:epic at Epic: Awaiting Children and ALL its created
-- children are Basic: Done, advance to Epic: Evaluating and evaluate. "All created" =
-- every task with parent_task_id == epicId (archived children are excluded by archival).
onChildDone :: TaskId → Outcome
onChildDone(childId) = {
  epicId: parentTaskId(childId),
  if (epicId == ∅ ∨ ¬isKindEpic(epicId)):              return Idle,
  if (status(epicId) ≠ "Epic: Awaiting Children"):     return Idle,
  children: childrenOf(epicId),                          -- tasks with parent_task_id == epicId
  done:     filter(c → status(c) == "Basic: Done", children),
  needsHuman: filter(c → status(c) == "Basic: Needs Human", children),
  if (length(done) < length(children)):
    appendNote(epicId, "onChildDone: " + length(done) + "/" + length(children) + " children done"),
    return Idle,                                          -- wait for the rest
  _:  setStatus(epicId, "Epic: Evaluating"),             -- auto-processing
  return: epicEvaluate(epicId, done, needsHuman)
}

-- epicEvaluate: aggregate child outcomes (measured: DoD pass + no Needs Human), write a
-- FINISH/ITERATE recommendation, then SOFT-HALT. Does NOT auto-advance to Epic: Done —
-- the human reads the recommendation and confirms (Epic: Evaluating → Epic: Done) or
-- iterates (Epic: Evaluating → Epic: Proposal | Epic: Plan, re-run epic-to-backlog).
epicEvaluate :: (TaskId, [Task], [Task]) → Outcome
epicEvaluate(id, done, needsHuman) = {
  if (hasCap(id, "evaluate")): return Idle,
  verdict: if (empty(needsHuman) ∧ allDodPass(done)): "FINISH" else: "ITERATE",
  reason:  if (verdict == "FINISH"): "all children Basic: Done with DoD pass"
           else: "blockers: " + summarise(needsHuman) + " / DoD failures",
  _: appendNote(id, "cap:evaluate=recommendation:" + verdict
               + " | done=" + length(done) + " needsHuman=" + length(needsHuman)
               + " | " + reason + " | data_source: measured"),
  _: appendNote(id, "RECOMMENDATION: " + verdict
               + ".\nTo finish: set status → Epic: Done."
               + "\nTo iterate: set status → Epic: Proposal or Epic: Plan and re-run /epic-to-backlog."),
  -- soft halt: stay at Epic: Evaluating; cap:evaluate guard makes re-emits no-ops.
  return: Reconciled
}

-- escalateEpic: park the epic at Epic: Needs Human with a cap marker and reason note.
escalateEpic :: (TaskId, Reason, CapMarker) → Outcome
escalateEpic(id, r, cap) = {
  appendNote(id, cap),
  appendNote(id, "Escalated: " + r + "\nTo continue: resolve in notes, set status → Epic: Ready."),
  setStatus(id, "Epic: Needs Human"),
  return: NeedsHuman(r)
}

-- startPlanDraft: triggered by proposal-approved (human advanced status to Epic: Plan or
-- Basic: Plan after proposal was APPROVED). Spawns a background agent to run Phase 3
-- (draftEpicPlan / draftPlan) of the respective skill. The agent updates the task and
-- writes a plan draft. The daemon will subsequently detect plan-approved when the human
-- advances to Epic: Backlog / Basic: Ready after plan review.
startPlanDraft :: TaskId → ()
startPlanDraft(id) = Agent(run_in_background=true, prompt=planDraftPrompt(id))

-- startFinalise: triggered by plan-approved (human advanced status to Epic: Backlog or
-- Basic: Ready after plan was APPROVED). Spawns a background agent to run Phase 5
-- (finalise) of the respective skill. The agent writes combined proposal+plan into the
-- task implementation plan and parks the task.
startFinalise :: TaskId → ()
startFinalise(id) = Agent(run_in_background=true, prompt=finalisePrompt(id))

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

-- verifySubTaskDod: R1 guard — every child of the epic carries a shell-gate DoD.
verifySubTaskDod :: TaskId → Bool
verifySubTaskDod(id) = shell("bash "${REPO_ROOT}/scripts/verify-subtask-dod.sh" " + id) == 0

-- allDodPass: measured slice — every done child's DoD shell-gates exit 0 (re-run).
allDodPass :: [Task] → Bool
allDodPass(done) = ∀c ∈ done: shell("bash "${REPO_ROOT}/scripts/verify-subtask-dod.sh" " + c.id) == 0

reap :: [Task] → ()
reap(tasks) = ∀t ∈ tasks
  where claimAge(t) > 30min ∨ ¬hasClaimed(t): {
    reset(t, "Basic: Ready"),
    appendNote(t, "Requeued by reaper: in-progress timeout."),
    removeWorktree(t)
  }

claimBatch :: Int → [Task]
claimBatch(n) = {
  tasks: take(n, basicReadyTasks()),
  if (empty(tasks)): return [],
  ∀t ∈ tasks: atomically: {
    setStatus(t, "Basic: In Progress"),
    appendNote(t, "claimed: " + now()),
    writeCap(t, "cap:claim=started")
  },
  return: tasks        -- actual list; may be fewer than n if fewer Basic: Ready tasks exist
}

-- spawnAgent: launch a background agent for a single task in its worktree.
-- The agent works only inside wt, commits if changed, then writes a signal file.
-- Agent's allowed-tools explicitly excludes Agent to prevent recursive spawn.
spawnAgent :: (Task, Worktree) → ()
spawnAgent(T, wt) =
  Agent(run_in_background=true, prompt=executePrompt(T, wt))

-- waitForAgents: poll signal files until all agents in the batch have reported.
-- Signal file path: backlog/.agent-done-TASK-N
-- Content: "done" | "needs-human: <reason>"
-- Polls every 5 seconds; no external dependencies beyond bash.
waitForAgents :: [Task] → Map Task SignalContent
waitForAgents(tasks) = {
  remaining: tasks,
  results:   {},
  loop while (nonEmpty(remaining)): {
    sleep(5),
    ∀t ∈ remaining:
      if (exists("backlog/.agent-done-" + t.id)):
        content: read("backlog/.agent-done-" + t.id),
        results[t]: content,
        remaining:  remaining \ {t}
  },
  return: results
}

withWorktree :: Task → Config → (Task → a) → a
withWorktree(T, cfg, f) = {
  wt:  createWorktree(T),
  _:   ∀s ∈ cfg.symlinks: symlink(repoRoot + "/" + s, wt + "/" + s),
  cd:  wt,
  return: f(T)
}

-- execute is task-type-agnostic: T.description is the sole authority on what to do
-- If re-claimed after a Needs Human cycle, human reply in Notes takes precedence.
execute :: Task → Outcome
execute(T) = {
  ctx:    readHumanReply(T),       -- extract human's answer if re-claimed after escalation
  _:      followDescription(T.description, ctx),
  _:      ∀(n, cmd) ∈ enumerate(T.dodCommands): verifyDod(T, n, cmd),
  hash:   conditionalCommit(T),
  _:      appendSummary(T, hash),
  return: merge(T, hash)
} | cannotProceed(reason) → escalate(T, reason)

-- appendCheckpoint: record completion of a phase in the task's Implementation Notes.
-- Called after each ## Phase section in the task Description completes.
appendCheckpoint :: (Task, PhaseIndex, Summary) → ()
appendCheckpoint(T, x, summary) =
  appendNote(T, "Phase " + x + " ✓ " + now() + "\n" + summary)

-- appendDodNote: record pass/fail result of a DoD command.
-- Called once per DoD item; on failure includes up to 5 lines of error output.
appendDodNote :: (Task, Int, ShellCmd, Result) → ()
appendDodNote(T, n, cmd, Pass)       = appendNote(T, "DoD #" + n + ": PASS — " + cmd)
appendDodNote(T, n, cmd, Fail(out))  = appendNote(T, "DoD #" + n + ": FAIL — " + cmd
                                                     + "\n" + take(5, lines(out)))

-- appendSummary: write the final Execution Summary before the signal file is written.
-- Must be called after all phases and DoD checks have completed.
appendSummary :: (Task, Maybe CommitHash) → ()
appendSummary(T, hash) =
  appendNote(T, "## Execution Summary\n"
               + "Result: " + outcomeLabel(T) + "\n"
               + "Commit: " + fromMaybe("no changes", hash) + "\n"
               + executionLog(T))

-- readHumanReply: scan Notes for a human reply written after the last "Escalated:" entry.
-- Returns a context map that followDescription uses to resolve open questions.
readHumanReply :: Task → Context
readHumanReply(T) =
  | hasEscalatedNote(T) →
      reply: textAfterLastEscalated(T.notes),
      if (nonEmpty(reply)): return parseContext(reply)   -- treat reply as free-form; extract decisions
  | otherwise → emptyContext

-- escalate: only exit when the worker cannot continue without human input.
-- Never ask the user a question while a task is In Progress; call escalate() instead.
-- Write a clear "Human, please answer:" question so the user can reply directly in Notes.
escalate :: (Task, Reason) → Outcome
escalate(T, r) = {
  setStatus(T, "Basic: Needs Human"),
  writeCap(T, "cap:execute=failed"),
  appendNote(T, "Escalated: " + r
               + "\nTo continue: answer in Implementation Notes, then set status → Basic: Ready."),
  return: NeedsHuman(r)
}

verifyDod :: (Task, Int, ShellCmd) → ()
verifyDod(T, n, cmd) =
  | eval(cmd).exitCode == 0 → checkDod(T, n)
  | attempts(n) < 3         → fix(); verifyDod(T, n, cmd)
  | otherwise               → raise Stuck(n, cmd)

conditionalCommit :: Task → Maybe CommitHash
conditionalCommit(T) =
  | hasChanges() → git add -A; commit(T); return Just(HEAD)
  | otherwise    → return Nothing

merge :: (Task, Maybe CommitHash) → Outcome
merge(T, hash) =
  | mergeNoFF(T.branch) succeeds → markDone(T, hash); removeWorktree(T); Done(hash)
  | otherwise                    → markNeedsHuman(T, "merge conflict"); NeedsHuman("merge conflict")

## basicDAG — Basic Worker State Machine

The basic channel uses the following status transitions (basicDAG):

```
Basic: Ready
  → (claim)          Basic: In Progress    cap:claim=started
  → (execute done)   Basic: Done           cap:execute=done
  → (execute failed) Basic: Needs Human    cap:execute=failed
  → (merge conflict) Basic: Needs Human    cap:merge=failed
```

### Dispatch spec

When a `basic-ready:TASK-N` event arrives, the worker MUST execute these steps in order:

**Step 1 — Claim (set `Basic: In Progress` BEFORE any other work):**
```bash
backlog task edit TASK-N --status "Basic: In Progress" \
  --append-notes "claimed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
# Write idempotency marker
echo "cap:claim=started" >> backlog/.caps/TASK-N
```

**Step 2 — Spawn implementation agent (NEVER do implementation inline):**
```
Agent(run_in_background=true, prompt=executePrompt(TASK-N, worktree, branch, signal_file))
```
The `allowed-tools` passed to the agent explicitly excludes `Agent` to prevent recursive spawn.

**Step 3 — Wait for signal file:**
```bash
# Poll until backlog/.agent-done-TASK-N exists
```

**Step 4 — Merge and mark Done (cap:execute=done):**
```bash
git merge --no-ff <branch>
backlog task edit TASK-N --status "Basic: Done" \
  --append-notes "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
# Write terminal idempotency marker
echo "cap:execute=done" >> backlog/.caps/TASK-N
```

**Step 5 — notifyParentIfAny:**
After reaching a terminal status (`Basic: Done` or `Basic: Needs Human`), check if
`parent_task_id` is set in the task frontmatter. If so, emit a completion note to the parent:
```bash
PARENT=$(backlog task view TASK-N --plain | grep -oP '(?<=parent_task_id: )TASK-\d+(\.\d+)*')
if [ -n "$PARENT" ]; then
  backlog task edit "$PARENT" --append-notes \
    "Sub-task TASK-N reached terminal status: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi
```

### cap:* idempotency markers

`cap:*` markers are written to `backlog/.caps/TASK-N` at each state transition.
They prevent double-execution if the worker is restarted mid-task:

| marker              | meaning                          |
|---------------------|----------------------------------|
| `cap:claim=started` | task has been claimed            |
| `cap:execute=done`  | agent completed successfully     |
| `cap:execute=failed`| agent escalated (Needs Human)    |
| `cap:merge=failed`  | merge conflict (Needs Human)     |

Before claiming, the worker checks if a `cap:claim=started` marker already exists for the
task — if so, it skips re-claiming and waits for the existing signal file instead.

**Prohibited shortcut**: doing implementation directly in the worker agent (without `Agent(run_in_background=true, ...)`) violates Step 2 and causes Step 1 to be silently skipped in practice. The task will jump from `Basic: Ready` → `Basic: Done` without ever entering `Basic: In Progress`.

---

## Critical Protocol (MUST NOT deviate)

When a `basic-ready:TASK-N` event arrives, the worker MUST execute these steps in order:

**Step 1 — Claim (set `Basic: In Progress` BEFORE any other work):**
```bash
backlog task edit TASK-N --status "Basic: In Progress" \
  --append-notes "claimed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

**Step 2 — Spawn implementation agent (NEVER do implementation inline):**
```
Agent(run_in_background=true, prompt=executePrompt(TASK-N, worktree, branch, signal_file))
```
The `allowed-tools` passed to the agent explicitly excludes `Agent` to prevent recursive spawn.

**Step 3 — Wait for signal file:**
```bash
# Poll until backlog/.agent-done-TASK-N exists
```

**Step 4 — Merge and mark `Basic: Done`:**
```bash
git merge --no-ff <branch>
backlog task edit TASK-N --status "Basic: Done" \
  --append-notes "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

**Prohibited shortcut**: doing implementation directly in the worker agent (without `Agent(run_in_background=true, ...)`) violates Step 2 and causes Step 1 to be silently skipped in practice. The task will jump from `Basic: Ready` → `Basic: Done` without ever entering `Basic: In Progress`.

---

## Implementation

### loadConfig

Read `CLAUDE.md` for an `## L0 Config` section. If not found, auto-detect from project files.

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)

# --- fromClaudeMd ---
L0_SECTION=$(awk '/^## L0 Config/{found=1; next} found && /^## /{exit} found{print}' \
  "${REPO_ROOT}/CLAUDE.md" 2>/dev/null)

parse_cfg() { echo "$L0_SECTION" | grep -oP "(?<=^$1:\s)\S.*" | head -1 | xargs; }

CFG_SYMLINKS=$(parse_cfg "worktree-symlinks")
CFG_MAX_PARALLEL=$(parse_cfg "max-parallel")
CFG_MAX_PARALLEL=${CFG_MAX_PARALLEL:-2}

# --- autoDetect fallback ---
if [ -z "$L0_SECTION" ]; then
  if   [ -f "${REPO_ROOT}/package.json" ]; then CFG_SYMLINKS="${CFG_SYMLINKS:-node_modules}"
  else                                          CFG_SYMLINKS="${CFG_SYMLINKS:-}"
  fi
  echo "L0 auto-detected config: symlinks=${CFG_SYMLINKS:-none}"
else
  echo "L0 config loaded from CLAUDE.md: symlinks=${CFG_SYMLINKS:-none}"
fi

# Normalise "none" → empty
[ "$CFG_SYMLINKS" = "none" ] && CFG_SYMLINKS=""
```

### ensureDaemonScript

Write the daemon script to `scripts/basic-daemon.js` (or `scripts/basic-daemon.cjs` in
ESM projects where `"type": "module"` is set in package.json), overwriting if the version
tag does not match. Node.js is guaranteed available on every Claude Code install; no
runtime dependency needed.

```bash
# Detect ESM project; use .cjs extension to avoid CJS/ESM conflict
if grep -q '"type"[[:space:]]*:[[:space:]]*"module"' "${REPO_ROOT}/package.json" 2>/dev/null; then
  DAEMON_EXT="cjs"
else
  DAEMON_EXT="js"
fi
DAEMON_SCRIPT="${REPO_ROOT}/scripts/basic-daemon.${DAEMON_EXT}"
DAEMON_VERSION="v7"

NEED_WRITE=true
if [ -f "$DAEMON_SCRIPT" ]; then
  FILE_VER=$(head -3 "$DAEMON_SCRIPT" | grep -oP '(?<=daemon-version: )v\d+' || true)
  [ "$FILE_VER" = "$DAEMON_VERSION" ] && NEED_WRITE=false
fi

if [ "$NEED_WRITE" = "true" ]; then
  mkdir -p "${REPO_ROOT}/scripts"
  cat > "$DAEMON_SCRIPT" << 'DAEMON_EOF'
#!/usr/bin/env node
// daemon-version: v7
/**
 * basic-daemon.js — UNIFIED B″ poller. Polls backlog tasks dir and emits three
 * event channels to stdout:
 *
 *   basic-ready:TASK-N   kind:basic AND status "Basic: Ready"   → worker executes task
 *   epic-ready:TASK-N    kind:epic  AND status "Epic: Ready"    → worker auto-decomposes
 *   child-done:TASK-N    kind:basic AND status "Basic: Done" AND has parent_task_id
 *                                                               → worker re-checks parent epic
 *
 * One daemon, one log; the loop-backlog worker dispatches by event prefix. Replaces the
 * former separate basic-daemon/epic-daemon split. Note: epic-ready fires ONLY for
 * "Epic: Ready" (the human-authorized state) — Epic: Proposal/Plan are handled by the
 * interactive epic-to-backlog skill, and Decomposing/Awaiting Children/Evaluating are
 * driven by the worker (via epic-ready then child-done), not by polling.
 *
 * Stops on stop-sentinel file or SIGTERM. Pure Node.js stdlib — no npm dependencies.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const BASIC_READY_STATUS = 'basic: ready';
const EPIC_READY_STATUS  = 'epic: ready';
const BASIC_DONE_STATUS  = 'basic: done';

function parseArgs(argv) {
  const args = {
    tasksDir: 'backlog/tasks',
    pidFile:  'backlog/.basic-daemon.pid',
    stopFile: 'backlog/.loop-stop',
    interval: 0.5,
  };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--tasks-dir':  args.tasksDir = argv[++i]; break;
      case '--pid-file':   args.pidFile  = argv[++i]; break;
      case '--stop-file':  args.stopFile = argv[++i]; break;
      case '--interval':   args.interval = parseFloat(argv[++i]); break;
      case '--help': case '-h':
        process.stdout.write(
          'Usage: basic-daemon.js [options]  (unified B″ poller)\n' +
          '  --tasks-dir <path>  Directory of task markdown files (default: backlog/tasks)\n' +
          '  --pid-file  <path>  PID file path (default: backlog/.basic-daemon.pid)\n' +
          '  --stop-file <path>  Stop sentinel path (default: backlog/.loop-stop)\n' +
          '  --interval  <secs> Poll interval in seconds (default: 0.5)\n'
        );
        process.exit(0);
    }
  }
  return args;
}

function parseTaskId(filename) {
  const base = path.basename(filename, path.extname(filename)).toUpperCase();
  for (const part of base.split(/\s+/)) {
    if (/^TASK-\d+(\.\d+)*$/.test(part)) return part;
  }
  const m = base.match(/\bTASK-(\d+(?:\.\d+)*)\b/);
  return m ? `TASK-${m[1]}` : null;
}

// Returns { status, hasKindBasic, hasKindEpic, parent_task_id } from a task file.
function readTaskMeta(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const m = content.match(/^---\n([\s\S]*?)^---/m);
    if (!m) return null;
    const fm = m[1];

    const statusMatch = fm.match(/^status:\s*(.+)$/m);
    const status = statusMatch ? statusMatch[1].trim().replace(/['"]/g, '').toLowerCase() : null;

    const parentMatch = content.match(/^parent_task_id:\s*(.+)$/m);
    const parent_task_id = parentMatch ? parentMatch[1].trim().toUpperCase() : null;

    // Parse labels — support both inline [] and block list formats
    let labels = [];
    const inlineLabels = fm.match(/^labels:\s*\[([^\]]*)\]/m);
    if (inlineLabels) {
      labels = inlineLabels[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    } else {
      // Block list: lines after "labels:" that start with "  - "
      const blockMatch = fm.match(/^labels:\s*\n((?:  - .+\n?)*)/m);
      if (blockMatch) {
        labels = blockMatch[1].split('\n')
          .map(l => l.replace(/^\s+-\s+/, '').trim().replace(/['"]/g, ''))
          .filter(Boolean);
      }
    }

    const hasKindBasic = labels.includes('kind:basic');
    const hasKindEpic  = labels.includes('kind:epic');

    return { status, hasKindBasic, hasKindEpic, parent_task_id };
  } catch { /* unreadable */ }
  return null;
}

function isBasicReady(filepath) {
  const meta = readTaskMeta(filepath);
  if (!meta) return false;
  return meta.hasKindBasic && !meta.hasKindEpic && meta.status === BASIC_READY_STATUS;
}

function isEpicReady(filepath) {
  const meta = readTaskMeta(filepath);
  if (!meta) return false;
  return meta.hasKindEpic && !meta.hasKindBasic && meta.status === EPIC_READY_STATUS;
}

function isChildDone(filepath) {
  const meta = readTaskMeta(filepath);
  if (!meta) return false;
  return meta.hasKindBasic && !meta.hasKindEpic
      && meta.status === BASIC_DONE_STATUS && !!meta.parent_task_id;
}

// Scan tasksDir, returning a Set of IDs for which predicate(filepath) is true.
function scanIds(tasksDir, predicate) {
  const out = new Set();
  let entries;
  try { entries = fs.readdirSync(tasksDir); } catch { return out; }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const id = parseTaskId(entry);
    if (id && predicate(path.join(tasksDir, entry))) out.add(id);
  }
  return out;
}

// Backward-compatible alias used by the embedded self-test.
function scanBasicReadyIds(tasksDir) { return scanIds(tasksDir, isBasicReady); }

const args       = parseArgs(process.argv);
const intervalMs = Math.round(args.interval * 1000);

const pidDir = path.dirname(args.pidFile);
if (pidDir) fs.mkdirSync(pidDir, { recursive: true });
fs.writeFileSync(args.pidFile, String(process.pid));

function removePid() { try { fs.unlinkSync(args.pidFile); } catch { /* gone */ } }
process.on('exit',    removePid);
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT',  () => process.exit(0));

// One notified set per channel; emit a given id once until it leaves the trigger state.
const channels = [
  { prefix: 'basic-ready', predicate: isBasicReady, notified: new Set() },
  { prefix: 'epic-ready',  predicate: isEpicReady,  notified: new Set() },
  { prefix: 'child-done',  predicate: isChildDone,  notified: new Set() },
];

const timer = setInterval(() => {
  if (fs.existsSync(args.stopFile)) { clearInterval(timer); process.exit(0); }

  for (const ch of channels) {
    const ids = scanIds(args.tasksDir, ch.predicate);
    // Evict IDs no longer in the trigger state (allows re-emit on a future re-entry)
    for (const id of ch.notified) { if (!ids.has(id)) ch.notified.delete(id); }
    // Emit new IDs (sorted for determinism)
    for (const id of [...ids].filter(id => !ch.notified.has(id)).sort()) {
      process.stdout.write(`${ch.prefix}:${id}\n`);
      ch.notified.add(id);
    }
  }
}, intervalMs);
DAEMON_EOF
  echo "ensureDaemonScript: wrote $DAEMON_SCRIPT (${DAEMON_VERSION})"
fi
```

### ensureDaemonTest

Write the unit-test file `scripts/basic-daemon.test.js` if it does not exist,
then run it. Tests cover the pure helper functions. Run this immediately after
`ensureDaemonScript` so a broken daemon is caught before the daemon is launched.

```bash
TEST_EXT="${DAEMON_EXT:-js}"
TEST_SCRIPT="${REPO_ROOT}/scripts/basic-daemon.test.${TEST_EXT}"

if [ ! -f "$TEST_SCRIPT" ]; then
  cat > "$TEST_SCRIPT" << 'TEST_EOF'
#!/usr/bin/env node
// Unit tests for basic-daemon.js helper functions.
// Run with: node scripts/basic-daemon.test.js
'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── inline copies of the pure helpers (keep in sync with daemon) ──────────────

function parseTaskId(filename) {
  const base = path.basename(filename, path.extname(filename)).toUpperCase();
  for (const part of base.split(/\s+/)) {
    if (/^TASK-\d+(\.\d+)*$/.test(part)) return part;
  }
  const m = base.match(/\bTASK-(\d+(?:\.\d+)*)\b/);
  return m ? `TASK-${m[1]}` : null;
}

function isBasicReady(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const m = content.match(/^---\n([\s\S]*?)^---/m);
    if (!m) return false;
    const fm = m[1];
    const statusMatch = fm.match(/^status:\s*(.+)$/m);
    const status = statusMatch ? statusMatch[1].trim().toLowerCase() : null;
    if (status !== 'basic: ready') return false;
    const inlineLabels = fm.match(/^labels:\s*\[([^\]]*)\]/m);
    if (inlineLabels) {
      const labels = inlineLabels[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
      return labels.includes('kind:basic') && !labels.includes('kind:epic');
    }
  } catch { /* unreadable */ }
  return false;
}

function scanBasicReadyIds(tasksDir) {
  const ready = new Set();
  let entries;
  try { entries = fs.readdirSync(tasksDir); } catch { return ready; }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const id = parseTaskId(entry);
    if (id && isBasicReady(path.join(tasksDir, entry))) ready.add(id);
  }
  return ready;
}

// ── test harness ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function assert(desc, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { process.stdout.write(`  ✓ ${desc}\n`); passed++; }
  else     { process.stderr.write(`  ✗ ${desc}\n    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(actual)}\n`); failed++; }
}

// ── parseTaskId ───────────────────────────────────────────────────────────────
process.stdout.write('parseTaskId\n');
assert('simple prefix',       parseTaskId('task-3 - do something.md'),             'TASK-3');
assert('upper already',       parseTaskId('TASK-10 - title.md'),                   'TASK-10');
assert('embedded id',         parseTaskId('sprint-TASK-7-notes.md'),               'TASK-7');
assert('no id returns null',  parseTaskId('README.md'),                            null);
assert('multi-digit',         parseTaskId('task-42 - long title here.md'),         'TASK-42');

// ── isBasicReady ──────────────────────────────────────────────────────────────
process.stdout.write('isBasicReady\n');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-test-'));

const basicReadyFile = path.join(tmp, 'ready.md');
fs.writeFileSync(basicReadyFile,
  '---\nstatus: Basic: Ready\nlabels: [kind:basic]\n---\n# Task\n');
assert('basic ready with kind:basic', isBasicReady(basicReadyFile), true);

const epicFile = path.join(tmp, 'epic.md');
fs.writeFileSync(epicFile,
  '---\nstatus: Basic: Ready\nlabels: [kind:basic, kind:epic]\n---\n# Task\n');
assert('kind:epic excluded', isBasicReady(epicFile), false);

const doneFile = path.join(tmp, 'done.md');
fs.writeFileSync(doneFile,
  '---\nstatus: Basic: Done\nlabels: [kind:basic]\n---\n# Task\n');
assert('basic done → false', isBasicReady(doneFile), false);

// ── scanBasicReadyIds ─────────────────────────────────────────────────────────
process.stdout.write('scanBasicReadyIds\n');
const dir = path.join(tmp, 'tasks');
fs.mkdirSync(dir);

fs.writeFileSync(path.join(dir, 'task-1 - alpha.md'),
  '---\nstatus: Basic: Ready\nlabels: [kind:basic]\n---\n');
fs.writeFileSync(path.join(dir, 'task-2 - beta.md'),
  '---\nstatus: Basic: Done\nlabels: [kind:basic]\n---\n');
fs.writeFileSync(path.join(dir, 'task-3 - gamma.md'),
  '---\nstatus: Basic: Ready\nlabels: [kind:basic]\n---\n');
fs.writeFileSync(path.join(dir, 'not-a-task.txt'),
  '---\nstatus: Basic: Ready\nlabels: [kind:basic]\n---\n');  // ignored

const ids = scanBasicReadyIds(dir);
assert('finds basic ready tasks', [...ids].sort(), ['TASK-1', 'TASK-3']);
assert('skips done tasks',        ids.has('TASK-2'), false);
assert('skips non-md files',      ids.size, 2);

assert('missing dir → empty', [...scanBasicReadyIds(path.join(tmp, 'no-such-dir'))].length, 0);

// ── cleanup + result ──────────────────────────────────────────────────────────
fs.rmSync(tmp, { recursive: true });
process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
TEST_EOF
  echo "ensureDaemonTest: wrote $TEST_SCRIPT"
fi

node "$TEST_SCRIPT"
```

### daemonBootstrap

Start the basic-daemon if not already running. The daemon polls `backlog/tasks/`
for `kind:basic` tasks at `Basic: Ready` status, and writes `basic-ready:TASK-N`
lines to stdout, which Monitor picks up as events.

```bash
BACKLOG_DIR="${REPO_ROOT}/backlog"
PID_FILE="${BACKLOG_DIR}/.basic-daemon.pid"
STOP_FILE="${BACKLOG_DIR}/.loop-stop"
TASKS_DIR="${BACKLOG_DIR}/tasks"
DAEMON_LOG="${BACKLOG_DIR}/.basic-daemon.log"

# Remove stale stop sentinel from a previous run
rm -f "$STOP_FILE"

# Start daemon only if not already running
DAEMON_RUNNING=false
if [ -f "$PID_FILE" ]; then
  DPID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$DPID" ] && kill -0 "$DPID" 2>/dev/null; then
    DAEMON_RUNNING=true
    echo "daemonBootstrap: basic-daemon already running (pid $DPID)"
  fi
fi

if [ "$DAEMON_RUNNING" = "false" ]; then
  nohup node "$DAEMON_SCRIPT" \
    --tasks-dir "$TASKS_DIR" \
    --pid-file  "$PID_FILE"  \
    --stop-file "$STOP_FILE" \
    --interval  0.5 \
    >> "$DAEMON_LOG" 2>/dev/null & disown
  # Poll for PID file instead of fixed sleep (handles slow Node cold-starts)
  for i in $(seq 1 25); do [ -f "$PID_FILE" ] && break; sleep 0.2; done
  DPID=$(cat "$PID_FILE" 2>/dev/null || true)
  echo "daemonBootstrap: started basic-daemon (pid ${DPID:-unknown})"
fi
```

### reap

```bash
backlog task list --status "Basic: In Progress" --plain \
  | grep -oP 'TASK-\d+' \
  | while read TASK_ID; do
    VIEW=$(backlog task view "$TASK_ID" --plain)
    CLAIMED=$(echo "$VIEW" | grep -oP '(?<=claimed: )\S+' | tail -1)
    AGE=9999
    if [ -n "$CLAIMED" ]; then
      AGE=$(( $(date -u +%s) - $(date -u -d "$CLAIMED" +%s 2>/dev/null || echo 0) ))
    fi
    if [ $AGE -gt 1800 ]; then
      backlog task edit "$TASK_ID" --status "Basic: Ready" \
        --append-notes "Requeued by reaper: in-progress timeout exceeded 30 minutes."
      PROJECT_NAME=$(basename "$REPO_ROOT")
      WORKTREE="${REPO_ROOT}/../${PROJECT_NAME}-${TASK_ID}"
      [ -d "$WORKTREE" ] && git worktree remove "$WORKTREE" --force 2>/dev/null || true
      git branch -D "task/${TASK_ID}" 2>/dev/null || true
    fi
  done
```

### claimBatch

Claim up to `CFG_MAX_PARALLEL` `Basic: Ready` tasks atomically. Returns the list of claimed
task IDs in `CLAIMED_TASK_IDS` (space-separated). Writes `cap:claim=started` for each claimed
task. If fewer `Basic: Ready` tasks exist, claims only those.

```bash
CLAIMED_TASK_IDS=""
CLAIM_COUNT=0
while IFS= read -r CANDIDATE_ID; do
  [ -z "$CANDIDATE_ID" ] && continue
  [ "$CLAIM_COUNT" -ge "$CFG_MAX_PARALLEL" ] && break
  backlog task edit "$CANDIDATE_ID" --status "Basic: In Progress" \
    --append-notes "claimed: $(date -u +%Y-%m-%dT%H:%M:%SZ)" 2>/dev/null || continue
  # Write cap:claim=started idempotency marker
  mkdir -p "${REPO_ROOT}/backlog/.caps"
  echo "cap:claim=started $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    >> "${REPO_ROOT}/backlog/.caps/${CANDIDATE_ID}"
  CLAIMED_TASK_IDS="${CLAIMED_TASK_IDS} ${CANDIDATE_ID}"
  CLAIM_COUNT=$((CLAIM_COUNT + 1))
done < <(backlog task list --status "Basic: Ready" --plain | grep -oP 'TASK-\d+')
CLAIMED_TASK_IDS=$(echo "$CLAIMED_TASK_IDS" | xargs)  # trim whitespace
```

If `CLAIMED_TASK_IDS` is empty and no stop sentinel: use Monitor (persistent) to wait for
the next `basic-ready` event. The daemon writes `basic-ready:TASK-N` lines to `$DAEMON_LOG`;
Monitor tails that file:

```bash
# Foreground tail — Monitor reads its stdout as the event stream.
# -n 0 prevents stale log replay on restart (starts from end of file).
Monitor(persistent=true,
    command="tail -f -n 0 \"$DAEMON_LOG\"",
    description="loop-backlog daemon notification. An event line (basic-ready:TASK-N, epic-ready:TASK-N, child-done:TASK-N, proposal-approved:TASK-N, or plan-approved:TASK-N) has arrived from the backlog task board. If this is a new Claude session, invoke /loop-backlog in the project root to resume the worker loop — it will re-claim and dispatch this event automatically."
  )
```

Any output line matching `basic-ready:TASK-*` is the wake-up signal; re-enter `workerLoop()`.

### waitForAgents

Poll `backlog/.agent-done-TASK-N` signal files for every task in `CLAIMED_TASK_IDS`.
Loops with `sleep 5` until all signal files are present.

```bash
# $1: space-separated list of TASK-IDs to wait for
waitForAgents() {
  local REMAINING="$1"
  local ALL_DONE=false
  while [ "$ALL_DONE" = "false" ]; do
    ALL_DONE=true
    local STILL_WAITING=""
    for TID in $REMAINING; do
      SIGNAL_FILE="${REPO_ROOT}/backlog/.agent-done-${TID}"
      if [ ! -f "$SIGNAL_FILE" ]; then
        ALL_DONE=false
        STILL_WAITING="${STILL_WAITING} ${TID}"
      fi
    done
    REMAINING=$(echo "$STILL_WAITING" | xargs)
    if [ "$ALL_DONE" = "false" ]; then
      echo "waitForAgents: still waiting for:${REMAINING}"
      sleep 5
    fi
  done
  echo "waitForAgents: all agents done"
}
```

### executePrompt

Build a self-contained prompt string for a background agent executing one task.
The prompt must not depend on external bash variables at call time — all values
are interpolated into the string before passing to the Agent tool.
The agent's allowed-tools list explicitly excludes `Agent` to prevent recursive spawn.

```bash
# Usage: PROMPT=$(buildExecutePrompt "$TASK_ID" "$TASK_TITLE" "$TASK_DESC" "$WORKTREE" "$BRANCH" "$SIGNAL_FILE")
buildExecutePrompt() {
  local TID="$1"
  local TTITLE="$2"
  local TDESC="$3"
  local TWT="$4"
  local TBRANCH="$5"
  local TSIGNAL="$6"

  cat <<PROMPT_EOF
You are a background task agent. Your only job is to execute the task described below.

## Task
ID: ${TID}
Title: ${TTITLE}
Branch: ${TBRANCH}
Worktree: ${TWT}
Signal file: ${TSIGNAL}

## Description
${TDESC}

## Constraints
- Work exclusively inside the worktree at: ${TWT}
- Do NOT run git merge or git push
- Do NOT spawn sub-agents (Agent tool is not available to you)
- After all work is complete, run git add -A && git commit if there are changes
- Write the signal file as the LAST action before exiting

## Completing the task
When done (success):
  Write file ${TSIGNAL} with content: done

If you cannot continue without human input (escalation):
  Write file ${TSIGNAL} with content: needs-human: <one-line reason>

## Execution Protocol

**Phase checkpoints**: After completing each ## Phase section described in the task Description,
append a structured note to the worktree summary file:
  echo "Phase X ✓ $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> ${TWT}/.agent-summary-${TID}
  echo "<one-line summary of what was done>" >> ${TWT}/.agent-summary-${TID}

**DoD verification notes**: For each DoD command run, append to the summary file:
  echo "DoD #N: PASS|FAIL — <cmd>" >> ${TWT}/.agent-summary-${TID}
  echo "<up to 5 lines of output on failure>" >> ${TWT}/.agent-summary-${TID}

**Execution Summary**: Before writing the signal file, write a final summary section:
  printf '## Execution Summary\nResult: Done|Needs Human\nCommit: <hash or no changes>\n<ordered list of Phase and DoD outcomes>\n' >> ${TWT}/.agent-summary-${TID}

Do NOT run `backlog task edit` with --status, --planSet, --dod, --set-field, or --check-dod.
You MAY run `backlog task edit <TASK_ID> --append-notes "..."` to record Phase checkpoints and DoD results.
The worker (main branch) handles all status transitions and field writes.

allowed-tools: Bash, Read, Write, Edit, Glob, Grep
PROMPT_EOF
}
```

### withWorktree

```bash
BRANCH="task/${TASK_ID}"
PROJECT_NAME=$(basename "$REPO_ROOT")
WORKTREE="${REPO_ROOT}/../${PROJECT_NAME}-${TASK_ID}"
git worktree add "$WORKTREE" -b "$BRANCH"

# Symlink configured dirs (e.g. node_modules) to avoid reinstall
for SYM in $CFG_SYMLINKS; do
  [ -e "${REPO_ROOT}/${SYM}" ] && \
    ln -sf "${REPO_ROOT}/${SYM}" "${WORKTREE}/${SYM}"
done

cd "$WORKTREE"
```

### execute → readHumanReply

Before reading the Description, check whether this task was previously escalated.

```bash
TASK_VIEW=$(backlog task view "$TASK_ID" --plain)
NOTES_SECTION=$(echo "$TASK_VIEW" | awk '/^Implementation Notes:/,0' | tail -n +2)
LAST_ESCALATED_LINE=$(echo "$NOTES_SECTION" | grep -n "^Escalated:" | tail -1 | cut -d: -f1)
```

If `LAST_ESCALATED_LINE` is non-empty, extract everything after it as the human reply:

```bash
HUMAN_REPLY=""
if [ -n "$LAST_ESCALATED_LINE" ]; then
  HUMAN_REPLY=$(echo "$NOTES_SECTION" | tail -n +$((LAST_ESCALATED_LINE + 1)))
fi
```

If `HUMAN_REPLY` is non-empty, read it carefully before proceeding. It is a free-form
natural-language answer from the user. Extract any decisions, version numbers, file paths,
or other context it provides. Use this information throughout execution — it supersedes
any open questions left by the previous escalation. Log what you understood:

```bash
if [ -n "$HUMAN_REPLY" ]; then
  backlog task edit "$TASK_ID" --append-notes \
    "Human reply received — interpreted context:
$(echo "$HUMAN_REPLY" | head -10)"
fi
```

### execute → followDescription

```bash
TITLE=$(echo "$TASK_VIEW" | grep -oP '(?<=Task TASK-\d+ - ).+' | head -1)

# Accumulator for final-summary
EXECUTION_LOG=""
log_exec() { EXECUTION_LOG="${EXECUTION_LOG}$1\n"; }
```

Read the task Description in full. The Description is the primary authority on what to
do. If a human reply was extracted above, it takes precedence for any open questions
(e.g. version numbers, file paths, decisions) — apply it before executing phases.
Follow the Description's `## Phase` sections in order. After each phase completes,
append a structured checkpoint that includes the key outputs or decisions from that phase:

```bash
PHASE_NOTE="Phase <X> ✓ $(date -u +%Y-%m-%dT%H:%M:%SZ)
<one-line summary of what was done or found>"
backlog task edit "$TASK_ID" --append-notes "$PHASE_NOTE"
log_exec "$PHASE_NOTE"
```

If a phase produced notable command output (e.g. test results, validation output, key
tool responses), include the relevant excerpt (truncated to ~20 lines) in the note.

Do not invent steps beyond what the Description specifies. Do not assume a task type.

### verifyDod

```bash
DOD_COUNT=$(echo "$TASK_VIEW" | grep -cP '^\- \[.\] #\d+')

for N in $(seq 0 $((DOD_COUNT - 1))); do
  CMD=$(echo "$TASK_VIEW" | grep -P "^\- \[.\] #${N} " | sed "s/^- \[.\] #${N} //")
  ATTEMPTS=0
  while true; do
    if bash -c "$CMD"; then
      backlog task edit "$TASK_ID" --check-dod $N
      DOD_PASS_NOTE="DoD #${N}: PASS"
      backlog task edit "$TASK_ID" --append-notes "${DOD_PASS_NOTE} — ${CMD}"
      log_exec "DoD #${N} ✓: ${CMD}"
      break
    fi
    ATTEMPTS=$((ATTEMPTS + 1))
    LAST_ERROR="$(bash -c "$CMD" 2>&1 || true)"
    if [ $ATTEMPTS -ge 3 ]; then
      STUCK_INDEX=$N
      STUCK_CMD="$CMD"
      DOD_FAIL_NOTE="DoD #${N}: FAIL"
      backlog task edit "$TASK_ID" --append-notes "${DOD_FAIL_NOTE} — ${STUCK_CMD}
$(echo "$LAST_ERROR" | head -5)"
      log_exec "DoD #${N} ✗ STUCK after 3 attempts: ${CMD}
Last error:
${LAST_ERROR}"
      break 2   # → Failure path
    fi
    # Log the failure and what fix is being attempted
    FIX_NOTE="DoD #${N} ✗ attempt ${ATTEMPTS}: ${CMD}
Error: $(echo "$LAST_ERROR" | head -5)
→ applying fix..."
    backlog task edit "$TASK_ID" --append-notes "$FIX_NOTE"
    log_exec "$FIX_NOTE"
    # Fix the issue causing the failure, then retry
  done
done
```

### conditionalCommit

```bash
git add -A
if ! git diff --cached --quiet; then
  git commit -m "${TITLE} (${TASK_ID})"
  COMMIT_HASH=$(git rev-parse HEAD)
else
  COMMIT_HASH="(no file changes)"
fi
```

### merge

> **Precondition:** merge is only reached after workerLoop's independent DoD verification has passed.
> The workerLoop serial merge loop runs `verifyDodInWorkerLoop` before calling `git merge`; a
> failing DoD command redirects control to escalation instead.

```bash
cd "$REPO_ROOT"
# RULE: never pipe git merge (| tail/cat/tee) — no-pipe: a pipe replaces its exit code and masks abort.
if git merge --no-ff "$BRANCH" -m "merge: ${TITLE} (${TASK_ID})"; then
  # Guard: MERGE_HEAD or unmerged files → treat as failure, never mark Done
  if [ -f ".git/MERGE_HEAD" ] || [ -n "$(git diff --name-only --diff-filter=U)" ]; then
    backlog task edit "$TASK_ID" --status "Basic: Needs Human" \
      --append-notes "Merge guard: MERGE_HEAD/unmerged files present — worktree preserved."
    echo "needs-human: merge guard triggered" > "${REPO_ROOT}/backlog/.agent-done-${TASK_ID}"
    exit 0
  fi
  FINAL_SUMMARY="## Execution Summary

**Result:** Done  
**Commit:** ${COMMIT_HASH}

### Execution Log
$(echo -e "$EXECUTION_LOG")"
  # post-merge append: read agent summary from worktree and append to task notes
  AGENT_SUMMARY_FILE="${WORKTREE}/.agent-summary-${TASK_ID}"
  if [ -f "$AGENT_SUMMARY_FILE" ]; then
    AGENT_SUMMARY_CONTENT=$(cat "$AGENT_SUMMARY_FILE")
    backlog task edit "$TASK_ID" --append-notes "$AGENT_SUMMARY_CONTENT"
  else
    backlog task edit "$TASK_ID" --append-notes "WARNING: agent-summary missing for ${TASK_ID} — execution trace unavailable"
  fi
  backlog task edit "$TASK_ID" \
    --status "Basic: Done" \
    --append-notes "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --final-summary "$FINAL_SUMMARY"
  # Write terminal idempotency marker
  echo "cap:execute=done $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    >> "${REPO_ROOT}/backlog/.caps/${TASK_ID}"
  # notifyParentIfAny: check parent_task_id field
  PARENT=$(backlog task view "$TASK_ID" --plain | grep -oP '(?<=parent_task_id: )TASK-\S+' | head -1)
  if [ -n "$PARENT" ]; then
    backlog task edit "$PARENT" --append-notes \
      "Sub-task ${TASK_ID} completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  fi
  git worktree remove "$WORKTREE"
  git branch -d "$BRANCH"
  WORK_DONE=true
else
  FINAL_SUMMARY="## Execution Summary

**Result:** Needs Human — merge conflict  
**Branch:** ${BRANCH}  
**Worktree:** ${WORKTREE}

### Execution Log
$(echo -e "$EXECUTION_LOG")

### Resolution Steps
\`\`\`
cd ${REPO_ROOT}
git mergetool
git commit
git worktree remove ${WORKTREE}
git branch -d ${BRANCH}
\`\`\`"
  backlog task edit "$TASK_ID" \
    --status "Basic: Needs Human" \
    --append-notes "Merge conflict: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --final-summary "$FINAL_SUMMARY"
  # Write cap:merge=failed idempotency marker
  echo "cap:merge=failed $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    >> "${REPO_ROOT}/backlog/.caps/${TASK_ID}"
  echo "Merge conflict: $TASK_ID — worktree preserved at $WORKTREE"
  WORK_DONE=false
fi
```

### workerLoop (parallel)

The top-level orchestration using claimBatch, background Agent spawning, and serial merge.

```bash
# After loadConfig, ensureDaemonScript, daemonBootstrap, and reap have run:

# 1. Claim a batch of up to CFG_MAX_PARALLEL Basic: Ready tasks
# (claimBatch sets CLAIMED_TASK_IDS)

if [ -z "$CLAIMED_TASK_IDS" ]; then
  # No basic task to claim — block on the daemon event stream (all three channels).
  # Monitor(persistent=true,
  #   command="tail -f -n 0 \"$DAEMON_LOG\"",
  #   description="loop-backlog daemon notification. An event line (basic-ready:TASK-N, epic-ready:TASK-N, child-done:TASK-N, proposal-approved:TASK-N, or plan-approved:TASK-N) has arrived from the backlog task board. If this is a new Claude session, invoke /loop-backlog in the project root to resume the worker loop — it will re-claim and dispatch this event automatically."
  # )
  # On basic-ready:TASK-N      → re-enter workerLoop (claim & execute).
  # On epic-ready:TASK-N       → epicDecompose(extractId), then re-enter workerLoop.
  # On child-done:TASK-N       → onChildDone(extractId), then re-enter workerLoop.
  # On proposal-approved:TASK-N → startPlanDraft(extractId), then re-enter workerLoop.
  # On plan-approved:TASK-N    → startFinalise(extractId), then re-enter workerLoop.
  # Dispatch is handled by the Monitor event loop; this bash section exits to let the
  # Monitor dispatch call the appropriate handler function.
  # Example dispatch (in the Monitor event handler):
  #   case "$EVENT" in
  #     epic-ready:*)      epicDecompose "${EVENT#epic-ready:}" ;;
  #     child-done:*)      onChildDone "${EVENT#child-done:}" ;;
  #     proposal-approved:*) startPlanDraft "${EVENT#proposal-approved:}" ;;
  #     plan-approved:*)   startFinalise "${EVENT#plan-approved:}" ;;
  #   esac
  exit 0
fi

# 2. Create worktrees and spawn one background agent per task
declare -A TASK_WORKTREES
declare -A TASK_BRANCHES
for TASK_ID in $CLAIMED_TASK_IDS; do
  BRANCH="task/${TASK_ID}"
  PROJECT_NAME=$(basename "$REPO_ROOT")
  WORKTREE="${REPO_ROOT}/../${PROJECT_NAME}-${TASK_ID}"
  git worktree add "$WORKTREE" -b "$BRANCH"
  for SYM in $CFG_SYMLINKS; do
    [ -e "${REPO_ROOT}/${SYM}" ] && ln -sf "${REPO_ROOT}/${SYM}" "${WORKTREE}/${SYM}"
  done
  TASK_WORKTREES[$TASK_ID]="$WORKTREE"
  TASK_BRANCHES[$TASK_ID]="$BRANCH"

  TASK_VIEW=$(backlog task view "$TASK_ID" --plain)
  TASK_TITLE=$(echo "$TASK_VIEW" | grep -oP '(?<=Task TASK-\d+ - ).+' | head -1)
  TASK_DESC=$(echo "$TASK_VIEW" | awk '/^Description:/,/^(Status|Assignee|Labels|Priority|Due|Created|Updated|Notes):/' | tail -n +2)
  SIGNAL_FILE="${REPO_ROOT}/backlog/.agent-done-${TASK_ID}"

  AGENT_PROMPT=$(buildExecutePrompt \
    "$TASK_ID" "$TASK_TITLE" "$TASK_DESC" "$WORKTREE" "$BRANCH" "$SIGNAL_FILE")

  # Spawn background agent — run_in_background=true
  Agent(run_in_background=true, prompt="$AGENT_PROMPT")
done

# 3. Wait for all agents to write their signal files
waitForAgents "$CLAIMED_TASK_IDS"

# 4. Serial merge: read signal, merge or escalate, delete signal file
for TASK_ID in $CLAIMED_TASK_IDS; do
  SIGNAL_FILE="${REPO_ROOT}/backlog/.agent-done-${TASK_ID}"
  SIGNAL_CONTENT=$(cat "$SIGNAL_FILE" 2>/dev/null || echo "needs-human: signal file missing")
  rm -f "$SIGNAL_FILE"

  BRANCH="${TASK_BRANCHES[$TASK_ID]}"
  WORKTREE="${TASK_WORKTREES[$TASK_ID]}"
  TASK_VIEW=$(backlog task view "$TASK_ID" --plain)
  TITLE=$(echo "$TASK_VIEW" | grep -oP '(?<=Task TASK-\d+ - ).+' | head -1)

  # pre-merge DoD verification (independent of agent signal)
  if [ "$SIGNAL_CONTENT" = "done" ] && [ -d "$WORKTREE" ]; then
    PRE_MERGE_DOD_PASS=true
    PRE_MERGE_FAIL_MSG=""
    DOD_N=0
    while IFS= read -r DOD_CMD; do
      DOD_CMD=$(echo "$DOD_CMD" | sed 's/^- \[.\] #[0-9]* //')
      cd "$WORKTREE"
      DOD_OUT=$(bash -c "$DOD_CMD" 2>&1)
      DOD_EXIT=$?
      cd "$REPO_ROOT"
      if [ $DOD_EXIT -ne 0 ]; then
        PRE_MERGE_DOD_PASS=false
        PRE_MERGE_FAIL_MSG="workerLoop DoD #${DOD_N} failed: ${DOD_CMD}\n$(echo "$DOD_OUT" | head -5)"
        backlog task edit "$TASK_ID" --append-notes "workerLoop pre-merge DoD #${DOD_N} FAIL: ${DOD_CMD}"
        break
      fi
      backlog task edit "$TASK_ID" --append-notes "workerLoop DoD #${DOD_N}: PASS — ${DOD_CMD}"
      DOD_N=$((DOD_N + 1))
    done < <(backlog task view "$TASK_ID" --plain | grep -oP '^- \[.\] #\d+ .+')

    if [ "$PRE_MERGE_DOD_PASS" != "true" ]; then
      SIGNAL_CONTENT="needs-human: ${PRE_MERGE_FAIL_MSG}"
    fi
  fi

  cd "$REPO_ROOT"
  if [ "$SIGNAL_CONTENT" = "done" ]; then
    # Standard merge path (same as existing merge section)
    # RULE: never pipe git merge (| tail/cat/tee) — no-pipe: a pipe replaces its exit code and masks abort.
    if git merge --no-ff "$BRANCH" -m "merge: ${TITLE} (${TASK_ID})"; then
      # Guard: MERGE_HEAD or unmerged files → treat as failure, never mark Done
      if [ -f ".git/MERGE_HEAD" ] || [ -n "$(git diff --name-only --diff-filter=U)" ]; then
        backlog task edit "$TASK_ID" --status "Basic: Needs Human" \
          --append-notes "Merge guard: MERGE_HEAD/unmerged files present — worktree preserved."
        echo "needs-human: merge guard triggered" > "${REPO_ROOT}/backlog/.agent-done-${TASK_ID}"
        exit 0
      fi
      # post-merge append: read agent summary from worktree and append to task notes
      AGENT_SUMMARY_FILE="${WORKTREE}/.agent-summary-${TASK_ID}"
      if [ -f "$AGENT_SUMMARY_FILE" ]; then
        AGENT_SUMMARY_CONTENT=$(cat "$AGENT_SUMMARY_FILE")
        backlog task edit "$TASK_ID" --append-notes "$AGENT_SUMMARY_CONTENT"
      else
        backlog task edit "$TASK_ID" --append-notes "WARNING: agent-summary missing for ${TASK_ID} — execution trace unavailable"
      fi
      backlog task edit "$TASK_ID" \
        --status "Basic: Done" \
        --append-notes "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      # Write cap:execute=done marker
      echo "cap:execute=done $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        >> "${REPO_ROOT}/backlog/.caps/${TASK_ID}"
      # notifyParentIfAny: check parent_task_id in task frontmatter
      PARENT=$(backlog task view "$TASK_ID" --plain | grep -oP '(?<=parent_task_id: )TASK-\S+' | head -1)
      if [ -n "$PARENT" ]; then
        backlog task edit "$PARENT" --append-notes \
          "Sub-task ${TASK_ID} completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      fi
      git worktree remove "$WORKTREE"
      git branch -d "$BRANCH"
    else
      backlog task edit "$TASK_ID" \
        --status "Basic: Needs Human" \
        --append-notes "Merge conflict: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      # Write cap:merge=failed marker
      echo "cap:merge=failed $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        >> "${REPO_ROOT}/backlog/.caps/${TASK_ID}"
    fi
  else
    REASON=$(echo "$SIGNAL_CONTENT" | sed 's/^needs-human: //')
    backlog task edit "$TASK_ID" \
      --status "Basic: Needs Human" \
      --append-notes "Escalated: ${REASON}
To continue: answer in Implementation Notes, then set status → Basic: Ready."
    # Write cap:execute=failed marker
    echo "cap:execute=failed $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      >> "${REPO_ROOT}/backlog/.caps/${TASK_ID}"
  fi
done
```

### verifyDodInWorkerLoop

Independent DoD verification executed by the workerLoop serial merge loop before each `git merge`.
This is distinct from the agent's own `verifyDod` loop: it re-runs every DoD command from the
worktree as a second, independent check. If any command fails, the merge is skipped and the task
is escalated with a `needs-human: workerLoop DoD` signal.

Key properties:
- Runs in the worktree (`cd "$WORKTREE"`) so paths resolve correctly.
- Only runs when the agent signalled `"done"` and the worktree directory still exists.
- On failure, overwrites `SIGNAL_CONTENT` with `"needs-human: workerLoop DoD #N failed: …"`,
  causing the standard escalation branch below to fire.
- On success, appends a per-command `"workerLoop DoD #N: PASS — <cmd>"` note for each passing command.

### Failure path (Stuck)

```bash
cd "$REPO_ROOT"
FINAL_SUMMARY="## Execution Summary

**Result:** Needs Human — stuck on DoD #${STUCK_INDEX}  
**Branch:** ${BRANCH}  
**Worktree:** ${WORKTREE}

### Failing Command
\`\`\`
${STUCK_CMD}
\`\`\`

### Last Error
\`\`\`
${LAST_ERROR}
\`\`\`

### Execution Log
$(echo -e "$EXECUTION_LOG")

### Cleanup
\`\`\`
git worktree remove ${WORKTREE} --force
git branch -D ${BRANCH}
\`\`\`"
backlog task edit "$TASK_ID" \
  --status "Basic: Needs Human" \
  --append-notes "Stuck on DoD #${STUCK_INDEX}: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --final-summary "$FINAL_SUMMARY"
# Write cap:execute=failed marker
echo "cap:execute=failed $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  >> "${REPO_ROOT}/backlog/.caps/${TASK_ID}"
echo "Stuck: $TASK_ID (DoD #$STUCK_INDEX)"
echo "Task moved to Basic: Needs Human. Worktree preserved at $WORKTREE"
WORK_DONE=false
```

### Epic dispatch (epic-ready / child-done)

When `Monitor` yields an `epic-ready:` or `child-done:` line, the worker runs these
handlers instead of claiming a basic task. Both are idempotent via `cap:*` markers.

```bash
# extractId: pull TASK-N from an event line like "epic-ready:TASK-12"
extractId() { echo "$1" | grep -oP 'TASK-\d+(\.\d+)*' | head -1; }

# childrenOf EPIC_ID → list of child task IDs (frontmatter parent_task_id == EPIC_ID)
childrenOf() {
  local EPIC_ID="$1"
  grep -lE "^parent_task_id:\s*${EPIC_ID}\$" "${REPO_ROOT}"/backlog/tasks/*.md 2>/dev/null \
    | while read -r f; do grep -oP '(?<=^id:\s)TASK-\S+' "$f"; done
}

taskStatus() { backlog task view "$1" --plain 2>/dev/null | grep -oP '(?<=Status:).*' \
  | head -1 | grep -oP '(Basic|Epic): [A-Za-z ]+' | head -1 | xargs; }

hasCap() { grep -q "cap:$2" "$(ls "${REPO_ROOT}"/backlog/tasks/${1,,}\ *.md 2>/dev/null | head -1)" 2>/dev/null; }

# epicDecompose: epic-ready handler. Checks preconditions then spawns a single background
# agent that handles ALL decomposition steps autonomously (spawn-and-forget).
# Returns immediately after spawning — no signal file polling, no waiting.
epicDecompose() {
  local EPIC_ID="$1"
  [ "$(taskStatus "$EPIC_ID")" = "Epic: Ready" ] || { echo "epicDecompose: $EPIC_ID not Epic: Ready, skip"; return 0; }
  if hasCap "$EPIC_ID" "decompose=done"; then echo "epicDecompose: $EPIC_ID already done"; return 0; fi

  Agent run_in_background=true prompt="$(cat <<DECOMPAGENT
You are the autonomous decomposer agent for epic ${EPIC_ID}. Follow these steps exactly:

STEP 1 — Idempotency check:
  Run: backlog task view ${EPIC_ID} --plain
  If the notes already contain "cap:decompose=done", exit immediately (already decomposed).

STEP 2 — Mark started:
  Run: backlog task edit ${EPIC_ID} --append-notes "cap:decompose=started" --plain

STEP 3 — Set status to Decomposing:
  Run: backlog task edit ${EPIC_ID} --status "Epic: Decomposing" --plain

STEP 4 — Read Sub-Task Decomposition:
  The Implementation Plan (visible in step 1 output) contains a Sub-Task Decomposition
  section. Parse each intended child sub-task from that section.

STEP 5 — Create children:
  4. Create each child sub-task using the correct skill (do NOT create children directly via CLI):

   Determine for each child whether it is a CODE-CHANGE task or DOC-ONLY task:
   - CODE-CHANGE: creates or modifies files under plugin/, scripts/, any SKILL.md, *.sh scripts
   - DOC-ONLY: scope is exclusively reading, researching, writing prose docs, updating backlog notes

   For CODE-CHANGE children: run the /feature-to-backlog skill with the child title
   For DOC-ONLY children:    run the /task-to-backlog skill with the child title

   After each skill creates the child and returns its TASK-ID:
   - Set parent: backlog task edit <CHILD_ID> --set-field parent_task_id ${EPIC_ID}
   - Set label:  backlog task edit <CHILD_ID> --label kind:basic
   - Do NOT set status to Basic: Ready — leave children at their created status

  Do not create children that already exist (idempotent). Record all created TASK-ids.

STEP 6 — R1 guard (verify every child has a shell-gate DoD):
  Run: bash "${REPO_ROOT}/scripts/verify-subtask-dod.sh" ${EPIC_ID}

STEP 7a — R1 PASS: advance to Awaiting Children:
  Run: backlog task edit ${EPIC_ID} --status "Epic: Awaiting Children" \
    --append-notes "cap:decompose=done
epicDecompose: children created at Basic: Backlog. Promote chosen children → Basic: Ready to execute."

STEP 7b — R1 FAIL or any earlier error: escalate to Needs Human:
  Run: backlog task edit ${EPIC_ID} --status "Epic: Needs Human" \
    --append-notes "cap:decompose=failed | <reason>
Escalated: <reason>. Fix the issue and set status → Epic: Ready to retry."

Important: Do NOT promote any child to Basic: Ready. That is the human's selection gate.
DECOMPAGENT
)"
  # Returns immediately — background agent is fully autonomous.
}

# startPlanDraft: proposal-approved handler. Spawns a background agent to run Phase 3
# (draftEpicPlan / draftPlan) of the appropriate skill for TASK_ID.
# The daemon fires this when the human advances status to Epic: Plan or Basic: Plan
# after proposal APPROVED and the marker file backlog/.etb-awaiting-plan-$id (or ftb) exists.
startPlanDraft() {
  local TASK_ID="$1"
  local STATUS; STATUS="$(taskStatus "$TASK_ID")"
  echo "startPlanDraft: $TASK_ID (status: $STATUS)"
  Agent run_in_background=true prompt="$(cat <<PLANDRAFT
Task ${TASK_ID} proposal has been APPROVED and its status is now '${STATUS}'.
Run /epic-to-backlog ${TASK_ID} or /feature-to-backlog ${TASK_ID} (as appropriate for its kind)
to continue from Phase 3 (plan drafting). The skill will detect the current status and
resume from the correct phase automatically.
PLANDRAFT
)"
}

# startFinalise: plan-approved handler. Spawns a background agent to run Phase 5
# (finalise) of the appropriate skill for TASK_ID.
# The daemon fires this when the human advances status to Epic: Backlog or Basic: Ready
# after plan APPROVED and the marker file backlog/.etb-awaiting-backlog-$id (or ftb) exists.
startFinalise() {
  local TASK_ID="$1"
  local STATUS; STATUS="$(taskStatus "$TASK_ID")"
  echo "startFinalise: $TASK_ID (status: $STATUS)"
  Agent run_in_background=true prompt="$(cat <<FINALISE
Task ${TASK_ID} plan has been APPROVED and its status is now '${STATUS}'.
Run /epic-to-backlog ${TASK_ID} or /feature-to-backlog ${TASK_ID} (as appropriate for its kind)
to continue from Phase 5 (finalise). The skill will detect the current status and
resume from the correct phase automatically.
FINALISE
)"
}

# onChildDone: child-done handler. If parent epic at Awaiting Children and ALL children
# are Basic: Done → Epic: Evaluating → write FINISH/ITERATE recommendation, then soft-halt.
onChildDone() {
  local CHILD_ID="$1"
  local CHILD_FILE; CHILD_FILE=$(ls "${REPO_ROOT}"/backlog/tasks/${CHILD_ID,,}\ *.md 2>/dev/null | head -1)
  [ -n "$CHILD_FILE" ] || return 0
  local EPIC_ID; EPIC_ID=$(grep -oP '(?<=^parent_task_id:\s)TASK-\S+' "$CHILD_FILE" | head -1)
  [ -n "$EPIC_ID" ] || return 0
  [ "$(taskStatus "$EPIC_ID")" = "Epic: Awaiting Children" ] || return 0

  local TOTAL=0 DONE=0 NEEDS=0
  while read -r CID; do
    [ -z "$CID" ] && continue
    TOTAL=$((TOTAL+1))
    case "$(taskStatus "$CID")" in
      "Basic: Done") DONE=$((DONE+1)) ;;
      "Basic: Needs Human") NEEDS=$((NEEDS+1)) ;;
    esac
  done < <(childrenOf "$EPIC_ID")

  if [ "$DONE" -lt "$TOTAL" ]; then
    backlog task edit "$EPIC_ID" --append-notes "onChildDone: ${DONE}/${TOTAL} children done"
    return 0
  fi

  # All created children done → evaluate
  backlog task edit "$EPIC_ID" --status "Epic: Evaluating" --plain >/dev/null
  if hasCap "$EPIC_ID" "evaluate"; then return 0; fi

  # Measured slice: re-run every child's DoD shell-gate
  local DOD_OK=true
  bash "${REPO_ROOT}/scripts/verify-subtask-dod.sh" "$EPIC_ID" >/dev/null 2>&1 || DOD_OK=false
  local VERDICT="ITERATE"
  if [ "$NEEDS" -eq 0 ] && [ "$DOD_OK" = "true" ]; then VERDICT="FINISH"; fi

  backlog task edit "$EPIC_ID" \
    --append-notes "cap:evaluate=recommendation:${VERDICT} | done=${DONE}/${TOTAL} needsHuman=${NEEDS} dod_pass=${DOD_OK} | data_source: measured" \
    --append-notes "RECOMMENDATION: ${VERDICT}. To finish: set status → Epic: Done. To iterate: set status → Epic: Proposal or Epic: Plan and re-run /epic-to-backlog."
  # soft halt: stay at Epic: Evaluating; cap:evaluate guard makes daemon re-emits no-ops.
}
```

## Shutdown

To stop the worker loop, write the stop sentinel:

```bash
touch "${REPO_ROOT}/backlog/.loop-stop"
```

The basic-daemon (`basic-daemon.js`) detects `backlog/.loop-stop` and exits.
The skill also checks for this file at the top of each iteration and returns `Stopped`
without re-entering Monitor.

To restart after a shutdown:

```bash
rm -f "${REPO_ROOT}/backlog/.loop-stop"
# then invoke /loop-backlog
```

The `daemonBootstrap` section will restart the daemon automatically on the next
`/loop-backlog` invocation. The PID file (`backlog/.basic-daemon.pid`) is managed
by the daemon itself and removed on exit.

Use the following Monitor call to wait for daemon events:

```
Monitor(persistent=true,
    command="tail -f -n 0 \"$DAEMON_LOG\"",
    description="loop-backlog daemon notification. An event line (basic-ready:TASK-N, epic-ready:TASK-N, child-done:TASK-N, proposal-approved:TASK-N, or plan-approved:TASK-N) has arrived from the backlog task board. If this is a new Claude session, invoke /loop-backlog in the project root to resume the worker loop — it will re-claim and dispatch this event automatically."
  )
```

The daemon appends event lines to `backlog/.basic-daemon.log`; `tail -f -n 0`
runs in the foreground so Monitor receives each line as an event immediately (starting from the
end of the file to prevent stale event replay on restart).
The daemon subprocess exits only when `backlog/.loop-stop` is written (or the parent process dies).

To stop the Monitor from outside the skill, call `TaskStop <monitor-task-id>`.
