---
id: TASK-149
title: >-
  Improve loop-backlog execution Notes: per-command DoD records and
  agent-summary enforcement
status: 'Basic: Done'
assignee: []
created_date: '2026-06-22 08:01'
updated_date: '2026-06-22 08:14'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
loop-backlog 的 executePrompt 明确禁止 agent 调 backlog task edit --append-notes，导致 Phase checkpoint 和 DoD 验证记录全部丢失。同时 workerLoop 的 pre-merge DoD 段仅写一行概要，agent-summary 文件缺失时也静默跳过。需三层修复：(A) workerLoop 逐条写 DoD PASS/FAIL 记录；(B) executePrompt 放开 --append-notes（仅禁 --status/--planSet 等）；(C) agent-summary 缺失时写 WARNING note 而非静默跳过。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Improve loop-backlog execution Notes: per-command DoD records and agent-summary enforcement

## Background

`loop-backlog` tasks land at Basic: Done with nearly empty Implementation Notes, making it impossible to audit what the agent actually did, which DoD commands passed, or why a task succeeded. The root cause is a three-layer gap in the current `plugin/skills/loop-backlog/SKILL.md`:

1. **executePrompt prohibits all `--append-notes`** (line ~1023): "Do NOT run `backlog task edit` for any --append-notes" blocks the implementation agent from writing Phase checkpoints and per-command DoD records to the task.
2. **workerLoop pre-merge DoD only writes an aggregate note** (lines ~1306-1327): On success, it writes one line ("all N commands passed") instead of a per-command PASS record; failing commands get one note but prior PASS results are not preserved.
3. **Missing agent-summary file is silently skipped** (lines ~1185-1189): If the implementation agent fails to write `.agent-summary-TASK-N`, the worker logs nothing and the task reaches Basic: Done with no execution trace.

These gaps were observed concretely in TASK-146, which completed with no DoD records in Notes. Fixing all three layers provides a complete, auditable execution trail without introducing external dependencies.

## Goals

1. Every completed task's Implementation Notes contain a per-command DoD record: at least one `DoD #N: PASS — <cmd>` line for each DoD command that ran in the workerLoop pre-merge verification section.
2. The implementation agent is permitted to call `backlog task edit --append-notes` for Phase checkpoints and per-command DoD records; the prohibition is narrowed to `--status`, `--planSet`, `--dod`, `--set-field`, `--check-dod`.
3. When `.agent-summary-TASK-N` is absent after the implementation agent writes "done", the worker writes a `WARNING: agent-summary missing for TASK-N` note instead of silently skipping.
4. `bash scripts/validate-plugin.sh` exits 0 after all changes.

## Proposed Approach

Three targeted edits to `plugin/skills/loop-backlog/SKILL.md` (mirrored to `plugin/scripts/validate-plugin.sh` copy if applicable):

- **Phase A** — In the `workerLoop` pre-merge DoD section (lines ~1306-1327): change the success path from a single aggregate note to a per-command loop that appends `DoD #N: PASS — <cmd>` for every passing command.
- **Phase B** — In `executePrompt` (line ~1023): change the prohibition from "for any --append-notes, --status, or other task edits" to "for --status, --planSet, --dod, --set-field, --check-dod"; explicitly permit `--append-notes` for Phase checkpoints and DoD records.
- **Phase C** — In the post-merge agent-summary block (lines ~1185-1189): add an `else` branch that calls `backlog task edit "$TASK_ID" --append-notes "WARNING: agent-summary missing for ${TASK_ID}"`.

Each phase touches only `plugin/skills/loop-backlog/SKILL.md`. No new files, no script changes, no framework additions.

## Trade-offs and Risks

**Not doing**: Adding structured JSON logging, integrating with external observability systems, or modifying how signal files are written.

**Risk — verbosity**: Per-command DoD notes will increase Note length for tasks with many DoD items. Acceptable: Notes are append-only prose; no size constraint exists.

**Risk — agent behavior change (Phase B)**: Allowing `--append-notes` means a misbehaving agent could write excessive notes. Mitigated by the explicit prohibition still covering state-changing flags (`--status`, `--planSet`, `--dod`).

**Risk — SKILL.md copy sync**: `validate-plugin.sh` enforces that `scripts/validate-plugin.sh` and `plugin/scripts/validate-plugin.sh` are identical; this epic does NOT touch those files, so no sync risk.

---

# Plan: Improve loop-backlog execution Notes: per-command DoD records and agent-summary enforcement

Proposal: (embedded above)

## Phase A: Per-command DoD PASS records in workerLoop pre-merge verification

### Tests (write first)
- Verify before edit that aggregate note pattern exists: `grep -q "DoD verified: all.*commands passed" plugin/skills/loop-backlog/SKILL.md` → exits 0 (red baseline).
- After edit, verify per-command PASS pattern exists: `grep -q 'workerLoop DoD #' plugin/skills/loop-backlog/SKILL.md` → exits 0 (green).
- After edit, verify aggregate note is gone: `! grep -q "DoD verified: all.*commands passed" plugin/skills/loop-backlog/SKILL.md` → exits 0 (green).

### Implementation
- File: `plugin/skills/loop-backlog/SKILL.md`
- In the pre-merge DoD section (~lines 1306-1330): inside the `while IFS= read -r DOD_CMD` loop, after `DOD_N=$((DOD_N + 1))` on the success path, add:
  ```bash
  backlog task edit "$TASK_ID" --append-notes "workerLoop DoD #${DOD_N}: PASS — ${DOD_CMD}"
  ```
- Remove the post-loop aggregate note block:
  ```bash
  if [ "$PRE_MERGE_DOD_PASS" = "true" ]; then
    backlog task edit "$TASK_ID" --append-notes "workerLoop DoD verified: all ${DOD_N} commands passed"
  ```
  Replace with just the `else` branch for the fail case (no aggregate success note needed since per-command notes are now written in the loop).

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "workerLoop DoD #" plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q "DoD verified: all.*commands passed" plugin/skills/loop-backlog/SKILL.md`

## Phase B: Allow --append-notes in executePrompt; narrow prohibition to state-changing flags

### Tests (write first)
- Verify before edit that the old prohibition line exists: `grep -q "for any --append-notes" plugin/skills/loop-backlog/SKILL.md` → exits 0 (red baseline).
- After edit: `! grep -q "for any --append-notes" plugin/skills/loop-backlog/SKILL.md` → exits 0 (green).
- After edit: `grep -q "MAY run.*--append-notes" plugin/skills/loop-backlog/SKILL.md` → exits 0 (green).

### Implementation
- File: `plugin/skills/loop-backlog/SKILL.md`
- Line ~1023: Change:
  ```
  Do NOT run `backlog task edit` for any --append-notes, --status, or other task edits.
  The worker (main branch) handles all task-file writes after reading this summary file.
  ```
  To:
  ```
  Do NOT run `backlog task edit` with --status, --planSet, --dod, --set-field, or --check-dod.
  You MAY run `backlog task edit <TASK_ID> --append-notes "..."` to record Phase checkpoints and DoD results.
  The worker (main branch) handles all status transitions and field writes.
  ```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q "for any --append-notes" plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "MAY run.*--append-notes" plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "Do NOT run.*--status" plugin/skills/loop-backlog/SKILL.md`

## Phase C: Write WARNING note when agent-summary file is missing

### Tests (write first)
- Verify before edit that WARNING pattern is absent: `! grep -q "WARNING: agent-summary missing" plugin/skills/loop-backlog/SKILL.md` → exits 0 (red baseline).
- After edit: `grep -q "WARNING: agent-summary missing" plugin/skills/loop-backlog/SKILL.md` → exits 0 (green).

### Implementation
- File: `plugin/skills/loop-backlog/SKILL.md`
- Two agent-summary blocks exist (single-task path ~line 1185 and batch path ~line 1346). Both must be updated.
- Current pattern in both locations:
  ```bash
  if [ -f "$AGENT_SUMMARY_FILE" ]; then
    AGENT_SUMMARY_CONTENT=$(cat "$AGENT_SUMMARY_FILE")
    backlog task edit "$TASK_ID" --append-notes "$AGENT_SUMMARY_CONTENT"
  fi
  ```
  Add `else` branch to each:
  ```bash
  if [ -f "$AGENT_SUMMARY_FILE" ]; then
    AGENT_SUMMARY_CONTENT=$(cat "$AGENT_SUMMARY_FILE")
    backlog task edit "$TASK_ID" --append-notes "$AGENT_SUMMARY_CONTENT"
  else
    backlog task edit "$TASK_ID" --append-notes "WARNING: agent-summary missing for ${TASK_ID} — execution trace unavailable"
  fi
  ```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "WARNING: agent-summary missing" plugin/skills/loop-backlog/SKILL.md`

## Constraints
- Only `plugin/skills/loop-backlog/SKILL.md` is modified; no scripts, no other SKILL.md files
- Do not add new files; do not change the signal file protocol
- Both occurrences of the agent-summary block must be updated (Phase C)
- The implementation agent is now permitted to call `--append-notes` (Phase B unlocks this)

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "workerLoop DoD #" plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q "for any --append-notes" plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "WARNING: agent-summary missing" plugin/skills/loop-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal drafted and self-reviewed: APPROVED. Starting plan draft.

claimed: 2026-06-22T08:10:55Z

workerLoop DoD #0: PASS — #1 bash scripts/validate-plugin.sh

workerLoop DoD #1: PASS — #2 grep -q "workerLoop DoD #" plugin/skills/loop-backlog/SKILL.md

workerLoop DoD #2: PASS — #3 ! grep -q "DoD verified: all.*commands passed" plugin/skills/loop-backlog/SKILL.md

workerLoop DoD #3: PASS — #4 bash scripts/validate-plugin.sh

workerLoop DoD #4: PASS — #5 ! grep -q "for any --append-notes" plugin/skills/loop-backlog/SKILL.md

workerLoop DoD #5: PASS — #6 grep -q "MAY run.*--append-notes" plugin/skills/loop-backlog/SKILL.md

workerLoop DoD #6: PASS — #7 grep -q "Do NOT run.*--status" plugin/skills/loop-backlog/SKILL.md

workerLoop DoD #7: PASS — #8 bash scripts/validate-plugin.sh

workerLoop DoD #8: PASS — #9 grep -q "WARNING: agent-summary missing" plugin/skills/loop-backlog/SKILL.md

workerLoop DoD #9: PASS — #10 bash scripts/validate-plugin.sh

workerLoop DoD #10: PASS — #11 grep -q "workerLoop DoD #" plugin/skills/loop-backlog/SKILL.md

workerLoop DoD #11: PASS — #12 ! grep -q "for any --append-notes" plugin/skills/loop-backlog/SKILL.md

workerLoop DoD #12: PASS — #13 grep -q "WARNING: agent-summary missing" plugin/skills/loop-backlog/SKILL.md

Phase A ✓ — added per-command DoD PASS notes in pre-merge loop; removed aggregate note
Phase B ✓ — narrowed executePrompt prohibition to --status/--planSet/--dod; allowed --append-notes
Phase C ✓ — added else branch writing WARNING note when agent-summary missing (both occurrences)
DoD #0: PASS — bash scripts/validate-plugin.sh
DoD #1: PASS — grep -q "workerLoop DoD #" plugin/skills/loop-backlog/SKILL.md
DoD #2: PASS — ! grep -q "DoD verified: all.*commands passed" plugin/skills/loop-backlog/SKILL.md
DoD #3: PASS — ! grep -q "for any --append-notes" plugin/skills/loop-backlog/SKILL.md
DoD #4: PASS — grep -q "MAY run.*--append-notes" plugin/skills/loop-backlog/SKILL.md
DoD #5: PASS — grep -q "Do NOT run.*--status" plugin/skills/loop-backlog/SKILL.md
DoD #6: PASS — grep -q "WARNING: agent-summary missing" plugin/skills/loop-backlog/SKILL.md
## Execution Summary
Result: Done
Commit: b2eb46b
All 3 phases applied cleanly; 7/7 DoD checks pass; validate-plugin.sh exits 0 (Errors: 0, Warnings: 55)

Completed: 2026-06-22T08:14:53Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q "workerLoop DoD #" plugin/skills/loop-backlog/SKILL.md
- [ ] #3 ! grep -q "DoD verified: all.*commands passed" plugin/skills/loop-backlog/SKILL.md
- [ ] #4 bash scripts/validate-plugin.sh
- [ ] #5 ! grep -q "for any --append-notes" plugin/skills/loop-backlog/SKILL.md
- [ ] #6 grep -q "MAY run.*--append-notes" plugin/skills/loop-backlog/SKILL.md
- [ ] #7 grep -q "Do NOT run.*--status" plugin/skills/loop-backlog/SKILL.md
- [ ] #8 bash scripts/validate-plugin.sh
- [ ] #9 grep -q "WARNING: agent-summary missing" plugin/skills/loop-backlog/SKILL.md
- [ ] #10 bash scripts/validate-plugin.sh
- [ ] #11 grep -q "workerLoop DoD #" plugin/skills/loop-backlog/SKILL.md
- [ ] #12 ! grep -q "for any --append-notes" plugin/skills/loop-backlog/SKILL.md
- [ ] #13 grep -q "WARNING: agent-summary missing" plugin/skills/loop-backlog/SKILL.md
<!-- DOD:END -->
