---
id: TASK-93.11.2
title: Add contracts-density soft-warning to validate-plugin.sh for SKILL.md files
status: Backlog
assignee: []
created_date: '2026-06-20 10:54'
updated_date: '2026-06-20 10:55'
labels: []
dependencies: []
parent_task_id: TASK-93.11
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a contracts-density soft-warning check to scripts/validate-plugin.sh that emits a non-blocking WARNING when any SKILL.md has fewer than 1 contract per 50 lines of spec (i.e. contract_count < spec_line_count / 50). The check must be non-blocking (does not increment ERRORS, only WARNINGS) and must fire only on SKILL.md files that have a spec body.

Why: Large SKILL.md files with few machine-verifiable contracts are harder to validate automatically. A density ratio warning nudges authors to add contracts proportional to spec size. This is part of parent task TASK-93.11 alongside the lint-severity matrix.

Done looks like:
- validate-plugin.sh emits a WARNING line (not FAIL) for any SKILL.md where contract_count < spec_lines / 50
- The check exits 0 even when warnings are emitted (non-blocking)
- Regression tests in scripts/ verify the density threshold triggers correctly and does not trigger when density is adequate
- bash scripts/validate-plugin.sh continues to pass on the current repo
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add contracts-density soft-warning to validate-plugin.sh for SKILL.md files

## Context
scripts/validate-plugin.sh already has a "Contract Density Check" section (line 569) that uses an absolute threshold (>500 lines AND <3 contracts). TASK-93.11 asks for a ratio-based check: emit a non-blocking WARNING when any SKILL.md has fewer than 1 contract per 50 lines of spec body. The existing absolute check needs to be replaced or extended with the ratio logic, and regression tests must be added to scripts/.

## Phase 1: Update the Contract Density Check to use ratio logic

In scripts/validate-plugin.sh, replace the existing absolute-threshold density check (LINE_THRESHOLD=500, CONTRACT_THRESHOLD=3) with a ratio-based check:
- For each SKILL.md, count spec_lines = number of lines in the ## Spec section body (between "## Spec" and the next "##" heading or EOF).
- If spec_lines == 0, skip the skill (no spec, no density requirement).
- contract_count = number of contract list items in the YAML frontmatter contracts: block.
- Threshold: contract_count < spec_lines / 50.0 triggers a WARNING (never a FAIL; never increments ERRORS).
- The check block must use `set +e` / `set -e` guards and accumulate into WARNINGS only (not ERRORS).

Edit scripts/validate-plugin.sh: replace the Python block inside "=== Layer 0: Contract Density Check ===" with the new ratio logic.

### DoD
- [ ] `grep -q "spec_lines / 50" /home/yale/work/baime/scripts/validate-plugin.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "Errors: 0"`

## Phase 2: Write regression tests for the density check

Create scripts/validate-density.test.sh that:
1. Sets up a fixture directory in /tmp/density-test-$$ with two synthetic SKILL.md files:
   - skill-dense/SKILL.md: 100 spec lines, 3 contracts (ratio = 3/100 = 0.03, threshold = 100/50 = 2 → 3 >= 2 → no warning)
   - skill-sparse/SKILL.md: 100 spec lines, 1 contract (ratio = 1/100 = 0.01, threshold = 100/50 = 2 → 1 < 2 → warning)
2. Runs the density-check Python block extracted from validate-plugin.sh against this fixture dir.
3. Asserts:
   - skill-dense produces no WARNING output.
   - skill-sparse produces a WARNING line.
4. Cleans up /tmp/density-test-$$ on exit.

The test file must be named scripts/validate-density.test.sh and exit 0 on success, non-zero on failure.
It will be picked up automatically by run_skill_unit_tests() in validate-plugin.sh.

### DoD
- [ ] `test -f /home/yale/work/baime/scripts/validate-density.test.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-density.test.sh`
- [ ] `grep -q "skill-sparse" /home/yale/work/baime/scripts/validate-density.test.sh`

## Phase 3: Validate end-to-end

Run the full validation suite to confirm both the new density check and its regression test pass cleanly.

### DoD
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "Errors: 0"`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "PASS: unit test: validate-density.test.sh"`

## Constraints
- The density check must never increment ERRORS; only WARNINGS.
- Do not remove the existing check section header; replace only the Python logic inside it.
- The regression test must be self-contained and clean up its own tmp files.
- No new Python packages or node modules may be added.

## Acceptance Gate
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "PASS: unit test: validate-density.test.sh"`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.11

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q "spec_lines / 50" /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #2 bash /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #3 bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "Errors: 0"
- [ ] #4 test -f /home/yale/work/baime/scripts/validate-density.test.sh
- [ ] #5 bash /home/yale/work/baime/scripts/validate-density.test.sh
- [ ] #6 grep -q "skill-sparse" /home/yale/work/baime/scripts/validate-density.test.sh
- [ ] #7 bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "PASS: unit test: validate-density.test.sh"
<!-- DOD:END -->
