---
id: TASK-153
title: 'TASK-141-A: Define `cap:experiment` capability facet'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-22 11:50'
updated_date: '2026-06-22 12:03'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-141
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `cap:experiment` to verify-cap-markers.sh vocabulary (values: CONFIRMED|NULL|REJECTED|UNDERPOWERED), update the script to validate it, add assignment-rules docs. Parent: TASK-141.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Define `cap:experiment` capability facet

## Background

The project currently recognizes five `cap:*` idempotency facets (`cap:propose`, `cap:plan`, `cap:decompose`, `cap:execute`, `cap:evaluate`) that track process-lifecycle milestones for backlog tasks. Eight quantitative experiments (Exp-A through Exp-H) have now been run, but none of the corresponding experiment tasks carries a machine-readable completion marker indicating whether the experiment confirmed, rejected, or was underpowered to decide its hypothesis. This absence means `validate-plugin.sh` cannot tell whether an experiment task is legitimately done or merely abandoned. The `cap:experiment` facet fills this gap: it records the epistemic outcome of an experiment run as a first-class capability marker, making it grep-able, traceable, and checkable by the release gate. Without this facet, the broader TASK-141 infrastructure (runner.ts, timing.ts, provenance gate) has no vocabulary to mark experiment completion in the task system.

## Goals

1. `scripts/verify-cap-markers.sh` recognizes `cap:experiment=<value>` as a valid marker and validates that value is one of `CONFIRMED`, `NULL`, `REJECTED`, or `UNDERPOWERED` on any task with `kind:basic` that is beyond its entry column and has a `cap:experiment` marker present.
2. `plugin/scripts/verify-cap-markers.sh` is kept in sync with `scripts/verify-cap-markers.sh` (existing convention in this codebase).
3. Assignment rules for `cap:experiment` are documented in `docs/proposals/proposal-epic-capability-model.md` — when to use each value, who sets it, and at what point in task lifecycle.
4. A test under `scripts/tests/` verifies that: (a) a task body with `cap:experiment=CONFIRMED` passes, (b) a task body with `cap:experiment=INVALID` emits a warning, and (c) the script still exits 0 (advisory-only) in both cases.

## Proposed Approach

`scripts/verify-cap-markers.sh` contains a Python snippet that checks for the pattern `cap:[a-z_]+=\w+`. Extend the Python snippet to additionally check: if a `cap:experiment` marker is present, its value must be one of the four allowed values; emit a separate warning if the value is invalid. The check remains advisory (exit 0) — consistent with the existing script's design. Then copy the updated script to `plugin/scripts/` to maintain the canonical/copy convention. Finally, add a concise section to `docs/proposals/proposal-epic-capability-model.md` documenting the new facet alongside the existing five.

## Trade-offs and Risks

Not doing: We are not making `cap:experiment` mandatory on all `kind:basic` tasks — it is only relevant to experiment tasks and only validated when present. We are not changing the advisory (exit-0) nature of the script. We are not implementing value validation for other existing `cap:*` facets (those use open-ended values like `approved`, `done`, `converged` and don't have a closed enum). Risk: if the allowed-value enum changes later (e.g., adding `PARTIAL`), the script validation must be updated in sync; document this in the assignment-rules section.

---

# Plan: Define `cap:experiment` capability facet

Proposal: docs/proposals/proposal-epic-capability-model.md

## Phase A: Extend verify-cap-markers.sh with cap:experiment value validation

### Tests (write first)
- `scripts/tests/cap-experiment-facet.test.sh` — test cases:
  1. Create a temp task file with `cap:experiment=CONFIRMED` in body; run script; expect zero warnings for this file
  2. Create a temp task file with `cap:experiment=INVALID_VAL` in body; run script; expect one warning mentioning "cap:experiment" and "invalid value"
  3. Script exits 0 in both cases (advisory only)

### Implementation
- `scripts/verify-cap-markers.sh`: extend the Python snippet to add, after the existing `has_cap` check:
  - If a `cap:experiment=<value>` marker is found in the body, extract the value and check it against the set `{CONFIRMED, NULL, REJECTED, UNDERPOWERED}`; if not in set, print `WARN: cap:experiment has invalid value '<value>' in <basename>` and exit 1 from the python script (which the bash wrapper counts as a warning, not a failure)
- `plugin/scripts/verify-cap-markers.sh`: overwrite with the updated content (keep in sync)

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/tests/cap-experiment-facet.test.sh`
- [ ] `diff scripts/verify-cap-markers.sh plugin/scripts/verify-cap-markers.sh`

## Phase B: Document cap:experiment assignment rules

### Tests (write first)
- `scripts/tests/cap-experiment-docs.test.sh` — single test:
  1. `grep -q 'cap:experiment' docs/proposals/proposal-epic-capability-model.md` — asserts the doc contains the new facet entry

### Implementation
- `docs/proposals/proposal-epic-capability-model.md`: add a new row to the capabilities table and a new sub-section "cap:experiment — Experiment outcome" describing:
  - Allowed values: `CONFIRMED` (hypothesis supported), `NULL` (no detectable effect), `REJECTED` (hypothesis contradicted), `UNDERPOWERED` (insufficient data/k)
  - Who sets it: the experiment runner (runner.ts in TASK-141-B, or manually for hand-run experiments)
  - When: after the experiment artifact JSON is written and results reviewed
  - Note: if the allowed-value set changes, update both verify-cap-markers.sh and this doc together

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/tests/cap-experiment-docs.test.sh`
- [ ] `grep -q 'CONFIRMED\|NULL\|REJECTED\|UNDERPOWERED' docs/proposals/proposal-epic-capability-model.md`

## Constraints
- The advisory (exit-0) contract of `scripts/verify-cap-markers.sh` MUST NOT change
- Both `scripts/verify-cap-markers.sh` and `plugin/scripts/verify-cap-markers.sh` must be identical after this task
- cap:experiment is NOT made mandatory on all kind:basic tasks — only validated when the marker is present with an invalid value

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/tests/cap-experiment-facet.test.sh`
- [ ] `bash scripts/tests/cap-experiment-docs.test.sh`
- [ ] `grep -q 'cap:experiment' docs/proposals/proposal-epic-capability-model.md`
- [ ] `diff scripts/verify-cap-markers.sh plugin/scripts/verify-cap-markers.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal self-review: APPROVED
Plan review iteration 1: APPROVED
premise-ledger:
[E] goal coverage: 4 goals mapped to Phase A (goals 1,2,4) and Phase B (goal 3)
[E] TDD structure: both phases have Tests + Implementation + DoD sections
[E] DoD executability: all DoD items are shell commands
[E] acceptance gate: first item is bash scripts/validate-plugin.sh matching CFG_TEST_ALL
[E] file paths: scripts/verify-cap-markers.sh confirmed to exist; docs/proposals/proposal-epic-capability-model.md confirmed to exist; plugin/scripts/verify-cap-markers.sh confirmed to exist
[E] phase ordering: Phase A (script) before Phase B (docs) — correct, docs reference the new script behavior
[H] DoD sufficiency: judgment that diff + test coverage is sufficient relies on background knowledge of what constitutes adequate test coverage for a shell script extension
GCL-self-report: E=6 C=0 H=1

claimed: 2026-06-22T11:55:27Z

Phase A ✓ 2026-06-22T00:00:00Z — verify-cap-markers.sh extended with cap:experiment value validation (CONFIRMED|NULL|REJECTED|UNDERPOWERED); plugin/scripts/verify-cap-markers.sh created as identical copy; test file scripts/tests/cap-experiment-facet.test.sh written and passing (3/3)

Phase B ✓ 2026-06-22T00:01:00Z — cap:experiment assignment rules documented in proposal-epic-capability-model.md (CONFIRMED|NULL|REJECTED|UNDERPOWERED section with values, who-sets, when, sync-note); scripts/tests/cap-experiment-docs.test.sh written and passing (1/1)

DoD #1: PASS — bash scripts/validate-plugin.sh

DoD #2: PASS — bash scripts/tests/cap-experiment-facet.test.sh (3/3)

DoD #3: PASS — bash scripts/tests/cap-experiment-docs.test.sh (1/1)

DoD #4: PASS — grep -q 'cap:experiment' docs/proposals/proposal-epic-capability-model.md

DoD #5: PASS — diff scripts/verify-cap-markers.sh plugin/scripts/verify-cap-markers.sh (identical)

re-claimed after decomposer edit race: 2026-06-22T12:02:31Z

workerLoop DoD #0: PASS — bash scripts/validate-plugin.sh

workerLoop DoD #1: PASS — bash scripts/tests/cap-experiment-facet.test.sh

workerLoop DoD #2: PASS — bash scripts/tests/cap-experiment-docs.test.sh

workerLoop DoD #3: PASS — grep -q 'cap:experiment' docs/proposals/proposal-epic-capability-model.md

workerLoop DoD #4: PASS — diff scripts/verify-cap-markers.sh plugin/scripts/verify-cap-markers.sh

WARNING: agent-summary missing for TASK-153

Completed: 2026-06-22T12:03:48Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 bash scripts/tests/cap-experiment-facet.test.sh
- [ ] #3 bash scripts/tests/cap-experiment-docs.test.sh
- [ ] #4 grep -q 'cap:experiment' docs/proposals/proposal-epic-capability-model.md
- [ ] #5 diff scripts/verify-cap-markers.sh plugin/scripts/verify-cap-markers.sh
<!-- DOD:END -->
