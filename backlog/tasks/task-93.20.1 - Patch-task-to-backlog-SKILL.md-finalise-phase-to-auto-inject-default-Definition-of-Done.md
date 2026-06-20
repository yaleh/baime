---
id: TASK-93.20.1
title: >-
  Patch task-to-backlog SKILL.md finalise phase to auto-inject default
  Definition of Done
status: Backlog
assignee: []
created_date: '2026-06-20 10:52'
updated_date: '2026-06-20 10:54'
labels: []
dependencies: []
parent_task_id: TASK-93.20
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Patch task-to-backlog skill finalise phase to auto-inject default Definition of Done section.

**What:** Modify plugin/skills/task-to-backlog/SKILL.md so that during the finalise phase, if the drafted task document does not already contain a "## Definition of Done" section, the skill automatically appends one with a single placeholder shell-gate checkbox: `- [ ] bash scripts/validate-plugin.sh exits 0`.

**Why:** TASK-93 post-mortem identified root-cause R1: tasks created without a DoD can be rubber-stamped Done without any real validation. This patch closes that gap by ensuring every task produced by task-to-backlog carries a minimum DoD.

**How it fits the parent goal (TASK-93.20):** TASK-93.20 requires (a) patching the finalise phase and (b) adding a regression contract. This sub-task covers the skill patch.

**Done looks like:**
- plugin/skills/task-to-backlog/SKILL.md finalise phase contains explicit logic: "if no ## Definition of Done section exists in the draft, append the default DoD block"
- A hand-traced dry run through the updated SKILL.md prose confirms the auto-inject step fires for a task without DoD and is skipped for one that already has a DoD section
- bash scripts/validate-plugin.sh exits 0
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Patch task-to-backlog SKILL.md finalise phase to auto-inject default Definition of Done

## Context
TASK-93 post-mortem identified root-cause R1: tasks created without a DoD section can be
rubber-stamped Done without real validation. The fix is to modify the task-to-backlog skill's
Phase 4 (finalise) agent prompt so it checks for the presence of a "## Definition of Done"
section in the task draft and appends a default placeholder if absent.

## Phase 1: Read and understand the current finalise phase
Read plugin/skills/task-to-backlog/SKILL.md, specifically the "### Phase 4: finalise" section.
Identify exactly where the Step B block ends and Step D begins. Record the precise surrounding
markdown (blockquote prefix, bold header style, code fence markers) needed to insert Step C
without breaking the agent prompt format.

### DoD
- [ ] `grep -n 'Step B\|Step D' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`

## Phase 2: Insert auto-inject DoD step into the finalise agent prompt
Edit plugin/skills/task-to-backlog/SKILL.md: inside the Phase 4 finalise agent prompt, add a
new "Step C — Auto-inject default DoD if absent" block between Step B and Step D. The block
should instruct the finalise agent to check whether the task already has a populated Definition
of Done and, if not, add the default placeholder `bash scripts/validate-plugin.sh`:

The inserted Step C agent-prompt block:

> **Step C — Auto-inject default DoD if absent**:
> Check whether the task already has a populated Definition of Done section. If not, add the
> default placeholder:
> ```bash
> EXISTING_DOD=$(backlog task view <TASK_ID> --plain \
>   | awk '/## Definition of Done/{found=1;next} found && /^## /{exit} found{print}' \
>   | grep -c '\- \[' || echo 0)
> if [ "$EXISTING_DOD" -eq 0 ]; then
>   backlog task edit <TASK_ID> --dod "bash scripts/validate-plugin.sh"
>   echo "Auto-injected default DoD for <TASK_ID>"
> fi
> ```

Preserve all surrounding markdown (the `>` blockquote prefix, bold headers, code fences).

### DoD
- [ ] `grep -q 'Step C' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q 'Auto-inject default DoD' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q 'EXISTING_DOD' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`

## Phase 3: Dry-run trace to verify logic
Trace through the updated SKILL.md prose for two scenarios without executing against a live task:
(a) A task draft with no "## Definition of Done" section: EXISTING_DOD=0, Step C fires and adds the default DoD.
(b) A task draft that already has "## Definition of Done" with at least one checkbox: EXISTING_DOD>=1, Step C skips injection.
Append the trace result as a note to task TASK-93.20.1 via `backlog task edit TASK-93.20.1 --append-notes "..."`.

### DoD
- [ ] `backlog task view TASK-93.20.1 --plain | grep -q 'Dry-run trace'`

## Phase 4: Validate plugin integrity
Run the full plugin validation suite to confirm the SKILL.md change does not break any existing contracts.

### DoD
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`

## Constraints
- Only modify plugin/skills/task-to-backlog/SKILL.md — do not change any other skill or script
- Do not alter the Step B (DOD_ARGS extraction) logic; Step C is additive and inserted between B and D
- The injected DoD item must be the literal string "bash scripts/validate-plugin.sh"
- No branch creation, no worktree operations, no git push

## Acceptance Gate
- [ ] `grep -q 'Step C' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q 'Auto-inject default DoD' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.20

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'Step C' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md
- [ ] #2 grep -q 'Auto-inject default DoD' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md
- [ ] #3 grep -q 'EXISTING_DOD' /home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md
- [ ] #4 backlog task view TASK-93.20.1 --plain | grep -q 'Dry-run trace'
- [ ] #5 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->
