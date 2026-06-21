---
name: epic-to-backlog
description: "Interactive epic authoring for the B″ epic lane. Drives a brief multi-child epic idea through propose then plan, each gated by human-reviewed cycles, and parks it at Epic: Backlog. The plan enumerates intended child sub-tasks but creates none — the human promotes Epic: Backlog to Epic: Ready to authorize autonomous decomposition by the epic worker."
argument-hint: [epic-topic-or-description]
allowed-tools: Read, Glob, Grep, Bash, Agent
contracts:
  - grep: "proposalLoop"
    target: self
  - grep: "planLoop"
    target: self
  - grep: "Epic: Backlog"
    target: self
  - grep: "kind:epic"
    target: self
  - grep: "reviewLoop"
    target: self
  - not-grep: "git worktree add"
    target: self
---

λ(topic) → epicToBacklog(topic)

## Spec

Config :: {
  testCmd  : String,   -- per-phase test runner; carried into child plans later
  testAll  : String,   -- full suite; carried into child plans later
  docPath  : String    -- root for proposals/ and plans/ subdirectories
}

loadConfig :: () → Config  -- see spec-stdlib § loadConfig
loadConfig() =
  | fromClaudeMd()   -- explicit: "## L0 Config" section in CLAUDE.md
  | autoDetect()     -- implicit: probe package.json, go.mod, Cargo.toml, etc.

autoDetect :: () → Config
autoDetect() = -- see spec-stdlib § loadConfig

detectLang :: () → Lang  -- see spec-stdlib § detectLang
-- see spec-stdlib § detectLang

-- Core document types

EpicProposal :: {
  background    : String,        -- WHY this epic is needed (3-8 lines)
  goals         : [VerifiableGoal], -- each Goal checkable by inspection or shell command
  sketch        : [SubTaskHint], -- rough decomposition: the would-be child basic tasks
  tradeoffs     : String         -- what we are NOT doing; known risks
}

SubTaskHint :: {
  title   : String,              -- candidate child basic-task title
  oneLine : String               -- one-line description of that child's scope
}

EpicPlan :: {
  background    : String,        -- carried from approved proposal
  goals         : [VerifiableGoal],
  subTasks      : [SubTaskHint], -- "Sub-Task Decomposition": intended child basic tasks
  sequencing    : String,        -- ordering / dependency notes between children
  constraints   : [String]       -- non-executable criteria for the epic as a whole
}

-- Input: topic is either a task ID (e.g. TASK-12, task-12) or a free-form description.
-- Task ID → resolve existing epic; resume from its current status using its description as draft.
-- Description → create a new epic and run the full proposal → plan workflow.

EntryPoint = ProposalLoop | PlanLoop
  -- ProposalLoop : enter proposal reviewLoop (new epic, or Epic: Proposal status)
  -- PlanLoop     : skip proposal; enter plan reviewLoop (Epic: Plan status)

resolveOrCreate :: Topic → (Task, EntryPoint)
resolveOrCreate(T) =
  | isTaskId(T) → (lookupTask(T), fromStatus(lookupTask(T).status))
  | otherwise   → (createEpicTask(T), ProposalLoop)

fromStatus :: Status → EntryPoint
fromStatus("Epic: Plan") = PlanLoop
fromStatus(_)            = ProposalLoop  -- Epic: Proposal or other

createEpicTask :: Topic → Task  -- creates with kind:epic label and Epic: Proposal status
createEpicTask(T) = backlogTaskCreate({
  title:       T,
  status:      "Epic: Proposal",
  labels:      ["kind:epic"],
  description: T
})

-- Workflow

epicToBacklog :: Topic → EpicTask
epicToBacklog(T) = {
  cfg:            loadConfig(),
  (task, entry):  resolveOrCreate(T),
  -- proposalLoop: use existing description as proposal draft (skips fresh draft if task ID given)
  -- planLoop: skip proposal stage entirely
  proposal: case entry of
    ProposalLoop → proposalLoop(task, task.description, 8)
    PlanLoop     → task.description  -- not used; plan stage reads task.description directly
  plan: case entry of
    ProposalLoop → planLoop(task, draftEpicPlan(task, proposal, cfg), 8)
    PlanLoop     → planLoop(task, task.description, 8)  -- description IS the plan draft
  _:    finalise(task, proposal, plan, cfg),
  return: task  -- status: Epic: Backlog
}

-- proposalLoop / planLoop are reviewLoop instantiations (MaxRounds = 8)
proposalLoop :: (Task, Doc, Int) → ApprovedDoc
proposalLoop(task, doc, n) = reviewLoop(task, doc, n)   -- see spec-stdlib § reviewLoop
                                                        -- human approves: Epic: Proposal → Epic: Plan

planLoop :: (Task, Doc, Int) → ApprovedDoc
planLoop(task, doc, n) = reviewLoop(task, doc, n)       -- see spec-stdlib § reviewLoop
                                                        -- human approves: Epic: Plan → Epic: Backlog

-- Proposal review invariants (all must hold for APPROVED)

reviewProposal :: EpicProposal → Verdict
reviewProposal(P) = {
  assert: explainsWhy(P.background),            -- Background states WHY, 3-8 lines
  assert: ∀goal ∈ P.goals: verifiable(goal),
  assert: ¬empty(P.sketch),                     -- decomposition sketch must exist
  assert: identified(P.tradeoffs),
  return: APPROVED | NEEDS_REVISION
}

-- Plan review invariants (all must hold for APPROVED)

reviewPlan :: EpicPlan → Verdict
reviewPlan(P) = {
  assert: ¬empty(P.subTasks),                   -- Sub-Task Decomposition must list children
  assert: ∀st ∈ P.subTasks: hasOneLine(st),     -- each child has title + one-line
  assert: ∀goal ∈ P.goals: coveredBy(goal, P.subTasks),
  assert: coherent(P.sequencing),
  return: APPROVED | NEEDS_REVISION
}

-- This skill stops at Epic: Backlog. It creates NO child tasks and performs NO
-- decomposition. The epic DAG continues only after a human promotes the epic:
--   Epic: Backlog → Epic: Ready → (autonomous) Epic: Decomposing →
--   Epic: Awaiting Children → Epic: Evaluating → Epic: Done | Epic: Needs Human

## Implementation

### loadConfig

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)

# --- fromClaudeMd ---
L0_SECTION=$(awk '/^## L0 Config/{found=1; next} found && /^## /{exit} found{print}' \
  "${REPO_ROOT}/CLAUDE.md" 2>/dev/null)

parse_cfg() { echo "$L0_SECTION" | grep -oP "(?<=^$1:\s)\S.*" | head -1 | xargs; }

CFG_TEST_CMD=$(parse_cfg "test-cmd")
CFG_TEST_ALL=$(parse_cfg "test-all")
CFG_DOC_PATH=$(parse_cfg "doc-path")

# --- autoDetect fallback ---
if [ -z "$L0_SECTION" ]; then
  if   [ -f "${REPO_ROOT}/package.json"  ]; then LANG=node
  elif [ -f "${REPO_ROOT}/go.mod"        ]; then LANG=go
  elif [ -f "${REPO_ROOT}/Cargo.toml"    ]; then LANG=rust
  elif [ -f "${REPO_ROOT}/pyproject.toml" ] || [ -f "${REPO_ROOT}/setup.py" ]; then LANG=python
  else LANG=unknown; fi

  case "$LANG" in
    node)   CFG_TEST_CMD="${CFG_TEST_CMD:-npm test -- --run}"; CFG_TEST_ALL="${CFG_TEST_ALL:-npm test}" ;;
    go)     CFG_TEST_CMD="${CFG_TEST_CMD:-go test ./...}";    CFG_TEST_ALL="${CFG_TEST_ALL:-go test ./...}" ;;
    rust)   CFG_TEST_CMD="${CFG_TEST_CMD:-cargo test}";       CFG_TEST_ALL="${CFG_TEST_ALL:-cargo test --workspace}" ;;
    python) CFG_TEST_CMD="${CFG_TEST_CMD:-pytest -k}";        CFG_TEST_ALL="${CFG_TEST_ALL:-pytest}" ;;
    *)      CFG_TEST_CMD="${CFG_TEST_CMD:-make test}";        CFG_TEST_ALL="${CFG_TEST_ALL:-make test}" ;;
  esac
  CFG_DOC_PATH="${CFG_DOC_PATH:-docs}"
  echo "L0 auto-detected config: lang=${LANG} testCmd=${CFG_TEST_CMD} testAll=${CFG_TEST_ALL} docPath=${CFG_DOC_PATH}"
else
  CFG_TEST_CMD="${CFG_TEST_CMD:-make test}"
  CFG_TEST_ALL="${CFG_TEST_ALL:-make test}"
  CFG_DOC_PATH="${CFG_DOC_PATH:-docs}"
  echo "L0 config loaded from CLAUDE.md: testCmd=${CFG_TEST_CMD} testAll=${CFG_TEST_ALL} docPath=${CFG_DOC_PATH}"
fi
```

Derive slug and title from `<topic>`:

```bash
SLUG=$(echo "<topic>" | tr '[:upper:] ' '[:lower:]-' | tr -cd '[:alnum:]-' | cut -c1-50)
TITLE=$(echo "<topic>" | cut -c1-70)
```

If `<topic>` is empty: print usage and stop.

---

### Phase 0: Manifest Generation and Lint

Before executing any phase, generate a manifest JSON that describes the planned execution:

```json
{
  "skill": "epic-to-backlog",
  "task_id": null,
  "entry_point": "createEpicTask",
  "skip_draft": false,
  "field_writes": [
    { "tool": "backlog task edit", "field": "planSet", "source": "$TMPDIR/etb-plan.md" },
    { "tool": "backlog task edit", "field": "status", "value": "Epic: Backlog" }
  ],
  "phases_to_execute": ["createEpicTask", "proposalLoop", "planLoop", "finalise"]
}
```

Write the manifest to `$TMPDIR/epic-to-backlog-manifest.json`, then validate it:

```bash
bash scripts/skill-lint.sh --manifest "$TMPDIR/epic-to-backlog-manifest.json"
```

If validation fails, stop and report the error before proceeding.

---

### Phase 1: resolveOrCreate + maybe draftProposal

**1a. resolveOrCreate** (orchestrator runs directly):

```bash
if echo "<topic>" | grep -qiP '^task-\d+$'; then
  # Existing epic path — resolve and extract description as initial draft
  TASK_ID=$(echo "<topic>" | tr '[:lower:]' '[:upper:]')
  backlog task view "$TASK_ID" --plain > $TMPDIR/etb-existing-task.txt
  echo "$TASK_ID" > $TMPDIR/etb-task-id.txt
  # Extract description block into etb-proposal.md (reused as proposal or plan draft)
  awk '/^Description:/{found=1;next} found && /^-{10,}/{if(!sep){sep=1;next};exit} found && sep{print}' \
    $TMPDIR/etb-existing-task.txt > $TMPDIR/etb-proposal.md
  # Determine entry point from status
  TASK_STATUS=$(grep -oP '(?<=Status:).*' $TMPDIR/etb-existing-task.txt | head -1 | grep -oP '(Basic|Epic): [A-Za-z ]+' | head -1 | xargs)
  case "$TASK_STATUS" in
    "Epic: Plan") echo "PlanLoop"     > $TMPDIR/etb-entry-point.txt ;;
    *)            echo "ProposalLoop" > $TMPDIR/etb-entry-point.txt ;;
  esac
else
  # New topic path — create epic task with kind:epic label at Epic: Proposal
  backlog task create "$TITLE" \
    --status "Epic: Proposal" \
    --labels "kind:epic" \
    --description "<topic>" \
    --plain
  # Extract task ID from output line `Task TASK-N`. Write to $TMPDIR/etb-task-id.txt.
  echo "ProposalLoop" > $TMPDIR/etb-entry-point.txt
fi
```

If `$TMPDIR/etb-entry-point.txt` contains `PlanLoop`: skip phase 1b and phases 2–3; proceed directly to Phase 4 using `$TMPDIR/etb-proposal.md` as the plan draft (rename it to `$TMPDIR/etb-plan.md`).

**1b. draftProposal** — spawn Task agent (only when entry point is `ProposalLoop` AND topic is a new description; skip if existing task ID was given — its description is already in `$TMPDIR/etb-proposal.md`):

> Draft an epic proposal and update the backlog task.
>
> Task ID: `<TASK_ID>`
>
> 1. Search the codebase to understand current architecture relevant to: `<topic>`
>
> 2. Write `$TMPDIR/etb-proposal.md`:
>    ```markdown
>    # Epic Proposal: <title>
>
>    ## Background
>    (3-8 lines: WHY this epic is needed, what cross-cutting problem it solves)
>
>    ## Goals
>    1. (concrete, verifiable outcome for the epic as a whole)
>    2. ...
>
>    ## Decomposition Sketch
>    (Rough list of the would-be child sub-tasks this epic will spawn.
>     One bullet per candidate basic task — title plus a one-line scope.
>     This is a SKETCH; the firm decomposition is produced in the Plan stage.)
>    - <candidate child title> — <one-line scope>
>    - ...
>
>    ## Trade-offs and Risks
>    (What we are not doing, known risks, alternatives considered)
>    ```
>
> 3. Update task:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --planSet "$(cat $TMPDIR/etb-proposal.md)" \
>      --status "Epic: Proposal"
>    ```
>
> Rules: Background must state WHY, not just WHAT. Each Goal must be verifiable.
> The Decomposition Sketch must list at least two candidate child sub-tasks.
> Do NOT create any child tasks. No implementation phases or DoD commands here.

---

### Phase 2: proposalLoop — reviewLoop(proposal)

**Soft limit: 8 iterations.** On exhaustion:

```bash
backlog task edit $TASK_ID --status "Epic: Needs Human" \
  --append-notes "Epic proposal review did not converge after 8 iterations. Manual review required."
```

Print current `$TMPDIR/etb-proposal.md` and stop.

Each iteration — spawn Task agent with `run_in_background=true` (self-chaining background agent):

> You are a strict software architect reviewing an epic proposal.
>
> Task ID: `<TASK_ID>` — Iteration: `<N>` — Max iterations: 8
>
> 1. Read `$TMPDIR/etb-proposal.md`
>
> 2. Check each item:
>    - **Motivation**: Does Background explain WHY (not just WHAT)? Is it 3-8 lines?
>    - **Goals**: All numbered and concretely verifiable? No vague language?
>    - **Decomposition Sketch**: Present and lists ≥2 candidate child sub-tasks,
>      each with a one-line scope? Do the children collectively cover the Goals?
>    - **Feasibility**: Does the epic align with the codebase? Search to verify.
>    - **Completeness**: Are trade-offs and risks identified?
>    - **Consistency**: No contradictions between sections?
>
> 3a. ALL pass:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --append-notes "Epic proposal review iteration <N>: APPROVED"
>    echo "APPROVED" > $TMPDIR/etb-proposal-verdict.txt
>    # Write marker file — daemon will fire proposal-approved event when human advances status
>    touch backlog/.etb-awaiting-plan-<TASK_ID>
>    ```
>    Print: "Proposal APPROVED. Run: `backlog task edit <TASK_ID> --status 'Epic: Plan'` to start plan drafting."
>    Then STOP — do NOT auto-advance status.
>
> 3b. ANY fail: fix the failing sections in `$TMPDIR/etb-proposal.md` directly,
>    update task plan with revised draft:
>    ```bash
>    backlog task edit <TASK_ID> --planSet "$(cat $TMPDIR/etb-proposal.md)"
>    echo "NEEDS_REVISION" > $TMPDIR/etb-proposal-verdict.txt
>    ```
>    If `<N>` < 8: spawn next iteration as background agent (`run_in_background=true`) with N+1 and STOP.
>    If `<N>` == 8: move to `Epic: Needs Human`, print proposal, STOP.

After the first iteration is spawned (`run_in_background=true`), the orchestrator exits.
The background agent self-chains by spawning the next iteration on NEEDS_REVISION.
On APPROVED, the background agent writes `backlog/.etb-awaiting-plan-<TASK_ID>` and stops.
The daemon detects the marker + human status advance and fires `proposal-approved:TASK-N`.

---

### Phase 3: draftEpicPlan

If `$TMPDIR/etb-entry-point.txt` contains `PlanLoop`: `$TMPDIR/etb-plan.md` already holds the task's existing description as the plan draft — skip this phase and proceed directly to Phase 4.

```bash
backlog task edit $TASK_ID \
  --status "Epic: Plan" \
  --append-notes "Epic proposal approved. Starting epic plan draft."
```

Spawn Task agent (pass `CFG_TEST_CMD`, `CFG_TEST_ALL`, `CFG_DOC_PATH` as literal values):

> Draft an epic plan and update the backlog task.
>
> Task ID: `<TASK_ID>`
> Test command (carried into children): `<CFG_TEST_CMD>`
> Full suite command (carried into children): `<CFG_TEST_ALL>`
> Doc root: `<CFG_DOC_PATH>`
>
> 1. Read the approved proposal from `$TMPDIR/etb-proposal.md`
> 2. Search the codebase to firm up the intended child sub-tasks and their boundaries.
> 3. Write `$TMPDIR/etb-plan.md`:
>
>    ```markdown
>    # Epic Plan: <title>
>
>    ## Background
>    (carried from the approved proposal)
>
>    ## Goals
>    1. ...
>
>    ## Sub-Task Decomposition
>    (The firm list of intended child basic tasks. The autonomous epic worker will
>     later turn each of these into a real child task — do NOT create them here.
>     One entry per child: a title plus a one-line description.)
>    1. <child basic-task title> — <one-line description>
>    2. <child basic-task title> — <one-line description>
>    3. ...
>
>    ## Sequencing
>    (Ordering and dependencies between the children: which must land before which,
>     and why. Note any children that can proceed in parallel.)
>
>    ## Constraints
>    (Non-executable criteria for the epic as a whole.)
>    ```
>
>    Rules (STRICT):
>    - `## Sub-Task Decomposition` MUST exist and list ≥2 children, each title + one-line.
>    - Every proposal Goal must be covered by at least one child sub-task.
>    - Do NOT create any child tasks. Do NOT decompose into real backlog entries.
>    - This is a plan only; the autonomous worker performs the actual decomposition later.
>
> 4. Update task:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --planSet "$(cat $TMPDIR/etb-plan.md)" \
>      --status "Epic: Plan"
>    ```

---

### Phase 4: planLoop — reviewLoop(plan)

**Soft limit: 8 iterations.** On exhaustion: move to `Epic: Needs Human`, print plan, stop.

Each iteration — spawn Task agent with `run_in_background=true` (self-chaining background agent):

> You are a strict software architect reviewing an epic plan.
>
> Task ID: `<TASK_ID>` — Iteration: `<N>` — Max iterations: 8
>
> 1. Read `$TMPDIR/etb-proposal.md` and `$TMPDIR/etb-plan.md`
>
> 2. Check each item:
>    - **Sub-Task Decomposition present**: `## Sub-Task Decomposition` exists and lists
>      ≥2 children, each with a title and a one-line description.
>    - **Goal coverage**: Every proposal Goal is covered by at least one child sub-task.
>    - **Sequencing coherence**: Dependencies between children are stated and acyclic.
>    - **Scope discipline**: No child outside the epic's Goals; no child that should be
>      its own epic.
>    - **No premature creation**: The plan does NOT create child tasks or decompose —
>      it only describes the intended children.
>    - **File paths / feasibility**: Referenced areas exist in the codebase (search to verify).
>
> 3a. ALL pass:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --append-notes "Epic plan review iteration <N>: APPROVED"
>    echo "APPROVED" > $TMPDIR/etb-plan-verdict.txt
>    # Write marker file — daemon will fire plan-approved event when human advances status
>    touch backlog/.etb-awaiting-backlog-<TASK_ID>
>    ```
>    Print: "Plan APPROVED. Run: `backlog task edit <TASK_ID> --status 'Epic: Backlog'` to finalise."
>    Then STOP — do NOT auto-advance status.
>
> 3b. ANY fail: fix `$TMPDIR/etb-plan.md` (and `$TMPDIR/etb-proposal.md` if needed),
>    update task plan:
>    ```bash
>    backlog task edit <TASK_ID> --planSet "$(cat $TMPDIR/etb-plan.md)"
>    echo "NEEDS_REVISION" > $TMPDIR/etb-plan-verdict.txt
>    ```
>    If `<N>` < 8: spawn next iteration as background agent (`run_in_background=true`) with N+1 and STOP.
>    If `<N>` == 8: move to `Epic: Needs Human`, print plan, STOP.

After the first iteration is spawned (`run_in_background=true`), the orchestrator exits.
The background agent self-chains by spawning the next iteration on NEEDS_REVISION.
On APPROVED, the background agent writes `backlog/.etb-awaiting-backlog-<TASK_ID>` and stops.
The daemon detects the marker + human status advance and fires `plan-approved:TASK-N`.

---

### Phase 5: finalise

Spawn Task agent (pass `CFG_DOC_PATH`, `TASK_ID`, `SLUG` as literal values):

> Finalise the epic task: write combined proposal + plan into the Implementation Plan
> field and park the epic at Epic: Backlog. Do NOT create children or decompose.
>
> Task ID: `<TASK_ID>` — Slug: `<SLUG>` — Doc root: `<CFG_DOC_PATH>`
>
> **Step B — Write combined proposal+plan into task and set status to Epic: Backlog**:
> ```bash
> {
>   cat $TMPDIR/etb-proposal.md
>   printf '\n\n---\n\n'
>   cat $TMPDIR/etb-plan.md
> } > $TMPDIR/etb-combined.md
>
> backlog task edit <TASK_ID> \
>   --planSet "$(cat $TMPDIR/etb-combined.md)" \
>   --status "Epic: Backlog" \
>   --append-notes "cap:propose=approved"
> ```
>
> **Step D — Run Layer 0-2 validation gate**:
> ```bash
> bash scripts/validate-plugin.sh
> ```
> If validation fails, fix the SKILL.md contracts or internals before proceeding.
>
> **Step E — Print completion**:
> ```
> ✅ Epic <TASK_ID> is now in Epic: Backlog.
>
> 一轮起草 + 迭代审查（提案、计划）已完成。计划中已列出预期的子任务分解，
> 但本技能不会创建任何子任务，也不会执行分解。
>
> 请在 web UI 审阅 Epic Proposal / Epic Plan：
>   backlog browser --no-open --port 6421
>
> 确认无误后，将 epic 推进到 Epic: Ready 以授权自主分解：
>   backlog task edit <TASK_ID> --status "Epic: Ready"
>
> 之后统一的 loop-backlog worker（basic-daemon 在 Epic: Ready 时发 epic-ready 事件）会接管：
>   Epic: Ready → Epic: Decomposing → Epic: Awaiting Children →
>   Epic: Evaluating（写 FINISH/ITERATE 建议，软停等你确认）→ Epic: Done | Epic: Needs Human
> 子任务建在 Basic: Backlog；由你提升选中的子任务到 Basic: Ready 来执行。
> ```

---

## Constraints

- **Granularity gate (use an epic only when it earns it)**: an epic is justified ONLY when the
  goal needs ≥2 independent Basic Tasks with ordering/dependencies and a combined acceptance.
  A Basic Task is NOT small — its plan may have two levels (Phase + Stage) and reach ~1000s LOC
  (e.g. TASK-16: 16 skills, ~430-line plan). "A few related fixes" is ONE Basic Task with
  multiple Phases, not an epic. See `docs/proposals/proposal-epic-split-board.md` § 颗粒度.
  If the idea is really one Basic Task, stop and use `task-to-backlog` / `feature-to-backlog`.
- This skill outputs an epic proposal + plan and a backlog task only — it does not implement code
- It creates NO child tasks and performs NO decomposition; that is the autonomous worker's job
- No branch creation, no worktree operations, no git push, no PR creation
- One task per epic throughout; the same TASK_ID moves Epic: Proposal → Epic: Plan → Epic: Backlog
- The skill stops at Epic: Backlog; the human promotes to Epic: Ready to start decomposition
- Proposal and plan text live in the task's Implementation Plan field; no docs/ files are written
- Must run from the project root of a git repository
