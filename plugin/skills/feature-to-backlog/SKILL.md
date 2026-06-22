---
name: feature-to-backlog
description: "Drives the Proposal-to-Backlog pipeline for a software feature: two architect-reviewed cycles (one for Proposal, one for Plan), each converging on APPROVED within 8 rounds. Outputs a planSet entry ready for implementation; does not create branches or open PRs."
argument-hint: [feature-topic-or-description]
allowed-tools: Read, Glob, Grep, Bash, Agent
contracts:
  - grep: "proposalLoop"
    target: self
  - grep: "planLoop"
    target: self
  - grep: "APPROVED"
    target: self
  - not-grep: "git worktree add"
    target: self
---

λ(topic) → featureToBacklog(topic)

## Spec

Config :: {
  testCmd  : String,   -- per-phase test runner; becomes DoD[0] in generated plans
  testAll  : String,   -- full suite; becomes Acceptance Gate[0]
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

Proposal :: {
  background : String,           -- WHY this feature is needed (3-8 lines)
  goals      : [VerifiableGoal], -- each Goal checkable by inspection or shell command
  approach   : String,           -- high-level design; no implementation code
  tradeoffs  : String            -- what we are NOT doing; known risks
}

Phase :: {
  title  : String,
  tests  : [TestSpec],           -- written before implementation; must fail first
  impl   : [FileChange],         -- code that makes the tests pass
  dod    : [ShellCmd]            -- dod[0] MUST be cfg.testCmd (red→green proof)
}

Plan :: {
  phases      : [Phase],         -- ordered; earlier phases feed later ones
  constraints : [String],        -- non-executable criteria (NOT in dod)
  acceptance  : [ShellCmd]       -- acceptance[0] is cfg.testAll
}

-- Input: topic is either a task ID (e.g. TASK-12, task-12) or a free-form description.
-- Task ID → resolve existing task; resume from its current status using its description as draft.
-- Description → create a new task and run the full proposal → plan workflow.

EntryPoint = ProposalLoop | PlanLoop
  -- ProposalLoop : enter proposal reviewLoop (new task, or Proposal status)
  -- PlanLoop     : skip proposal; enter plan reviewLoop (Plan status)

resolveOrCreate :: Topic → (Task, EntryPoint)
resolveOrCreate(T) =
  | isTaskId(T) → (lookupTask(T), fromStatus(lookupTask(T).status))
  | otherwise   → (createTask(T), ProposalLoop)

fromStatus :: Status → EntryPoint
fromStatus("Basic: Plan") = PlanLoop
fromStatus(_)             = ProposalLoop  -- Basic: Proposal or other

-- Workflow

featureToBacklog :: Topic → BacklogTask
featureToBacklog(T) = {
  cfg:            loadConfig(),
  (task, entry):  resolveOrCreate(T),
  -- ProposalLoop: use existing description as proposal draft (skips fresh draft if task ID given)
  -- PlanLoop: skip proposal stage entirely
  proposal: case entry of
    ProposalLoop → reviewLoop(task, task.description, 8)
    PlanLoop     → task.description  -- not used; plan stage reads task.description directly
  plan: case entry of
    ProposalLoop → reviewLoop(task, draftPlan(task, proposal, cfg), 8)
    PlanLoop     → reviewLoop(task, task.description, 8)  -- description IS the plan draft
  _:    finalise(task, proposal, plan, cfg),
  return: task  -- status: Backlog
}

-- see spec-stdlib § reviewLoop (MaxRounds = 8)

-- Plan review invariants (all must hold for APPROVED)

reviewPlan :: (Plan, Config) → Verdict
reviewPlan(P, cfg) = {
  ∀phase ∈ P.phases: {
    assert: ¬empty(phase.tests),                  -- TDD: Tests section must exist
    assert: phase.dod[0] starts with cfg.testCmd, -- TDD: first DoD proves red→green
    assert: ∀cmd ∈ phase.dod: isShellCmd(cmd)
  },
  assert: P.acceptance[0] == cfg.testAll,
  assert: ∀goal ∈ proposal.goals: coveredBy(goal, P.phases ∪ P.acceptance),
  assert: ∀phase ∈ P.phases: allFilesExist(phase.impl),
  return: APPROVED | NEEDS_REVISION
}

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
  "skill": "feature-to-backlog",
  "task_id": null,
  "entry_point": "createTask",
  "skip_draft": false,
  "field_writes": [
    { "tool": "backlog task edit", "field": "planSet", "source": "$TMPDIR/ftb-plan.md" },
    { "tool": "backlog task edit", "field": "status", "value": "Basic: Backlog" }
  ],
  "phases_to_execute": ["createTask", "proposalLoop", "planLoop", "finalise"]
}
```

Write the manifest to `$TMPDIR/feature-to-backlog-manifest.json`, then validate it:

```bash
bash "${REPO_ROOT}/scripts/skill-lint.sh" --manifest "$TMPDIR/feature-to-backlog-manifest.json"
```

If validation fails, stop and report the error before proceeding.

---

### Phase 1: resolveOrCreate + maybe draftProposal

**1a. resolveOrCreate** (orchestrator runs directly):

```bash
if echo "<topic>" | grep -qiP '^task-\d+$'; then
  # Existing task path — resolve and extract description as initial draft
  TASK_ID=$(echo "<topic>" | tr '[:lower:]' '[:upper:]')
  backlog task view "$TASK_ID" --plain > $TMPDIR/ftb-existing-task.txt
  echo "$TASK_ID" > $TMPDIR/ftb-task-id.txt
  # Extract description block into ftb-proposal.md (reused as proposal or plan draft)
  awk '/^Description:/{found=1;next} found && /^-{10,}/{if(!sep){sep=1;next};exit} found && sep{print}' \
    $TMPDIR/ftb-existing-task.txt > $TMPDIR/ftb-proposal.md
  # Determine entry point from status
  TASK_STATUS=$(grep -oP '(?<=Status:).*' $TMPDIR/ftb-existing-task.txt | head -1 | grep -oP '(Basic|Epic): [A-Za-z ]+' | head -1 | xargs)
  case "$TASK_STATUS" in
    "Basic: Plan") echo "PlanLoop"     > $TMPDIR/ftb-entry-point.txt ;;
    *)                          echo "ProposalLoop" > $TMPDIR/ftb-entry-point.txt ;;
  esac
else
  # New topic path — create task
  backlog task create "$TITLE" \
    --status "Basic: Proposal" \
    --description "<topic>" \
    --plain
  # Extract task ID from output line `Task TASK-N`. Write to $TMPDIR/ftb-task-id.txt.
  echo "ProposalLoop" > $TMPDIR/ftb-entry-point.txt
fi
```

If `$TMPDIR/ftb-entry-point.txt` contains `PlanLoop`: skip phase 1b and phases 2–3; proceed directly to Phase 4 using `$TMPDIR/ftb-proposal.md` as the plan draft (rename it to `$TMPDIR/ftb-plan.md`).

**1b. draftAndReview** — spawn Task agent "Draft proposal with built-in self-review" (only when entry point is `ProposalLoop` AND topic is a new description; skip if existing task ID was given — its description is already in `$TMPDIR/ftb-proposal.md`):

> Draft a technical proposal and immediately self-review it against all criteria.
>
> Task ID: `<TASK_ID>`
>
> 1. Search the codebase to understand current architecture relevant to: `<topic>`
>
> 2. Write `$TMPDIR/ftb-proposal.md`:
>    ```markdown
>    # Proposal: <title>
>
>    ## Background
>    (3-8 lines: WHY this feature is needed, what problem it solves)
>
>    ## Goals
>    1. (concrete, verifiable outcome)
>    2. ...
>
>    ## Proposed Approach
>    (High-level design: what to build, key components — no implementation code)
>
>    ## Trade-offs and Risks
>    (What we are not doing, known risks, alternatives considered)
>    ```
>
> 3. Self-review: check each criterion against the draft you just wrote:
>    - **Motivation**: Does Background explain WHY (not just WHAT)? Is it 3-8 lines?
>    - **Goals**: All numbered and concretely verifiable? No vague language?
>    - **Feasibility**: Does Approach align with the codebase? Search to verify.
>    - **Completeness**: Are trade-offs and risks identified?
>    - **Consistency**: No contradictions between sections?
>
>    If ANY criterion fails: fix the failing sections inline in `$TMPDIR/ftb-proposal.md` and
>    repeat self-review. Repeat up to 3 total rounds (initial draft + 2 revision rounds).
>
> 4. After all criteria pass (or after 3 rounds), update the task and stop:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --planSet "$(cat $TMPDIR/ftb-proposal.md)" \
>      --status "Basic: Proposal"
>    echo "APPROVED" > $TMPDIR/ftb-proposal-verdict.txt
>    ```
>    Print: "Proposal APPROVED. Proceeding to plan draft."
>
> Rules: Background must state WHY, not just WHAT. Each Goal must be verifiable.
> No implementation phases or DoD commands in this document.

---

### Phase 2: self-review (integrated into Phase 1b)

For new-description topics (ProposalLoop entry), proposal self-review is handled inside
the `draftAndReview` agent in Phase 1b — no separate review agent is spawned.

For existing task ID topics (PlanLoop entry), no proposal review is needed; proceed
directly to Phase 3 (draftPlan) or Phase 4 (planLoop).

---

### Phase 3: draftPlan

If `$TMPDIR/ftb-entry-point.txt` contains `PlanLoop`: `$TMPDIR/ftb-plan.md` already holds the task's existing description as the plan draft — skip this phase and proceed directly to Phase 4.

```bash
backlog task edit $TASK_ID \
  --status "Basic: Plan" \
  --append-notes "Proposal approved. Starting plan draft."
```

Spawn Task agent (pass `CFG_TEST_CMD`, `CFG_TEST_ALL`, `CFG_DOC_PATH` as literal values):

> Draft a TDD implementation plan and update the backlog task.
>
> Task ID: `<TASK_ID>`
> Test command (per phase): `<CFG_TEST_CMD>`
> Full suite command: `<CFG_TEST_ALL>`
> Doc root: `<CFG_DOC_PATH>`
>
> 1. Read the approved proposal from `$TMPDIR/ftb-proposal.md`
> 2. Search the codebase to identify exact file paths to create or modify.
> 3. Write `$TMPDIR/ftb-plan.md`:
>
>    ```markdown
>    # Plan: <title>
>
>    Proposal: <CFG_DOC_PATH>/proposals/proposal-<slug>.md
>
>    ## Phase A: <title>
>    ### Tests (write first)
>    (Test file paths and test case names to add; these must fail before implementation)
>    ### Implementation
>    (Files to create or modify; code that makes the tests pass)
>    ### DoD
>    - [ ] `<CFG_TEST_CMD> <test-file-or-pattern>`   ← first item MUST use testCmd
>    - [ ] `<other verification command>`
>
>    ## Phase B: <title>
>    ### Tests (write first)
>    ...
>    ### Implementation
>    ...
>    ### DoD
>    - [ ] `<CFG_TEST_CMD> <test-file-or-pattern>`
>    - [ ] `<other verification command>`
>
>    ## Constraints
>    (Non-executable criteria — goes here, NOT in DoD)
>
>    ## Acceptance Gate
>    - [ ] `<CFG_TEST_ALL>`                           ← first item MUST be full suite
>    - [ ] `<final verification command>`
>    ```
>
>    DoD rules (STRICT):
>    - Every `### DoD` and `## Acceptance Gate` item MUST be an executable shell command
>      (exit 0 = pass)
>    - `### Tests` section MUST exist in every Phase — this is the TDD specification
>    - First `### DoD` item MUST use `<CFG_TEST_CMD>` — proves red→green
>    - First `## Acceptance Gate` item MUST be `<CFG_TEST_ALL>`
>    - Each Phase ≤ 200 lines of code change
>    - Absence check: `! grep -q <pattern> <file>` (NOT `grep -qv`)
>    - Natural-language criteria → `## Constraints` only, never in DoD
>    - Phases ordered so earlier phases produce what later phases need
>
> 4. Update task:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --planSet "$(cat $TMPDIR/ftb-plan.md)" \
>      --status "Basic: Plan"
>    ```

---

### Phase 4: reviewLoop(plan)

**Soft limit: 8 iterations.** On exhaustion: move to Needs Human, print plan, stop.

Each iteration — spawn Task agent with `run_in_background=true` (self-chaining background agent;
pass `CFG_TEST_CMD`, `CFG_TEST_ALL` as literal values):

> You are a strict software architect reviewing a TDD implementation plan.
>
> Task ID: `<TASK_ID>` — Iteration: `<N>` — Max iterations: 8
> Expected test command: `<CFG_TEST_CMD>`
> Expected full suite: `<CFG_TEST_ALL>`
>
> 1. Read `$TMPDIR/ftb-proposal.md` and `$TMPDIR/ftb-plan.md`
>
> 2. Check each item:
>    - **Goal coverage**: Every proposal Goal addressed by at least one Phase or
>      Acceptance Gate item
>    - **TDD structure**: Every Phase has a `### Tests` section AND
>      `### Implementation` section (in that order)
>    - **TDD order**: First `### DoD` item uses `<CFG_TEST_CMD>` (proves red→green)
>    - **Acceptance gate**: First `## Acceptance Gate` item is `<CFG_TEST_ALL>`
>    - **DoD executability**: All `### DoD` and `## Acceptance Gate` items are shell
>      commands. Flag natural-language items and move to `## Constraints`
>    - **Absence checks**: `! grep -q` pattern used, not `grep -qv`
>    - **Phase ordering**: Earlier phases produce what later phases need; no circular deps
>    - **Scope discipline**: No Phase implements something not backed by a Goal
>    - **File paths**: Referenced files exist in the codebase (search to verify)
>
> 3a. ALL pass:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --append-notes "Plan review iteration <N>: APPROVED"
>    echo "APPROVED" > $TMPDIR/ftb-plan-verdict.txt
>    ```
>    在写 APPROVED 时，把 verdict 扩展为结构化前提账本（premise-ledger）：
>    对你检查的每条 criterion，追加一行 `[E|C|H] <criterion>: <你判断所凭的前提>`，
>    分类规则：E=该前提可直接从本任务 task 文件读到；C=须跳转外部 task/doc/parent 才能确认；
>    H=任何 artifact 都没有、靠背景知识或记忆推断。
>    末尾追加一行 `GCL-self-report: E=<n> C=<n> H=<n>`（各类计数）。
>    写法示例：
>      backlog task edit <TASK_ID> --append-notes "Plan review iteration <N>: APPROVED
>      premise-ledger:
>      [E] goal coverage: 3 goals 映射到 Phase A/B/C
>      [C] file paths exist: 引用的外部文件经 search 确认
>      [H] DoD 充分性基准: 何为'足够'靠背景知识判断
>      GCL-self-report: E=2 C=1 H=1"
>    Print: "Plan APPROVED. Proceeding to finalise."
>
> 3b. ANY fail: fix `$TMPDIR/ftb-plan.md` (and `$TMPDIR/ftb-proposal.md` if needed),
>    update task plan:
>    ```bash
>    backlog task edit <TASK_ID> --planSet "$(cat $TMPDIR/ftb-plan.md)"
>    echo "NEEDS_REVISION" > $TMPDIR/ftb-plan-verdict.txt
>    ```
>    If `<N>` < 8: spawn next iteration as background agent (`run_in_background=true`) with N+1 and STOP.
>    If `<N>` == 8: move to `Basic: Needs Human`, print plan, STOP.

After the first iteration is spawned (`run_in_background=true`), the orchestrator exits.
The background agent self-chains by spawning the next iteration on NEEDS_REVISION.
On APPROVED, the background agent proceeds directly to Phase 5 (finalise).

---

### Phase 5: finalise

Run the following bash commands directly (no agent spawn needed — all steps are mechanical):

**Step B — Write combined proposal+plan into task and add DoD**:
```bash
grep -oP '(?<=- \[ \] `)[^`]+(?=`)' $TMPDIR/ftb-plan.md \
  > $TMPDIR/ftb-dod-cmds.txt

DOD_ARGS=()
while IFS= read -r cmd; do
  DOD_ARGS+=("--dod" "$cmd")
done < $TMPDIR/ftb-dod-cmds.txt

{
  cat $TMPDIR/ftb-proposal.md
  printf '\n\n---\n\n'
  cat $TMPDIR/ftb-plan.md
} > $TMPDIR/ftb-combined.md

backlog task edit <TASK_ID> \
  --planSet "$(cat $TMPDIR/ftb-combined.md)" \
  --status "Basic: Backlog" \
  "${DOD_ARGS[@]}"
```

**Step D — Run Layer 0-2 validation gate**:
```bash
bash "${REPO_ROOT}/scripts/validate-plugin.sh"
```
If validation fails, fix the SKILL.md contracts or internals before proceeding.

Add the following DoD items to the task:
```bash
backlog task edit <TASK_ID> \
  --dod "bash "${REPO_ROOT}/scripts/validate-plugin.sh"" \
  --dod "grep -q 'contracts:' plugin/skills/<skill-slug>/SKILL.md"
```

**Step E — Print completion**:
```
✅ Task <TASK_ID> is now in Backlog.

两轮起草 + 两轮迭代审查已完成。

请在 web UI 审阅 Definition of Done 中的命令：
  backlog browser --no-open --port 6421

确认无误后，将任务移入执行队列：
  backlog task edit <TASK_ID> --status "Basic: Ready"

启动 L0 执行：
  /loop-backlog
```
(print the standard completion message as text output)

---

## Constraints

- **Scope gate (epic vs basic)**: If the feature naturally decomposes into ≥2 independent
  deliverables with ordering/dependencies and a combined acceptance, stop and use
  `/epic-to-backlog` instead. A Basic Task is NOT small — its plan may have Phase + Stage
  two levels and span thousands of LOC. Only reach for an epic when one worker in one
  worktree genuinely cannot finish the whole goal. See
  `docs/proposals/proposal-epic-split-board.md` § 颗粒度.
- This skill outputs docs and a backlog task only — it does not implement code
- No branch creation, no worktree operations, no git push, no PR creation
- One task per feature throughout; the same TASK_ID moves through all columns
- Phase count in generated plans: minimum 1, maximum 8
- Must run from the project root of a git repository
- Proposal and plan text live in the task's Implementation Plan field; no docs/ files are written
