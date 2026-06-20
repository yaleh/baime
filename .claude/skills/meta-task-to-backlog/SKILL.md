---
name: meta-task-to-backlog
description: "Schedules a meta-task (loop-meta L1 work item) into the backlog: two review cycles produce a structured Proposal + Implementation Plan with Acceptance Criteria consumable by loop-meta's decomposer and evaluator. Final status is Meta-Plan — loop-meta picks it up automatically for draftDecomposition."
argument-hint: [goal-description]
allowed-tools: Read, Glob, Grep, Bash, Agent
contracts:
  - grep: "proposalLoop"
    target: self
  - grep: "planLoop"
    target: self
  - grep: "APPROVED"
    target: self
  - grep: "Meta-Plan"
    target: self
---

λ(topic) → metaTaskToBacklog(topic)

## Spec

-- Meta tasks are L1 work items processed by loop-meta (not loop-backlog).
-- They do NOT carry shell-gate DoD items — completeness is judged by the
-- evaluator's oracle/dod/trace slices after all sub-tasks reach Done.
-- The Implementation Plan is the decomposer's input: it must be written
-- at sub-task granularity so loop-meta can split it into ≤5 child tasks.

-- Input: free-form goal description or existing task ID.
-- Task ID (TASK-N) → resume from current status, reuse existing description as proposal draft.
-- Description → create new task, run full proposal → plan workflow.

resolveOrCreate :: Topic → (Task, EntryPoint)
resolveOrCreate(T) =
  | isTaskId(T) → (lookupTask(T), fromStatus(lookupTask(T).status))
  | otherwise   → (createTask(T, status="Meta-Proposal"), ProposalLoop)

fromStatus :: Status → EntryPoint
fromStatus("Meta-Plan") = PlanLoop
fromStatus(_)           = ProposalLoop

-- Proposal document structure
Proposal :: {
  background    : String,   -- WHY this meta-task exists (3-8 lines)
  goals         : [String], -- concrete, evaluator-observable outcomes
  approach      : String,   -- how the work will be decomposed into sub-tasks
  tradeoffs     : String    -- scope limits, known risks, what is NOT in scope
}

-- Implementation Plan structure (read by loop-meta decomposer)
Subject :: {
  title        : String,   -- maps to 1-3 sub-tasks during draftDecomposition
  description  : String,   -- what work this subject entails
  deliverable  : String    -- observable output (file, log entry, test result)
}

Plan :: {
  subjects           : [Subject],  -- 2-5 subjects; each ≤3 sub-tasks
  acceptanceCriteria : [String]    -- evaluator oracle checks (observable, NOT shell commands)
}

-- Workflow: proposal review → plan review → Meta-Plan
metaTaskToBacklog :: Topic → BacklogTask
metaTaskToBacklog(T) = {
  (task, entry): resolveOrCreate(T),
  proposal: case entry of
    ProposalLoop → proposalLoop(task, task.description, 4)
    PlanLoop     → task.description
  plan: case entry of
    ProposalLoop → planLoop(task, draftPlan(task, proposal), 4)
    PlanLoop     → planLoop(task, task.description, 4)
  _:    finalise(task, proposal, plan),
  return: task   -- status: Meta-Plan
}

-- proposalLoop review invariants (all must hold for APPROVED)
reviewProposal :: Proposal → Verdict
reviewProposal(P) = {
  assert: ¬empty(P.background),            -- must explain WHY, not just WHAT
  assert: length(P.goals) >= 1,            -- at least one concrete goal
  assert: ∀g ∈ P.goals: isObservable(g),  -- "evaluator can check X" not "X is good"
  assert: ¬empty(P.approach),              -- must name the decomposition strategy
  assert: ¬empty(P.tradeoffs),             -- must state at least one thing NOT in scope
  return: APPROVED | NEEDS_REVISION
}

-- planLoop review invariants (all must hold for APPROVED)
reviewPlan :: Plan → Verdict
reviewPlan(P) = {
  assert: length(P.subjects) >= 2,                        -- minimum 2 subjects
  assert: length(P.subjects) <= 5,                        -- maximum 5 subjects
  assert: ∀s ∈ P.subjects: ¬empty(s.description),        -- each subject must say what work
  assert: ∀s ∈ P.subjects: ¬empty(s.deliverable),        -- each subject must have an output
  assert: length(P.acceptanceCriteria) >= 2,              -- at least 2 criteria
  assert: ∀c ∈ P.acceptanceCriteria: ¬isShellCmd(c),     -- must be oracle criteria, NOT shell
  assert: ∀goal ∈ proposal.goals: coveredBy(goal, P.subjects ∪ P.acceptanceCriteria),
  assert: ¬contains(P, "- [ ] `"),   -- FORBIDDEN: no shell-gate DoD on meta task
  return: APPROVED | NEEDS_REVISION
}


## Implementation

### loadConfig

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)

L0_SECTION=$(awk '/^## L0 Config/{found=1; next} found && /^## /{exit} found{print}' \
  "${REPO_ROOT}/CLAUDE.md" 2>/dev/null)

parse_cfg() { echo "$L0_SECTION" | grep -oP "(?<=^$1:\s)\S.*" | head -1 | xargs; }

CFG_DOC_PATH=$(parse_cfg "doc-path")
CFG_DOC_PATH="${CFG_DOC_PATH:-docs}"
echo "L0 config: docPath=${CFG_DOC_PATH}"
```

Derive slug and title:

```bash
SLUG=$(echo "<topic>" | tr '[:upper:] ' '[:lower:]-' | tr -cd '[:alnum:]-' | cut -c1-50)
TITLE=$(echo "<topic>" | cut -c1-70)
```

If `<topic>` is empty: print usage and stop.

---

### Phase 0: Manifest Generation and Lint

Before executing any phase, generate a manifest JSON:

```json
{
  "skill": "meta-task-to-backlog",
  "task_id": null,
  "entry_point": "createTask",
  "skip_draft": false,
  "field_writes": [
    { "tool": "backlog task edit", "field": "planSet", "source": "$TMPDIR/mtb-plan.md" },
    { "tool": "backlog task edit", "field": "status", "value": "Meta-Plan" }
  ],
  "phases_to_execute": ["createTask", "proposalLoop", "planLoop", "finalise"]
}
```

Write to `$TMPDIR/meta-task-to-backlog-manifest.json`, then validate:

```bash
bash scripts/skill-lint.sh --manifest "$TMPDIR/meta-task-to-backlog-manifest.json"
```

If validation fails, stop and report before proceeding.

---

### Phase 1: resolveOrCreate

```bash
if echo "<topic>" | grep -qiP '^task-\d+$'; then
  TASK_ID=$(echo "<topic>" | tr '[:lower:]' '[:upper:]')
  backlog task view "$TASK_ID" --plain > $TMPDIR/mtb-existing-task.txt
  echo "$TASK_ID" > $TMPDIR/mtb-task-id.txt
  awk '/^Description:/{found=1;next} found && /^-{10,}/{if(!sep){sep=1;next};exit} found && sep{print}' \
    $TMPDIR/mtb-existing-task.txt > $TMPDIR/mtb-proposal.md
  TASK_STATUS=$(grep -oP '(?<=Status: )\S.*' $TMPDIR/mtb-existing-task.txt | head -1 | xargs)
  case "$TASK_STATUS" in
    "Meta-Plan") echo "PlanLoop"    > $TMPDIR/mtb-entry-point.txt ;;
    *)           echo "ProposalLoop" > $TMPDIR/mtb-entry-point.txt ;;
  esac
else
  backlog task create "$TITLE" \
    --status "Meta-Proposal" \
    --description "<topic>" \
    --plain
  # Extract task ID from output line "Task TASK-N". Write to $TMPDIR/mtb-task-id.txt.
  echo "ProposalLoop" > $TMPDIR/mtb-entry-point.txt
fi
```

If entry point is `PlanLoop`: skip phases 2–3; rename `$TMPDIR/mtb-proposal.md` to `$TMPDIR/mtb-plan.md` and proceed to Phase 4.

---

### Phase 2: draftProposal

Only when entry point is `ProposalLoop` AND topic is a new description. Skip if existing task ID given (description is already in `$TMPDIR/mtb-proposal.md`).

Spawn Task agent:

> Draft a meta-task proposal and update the backlog task.
>
> Task ID: `<TASK_ID>`
>
> 1. Read the goal: `<topic>`
> 2. Search the codebase to understand existing context relevant to this goal (which scripts, skill files, or data directories are involved).
> 3. Write `$TMPDIR/mtb-proposal.md`:
>
>    ```markdown
>    # Proposal: <title>
>
>    ## Background
>    (3-8 lines: WHY this meta-task is needed, what problem it solves, what evidence motivates it)
>
>    ## Goals
>    1. (Concrete, evaluator-observable outcome — "X file exists containing Y field" or "validate-plugin.sh exits 0 with Z check")
>    2. ...
>
>    ## Decomposition Approach
>    (How this goal naturally splits into 2–5 independent work subjects. Name the subjects.)
>
>    ## Trade-offs and Scope Limits
>    (What is explicitly NOT in scope. Known risks or ambiguities that could cause replan.)
>    ```
>
>    Rules:
>    - Background must explain WHY, not just WHAT
>    - Each Goal must be observable by an evaluator (inspection or existence check, NOT a shell command to run as gate)
>    - Decomposition Approach must name concrete subjects, not just say "implement X"
>    - No `- [ ]` shell-gate items anywhere in this document
>
> 4. Update task:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --planSet "$(cat $TMPDIR/mtb-proposal.md)" \
>      --status "Meta-Proposal"
>    ```

---

### Phase 3: proposalLoop

**Soft limit: 4 iterations.** On exhaustion:

```bash
backlog task edit $TASK_ID --status "Needs Human" \
  --append-notes "Proposal review did not converge after 4 iterations. Manual review required."
```

Print current `$TMPDIR/mtb-proposal.md` and stop.

Each iteration — spawn Task agent:

> You are reviewing a meta-task proposal. A meta-task is an L1 work item processed by loop-meta, which will decompose it into sub-tasks automatically.
>
> Task ID: `<TASK_ID>` — Iteration: `<N>`
>
> 1. Read `$TMPDIR/mtb-proposal.md`
>
> 2. Check each item:
>    - **Motivation**: Does Background explain WHY (not just WHAT)? Is it 3-8 lines?
>    - **Goals**: Are all Goals numbered, concrete, and evaluator-observable?
>      Flag vague goals like "improve X" — must say what observable state means success.
>    - **Decomposability**: Does Decomposition Approach name specific subjects (2–5)?
>      Could a decomposer subagent map each subject to 1–3 sub-tasks?
>    - **Scope clarity**: Are trade-offs and scope limits stated?
>    - **No shell gates**: Reject any `- [ ]` backtick shell commands — those belong in sub-tasks.
>
> 3a. ALL pass:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --append-notes "Proposal review iteration <N>: APPROVED"
>    echo "APPROVED" > $TMPDIR/mtb-proposal-verdict.txt
>    ```
>
> 3b. ANY fail: fix `$TMPDIR/mtb-proposal.md`, update task:
>    ```bash
>    backlog task edit <TASK_ID> --planSet "$(cat $TMPDIR/mtb-proposal.md)"
>    ```
>    Write `NEEDS_REVISION` to `$TMPDIR/mtb-proposal-verdict.txt`.

After each agent run, read `$TMPDIR/mtb-proposal-verdict.txt`:
- `APPROVED` → proceed to Phase 4
- `NEEDS_REVISION` → increment counter, repeat Phase 3

---

### Phase 4: draftPlan

If entry point was `PlanLoop`: `$TMPDIR/mtb-plan.md` already holds the existing description — skip to Phase 5.

```bash
backlog task edit $TASK_ID \
  --status "Meta-Plan" \
  --append-notes "Proposal approved. Drafting implementation plan."
```

Spawn Task agent:

> Draft an implementation plan for a meta-task and update the backlog task.
>
> Task ID: `<TASK_ID>`
>
> This is a META-TASK, not a regular backlog task. It will be processed by loop-meta's
> decomposer, which reads the Implementation Plan and creates child sub-tasks automatically.
> Write the plan so that each Subject maps naturally to 1-3 atomic sub-tasks.
>
> 1. Read the approved proposal from `$TMPDIR/mtb-proposal.md`
> 2. Search the codebase to identify specific files, scripts, or data paths involved.
> 3. Write `$TMPDIR/mtb-plan.md`:
>
>    ```markdown
>    # Implementation Plan: <title>
>
>    ## Subject A: <name>
>    **What**: (1-3 sentences: what work this subject entails)
>    **Files**: (specific file paths to create or modify)
>    **Deliverable**: (what observable artifact or state proves this subject is done)
>    **Estimated sub-tasks**: N (1-3)
>
>    ## Subject B: <name>
>    **What**: ...
>    **Files**: ...
>    **Deliverable**: ...
>    **Estimated sub-tasks**: N
>
>    (2–5 subjects total)
>
>    ## Acceptance Criteria
>    1. (Observable outcome the evaluator oracle can inspect — NOT a shell command to run as gate)
>    2. ...
>    (At least 2 criteria; each must be checkable by reading files or examining task notes)
>    ```
>
>    Rules:
>    - 2–5 subjects; each subject maps to 1–3 atomic sub-tasks
>    - Each Subject must name specific files (not "write a script" — say which script)
>    - Deliverable must be an observable artifact or state, not a process step
>    - Acceptance Criteria: observable outcomes the evaluator oracle uses to judge Met/NotMet
>    - FORBIDDEN: `- [ ]` shell-gate DoD items in this document — those belong in sub-tasks
>    - FORBIDDEN: more than 5 subjects — if decomposition is larger, consolidate
>
> 4. Update task:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --planSet "$(cat $TMPDIR/mtb-plan.md)" \
>      --status "Meta-Plan"
>    ```

---

### Phase 5: planLoop

**Soft limit: 4 iterations.** On exhaustion: move to Needs Human, print plan, stop.

Each iteration — spawn Task agent:

> You are reviewing an implementation plan for a meta-task. loop-meta's decomposer will
> read this plan and produce child sub-tasks automatically — your job is to ensure the
> plan is structured so the decomposer can do that correctly.
>
> Task ID: `<TASK_ID>` — Iteration: `<N>`
>
> 1. Read `$TMPDIR/mtb-proposal.md` and `$TMPDIR/mtb-plan.md`
>
> 2. Check each item:
>    - **Goal coverage**: Every proposal Goal addressed by at least one Subject or Acceptance Criterion
>    - **Subject count**: 2–5 subjects (fail if <2 or >5)
>    - **Sub-task granularity**: Each Subject should map to 1–3 atomic child sub-tasks.
>      If a Subject is too broad (needs >3 sub-tasks), split it.
>    - **Specific files**: Every Subject names specific file paths (not generic "a script")
>    - **Deliverable clarity**: Deliverable is an observable artifact or state, not a vague outcome
>    - **Acceptance Criteria**: At least 2 criteria; each is evaluator-observable
>      (existence check, content inspection, task-note field). NOT shell commands to gate on.
>    - **No shell gates**: Reject any `- [ ]` backtick shell command items in the plan.
>      Flag them and remove — those belong in sub-tasks, not in the meta-task plan.
>
> 3a. ALL pass:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --append-notes "Plan review iteration <N>: APPROVED"
>    echo "APPROVED" > $TMPDIR/mtb-plan-verdict.txt
>    ```
>
> 3b. ANY fail: fix `$TMPDIR/mtb-plan.md` (and `$TMPDIR/mtb-proposal.md` if needed):
>    ```bash
>    backlog task edit <TASK_ID> --planSet "$(cat $TMPDIR/mtb-plan.md)"
>    ```
>    Write `NEEDS_REVISION` to `$TMPDIR/mtb-plan-verdict.txt`.

After each agent run, read `$TMPDIR/mtb-plan-verdict.txt`:
- `APPROVED` → proceed to Phase 6
- `NEEDS_REVISION` → increment counter, repeat Phase 5

---

### Phase 6: finalise

Spawn Task agent (pass `TASK_ID`, `SLUG` as literal values):

> Finalise the meta-task: write combined proposal + plan into task and set status to Meta-Plan.
>
> Task ID: `<TASK_ID>` — Slug: `<SLUG>`
>
> **Step A — Write combined proposal + plan into task**:
> ```bash
> {
>   cat $TMPDIR/mtb-proposal.md
>   printf '\n\n---\n\n'
>   cat $TMPDIR/mtb-plan.md
> } > $TMPDIR/mtb-combined.md
>
> backlog task edit <TASK_ID> \
>   --planSet "$(cat $TMPDIR/mtb-combined.md)" \
>   --status "Meta-Plan"
> ```
>
> **Step B — Run validation gate**:
> ```bash
> bash scripts/validate-plugin.sh
> ```
> If validation fails, fix any SKILL.md contracts before proceeding.
>
> **Step C — Print completion**:
> ```
> ✅ Meta-task <TASK_ID> is now in Meta-Plan status.
>
> 两轮起草 + 两轮迭代审查已完成。
>
> loop-meta 将在下次轮询时自动 dispatch draftDecomposition。
> 若要手动触发：
>   /loop-meta
>
> 若要在 web UI 查看任务：
>   backlog browser --no-open --port 6421
> ```

---

## Constraints

- This skill outputs a meta-task in Meta-Plan status only — it does not create sub-tasks
- Sub-tasks are created by loop-meta's draftDecomposition, not by this skill
- No shell-gate `- [ ]` DoD items on the meta task itself (forbidden by meta-task contract)
- Implementation Plan subjects: minimum 2, maximum 5
- Acceptance Criteria: minimum 2 items, evaluator-observable (not shell commands)
- Final status MUST be Meta-Plan — loop-meta will not dispatch draftDecomposition on Meta-Proposal
- No branch creation, no worktree operations, no git push, no PR creation
- Must run from the project root of a git repository
