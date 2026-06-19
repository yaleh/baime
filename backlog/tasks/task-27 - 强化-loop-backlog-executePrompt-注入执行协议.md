---
id: TASK-27
title: 强化 loop-backlog executePrompt 注入执行协议
status: Done
assignee: []
created_date: '2026-06-18 06:21'
updated_date: '2026-06-18 06:50'
labels: []
dependencies: []
ordinal: 1000
---

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: 强化 loop-backlog executePrompt 注入执行协议

## Background

The `loop-backlog` skill's `buildExecutePrompt` function generates the prompt sent to
background task-execution agents. Currently the prompt only provides task metadata (ID,
title, branch, worktree, signal file path), the raw Description text, and three basic
constraints (no merge/push, no sub-agents, write signal file when done).

The SKILL.md Spec formally describes a four-step execution protocol —
`execute → followDescription → verifyDod → conditionalCommit` — including phase
checkpoint notes, per-DoD PASS/FAIL annotations, and an Execution Summary before the
signal file is written. However, **none of this protocol is communicated to the agent in
the actual prompt**. The agent has no instruction to call `backlog task edit --append-notes`
at any point during execution.

As a result, completed tasks (e.g. TASK-25) leave no auditable trace in the task's
Implementation Notes: no phase checkpoints, no DoD verification results, no summary of
what was done or why. When a task is later reviewed, re-queued after escalation, or
audited, there is no structured record to inspect. The gap between the Spec and the
generated prompt is the root cause.

## Goals

1. Every agent spawned by `buildExecutePrompt` appends a structured checkpoint note after
   each Description phase completes, verifiable by inspecting the task's Implementation
   Notes with `backlog task view TASK-N --plain | grep "Phase"`.

2. Every agent appends a per-DoD note recording PASS or FAIL (with an error excerpt) for
   each DoD command run, verifiable with `backlog task view TASK-N --plain | grep "DoD"`.

3. Every agent appends an Execution Summary note immediately before writing the signal
   file, verifiable with `backlog task view TASK-N --plain | grep "Execution Summary"`.

4. The `buildExecutePrompt` function in SKILL.md is the sole source of this protocol
   — no other file needs to change — verifiable by diffing only the `### executePrompt`
   section of SKILL.md.

## Proposed Approach

Expand the `## Constraints` and `## Completing the task` sections of the prompt template
in `buildExecutePrompt` to include a mandatory **Execution Protocol** block. This block
instructs the agent to:

- **Phase checkpoints**: after completing each `## Phase` section from the Description,
  call `backlog task edit ${TID} --append-notes` with a structured note containing the
  phase number, a UTC timestamp, and a one-line summary of what was done or found.

- **DoD verification notes**: for each DoD command, append a note recording the command
  index, the verdict (PASS / FAIL / STUCK), and — on failure — up to five lines of
  captured output so the cause is visible without re-running the command.

- **Execution Summary**: before writing the signal file, append a final summary note that
  lists the overall result (Done / Needs Human), the commit hash if a commit was made,
  and an ordered log of all phase and DoD outcomes recorded during execution.

The protocol text is injected as a self-contained section in the heredoc string already
produced by `buildExecutePrompt`, requiring no structural changes to how the function is
called or how its output is consumed. The Implementation section's `### executePrompt`
bash block is updated in-place; the Spec pseudocode already reflects the intent and needs
no change.

## Trade-offs and Risks

- **Prompt length**: adding the protocol block increases the agent prompt by roughly
  40–60 lines. For tasks with very long Descriptions this pushes total token usage higher.
  Mitigation: the protocol is written as concise imperative instructions, not examples.

- **Note verbosity**: tasks with many phases or DoD items will accumulate more notes.
  This is intentional — auditability is the goal — but reviewers should expect noisier
  note sections.

- **Not addressed**: the proposal does not change how `verifyDod` retries or how
  `conditionalCommit` decides whether to commit. It also does not add structured logging
  to the orchestrator (worker loop) itself; only the spawned agent prompt is modified.

- **Backward compatibility**: tasks already In Progress when the skill is updated will
  continue with the old prompt; only newly spawned agents receive the new protocol.

---

# Plan: 强化 loop-backlog executePrompt 注入执行协议

Proposal: docs/proposals/proposal-executePrompt-execution-protocol.md

## Phase A: 在 buildExecutePrompt heredoc 中注入执行协议

### Tests (write first)

These checks FAIL before the change and PASS after:

```bash
# A1 — protocol header absent before change
! grep -q "## Execution Protocol" plugin/skills/loop-backlog/SKILL.md

# A2 — phase checkpoint instruction absent inside the heredoc before change
# (Phase.*✓ already exists in the Implementation section; scope to heredoc only)
! awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' \
    plugin/skills/loop-backlog/SKILL.md | grep -q "Phase.*✓"

# A3 — DoD append-notes instruction absent in executePrompt heredoc
# (the --append-notes already exists elsewhere but not inside the heredoc block)
! awk '/^```bash$/{p=0} /buildExecutePrompt\(\)/{p=1} p' \
    plugin/skills/loop-backlog/SKILL.md | grep -q "append-notes"

# A4 — Execution Summary instruction absent inside the heredoc
! awk '/^```bash$/{p=0} /buildExecutePrompt\(\)/{p=1} p' \
    plugin/skills/loop-backlog/SKILL.md | grep -q "Execution Summary"
```

After the change, the negations above become positive matches (drop the `!`).

### Implementation

File to modify: `plugin/skills/loop-backlog/SKILL.md`

Inside the `### executePrompt` section, expand the `buildExecutePrompt()` heredoc
(`cat <<PROMPT_EOF … PROMPT_EOF`) to add a mandatory **Execution Protocol** block
between `## Completing the task` and the `allowed-tools` line.

The injected block (all text is literal — no bash variable references that would
break heredoc interpolation; `${TID}` is the only variable used and it is already
interpolated by the surrounding bash function):

```
## Execution Protocol

You MUST follow every step below during execution. These are not optional.

### 1. Phase checkpoints
After completing each ## Phase section from the Description, immediately call:

  backlog task edit ${TID} --append-notes "Phase <N> ✓ $(date -u +%Y-%m-%dT%H:%M:%SZ)
<one-line summary of what was done or found in this phase>"

Replace <N> with the phase number from the Description heading.
If a phase produced notable output (test results, validation lines), include
up to 20 lines of that output in the note.

### 2. DoD verification notes
For each DoD command, after running it, append a note:

  backlog task edit ${TID} --append-notes "DoD #<N> ✓ PASS: <command>"

If the command fails, append:

  backlog task edit ${TID} --append-notes "DoD #<N> ✗ FAIL attempt <A>: <command>
Error: <first 5 lines of output>"

If stuck after 3 attempts, append:

  backlog task edit ${TID} --append-notes "DoD #<N> ✗ STUCK after 3 attempts: <command>
Last error: <first 5 lines of output>"

### 3. Execution Summary (REQUIRED before writing signal file)
Immediately before writing the signal file, append:

  backlog task edit ${TID} --append-notes "## Execution Summary
Result: <Done|Needs Human>
Commit: <hash or 'no file changes'>
Log:
<ordered list of all Phase and DoD notes recorded above>"

Only after this note is written, write the signal file.
```

The block is inserted so the final heredoc structure is:

```
## Task
…
## Description
…
## Constraints
…
## Completing the task
…
## Execution Protocol          ← NEW BLOCK
…
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
```

No bash variable references other than `${TID}` (already used in the heredoc)
are introduced.

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "## Execution Protocol" plugin/skills/loop-backlog/SKILL.md`
- [ ] `awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' plugin/skills/loop-backlog/SKILL.md | grep -q "Phase.*✓"`
- [ ] `awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' plugin/skills/loop-backlog/SKILL.md | grep -q "append-notes"`
- [ ] `awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' plugin/skills/loop-backlog/SKILL.md | grep -q "Execution Summary"`

## Phase B: 更新 Spec 中 executePrompt / execute 的形式规格

### Tests (write first)

These checks FAIL before the change and PASS after:

```bash
# B1 — Spec execute pseudocode does not yet mention appendCheckpoint
! awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md \
    | grep -q "appendCheckpoint"

# B2 — Spec execute pseudocode does not mention appendDodNote
! awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md \
    | grep -q "appendDodNote"

# B3 — Spec execute pseudocode does not mention appendSummary
! awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md \
    | grep -q "appendSummary"
```

After the change, the negations above become positive matches (drop the `!`).

### Implementation

File to modify: `plugin/skills/loop-backlog/SKILL.md` — the `## Spec` section.

Update the `execute` pseudocode block (lines ~153–160) to reflect the
checkpoint-appending behavior now mandated by the prompt. Replace:

```
execute :: Task → Outcome
execute(T) = {
  ctx:    readHumanReply(T),
  _:      followDescription(T.description, ctx),
  _:      ∀(n, cmd) ∈ enumerate(T.dodCommands): verifyDod(T, n, cmd),
  hash:   conditionalCommit(T),
  return: merge(T, hash)
} | cannotProceed(reason) → escalate(T, reason)
```

With:

```
execute :: Task → Outcome
execute(T) = {
  ctx:    readHumanReply(T),
  _:      ∀phase ∈ phases(T.description): {
            followPhase(phase, ctx),
            appendCheckpoint(T, phase.n)     -- backlog task edit --append-notes "Phase N ✓ …"
          },
  _:      ∀(n, cmd) ∈ enumerate(T.dodCommands): {
            verifyDod(T, n, cmd),
            appendDodNote(T, n, cmd)         -- backlog task edit --append-notes "DoD #N …"
          },
  hash:   conditionalCommit(T),
  _:      appendSummary(T, hash),            -- backlog task edit --append-notes "## Execution Summary …"
  return: merge(T, hash)
} | cannotProceed(reason) → escalate(T, reason)
```

Also add three helper signatures immediately after the `execute` block:

```
appendCheckpoint :: (Task, PhaseN) → ()
appendCheckpoint(T, n) =
  appendNote(T, "Phase " + n + " ✓ " + now() + "\n" + summary(phase(n)))

appendDodNote :: (Task, Int, ShellCmd) → ()
appendDodNote(T, n, cmd) =
  | lastResult(n) == Pass → appendNote(T, "DoD #" + n + " ✓ PASS: " + cmd)
  | lastResult(n) == Fail → appendNote(T, "DoD #" + n + " ✗ FAIL: " + cmd + "\n" + excerpt(5))
  | lastResult(n) == Stuck → appendNote(T, "DoD #" + n + " ✗ STUCK: " + cmd + "\n" + excerpt(5))

appendSummary :: (Task, Maybe CommitHash) → ()
appendSummary(T, hash) =
  appendNote(T, "## Execution Summary\nResult: Done\nCommit: " + showHash(hash)
               + "\nLog:\n" + executionLog(T))
```

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md | grep -q "appendCheckpoint"`
- [ ] `awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md | grep -q "appendDodNote"`
- [ ] `awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md | grep -q "appendSummary"`

## Constraints

- Only `plugin/skills/loop-backlog/SKILL.md` is modified
- No changes to `scripts/validate-plugin.sh` or any other file
- The injected Execution Protocol text must be self-contained inside the heredoc — no
  new bash variable references beyond `${TID}` which is already interpolated
- The Spec pseudocode additions must use the same notation style (Haskell-like) as the
  existing Spec section
- Phase A must be completed and validated before Phase B begins

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "## Execution Protocol" plugin/skills/loop-backlog/SKILL.md`
- [ ] `awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' plugin/skills/loop-backlog/SKILL.md | grep -q "Phase.*✓"`
- [ ] `awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' plugin/skills/loop-backlog/SKILL.md | grep -q "append-notes"`
- [ ] `awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' plugin/skills/loop-backlog/SKILL.md | grep -q "Execution Summary"`
- [ ] `awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md | grep -q "appendCheckpoint"`
- [ ] `awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md | grep -q "appendDodNote"`
- [ ] `awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md | grep -q "appendSummary"`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Starting plan draft.

Plan review iteration 2: APPROVED

claimed: 2026-06-18T06:47:55Z

Phase A ✓ 2026-06-18T06:49:37Z — injected Execution Protocol block into buildExecutePrompt heredoc

Phase B ✓ 2026-06-18T06:49:41Z — updated Spec pseudocode with appendCheckpoint/appendDodNote/appendSummary

## Execution Summary
Result: Done
Phases: A ✓, B ✓
All acceptance gate checks passed

workerLoop DoD verified: all 17 commands passed
Completed: 2026-06-18T06:50:40Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q "## Execution Protocol" plugin/skills/loop-backlog/SKILL.md
- [ ] #3 awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' plugin/skills/loop-backlog/SKILL.md | grep -q "Phase.*✓"
- [ ] #4 awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' plugin/skills/loop-backlog/SKILL.md | grep -q "append-notes"
- [ ] #5 awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' plugin/skills/loop-backlog/SKILL.md | grep -q "Execution Summary"
- [ ] #6 bash scripts/validate-plugin.sh
- [ ] #7 awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md | grep -q "appendCheckpoint"
- [ ] #8 awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md | grep -q "appendDodNote"
- [ ] #9 awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md | grep -q "appendSummary"
- [ ] #10 bash scripts/validate-plugin.sh
- [ ] #11 grep -q "## Execution Protocol" plugin/skills/loop-backlog/SKILL.md
- [ ] #12 awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' plugin/skills/loop-backlog/SKILL.md | grep -q "Phase.*✓"
- [ ] #13 awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' plugin/skills/loop-backlog/SKILL.md | grep -q "append-notes"
- [ ] #14 awk '/buildExecutePrompt\(\)/{p=1} /^PROMPT_EOF/{p=0} p' plugin/skills/loop-backlog/SKILL.md | grep -q "Execution Summary"
- [ ] #15 awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md | grep -q "appendCheckpoint"
- [ ] #16 awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md | grep -q "appendDodNote"
- [ ] #17 awk '/^## Spec$/,/^## Implementation$/' plugin/skills/loop-backlog/SKILL.md | grep -q "appendSummary"
<!-- DOD:END -->
