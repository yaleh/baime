---
id: TASK-157
title: >-
  TASK-141-E: Build standalone `verify-experiment-provenance.sh` gate + wire
  into validate-plugin.sh
status: 'Basic: Done'
assignee: []
created_date: '2026-06-22 11:56'
updated_date: '2026-06-22 12:20'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-141
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build scripts/verify-experiment-provenance.sh — pre-registration timestamp check (hypotheses.md git commit earlier than first LLM call artifact); data_source:estimated FAIL gate; no-op when no artifacts exist; add single invocation line to scripts/validate-plugin.sh; keep plugin/scripts/ copy in sync; unit tests for no-op and FAIL paths. Parent: TASK-141.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Build standalone `verify-experiment-provenance.sh` gate + wire into validate-plugin.sh

## Background

The BAIME methodology requires that quantitative experiments be pre-registered — hypotheses must be committed before any LLM calls are made, ensuring results cannot be reverse-engineered from observations. Currently there is no automated check enforcing this. Additionally, experiment result files can silently carry `data_source: estimated` (as seen in `docs/experiments/ftb-phase-timing-baseline.md`), which means downstream consumers cannot distinguish measured from estimated results. Both gaps allow experiment integrity violations to go undetected until manual review. The solution is a standalone, scoped gate `verify-experiment-provenance.sh` that checks only experiment artifacts: (1) pre-registration timestamp check — `hypotheses.md` git commit must precede the earliest LLM call timestamp in artifacts; (2) `data_source: estimated` FAIL gate — any results file under `experiments/*/artifacts/` containing this string blocks the gate. Crucially, the gate is a **no-op when no experiment artifacts exist**, imposing zero cost on non-experiment projects. `validate-plugin.sh` then adds a single line to invoke this gate — baime's editorial choice to make experiment integrity a release precondition, without inlining the logic.

## Goals

1. `scripts/verify-experiment-provenance.sh` exists and implements: (a) pre-registration check: `git log --follow -- experiments/*/hypotheses.md` commit timestamp < earliest `first_llm_call_ts` field in `experiments/*/artifacts/**/*.json`; (b) `data_source: estimated` FAIL gate: any file under `experiments/*/artifacts/` containing the string `"data_source": "estimated"` causes the gate to exit non-zero; (c) no-op: when no files match `experiments/*/artifacts/**/*.json`, the gate exits 0 immediately.
2. `scripts/validate-plugin.sh` invokes `verify-experiment-provenance.sh` with a single added line in the "Unit Tests" section (or a new "Experiment Provenance" section), and `plugin/scripts/validate-plugin.sh` is kept in sync.
3. Unit tests under `scripts/tests/verify-experiment-provenance.test.sh` cover: no-op path (no artifacts dir), FAIL path (artifact with `data_source: estimated`), PASS path (artifact with `data_source: measured` and hypotheses committed before artifact timestamp).
4. The gate is project-agnostic: all paths are derived from `REPO_ROOT` (git toplevel), not hard-coded to baime paths.

## Proposed Approach

`verify-experiment-provenance.sh` uses `git rev-parse --show-toplevel` to find the repo root. It then globs `experiments/*/artifacts/**/*.json` — if none found, exits 0 (no-op). For the `data_source` check, it uses `grep -rl '"data_source": "estimated"' experiments/*/artifacts/` and fails with a list of offending files if any match. For the pre-registration check, it extracts `first_llm_call_ts` from each artifact JSON using `python3 -c`, compares against `git log --format=%aI -- experiments/hypotheses.md` (or per-experiment `experiments/<exp>/hypotheses.md`), and fails if any artifact's timestamp precedes the hypotheses commit. The unit tests use `bats` or simple bash assertions with temp directories containing synthetic artifact files.

## Trade-offs and Risks

Not doing: We are not retroactively fixing existing experiment artifacts that may carry `data_source: estimated` — those are pre-existing and exempt (gate only applies to files written after the gate lands). We are not implementing the gate for non-experiment projects — the no-op path ensures this. We are not making the `first_llm_call_ts` check mandatory if the field is absent — only present fields are checked (runner.ts in TASK-141-B will set this field for new experiments). Risk: if `experiments/*/hypotheses.md` doesn't exist for an experiment, the pre-registration check must skip that experiment gracefully (not fail). Risk: timestamp comparison assumes UTC; the gate must normalize timestamps before comparison.

---

# Plan: Build standalone `verify-experiment-provenance.sh` gate + wire into validate-plugin.sh

Proposal: docs/proposals/proposal-epic-capability-model.md

## Phase A: verify-experiment-provenance.sh core — no-op and data_source FAIL gate

### Tests (write first)
- `scripts/tests/verify-experiment-provenance.test.sh` (new file):
  1. No-op test: run gate in a temp dir with no `experiments/*/artifacts/` — assert exit 0
  2. FAIL test: create `experiments/exp-test/artifacts/results.json` containing `"data_source": "estimated"` — assert exit non-zero
  3. PASS test: create `experiments/exp-test/artifacts/results.json` containing `"data_source": "measured"` — assert exit 0 (pre-reg check skipped when no `first_llm_call_ts`)

### Implementation
- `scripts/verify-experiment-provenance.sh` (new file):
  - `REPO_ROOT=$(git rev-parse --show-toplevel)` — project-agnostic
  - Glob `experiments/*/artifacts/**/*.json`; if none, print "no experiment artifacts found — no-op" and exit 0
  - `data_source: estimated` FAIL gate: `grep -rl '"data_source": "estimated"' ...`; fail with file list if any match
  - Exit 0 if only `data_source: measured` files found and no `first_llm_call_ts` fields present

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/tests/verify-experiment-provenance.test.sh`

## Phase B: Pre-registration timestamp check

### Tests (write first)
- `scripts/tests/verify-experiment-provenance.test.sh` additions:
  1. Pre-reg PASS: artifact has `first_llm_call_ts` after hypotheses.md git commit timestamp — exit 0
  2. Pre-reg FAIL: artifact has `first_llm_call_ts` before hypotheses.md git commit timestamp — exit non-zero
  3. Pre-reg SKIP: artifact has `first_llm_call_ts` but no hypotheses.md exists for that experiment — exit 0 (graceful skip)

### Implementation
- `scripts/verify-experiment-provenance.sh` additions:
  - For each artifact JSON with a `first_llm_call_ts` field: extract the timestamp; find the corresponding `experiments/<exp>/hypotheses.md`; get its git commit timestamp via `git log --format=%aI -1 -- experiments/<exp>/hypotheses.md`; compare; FAIL if artifact timestamp precedes hypotheses commit
  - If no `hypotheses.md` found for an experiment: log a WARN but continue (don't fail)
  - Normalize all timestamps to epoch seconds before comparison

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/tests/verify-experiment-provenance.test.sh`
- [ ] `grep -q 'first_llm_call_ts' scripts/verify-experiment-provenance.sh`

## Phase C: Wire into validate-plugin.sh and keep plugin/scripts/ in sync

### Tests (write first)
- `scripts/tests/verify-experiment-provenance.test.sh` addition:
  1. Run `bash scripts/validate-plugin.sh` against the repo; assert it invokes `verify-experiment-provenance.sh` (grep for the invocation line in validate-plugin.sh)
- Existing validate-plugin.sh test suite must still pass after the wiring

### Implementation
- `scripts/validate-plugin.sh`: add a new section `=== Experiment Provenance ===` just before the `=== Summary ===` section, containing a single call: `bash "$REPO_ROOT/scripts/verify-experiment-provenance.sh"` with PASS/fail reporting via the existing `pass`/`fail` helpers
- `plugin/scripts/validate-plugin.sh`: overwrite with updated content to keep in sync
- `plugin/scripts/verify-experiment-provenance.sh`: copy from `scripts/verify-experiment-provenance.sh`

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/tests/verify-experiment-provenance.test.sh`
- [ ] `grep -q 'verify-experiment-provenance' scripts/validate-plugin.sh`
- [ ] `diff scripts/validate-plugin.sh plugin/scripts/validate-plugin.sh`
- [ ] `diff scripts/verify-experiment-provenance.sh plugin/scripts/verify-experiment-provenance.sh`

## Constraints
- The gate is a no-op when no experiment artifacts exist — zero cost for non-experiment projects
- No experiment logic must be inlined into validate-plugin.sh — only a single invocation line
- All paths must be derived from REPO_ROOT (git toplevel), not hard-coded
- `data_source: estimated` check scoped to `experiments/*/artifacts/` only — not the whole repo
- Pre-registration check gracefully skips experiments with no `hypotheses.md` rather than failing

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/tests/verify-experiment-provenance.test.sh`
- [ ] `grep -q 'verify-experiment-provenance' scripts/validate-plugin.sh`
- [ ] `diff scripts/validate-plugin.sh plugin/scripts/validate-plugin.sh`
- [ ] `diff scripts/verify-experiment-provenance.sh plugin/scripts/verify-experiment-provenance.sh`
- [ ] `grep -q 'first_llm_call_ts' scripts/verify-experiment-provenance.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal self-review: APPROVED
Plan review iteration 1: APPROVED
premise-ledger:
[E] goal coverage: goal 1 (no-op+data_source+pre-reg) in Phase A+B; goal 2 (validate-plugin wiring+sync) in Phase C; goal 3 (unit tests) in Phase A+B+C; goal 4 (project-agnostic) in Phase A constraint
[E] TDD structure: all three phases have Tests (write first) + Implementation + DoD sections
[E] DoD executability: all DoD items are shell commands
[E] acceptance gate: first item is bash scripts/validate-plugin.sh matching CFG_TEST_ALL
[C] file paths: validate-plugin.sh exists (confirmed by reading it); scripts/tests/ dir exists; plugin/scripts/ dir exists
[E] phase ordering: Phase A (no-op+data_source) before Phase B (pre-reg) before Phase C (wiring) — correct sequencing; Phase C depends on A+B being complete
[H] DoD sufficiency: diff-based sync check is strong but could be defeated if both files are wrong in the same way; accepted as sufficient given existing convention
GCL-self-report: E=5 C=1 H=1

claimed: 2026-06-22T12:11:18Z

Phase A ✓ 2026-06-22T00:00:00Z — verify-experiment-provenance.sh core: no-op, estimated FAIL, measured PASS gates implemented and tested

Phase B ✓ 2026-06-22T00:00:00Z — pre-registration timestamp check: PASS/FAIL/SKIP scenarios all tested

Phase C ✓ 2026-06-22T00:00:00Z — wired into validate-plugin.sh, plugin/scripts/ copies synced

DoD #1: PASS — bash scripts/validate-plugin.sh (0 errors)

DoD #2: PASS — bash scripts/verify-experiment-provenance.test.sh (7/7 passed)

DoD #3: PASS — grep -q 'verify-experiment-provenance' scripts/validate-plugin.sh

DoD #4: PASS — diff scripts/validate-plugin.sh plugin/scripts/validate-plugin.sh

DoD #5: PASS — diff scripts/verify-experiment-provenance.sh plugin/scripts/verify-experiment-provenance.sh

DoD #6: PASS — grep -q 'first_llm_call_ts' scripts/verify-experiment-provenance.sh

workerLoop DoD #0: PASS — bash scripts/validate-plugin.sh

Completed: 2026-06-22T12:20:35Z
## Execution Summary
Result: Done
Commit: 8369a95bc2461574a300da941a0aeebb4849dacf
All 6 DoD commands passed. Test script path fix (SCRIPT_DIR→SCRIPTS_DIR) committed.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 bash scripts/tests/verify-experiment-provenance.test.sh
- [ ] #3 grep -q 'verify-experiment-provenance' scripts/validate-plugin.sh
- [ ] #4 diff scripts/validate-plugin.sh plugin/scripts/validate-plugin.sh
- [ ] #5 diff scripts/verify-experiment-provenance.sh plugin/scripts/verify-experiment-provenance.sh
- [ ] #6 grep -q 'first_llm_call_ts' scripts/verify-experiment-provenance.sh
<!-- DOD:END -->
