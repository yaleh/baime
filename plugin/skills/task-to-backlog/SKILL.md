---
name: task-to-backlog
description: "Converts a non-development task (analysis, research, documentation, experiment, survey) into a backlog task. Single draft + review loop produces a phase-based execution plan with shell-verifiable DoD. No TDD structure required. Ends with the plan written into the task planSet and the task in Backlog status with native DoD items."
argument-hint: [task-description]
allowed-tools: Read, Glob, Grep, Bash, Agent
---

λ(topic) → taskToBacklog(topic)

## Spec

Config :: {
  docPath : String   -- root directory for plan docs and task outputs
}

loadConfig :: () → Config  -- see spec-stdlib § loadConfig
loadConfig() =
  | fromClaudeMd()   -- explicit: "## L0 Config" section in CLAUDE.md
  | autoDetect()     -- implicit: use "docs" if it exists, otherwise "."

autoDetect :: () → Config
autoDetect() = -- see spec-stdlib § loadConfig

-- Non-development task types this skill handles (non-exhaustive)
TaskType = Analysis | Documentation | Research | Experiment | Survey | Setup

-- Plan structure — no TDD constraint; DoD is any shell-verifiable command
Phase :: {
  title        : String,
  instructions : String,    -- what to do; specific tools, files, commands
  dod          : [ShellCmd] -- any shell command; exit 0 = pass
                             -- common patterns:
                             --   test -f <path>          (file exists)
                             --   test -s <path>          (file non-empty)
                             --   grep -q '<pat>' <path>  (content check)
                             --   <tool> && exit 0        (tool succeeded)
}

Plan :: {
  phases      : [Phase],    -- ordered; earlier phases produce inputs for later ones
  constraints : [String],   -- non-executable criteria (NOT in dod)
  acceptance  : [ShellCmd]  -- final gate; at least one item required
}

-- Input: topic is either a task ID (e.g. TASK-12, task-12) or a free-form description.
-- Task ID → resolve existing task; use its description as the plan draft (skip re-draft).
-- Description → create a new task, then draft a plan from scratch.

resolveOrCreate :: Topic → (Task, SkipDraft)
resolveOrCreate(T) =
  | isTaskId(T) → (lookupTask(T), True)   -- reuse existing description as plan draft
  | otherwise   → (createTask(T), False)  -- draft from scratch

-- Workflow: single draft + single review loop (softer than feature-to-backlog)
taskToBacklog :: Topic → BacklogTask
taskToBacklog(T) = {
  cfg:               loadConfig(),
  (task, skipDraft): resolveOrCreate(T),
  plan: if skipDraft
    then reviewLoop(task, task.description, 4)  -- existing description IS the plan draft
    else reviewLoop(task, draftPlan(task, T), 4)
  _:    finalise(task, plan, cfg),
  return: task   -- status: Backlog
}

reviewLoop :: (Task, Plan, MaxRounds) → ApprovedPlan  -- see spec-stdlib § reviewLoop
reviewLoop task plan = reviewLoopStdlib task plan maxRounds  -- MaxRounds = 4

-- Review invariants (all must hold for APPROVED)
reviewPlan :: Plan → Verdict
reviewPlan(P) = {
  assert: ¬empty(P.phases),
  ∀phase ∈ P.phases: {
    assert: ¬empty(phase.instructions),         -- phase must say what to do
    assert: ¬empty(phase.dod),                  -- phase must be verifiable
    assert: ∀cmd ∈ phase.dod: isShellCmd(cmd)  -- no natural-language DoD
  },
  assert: ¬empty(P.acceptance),
  assert: ∀cmd ∈ P.acceptance: isShellCmd(cmd),
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

if [ -z "$L0_SECTION" ]; then
  if [ -d "${REPO_ROOT}/docs" ]; then
    CFG_DOC_PATH="${CFG_DOC_PATH:-docs}"
  else
    CFG_DOC_PATH="${CFG_DOC_PATH:-.}"
  fi
  echo "L0 auto-detected config: docPath=${CFG_DOC_PATH}"
else
  CFG_DOC_PATH="${CFG_DOC_PATH:-docs}"
  echo "L0 config loaded from CLAUDE.md: docPath=${CFG_DOC_PATH}"
fi
```

Derive slug and title:

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
  "skill": "task-to-backlog",
  "task_id": "<TASK-ID or null>",
  "entry_point": "<resolveOrCreate|createTask>",
  "skip_draft": "<true if entry_point==\"resolveOrCreate\">",
  "field_writes": [
    { "tool": "backlog task edit", "field": "planSet", "source": "$TMPDIR/ttb-plan.md" },
    { "tool": "backlog task edit", "field": "status", "value": "Backlog" }
  ],
  "phases_to_execute": ["<entry_point>", "reviewLoop", "finalise"]
}
```

Write the manifest to `$TMPDIR/task-to-backlog-manifest.json`, then validate it:

```bash
bash scripts/skill-lint.sh --manifest "$TMPDIR/task-to-backlog-manifest.json"
```

If validation fails, stop and report the error before proceeding.

---

### Phase 1: resolveOrCreate

Detect whether `<topic>` is an existing task ID or a new description:

```bash
if echo "<topic>" | grep -qiP '^task-\d+$'; then
  # Existing task path — resolve and extract description as initial plan draft
  TASK_ID=$(echo "<topic>" | tr '[:lower:]' '[:upper:]')
  backlog task view "$TASK_ID" --plain > $TMPDIR/ttb-existing-task.txt
  echo "$TASK_ID" > $TMPDIR/ttb-task-id.txt
  # Extract description block into ttb-plan.md (between the two separator lines)
  awk '/^Description:/{found=1;next} found && /^-{10,}/{if(!sep){sep=1;next};exit} found && sep{print}' \
    $TMPDIR/ttb-existing-task.txt > $TMPDIR/ttb-plan.md
  echo "skip" > $TMPDIR/ttb-draft-mode.txt
else
  # New topic path — create task
  backlog task create "$TITLE" \
    --status "Plan" \
    --description "<topic>" \
    --plain
  # Extract task ID from output line `Task TASK-N`. Write to $TMPDIR/ttb-task-id.txt.
  echo "draft" > $TMPDIR/ttb-draft-mode.txt
fi
```

---

### Phase 2: draftPlan

If `$TMPDIR/ttb-draft-mode.txt` contains `skip`: `$TMPDIR/ttb-plan.md` already holds the task's existing description — skip this phase and proceed directly to Phase 3.

Spawn Task agent:

> Draft an execution plan for a non-development task and update the backlog task.
>
> Task ID: `<TASK_ID>`
> Doc root: `<CFG_DOC_PATH>`
>
> 1. Read the task topic: `<topic>`
> 2. Search the codebase or project structure as needed to understand context.
> 3. Write `$TMPDIR/ttb-plan.md`:
>
>    ```markdown
>    # Plan: <title>
>
>    ## Context
>    (1-4 lines: why this task, what problem it addresses)
>
>    ## Phase 1: <title>
>    <Specific instructions: which tools to run, which files to read/write,
>    what commands to execute. Be concrete — avoid "analyse" without saying how.>
>    ### DoD
>    - [ ] `<shell command>`   ← exit 0 = done; use test -f, grep -q, tool exit code
>    - [ ] `<shell command>`
>
>    ## Phase 2: <title>
>    ...
>    ### DoD
>    - [ ] `<shell command>`
>
>    ## Constraints
>    (What NOT to do; scope limits; non-executable criteria only)
>
>    ## Acceptance Gate
>    - [ ] `<final verification command>`
>    ```
>
>    DoD rules (STRICT):
>    - Every `### DoD` and `## Acceptance Gate` item MUST be a shell command
>      (exit 0 = pass; never natural language)
>    - Prefer precise checks: `grep -q '<section-header>' <file>` over `test -f <file>`
>    - Absence check: `! grep -q <pattern> <file>` (NOT `grep -qv`)
>    - Natural-language criteria → `## Constraints` only
>    - Phases ordered so earlier outputs are available to later phases
>    - Minimum 1 phase, maximum 6 phases
>
>    Common DoD patterns for non-dev tasks:
>    - Output file created:    `test -f <CFG_DOC_PATH>/tasks/<slug>-output.md`
>    - Output non-empty:       `test -s <CFG_DOC_PATH>/tasks/<slug>-output.md`
>    - Report has section:     `grep -q '## Recommendations' <path>`
>    - Tool exited cleanly:    `<tool command with flags>`
>    - At least N lines:       `[ $(wc -l < <path>) -ge N ]`
>
> 4. Update task:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --planSet "$(cat $TMPDIR/ttb-plan.md)" \
>      --status "Plan"
>    ```

---

### Phase 3: reviewLoop(plan)

**Soft limit: 4 iterations.** On exhaustion:

```bash
backlog task edit $TASK_ID --status "Needs Human" \
  --append-notes "Plan review did not converge after 4 iterations. Manual review required."
```

Print current `$TMPDIR/ttb-plan.md` and stop.

Each iteration — spawn Task agent:

> You are reviewing an execution plan for a non-development task.
>
> Task ID: `<TASK_ID>` — Iteration: `<N>`
>
> 1. Read `$TMPDIR/ttb-plan.md`
>
> 2. Check each item:
>    - **Clarity**: Does each Phase have specific, actionable instructions?
>      Flag vague instructions like "analyse X" without saying how.
>    - **DoD executability**: Every `### DoD` and `## Acceptance Gate` item
>      is a shell command (exit 0 = pass). Flag natural-language items
>      and move them to `## Constraints`.
>    - **DoD precision**: Prefer `grep -q '<section>'` over bare `test -f`.
>      A file existing is weaker than a file containing the expected content.
>    - **Absence checks**: `! grep -q` used, not `grep -qv`.
>    - **Phase ordering**: Outputs of earlier phases are available to later phases.
>    - **Scope**: No phase does something outside the task's stated purpose.
>
> 3a. ALL pass:
>    ```bash
>    backlog task edit <TASK_ID> \
>      --append-notes "Plan review iteration <N>: APPROVED"
>    echo "APPROVED" > $TMPDIR/ttb-plan-verdict.txt
>    ```
>
> 3b. ANY fail: fix `$TMPDIR/ttb-plan.md`, update task plan:
>    ```bash
>    backlog task edit <TASK_ID> --planSet "$(cat $TMPDIR/ttb-plan.md)"
>    ```
>    Write `NEEDS_REVISION` to verdict file.

After each agent run, read `$TMPDIR/ttb-plan-verdict.txt`:
- `APPROVED` → proceed to Phase 4
- `NEEDS_REVISION` → increment counter, repeat Phase 3

---

### Phase 4: finalise

Spawn Task agent (pass `CFG_DOC_PATH`, `TASK_ID`, `SLUG` as literal values):

> Finalise the backlog task: write plan into task and add DoD items.
>
> Task ID: `<TASK_ID>` — Slug: `<SLUG>` — Doc root: `<CFG_DOC_PATH>`
>
> **Step B — Write plan into task and add DoD**:
> ```bash
> grep -oP '(?<=- \[ \] `)[^`]+(?=`)' $TMPDIR/ttb-plan.md \
>   > $TMPDIR/ttb-dod-cmds.txt
>
> DOD_ARGS=()
> while IFS= read -r cmd; do
>   DOD_ARGS+=("--dod" "$cmd")
> done < $TMPDIR/ttb-dod-cmds.txt
>
> backlog task edit <TASK_ID> \
>   --planSet "$(cat $TMPDIR/ttb-plan.md)" \
>   --status "Backlog" \
>   "${DOD_ARGS[@]}"
> ```
>
> **Step D — Run Layer 0-2 validation gate**:
> ```bash
> bash scripts/validate-plugin.sh
> ```
> If validation fails, fix any SKILL.md contracts or internals before proceeding.
>
> Add the validation DoD item to the task:
> ```bash
> backlog task edit <TASK_ID> --dod "bash scripts/validate-plugin.sh"
> ```
>
> **Step E — Print completion**:
> ```
> ✅ Task <TASK_ID> is now in Backlog.
>
> 计划草拟 + 审查已完成。
>
> 请在 web UI 确认 Definition of Done 命令：
>   backlog browser --no-open --port 6421
>
> 确认无误后，将任务移入执行队列：
>   backlog task edit <TASK_ID> --status "Ready"
>
> 等待 loop-backlog 自动拾取，或立即启动：
>   /loop-backlog
> ```

---

## Constraints

- This skill outputs a plan doc and a backlog task only — it does not execute the task
- No branch creation, no worktree operations, no git push, no PR creation
- One task per topic; the same TASK_ID moves through all columns
- Phase count: minimum 1, maximum 6
- Must run from the project root of a git repository
- Plan text lives in the task's Implementation Plan field; no docs/ files are written
