---
id: TASK-105.4
title: >-
  Add gate script scripts/check-p0-evidence.sh that fails if any P0 claim has
  zero measured evidence
status: Backlog
assignee: []
created_date: '2026-06-20 10:39'
updated_date: '2026-06-20 10:39'
labels: []
dependencies: []
parent_task_id: TASK-105
priority: medium
ordinal: 117000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write scripts/check-p0-evidence.sh that reads experiments/maturity/maturity-scores.json and exits non-zero (printing the offending claim IDs) if any P0 claim has met_count == 0. Integrate this gate into the CI/validate pipeline by adding it to scripts/validate-plugin.sh or as a standalone CI step.

This is Phase 4 (the final gate phase) of the TASK-105 maturity scorecard pipeline. It enforces that no P0 methodology claim goes unvalidated — the hard stop that gives the scorecard its enforcement teeth.

Parent task: TASK-105
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/check-p0-evidence.sh
- [ ] #2 test -x scripts/check-p0-evidence.sh
- [ ] #3 bash scripts/check-p0-evidence.sh
- [ ] #4 grep -q 'check-p0-evidence' scripts/validate-plugin.sh || grep -rq 'check-p0-evidence' .github/
- [ ] #5 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Plan: Add gate script scripts/check-p0-evidence.sh that fails if any P0 claim has zero measured evidence

## Context
The maturity scorecard is only useful if it has enforcement. This gate script provides the hard stop: if any P0-priority methodology claim has no measured Met verdicts, the pipeline (and CI) fails loudly. This is the final phase of TASK-105 and the mechanism that makes the scorecard actionable rather than informational.

## Phase 1: Implement scripts/check-p0-evidence.sh
Write a bash script that:
1. Checks for existence of `experiments/maturity/maturity-scores.json`; exits 1 with a clear message if missing
2. Uses `python3 -c` or `jq` to find all entries where `p0_flag == true AND met_count == 0`
3. If any such entries exist: print each claim_id with a "FAIL: P0 claim has zero measured evidence" message and exit 1
4. If none: print "OK: all P0 claims have measured evidence" and exit 0

### DoD
- `test -f scripts/check-p0-evidence.sh`
- `test -x scripts/check-p0-evidence.sh`
- `bash -n scripts/check-p0-evidence.sh`

## Phase 2: Write a negative-control test
Create a fixture file `experiments/maturity/fixtures/p0-zero-evidence.json` containing at least one P0 claim with met_count=0. Verify the gate fails on it.

### DoD
- `test -f experiments/maturity/fixtures/p0-zero-evidence.json`
- `! bash scripts/check-p0-evidence.sh experiments/maturity/fixtures/p0-zero-evidence.json`

## Phase 3: Integrate into validate-plugin.sh
Add a call to `bash scripts/check-p0-evidence.sh` inside `scripts/validate-plugin.sh` (after the existing checks). The gate should be skipped gracefully (exit 0) if maturity-scores.json does not yet exist, to avoid breaking CI before the pipeline has run.

### DoD
- `grep -q 'check-p0-evidence' scripts/validate-plugin.sh`
- `bash scripts/validate-plugin.sh`

## Constraints
- Gate must not fail if maturity-scores.json is absent (skip gracefully)
- Gate must accept an optional path argument for the scores file (for testing with fixtures)
- Do not modify any experiment result files

## Acceptance Gate
- `bash scripts/check-p0-evidence.sh && bash scripts/validate-plugin.sh`

parentTask: TASK-105
<!-- SECTION:NOTES:END -->
