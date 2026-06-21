---
id: TASK-117
title: 'Add a shell-gate DoD template to task-to-backlog: when the skill creat'
status: Meta-Plan
assignee: []
created_date: '2026-06-20 14:12'
updated_date: '2026-06-20 14:24'
labels: []
dependencies: []
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a shell-gate DoD template to task-to-backlog: when the skill creates a new task, auto-append a default '## Definition of Done' section with a placeholder shell-gate checkbox if no DoD section is found in the draft.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Meta-Proposal: Add Shell-Gate DoD Template to task-to-backlog

## Background (WHY)

### Root Cause R1 — Tasks Created Without DoD Can Be Rubber-Stamped

The TASK-93 post-mortem identified a systemic gap: tasks entering the backlog without a Definition of Done section bypass meaningful quality review. When `task-to-backlog` creates a new task via `draftPlan`, the plan draft template includes `### DoD` blocks per-phase and an `## Acceptance Gate` block. However, there is **no enforcement** that these blocks are populated with real shell commands before the task is promoted.

This gap closes at the wrong end. The `reviewLoop` (Phase 3) checks executability of DoD items that already exist, but if the drafter omits the sections entirely, the reviewer has nothing to reject. The result: tasks with zero shell-verifiable gates can reach Backlog status and be rubber-stamped as Done.

**This change closes the gap at creation time**, by guaranteeing that every task produced by `task-to-backlog` contains at minimum one shell-gate placeholder in its DoD section before it enters the review loop.

### Where the Gap Lives in SKILL.md

- **Phase 2 (draftPlan)**: The Task agent prompt instructs the drafter to include `### DoD` sections, but provides no enforcement fallback if they are absent.
- **Phase 4 (finalise)**: `grep -oP '(?<=- \[ \] \`)[^\`]+(?=\`)' $TMPDIR/ttb-plan.md` silently emits zero lines if no DoD items exist, producing a task with an empty DoD list.
- **contracts**: Three `grep:` contracts exist (`reviewLoop`, `non-development`, `Backlog`) but none assert that a DoD injection mechanism is present.

## Goals

### Observable Outcome

Every task produced by `task-to-backlog` — whether via the new-topic path or the existing-task-ID path — contains at least one shell-verifiable DoD command before it reaches Backlog status.

### Specific Measurables

1. Running `task-to-backlog` on a topic whose draft has no `### DoD` section results in a task whose Implementation Plan contains a `## Definition of Done` section with at least one `- [ ] \`<shell cmd>\`` placeholder.
2. Running `task-to-backlog` on a topic whose draft already has `### DoD` blocks leaves those blocks unchanged (idempotent injection).
3. `bash scripts/validate-plugin.sh` passes with the updated SKILL.md and the new contract assertion.

## Decomposition (2 Subjects)

### Subject A — SKILL.md Update: DoD Injection in Finalise Phase

Modify `Phase 4: finalise` in `.claude/skills/task-to-backlog/SKILL.md` to detect whether `$TMPDIR/ttb-plan.md` contains any `- [ ]` shell-gate items. If zero items are found, inject a default `## Definition of Done` section with a placeholder command before extracting DoD args. This is a pure text-manipulation step that requires no new tools.

### Subject B — Contract Assertion + Regression Test Fixture

Add a `grep: "dod-template"` (or equivalent sentinel token) contract to the SKILL.md frontmatter `contracts:` block, keyed on the injection guard text added in Subject A. Add a regression fixture test — a minimal fake plan file with no DoD section — and a shell assertion that the injection logic produces a non-empty DoD list from it.

## Trade-offs

| Option | Pro | Con |
|---|---|---|
| Inject in Phase 4 finalise (chosen) | Single injection point; happens after review so reviewer can still flag missing DoD | Reviewer sees un-injected draft; may APPROVE before placeholder is added |
| Inject in Phase 2 draftPlan prompt | Reviewer sees complete draft with placeholder | Prompt-level enforcement is weaker; agent may still omit |
| Inject in Phase 3 reviewLoop | Reviewer can react to placeholder | Adds complexity to review loop; violates separation of concerns |

**Decision**: Inject in Phase 4 (finalise), with a clear log message when injection occurs, so the audit trail is visible. The reviewer approves the phase structure; the finalise step guarantees the minimum gate exists.

---

# Meta-Plan: Add Shell-Gate DoD Template to task-to-backlog

## Subject A: Inject Default DoD Section in Phase 4 finalise

**File**: `.claude/skills/task-to-backlog/SKILL.md`
**Phase**: `Phase 4: finalise` — Step B (Write plan into task and add DoD)

### What to Change

In the finalise agent prompt inside `### Phase 4: finalise`, before the `grep -oP` extraction step, add a guard block that:

1. Counts shell-gate items in `$TMPDIR/ttb-plan.md` using `grep -c '- \[ \] \`'`.
2. If count is zero, appends a default DoD section to `$TMPDIR/ttb-plan.md`:
   ```
   ## Definition of Done
   - [ ] `echo "TODO: replace this placeholder with a real shell gate"`
   ```
3. Logs a warning: `echo "[dod-template] No shell gates found — injecting placeholder DoD section."`.

The sentinel comment `# dod-template injection guard` must appear in the added block so the contract in Subject B can grep for it.

The extraction step (`grep -oP ...`) runs unchanged after the guard, now guaranteed to produce at least one item.

### Acceptance Criteria

1. `grep -q 'dod-template' .claude/skills/task-to-backlog/SKILL.md` exits 0 after the edit.
2. A test invocation against a fixture plan file with no `- [ ]` items produces a non-empty `ttb-dod-cmds.txt` (at least one line).

---

## Subject B: Add Contract + Regression Test Fixture

**File A**: `.claude/skills/task-to-backlog/SKILL.md` — frontmatter `contracts:` block
**File B**: `scripts/fixtures/ttb-no-dod-plan.md` (new fixture)
**File C**: `scripts/test-ttb-dod-injection.sh` (new regression test script)

### What to Change in SKILL.md frontmatter

Add one entry to the existing `contracts:` list:

```yaml
  - grep: "dod-template"
    target: self
```

This causes `scripts/validate-plugin.sh` Layer 1 contract checks to assert that the `dod-template` guard text is present in the skill file itself.

### Regression Fixture (scripts/fixtures/ttb-no-dod-plan.md)

A minimal plan file that intentionally has no `- [ ]` shell-gate lines:

```markdown
# Plan: smoke-test fixture

## Context
Fixture used by regression test — no DoD section present.

## Phase 1: Do something
Run some analysis.

## Constraints
No executable DoD items in this file.

## Acceptance Gate
Nothing here either.
```

### Regression Test (scripts/test-ttb-dod-injection.sh)

```bash
#!/usr/bin/env bash
# Regression test: dod-template injection guard in task-to-backlog
set -euo pipefail

TMPDIR=$(mktemp -d)
cp scripts/fixtures/ttb-no-dod-plan.md "$TMPDIR/ttb-plan.md"

# Simulate the injection guard logic from SKILL.md Phase 4
gate_count=$(grep -c '- \[ \] `' "$TMPDIR/ttb-plan.md" 2>/dev/null || true)
if [ "${gate_count:-0}" -eq 0 ]; then
  # dod-template injection guard
  printf '\n## Definition of Done\n- [ ] `echo "TODO: replace this placeholder with a real shell gate"`\n' \
    >> "$TMPDIR/ttb-plan.md"
fi

# Extract DoD cmds
grep -oP '(?<=- \[ \] `)[^`]+(?=`)' "$TMPDIR/ttb-plan.md" > "$TMPDIR/ttb-dod-cmds.txt"

line_count=$(wc -l < "$TMPDIR/ttb-dod-cmds.txt")
if [ "$line_count" -lt 1 ]; then
  echo "FAIL: dod-template injection did not produce any DoD items" >&2
  exit 1
fi
echo "PASS: dod-template injection produced $line_count DoD item(s)"
rm -rf "$TMPDIR"
```

### Acceptance Criteria

1. `grep -q 'dod-template' .claude/skills/task-to-backlog/SKILL.md` exits 0 (contract token present in both frontmatter and body).
2. `bash scripts/test-ttb-dod-injection.sh` exits 0 and prints `PASS`.
3. `bash scripts/validate-plugin.sh` exits 0 with all contracts satisfied.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Drafting implementation plan.

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->
