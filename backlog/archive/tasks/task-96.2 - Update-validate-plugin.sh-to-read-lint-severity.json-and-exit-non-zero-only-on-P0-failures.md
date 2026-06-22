---
id: TASK-96.2
title: >-
  Update validate-plugin.sh to read lint-severity.json and exit non-zero only on
  P0 failures
status: Backlog
assignee: []
created_date: '2026-06-20 10:38'
updated_date: '2026-06-20 10:49'
labels: []
dependencies: []
parent_task_id: TASK-96
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modify scripts/validate-plugin.sh to load plugin/.claude-plugin/lint-severity.json at startup, tag every check result with its severity tier, and change the final exit logic so the script exits non-zero only when at least one P0 check has failed. P1 and P2 failures must be printed with their severity tag but must not affect the exit code.

This is sub-task 2 of 2 for TASK-96 "Build a skill-lint severity matrix". It depends on TASK-96.1 (which produces lint-severity.json). Together they fulfill TASK-96's goal of letting CI pass through P1/P2 noise while blocking only on genuine P0 defects.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f plugin/.claude-plugin/lint-severity.json
- [ ] #2 bash scripts/validate-plugin.sh
- [ ] #3 grep -q 'lint-severity.json' scripts/validate-plugin.sh
- [ ] #4 grep -q 'P0' scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Plan: Update validate-plugin.sh to read lint-severity.json and gate on P0s only

## Context
After TASK-96.1 produces plugin/.claude-plugin/lint-severity.json, this task modifies
validate-plugin.sh to use it. Today the script exits non-zero for any failure regardless of
severity. The goal is: exit 0 when only P1/P2 failures exist, exit 1 only if one or more P0
checks failed. P1/P2 failures are still printed visibly so developers can see them.

## Phase 1: Add severity-aware helper functions to validate-plugin.sh

At the top of validate-plugin.sh (after the existing `fail()`/`pass()` helpers), add:

1. A loader that reads lint-severity.json into a bash associative array:
   `SEVERITY[check-id]=P0|P1|P2`

2. Replace the existing `fail()` and add `warn()`:
   - `p0_fail CHECK_ID MSG` — increments P0_ERRORS, prints "[P0] FAIL: MSG"
   - `p1_warn CHECK_ID MSG` — increments P1_WARNINGS, prints "[P1] WARN: MSG"
   - `p2_advisory CHECK_ID MSG` — increments P2_ADVISORIES, prints "[P2] INFO: MSG"
   - Keep legacy `fail()` as a shim that calls `p0_fail` for backward compat

3. Update the final Summary section to print P0/P1/P2 counts and exit non-zero only if
   P0_ERRORS > 0.

### DoD
- [ ] `grep -q 'lint-severity.json' scripts/validate-plugin.sh`
- [ ] `grep -q 'P0_ERRORS' scripts/validate-plugin.sh`
- [ ] `grep -q 'P1_WARNINGS' scripts/validate-plugin.sh`

## Phase 2: Migrate existing check call-sites to severity-tagged helpers

Walk every call to `fail()` in validate-plugin.sh and replace with the appropriate severity
call, using the check-IDs from lint-severity.json:

- `fail "..."` calls that correspond to P0 checks → `p0_fail "check-id" "..."`
- WARNING-printing blocks (allowed-tools-completeness, contract-density, quantitative-claims)
  that currently only print but don't increment ERRORS → convert to `p1_warn` or `p2_advisory`

Also update the places that directly increment ERRORS or WARNINGS variables to use the new
helpers so the counts stay consistent.

### DoD
- [ ] `! grep -qP '^    fail ' scripts/validate-plugin.sh`
- [ ] `grep -q 'p0_fail\|p1_warn\|p2_advisory' scripts/validate-plugin.sh`

## Phase 3: Validate end-to-end behaviour

Run the updated validate-plugin.sh against the current repo. It must exit 0 (all current
checks should remain passing after this refactor). Verify the severity counts appear in the
Summary section output.

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -q 'P0'`

## Constraints
- Do not change which checks are performed — only how their results are reported/counted
- The script must still exit non-zero if a P0 check fails (backward compat for CI)
- lint-severity.json must be read at runtime, not hard-coded into the script

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'lint-severity.json' scripts/validate-plugin.sh`
- [ ] `grep -q 'P0' scripts/validate-plugin.sh`

parentTask: TASK-96
<!-- SECTION:NOTES:END -->
