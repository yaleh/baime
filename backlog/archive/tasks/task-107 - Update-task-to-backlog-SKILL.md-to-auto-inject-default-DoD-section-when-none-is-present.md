---
id: TASK-107
title: >-
  Update task-to-backlog SKILL.md to auto-inject default DoD section when none
  is present
status: Backlog
assignee: []
created_date: '2026-06-20 10:38'
updated_date: '2026-06-20 10:39'
labels: []
dependencies: []
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modify plugin/task-to-backlog/SKILL.md to add logic that checks whether the drafted task markdown contains a '## Definition of Done' section. If no DoD section is found, the skill must append a default one with a placeholder shell-gate checkbox: '- [ ] bash scripts/validate-plugin.sh exits 0'. This is the implementation half of TASK-106 (Add a shell-gate DoD template to task-to-backlog). Without a guaranteed DoD section, the loop-backlog worker cannot reliably close tasks.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Update task-to-backlog SKILL.md to auto-inject default DoD section when none is present

## Context
The task-to-backlog skill does not guarantee that created tasks have a Definition of Done section. Loop-backlog requires at least one shell-gate DoD checkbox to close a task. Root cause R1 in loop-meta SKILL.md identifies missing DoD sections as a loop-breaking defect. This plan patches the skill to auto-append a default DoD section when none is found in the draft.

## Phase 1: Locate and Read the Skill File
Read `plugin/task-to-backlog/SKILL.md` to identify the draft-creation and finalise phases — specifically the point where the plan markdown is assembled and written to the backlog task.

### DoD
- [ ] `test -f plugin/task-to-backlog/SKILL.md`
- [ ] `grep -q 'Phase 4: finalise' plugin/task-to-backlog/SKILL.md`

## Phase 2: Add DoD-injection Logic to finalise Phase
Edit `plugin/task-to-backlog/SKILL.md` in the Phase 4 (finalise) instructions to add an explicit check:

1. After the plan is written to `$TMPDIR/ttb-plan.md`, check whether the plan contains a `## Definition of Done` section:
   ```bash
   if ! grep -q '## Definition of Done' "$TMPDIR/ttb-plan.md"; then
     printf '\n## Definition of Done\n- [ ] `bash scripts/validate-plugin.sh exits 0`\n' >> "$TMPDIR/ttb-plan.md"
   fi
   ```
2. This logic must appear in the finalise phase BEFORE the `grep -oP` command that extracts DoD items for `--dod` args.
3. Add a note in the Phase 4 finalise instructions (Step B) that clarifies the DoD-injection step occurs before DoD extraction.

### DoD
- [ ] `grep -q 'grep -q.*Definition of Done' plugin/task-to-backlog/SKILL.md`
- [ ] `grep -q 'validate-plugin.sh exits 0' plugin/task-to-backlog/SKILL.md`

## Phase 3: Validate Plugin
Run the validation suite to confirm no contracts are broken.

### DoD
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- Only modify `plugin/task-to-backlog/SKILL.md`; do not change other skill files
- The injection must be idempotent: if a DoD section already exists, do not append another
- The placeholder shell-gate checkbox must be exactly: `- [ ] \`bash scripts/validate-plugin.sh exits 0\``
- Do not modify the review loop logic or Phase 3 reviewer prompt

## Acceptance Gate
- [ ] `grep -q 'grep -q.*Definition of Done' plugin/task-to-backlog/SKILL.md`
- [ ] `grep -q 'validate-plugin.sh exits 0' plugin/task-to-backlog/SKILL.md`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-106
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f plugin/task-to-backlog/SKILL.md
- [ ] #2 grep -q 'Phase 4: finalise' plugin/task-to-backlog/SKILL.md
- [ ] #3 grep -q 'grep -q.*Definition of Done' plugin/task-to-backlog/SKILL.md
- [ ] #4 grep -q 'validate-plugin.sh exits 0' plugin/task-to-backlog/SKILL.md
- [ ] #5 bash scripts/validate-plugin.sh
<!-- DOD:END -->
