---
id: TASK-147
title: >-
  Remove human gates from feature-to-backlog and epic-to-backlog; upgrade R1
  guard to enforce plan depth
status: 'Basic: Done'
assignee: []
created_date: '2026-06-22 06:48'
updated_date: '2026-06-22 07:06'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove human gates from feature-to-backlog and epic-to-backlog; upgrade R1 guard to enforce plan depth
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Remove human gates from feature-to-backlog and epic-to-backlog; upgrade R1 guard to enforce plan depth

## Background

The feature-to-backlog and epic-to-backlog skills currently pause execution and write marker files after proposal APPROVED and again after plan APPROVED, requiring a human to manually advance the task status before the skill continues. This design was originally intended for interactive use where a human reviews each stage. However, when the loop-backlog decomposer agent calls these skills autonomously to create child tasks for an epic, the STOP causes a deadlock: no human is present to advance the status, so the pipeline never reaches Basic: Backlog. This directly caused TASK-143, TASK-144, TASK-145, and TASK-146 to be created with shallow descriptions, bypassing proper TDD planning. The task-to-backlog skill has no such gates and correctly runs end-to-end in autonomous contexts. Meanwhile, the R1 guard (verify-subtask-dod.sh hasDod function) only checks for a `## Definition of Done` section with at least one checkbox — allowing tasks with no Phase structure or test specifications to pass undetected.

## Goals

1. feature-to-backlog runs end-to-end from proposal draft to Basic: Backlog without any STOP or marker file, making it safe to call autonomously from the decomposer agent.
2. epic-to-backlog runs end-to-end from epic proposal draft to Epic: Backlog without any STOP or marker file, making it safe to call autonomously from the decomposer agent.
3. The human gate that matters — Basic: Backlog → Basic: Ready (and Epic: Backlog → Epic: Ready) — remains intact and is not modified; only the intra-skill intermediate gates are removed.
4. verify-subtask-dod.sh hasDod() is upgraded to additionally require ≥1 `## Phase` section, each Phase contains a `### Tests` subsection, and `## Acceptance Gate` exists — preventing shallow tasks without TDD structure from passing the R1 guard.

## Proposed Approach

In feature-to-backlog/SKILL.md, remove the `touch backlog/.ftb-awaiting-plan-<TASK_ID>` instruction and the accompanying STOP directive from Phase 1b (after proposal approval), and remove the `touch backlog/.ftb-awaiting-backlog-<TASK_ID>` instruction and STOP from Phase 4 (after plan approval). After each approval, the skill flows directly to the next phase. Apply the same change symmetrically to epic-to-backlog/SKILL.md for the `.etb-awaiting-plan-<TASK_ID>` and `.etb-awaiting-backlog-<TASK_ID>` markers. The existing `startPlanDraft` / `startFinalise` event handlers in loop-backlog that previously listened for these markers can remain as dead code — they are harmless with no active callers. In scripts/verify-subtask-dod.sh, upgrade the `hasDod()` awk function to also check for at least one `## Phase` heading, a `### Tests` sub-heading within each Phase, and a `## Acceptance Gate` heading; exit 1 if any of these are absent.

## Trade-offs and Risks

What we are NOT doing: not changing task-to-backlog (already gate-free), not removing the human-controlled Basic: Backlog → Basic: Ready promotion (the loop-backlog daemon still requires this before executing any worker), not changing loop-backlog daemon routing logic, and not removing the dead-code marker-file handlers in loop-backlog. Risk: the upgraded R1 guard's Phase/Tests requirement only makes sense for code-change tasks produced by feature-to-backlog; doc-only tasks from task-to-backlog do not have Phase structure. Mitigation: verify-subtask-dod.sh is called with a META_ID and only checks child sub-tasks of an epic — these are always code-change tasks with Phase structure. Risk: removing intermediate gates reduces per-stage visibility for interactive human users calling these skills directly; mitigated because the final Basic: Backlog status still requires a human to promote to Basic: Ready before any execution begins.

---

# Plan: Remove human gates from feature-to-backlog and epic-to-backlog; upgrade R1 guard to enforce plan depth

Proposal: docs/proposals/proposal-remove-human-gates-upgrade-r1-guard.md

## Phase A: Remove human gates from feature-to-backlog
### Tests (write first)
Before editing, confirm the gates exist:
```
grep -c "ftb-awaiting-plan\|ftb-awaiting-backlog" plugin/skills/feature-to-backlog/SKILL.md
# expect ≥ 3 (lines 268, 397, 413)
grep -c "do NOT auto-advance status\|STOP — do NOT" plugin/skills/feature-to-backlog/SKILL.md
# expect ≥ 2 (lines 271, 400)
```
After editing, confirm removal:
```
! grep -q "ftb-awaiting-plan" plugin/skills/feature-to-backlog/SKILL.md
! grep -q "ftb-awaiting-backlog" plugin/skills/feature-to-backlog/SKILL.md
! grep -q "do NOT auto-advance status" plugin/skills/feature-to-backlog/SKILL.md
```
### Implementation
Edit `plugin/skills/feature-to-backlog/SKILL.md`:

**In Phase 1b** (around line 265–271): Remove the three lines:
```
>    # Write marker file — daemon will fire proposal-approved event when human advances status
>    touch backlog/.ftb-awaiting-plan-<TASK_ID>
>    ```
>    Print: "Proposal APPROVED. Run: `backlog task edit <TASK_ID> --status 'Basic: Plan'` to start plan drafting."
>    Then STOP — do NOT auto-advance status or proceed to Phase 3.
```
Replace with (the print line already conveys intent; just remove the stop):
```
>    ```
>    Print: "Proposal APPROVED. Proceeding to plan draft."
```
Then immediately continue to Phase 3 (draftPlan) without stopping.

**In Phase 4 reviewLoop** (around line 395–413): Remove the four lines:
```
>    # Write marker file — daemon will fire plan-approved event when human advances status
>    touch backlog/.ftb-awaiting-backlog-<TASK_ID>
>    ```
>    Print: "Plan APPROVED. Run: `backlog task edit <TASK_ID> --status 'Basic: Ready'` to finalise."
>    Then STOP — do NOT auto-advance status or proceed to Phase 5.
```
And the trailing note on line 413:
```
On APPROVED, the background agent writes `backlog/.ftb-awaiting-backlog-<TASK_ID>` and stops.
```
Replace the stop instruction with a direct call to Phase 5 (finalise) without stopping.

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q "ftb-awaiting-plan" plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q "ftb-awaiting-backlog" plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q "do NOT auto-advance status" plugin/skills/feature-to-backlog/SKILL.md`

## Phase B: Remove human gates from epic-to-backlog
### Tests (write first)
Before editing, confirm the gates exist:
```
grep -c "etb-awaiting-plan\|etb-awaiting-backlog" plugin/skills/epic-to-backlog/SKILL.md
# expect ≥ 3 (lines 307, 438, 454)
grep -c "STOP — do NOT auto-advance status" plugin/skills/epic-to-backlog/SKILL.md
# expect ≥ 2 (lines 310, 441)
```
After editing, confirm removal:
```
! grep -q "etb-awaiting-plan" plugin/skills/epic-to-backlog/SKILL.md
! grep -q "etb-awaiting-backlog" plugin/skills/epic-to-backlog/SKILL.md
! grep -q "do NOT auto-advance status" plugin/skills/epic-to-backlog/SKILL.md
```
### Implementation
Edit `plugin/skills/epic-to-backlog/SKILL.md`:

**In Phase 1b** (around line 305–310): Remove the three lines:
```
>    # Write marker file — daemon will fire proposal-approved event when human advances status
>    touch backlog/.etb-awaiting-plan-<TASK_ID>
>    ```
>    Print: "Proposal APPROVED. Run: `backlog task edit <TASK_ID> --status 'Epic: Plan'` to start plan drafting."
>    Then STOP — do NOT auto-advance status.
```
Replace with:
```
>    ```
>    Print: "Proposal APPROVED. Proceeding to epic plan draft."
```
Then continue directly to Phase 3 (draftEpicPlan).

**In Phase 4 planLoop** (around line 436–454): Remove the four lines:
```
>    # Write marker file — daemon will fire plan-approved event when human advances status
>    touch backlog/.etb-awaiting-backlog-<TASK_ID>
>    ```
>    Print: "Plan APPROVED. Run: `backlog task edit <TASK_ID> --status 'Epic: Backlog'` to finalise."
>    Then STOP — do NOT auto-advance status.
```
And the trailing note on line 454:
```
On APPROVED, the background agent writes `backlog/.etb-awaiting-backlog-<TASK_ID>` and stops.
```
Replace the stop instruction with a direct call to Phase 5 (finalise).

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q "etb-awaiting-plan" plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `! grep -q "etb-awaiting-backlog" plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `! grep -q "do NOT auto-advance status" plugin/skills/epic-to-backlog/SKILL.md`

## Phase C: Upgrade verify-subtask-dod.sh R1 guard
### Tests (write first)
Create two fixture files to test before and after the upgrade:

Flat task fixture (no Phase, should FAIL after upgrade):
```bash
cat > /tmp/flat-task.md << 'EOF'
---
id: TASK-FLAT
parent_task_id: META-1
---
## Description
Does something.

## Definition of Done
- [ ] `bash scripts/validate-plugin.sh`
EOF
```

Phased task fixture (has Phase + Tests + Acceptance Gate, should PASS):
```bash
cat > /tmp/phased-task.md << 'EOF'
---
id: TASK-PHASED
parent_task_id: META-1
---
## Definition of Done
- [ ] `bash scripts/validate-plugin.sh`

## Phase A: Do the work
### Tests (write first)
Add test for X.
### Implementation
Implement X.
### DoD
- [ ] `bash scripts/validate-plugin.sh`

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
EOF
```

Before upgrade:
```
# flat task passes (should fail after upgrade):
scripts/verify-subtask-dod.sh META-1 --tasks-dir /tmp   # currently exits 0
```
After upgrade:
```
# flat task now fails:
scripts/verify-subtask-dod.sh META-1 --tasks-dir /tmp && echo FAIL || echo PASS
# phased task passes: need separate META with only phased-task as child
```

### Implementation
Edit `scripts/verify-subtask-dod.sh`, replace the `hasDod()` function (lines 35–42):

Current:
```bash
hasDod() {
  awk '
    /^## Definition of Done/ { indod=1; next }
    indod && /^## /          { indod=0 }
    indod && /^- \[[ xX]\]/   { found=1 }
    END { exit (found ? 0 : 1) }
  ' "$1"
}
```

Replace with:
```bash
hasDod() {
  awk '
    /^## Definition of Done/ { indod=1; next }
    indod && /^## /          { indod=0 }
    indod && /^- \[[ xX]\]/  { found_dod=1 }
    /^## Phase /             { phase_count++ }
    /^## Acceptance Gate/    { found_gate=1 }
    /^### Tests/             { found_tests=1 }
    END {
      if (!found_dod)   exit 1
      if (!phase_count) exit 1
      if (!found_tests) exit 1
      if (!found_gate)  exit 1
      exit 0
    }
  ' "$1"
}
```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash -c 'mkdir -p /tmp/vsd-test && printf -- "---\nid: TASK-FLAT\nparent_task_id: META-VSD\n---\n## Definition of Done\n- [ ] \`bash scripts/validate-plugin.sh\`\n" > /tmp/vsd-test/TASK-FLAT.md && ! bash scripts/verify-subtask-dod.sh META-VSD --tasks-dir /tmp/vsd-test'`
- [ ] `bash -c 'mkdir -p /tmp/vsd-pass && printf -- "---\nid: TASK-GOOD\nparent_task_id: META-VSD2\n---\n## Definition of Done\n- [ ] \`bash scripts/validate-plugin.sh\`\n## Phase A: Work\n### Tests (write first)\nTest X.\n### Implementation\nImpl.\n### DoD\n- [ ] \`bash scripts/validate-plugin.sh\`\n## Acceptance Gate\n- [ ] \`bash scripts/validate-plugin.sh\`\n" > /tmp/vsd-pass/TASK-GOOD.md && bash scripts/verify-subtask-dod.sh META-VSD2 --tasks-dir /tmp/vsd-pass'`

## Constraints
- Do not remove startPlanDraft / startFinalise handlers from loop-backlog (dead code, harmless)
- Do not change task-to-backlog (it already has no human gates)
- Phase A and Phase B are independent and can be done in any order
- Phase C is independent of A and B; can be done in parallel
- The R1 guard upgrade (Phase C) applies only to tasks with a parent_task_id; doc-only tasks from task-to-backlog that are standalone (no parent_task_id) are not checked by this guard
- Do not modify the loop-backlog daemon routing or worker logic

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q "do NOT auto-advance status" plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q "do NOT auto-advance status" plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `! grep -q "ftb-awaiting-plan" plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q "etb-awaiting-plan" plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `bash -c 'mkdir -p /tmp/vsd-final && printf -- "---\nid: TASK-FLAT2\nparent_task_id: META-VSD3\n---\n## Definition of Done\n- [ ] \`bash scripts/validate-plugin.sh\`\n" > /tmp/vsd-final/TASK-FLAT2.md && ! bash scripts/verify-subtask-dod.sh META-VSD3 --tasks-dir /tmp/vsd-final'`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal approved. Starting plan draft.

Plan review iteration 1: APPROVED

claimed: 2026-06-22T06:59:14Z

Completed: 2026-06-22T07:06:32Z
<!-- SECTION:NOTES:END -->

- [ ] #14 bash scripts/validate-plugin.sh
- [ ] #15 ! grep -q "ftb-awaiting-plan" plugin/skills/feature-to-backlog/SKILL.md
- [ ] #16 ! grep -q "ftb-awaiting-backlog" plugin/skills/feature-to-backlog/SKILL.md
- [ ] #17 ! grep -q "do NOT auto-advance status" plugin/skills/feature-to-backlog/SKILL.md
- [ ] #18 bash scripts/validate-plugin.sh
- [ ] #19 ! grep -q "etb-awaiting-plan" plugin/skills/epic-to-backlog/SKILL.md
- [ ] #20 ! grep -q "etb-awaiting-backlog" plugin/skills/epic-to-backlog/SKILL.md
- [ ] #21 ! grep -q "do NOT auto-advance status" plugin/skills/epic-to-backlog/SKILL.md
- [ ] #22 bash scripts/validate-plugin.sh
- [ ] #23 bash scripts/validate-plugin.sh
- [ ] #24 bash scripts/validate-plugin.sh
- [ ] #25 bash scripts/validate-plugin.sh
- [ ] #26 bash scripts/validate-plugin.sh
- [ ] #27 bash -c 'mkdir -p /tmp/vsd-test && printf -- "---\nid: TASK-FLAT\nparent_task_id: META-VSD\n---\n## Definition of Done\n- [ ] \
- [ ] #28 bash -c 'mkdir -p /tmp/vsd-pass && printf -- "---\nid: TASK-GOOD\nparent_task_id: META-VSD2\n---\n## Definition of Done\n- [ ] \
- [ ] #29 bash scripts/validate-plugin.sh
- [ ] #30 ! grep -q "do NOT auto-advance status" plugin/skills/feature-to-backlog/SKILL.md
- [ ] #31 ! grep -q "do NOT auto-advance status" plugin/skills/epic-to-backlog/SKILL.md
- [ ] #32 ! grep -q "ftb-awaiting-plan" plugin/skills/feature-to-backlog/SKILL.md
- [ ] #33 ! grep -q "etb-awaiting-plan" plugin/skills/epic-to-backlog/SKILL.md
- [ ] #34 bash -c 'mkdir -p /tmp/vsd-final && printf -- "---\nid: TASK-FLAT2\nparent_task_id: META-VSD3\n---\n## Definition of Done\n- [ ] \
<!-- DOD:END -->
