---
name: loop-meta
description: "Autonomous L1 Meta-planner for the backlog Meta lane. Responds to meta-ready events, decomposes meta-tasks into backlog sub-tasks via decomposer subagent (using task-to-backlog / feature-to-backlog), and idempotently reconciles desired vs actual sub-task state. Sub-tasks are created in Backlog status for human promotion to Ready. Escalates on budget, noProgress, or diverging conditions."
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Monitor, Agent
contracts:
  - grep: "idempotentReconcile"
    target: self
  - grep: "decomposer"
    target: self
  - grep: "Needs Human"
    target: self
  - grep: "meta-ready"
    target: self
  - not-grep: "git worktree add"
    target: self
  - grep: "evaluator"
    target: self
  - grep: "replanner"
    target: self
  - grep: "draftMetaProposal"
    target: self
  - grep: "Meta-Proposal"
    target: self
  - grep: "gateHuman"
    target: self
  - grep: "reviewLoop"
    target: self
  - grep: "WIP_CAP"
    target: self
  - grep: "setReady"
    target: self
  - grep: "budget exhausted"
    target: self
---

λ() → metaLoop()

## Spec

data MetaStatus = MetaProposal | MetaPlan | MetaActive | MetaDone | NeedsHuman

data Outcome = Proposed | Reconciled | Escalated Reason | Idle | Stopped

-- Entry point: invoked when a meta-ready event is received for a meta-task.
metaLoop :: TaskId → Outcome
metaLoop(id) =
  | stopSentinel()         → Stopped
  | status(id) == MetaProposal → draftMetaProposal(id)
  | status(id) == MetaPlan    → draftDecomposition(id)
  | status(id) == MetaActive  → idempotentReconcile(id)
  | otherwise              → Idle

-- draftMetaProposal: intake path for Meta-Proposal tasks. Drafts a structured
-- proposal doc from the description, then enters reviewLoop (max 4 iterations)
-- to collect human feedback before the human advances to Meta-Plan.
draftMetaProposal :: TaskId → Outcome
draftMetaProposal(id) = {
  goal:  readField(id, "description"),
  doc:   Agent(prompt=proposalPrompt(goal)),    -- subagent writes proposal to notes
  _:     reviewLoop(id, doc, maxIter=4),
  return: Proposed
}

-- gateHuman: append a note requesting human action and halt.
-- Never auto-advances status — the human must set the next status.
-- Returns after appending; control resumes only on the next meta-ready event.
gateHuman :: (TaskId, Message) → ()
gateHuman(id, msg) = {
  appendNote(id, msg)
  -- loop-meta halts here; daemon will emit meta-ready again on next poll
}

-- reviewLoop: iterative human-review gate for Meta-Proposal tasks.
-- Calls gateHuman each iteration. If the human advances status beyond
-- Meta-Proposal before maxIter is reached, the next meta-ready event will
-- dispatch to draftDecomposition or idempotentReconcile — reviewLoop is
-- not re-entered. If maxIter is exhausted without approval, escalates.
reviewLoop :: (TaskId, Doc, Int) → Outcome
reviewLoop(id, doc, maxIter) = {
  iter: countNotes(id, "reviewLoop:"),

  if (iter >= maxIter):
    return: escalate(id, "reviewLoop exhausted: " + maxIter
                       + " iterations without human approval"),

  gateHuman(id, "reviewLoop: iteration " + (iter+1) + "/" + maxIter
               + " — review proposal and set status → Meta-Plan to approve,"
               + " or add feedback note and leave status unchanged for revision."),
  appendNote(id, "reviewLoop: iteration " + str(iter+1) + " of " + str(maxIter)),
  return: Proposed
}

-- draftDecomposition: for Meta-Plan tasks, call decomposer subagent to produce
-- the canonical desired sub-task list, then reconcile. Pauses for human review
-- before activating (status stays Meta-Plan until human sets Meta-Active).
draftDecomposition :: TaskId → Outcome
draftDecomposition(id) = {
  plan:  readField(id, "implementationPlan"),
  subs:  decomposer(id, plan),
  _:     appendNote(id, "Decomposition complete: " + length(subs) + " sub-tasks in Backlog. "
                     + "Review sub-tasks, then set status → Meta-Active to start reconcile loop."),
  return: Proposed
}

-- idempotentReconcile: desired ⊖ actual diff — only creates sub-tasks that do
-- not already exist. Running reconcile twice on the same meta-task produces the
-- same result as running it once (no duplicate sub-tasks).
idempotentReconcile :: TaskId → Outcome
idempotentReconcile(id) = {
  desired: decomposer(id, readField(id, "implementationPlan")),
  actual:  listChildren(id),
  gap:     desired ⊖ actual,    -- set diff by normalised title

  if (empty(gap)):
    appendNote(id, "idempotentReconcile: no gap — all " + length(desired) + " sub-tasks present"),
    return: Reconciled,

  if (noProgress(id)):
    return: escalate(id, "noProgress: sub-tasks have been in Backlog too long without promotion"),

  if (diverging(id)):
    return: escalate(id, "diverging: actual sub-task set has grown beyond desired — manual review needed"),

  if (budgetExceeded(id)):
    return: escalate(id, "budget exhausted: reconcile loop exceeded cycle limit"),

  ∀t ∈ gap: createSubTask(id, t),
  appendNote(id, "idempotentReconcile: created " + length(gap) + " sub-task(s)"),

  -- Auto-schedule: promote Backlog children up to WIP_CAP (Meta-Active only)
  setReady(id, filter(c → status(c) == Backlog, listChildren(id))),
  return: Reconciled
}

-- decomposer: subagent that reads meta-plan text and returns a canonical list
-- of desired sub-tasks. Each sub-task is produced via task-to-backlog or
-- feature-to-backlog to ensure shell-gate DoD is present. Returns a list of
-- SubTaskSpec records (title, description, dodCommands).
decomposer :: (TaskId, PlanText) → [SubTaskSpec]
decomposer(id, plan) =
  Agent(
    prompt = decomposerPrompt(id, plan),
    schema = SubTaskListSchema
  )

-- listChildren: scan backlog for tasks whose notes contain "parentTask: <id>".
listChildren :: TaskId → [SubTaskSpec]
listChildren(id) =
  filter(t → hasNote(t, "parentTask: " + id), allTasks())

-- createSubTask: create a new backlog task in Backlog status with parentTask link.
-- Delegates to task-to-backlog or feature-to-backlog for DoD shell-gate generation.
createSubTask :: (TaskId, SubTaskSpec) → ()
createSubTask(parent, spec) = {
  child: invoke("task-to-backlog", spec),
  appendNote(child, "parentTask: " + parent),
  setStatus(child, "Backlog")
}

-- escalation conditions
noProgress :: TaskId → Bool
noProgress(id) =
  allChildrenInBacklogForDays(id, threshold=7)

diverging :: TaskId → Bool
diverging(id) =
  length(listChildren(id)) > 2 * length(desired(id))

budgetExceeded :: TaskId → Bool
budgetExceeded(id) =
  reconcileAttempts(id) > 5

escalate :: (TaskId, Reason) → Outcome
escalate(id, r) = {
  setStatus(id, "Needs Human"),
  appendNote(id, "Escalated: " + r
               + "\nTo continue: answer in notes and set status → Meta-Active."),
  return: Escalated(r)
}


-- WIP_CAP: maximum number of sub-tasks in Ready or In Progress at any time.
-- Conservative initial value; adjustable after validation data accumulates.
WIP_CAP :: Int
WIP_CAP = 2

-- setReady: promote Backlog sub-tasks to Ready while wip(id) < WIP_CAP.
-- Called inside idempotentReconcile when Meta-Active and human gate has passed.
-- Never auto-schedules from Meta-Plan — that gate is preserved unconditionally.
setReady :: (TaskId, [SubTaskSpec]) → ()
setReady(parent, backlogChildren) = {
  ∀t ∈ backlogChildren:
    if (wip(parent) < WIP_CAP):
      setStatus(t, "Ready"),
      appendNote(parent, "setReady: promoted " + t.title)
}

-- wip: count of children currently in Ready or In Progress status.
wip :: TaskId → Int
wip(id) =
  length(filter(c → status(c) ∈ {Ready, InProgress}, listChildren(id)))


-- evaluator: slice-aggregate quality assessor. Takes a meta-task and its Done
-- children; produces a Met/NotMet verdict from three independent slices.
-- Each slice MUST carry data_source: measured — no estimated inputs accepted.
-- Slice types:
--   layer25_oracle : run Class A/B oracle from experiments/skill-quality/artifacts/
--   dod_aggregate  : check all child DoD shell-gate pass counts from task notes
--   trace_replay   : replay execution log patterns against acceptance specs
evaluator :: (TaskId, [TaskId]) → EvalResult
evaluator(metaId, doneChildren) = {
  oracle_slice : runLayer25Oracle(doneChildren),    -- data_source: measured
  dod_slice    : aggregateDodResults(doneChildren), -- data_source: measured
  trace_slice  : replayTraces(metaId),              -- data_source: measured

  if (any(s → s.data_source ≠ "measured", [oracle_slice, dod_slice, trace_slice])):
    raise InvalidEvidenceError("estimated slices not permitted in evaluator"),

  verdict: if (all(slicePassed, [oracle_slice, dod_slice, trace_slice])): Met
           else: NotMet(reasons=[s.reason | s ← slices, ¬slicePassed(s)]),

  _: appendNote(metaId, "evaluator: " + verdict.label
               + " | oracle=" + oracle_slice.label
               + " | dod=" + dod_slice.label
               + " | trace=" + trace_slice.label
               + " | data_source: measured"),
  return: verdict
}

-- replanner: root-cause diagnostician. Invoked only when evaluator returns NotMet.
-- Classifies root cause and rewrites the meta-plan path to resolve it.
-- MUST NOT modify acceptance criteria — only the path to meet them.
-- Root cause taxonomy: impl | sub-plan | meta-plan | harness | infeasible
replanner :: (TaskId, NotMet) → ReplanResult
replanner(metaId, notMet) = {
  evidence: readNotes(metaId) ++ notMet.reasons,
  rootCause: classify(evidence),   -- impl | sub-plan | meta-plan | harness | infeasible

  if (rootCause == infeasible):
    return: escalate(metaId, "infeasible: acceptance criteria cannot be met by any known path"),

  updatedPlan: patchPath(readField(metaId, "implementationPlan"), rootCause, evidence),
  _: appendNote(metaId, "replan: " + rootCause + " — " + summarise(evidence)),
  _: updateField(metaId, "implementationPlan", updatedPlan),
  return: Replanned(rootCause, updatedPlan)
}

-- evaluateAndReplan: integrate evaluate→replan branch into reconcile.
-- Triggered only when Meta-Active and at least one child is Done.
evaluateAndReplan :: TaskId → ()
evaluateAndReplan(metaId) = {
  doneChildren: filter(c → status(c) == Done, listChildren(metaId)),
  if (empty(doneChildren)): return,

  result: evaluator(metaId, doneChildren),
  if (result == Met): return,

  -- NotMet: diagnose and replan
  replanResult: replanner(metaId, result),
  if (replanResult == Escalated): return   -- handled by escalate()
  -- otherwise: idempotentReconcile will pick up the patched plan on next cycle
}

## Implementation

### metaLoop

```bash
# Read meta-task status and dispatch
TASK_VIEW=$(backlog task view "$META_TASK_ID" --plain)
META_STATUS=$(echo "$TASK_VIEW" | grep -oP '(?i)(?<=status: )\S.*' | head -1 | xargs)

case "$META_STATUS" in
  "Meta-Proposal")
    # draftProposal: generate proposal doc, append note, stay in Meta-Proposal
    ;;
  "Meta-Plan")
    # draftDecomposition: call decomposer, create sub-tasks in Backlog
    ;;
  "Meta-Active")
    # idempotentReconcile: diff desired vs actual, fill gap
    ;;
  *)
    echo "metaLoop: status '$META_STATUS' requires no action"
    exit 0
    ;;
esac
```

### idempotentReconcile

```bash
idempotentReconcile() {
  local META_ID="$1"

  # 1. Get desired sub-tasks from decomposer (list of titles, one per line)
  DESIRED=$(callDecomposer "$META_ID")

  # 2. Get actual sub-tasks: scan notes for "parentTask: META_ID"
  ACTUAL=$(backlog task list --plain \
    | grep -oP 'TASK-\d+' \
    | while read TID; do
        backlog task view "$TID" --plain \
          | grep -q "parentTask: ${META_ID}" && \
          backlog task view "$TID" --plain \
            | grep -oP '(?<=Task TASK-\d+ - ).+' | head -1
      done)

  # 3. Compute gap: desired titles not in actual
  GAP=""
  while IFS= read -r TITLE; do
    [ -z "$TITLE" ] && continue
    if ! echo "$ACTUAL" | grep -qxF "$TITLE"; then
      GAP="${GAP}${TITLE}\n"
    fi
  done <<< "$DESIRED"

  if [ -z "$(echo -e "$GAP" | xargs)" ]; then
    backlog task edit "$META_ID" --append-notes \
      "idempotentReconcile: no gap — all sub-tasks present"
    return 0
  fi

  # 4. Create missing sub-tasks
  COUNT=0
  while IFS= read -r TITLE; do
    [ -z "$TITLE" ] && continue
    NEW_ID=$(backlog task create --title "$TITLE" --status "Backlog" --plain \
      | grep -oP 'TASK-\d+' | head -1)
    backlog task edit "$NEW_ID" --append-notes "parentTask: ${META_ID}"
    COUNT=$((COUNT + 1))
  done <<< "$(echo -e "$GAP")"

  backlog task edit "$META_ID" --append-notes \
    "idempotentReconcile: created ${COUNT} sub-task(s)"
}
```

### decomposer

The decomposer subagent reads the meta-task's Implementation Plan and returns a
newline-separated list of sub-task titles. Each title corresponds to one leaf
deliverable that `task-to-backlog` or `feature-to-backlog` will turn into a
fully-specified backlog task with shell-gate DoD.

```bash
callDecomposer() {
  local META_ID="$1"
  local PLAN
  PLAN=$(backlog task view "$META_ID" --plain \
    | awk '/^Implementation Plan:/,/^[A-Z]/' | tail -n +2)

  # Subagent prompt instructs the agent to output one sub-task title per line
  Agent(run_in_background=false, prompt="$(cat <<DECOMP_EOF
You are a decomposer agent. Read the meta-plan below and output a newline-separated
list of sub-task titles. Each title should be a self-contained unit of work
suitable for task-to-backlog or feature-to-backlog. Output ONLY the titles,
one per line, no numbering, no explanation.

Meta-task: ${META_ID}
Plan:
${PLAN}
DECOMP_EOF
  )")
}
```

### draftMetaProposal

```bash
draftMetaProposal() {
  local META_ID="$1"

  # Draft proposal via subagent
  GOAL=$(backlog task view "$META_ID" --plain | grep -oP '(?<=Description: ).+' | head -1)
  # Subagent writes proposal text; result captured for reviewLoop
  DOC=$(Agent(run_in_background=false, prompt="Draft a structured Meta-Proposal for: ${GOAL}"))

  reviewLoop "$META_ID" "$DOC" 4
}
```

### gateHuman

```bash
gateHuman() {
  local META_ID="$1"
  local MSG="$2"
  backlog task edit "$META_ID" --append-notes "$MSG"
  # Halt: loop-meta exits; daemon emits meta-ready again on next poll cycle
}
```

### reviewLoop

```bash
reviewLoop() {
  local META_ID="$1"
  local DOC="$2"
  local MAX_ITER="$3"

  # Count prior reviewLoop iterations recorded in notes
  ITER=$(backlog task view "$META_ID" --plain | grep -c "reviewLoop:" || true)

  if [ "$ITER" -ge "$MAX_ITER" ]; then
    backlog task edit "$META_ID" \
      --status "Needs Human" \
      --append-notes "Escalated: reviewLoop exhausted — ${MAX_ITER} iterations without human approval"
    return 1
  fi

  ITER_NEXT=$((ITER + 1))
  gateHuman "$META_ID" \
    "reviewLoop: iteration ${ITER_NEXT}/${MAX_ITER} — review proposal and set status → Meta-Plan to approve, or add feedback note and leave status unchanged for revision."

  backlog task edit "$META_ID" --append-notes \
    "reviewLoop: iteration ${ITER_NEXT} of ${MAX_ITER}"
}
```

### setReady (auto-schedule)

```bash
setReady() {
  local META_ID="$1"

  # Count current WIP (Ready + In Progress children)
  WIP=$(backlog task list --plain     | grep -oP 'TASK-\d+'     | while read TID; do
        NOTE=$(backlog task view "$TID" --plain)
        if echo "$NOTE" | grep -q "parentTask: ${META_ID}"; then
          STATUS=$(echo "$NOTE" | grep -oP '(?<=status: )\S.*' | head -1 | xargs)
          case "$STATUS" in Ready|"In Progress") echo "$TID" ;; esac
        fi
      done | wc -l)

  if [ "$WIP" -ge "$WIP_CAP" ]; then
    return 0
  fi

  # Promote Backlog children up to WIP_CAP
  backlog task list --plain     | grep -oP 'TASK-\d+'     | while read TID; do
        NOTE=$(backlog task view "$TID" --plain)
        if echo "$NOTE" | grep -q "parentTask: ${META_ID}"; then
          STATUS=$(echo "$NOTE" | grep -oP '(?<=status: )\S.*' | head -1 | xargs)
          if [ "$STATUS" = "Backlog" ]; then
            CURRENT_WIP=$(backlog task list --plain | grep -oP 'TASK-\d+' | while read T; do
              N=$(backlog task view "$T" --plain)
              echo "$N" | grep -q "parentTask: ${META_ID}" &&                 echo "$N" | grep -qP 'status: (Ready|In Progress)' && echo "$T"
            done | wc -l)
            if [ "$CURRENT_WIP" -lt "$WIP_CAP" ]; then
              TITLE=$(echo "$NOTE" | grep -oP '(?<=Task TASK-\d+ - ).+' | head -1)
              backlog task edit "$TID" --status "Ready"
              backlog task edit "$META_ID" --append-notes "setReady: promoted ${TITLE}"
            fi
          fi
        fi
      done
}
```

### escalation checks

```bash
checkEscalation() {
  local META_ID="$1"

  # budget: too many reconcile attempts
  ATTEMPTS=$(backlog task view "$META_ID" --plain \
    | grep -c "idempotentReconcile:" || true)
  if [ "$ATTEMPTS" -gt 5 ]; then
    backlog task edit "$META_ID" \
      --status "Needs Human" \
      --append-notes "Escalated: budget — reconcile loop exceeded 5 attempts"
    return 1
  fi

  # noProgress: children stuck in Backlog too long (simplified: >7 days)
  # diverging: children count > 2× desired (not implemented in V1, placeholder)
  return 0
}
```
