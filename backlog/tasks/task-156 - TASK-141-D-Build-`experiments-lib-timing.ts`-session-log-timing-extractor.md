---
id: TASK-156
title: 'TASK-141-D: Build `experiments/lib/timing.ts` session-log timing extractor'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-22 11:55'
updated_date: '2026-06-22 12:11'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-141
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build experiments/skill-quality/lib/timing.ts — meta-cc query_timestamps/query_tools pipeline; structural assertion preventing data_source:estimated; unit tests against captured session fixture. Parent: TASK-141.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Build `experiments/lib/timing.ts` session-log timing extractor

## Background

Pipeline timing experiments (such as the ftb-phase-timing-baseline) currently derive phase durations from manual estimation or from raw JSONL timestamp extraction done ad hoc. The `ftb-phase-timing-baseline.md` document explicitly notes: "TASK-132 planLoop total is estimated" and "TASK-134 finalise end time is estimated from contextual evidence." This is a structural epistemic problem: when timing claims carry `data_source: estimated`, they have lower evidential weight and cannot be automatically verified. The meta-cc MCP server provides `query_timestamps` and `query_tools` endpoints that can extract real wall-clock timestamps from session logs for specific tool calls and agent boundaries — but no TypeScript module wraps this into a usable pipeline. Without `timing.ts`, every future timing experiment must either estimate durations (low confidence) or re-implement the meta-cc query pipeline from scratch (high cost). `timing.ts` eliminates both problems: it provides a reusable, project-agnostic pipeline that structurally cannot emit `data_source: estimated` — if session data is unavailable, it throws rather than silently defaulting to estimation.

## Goals

1. `experiments/skill-quality/lib/timing.ts` exports `extractPhaseTiming(config: TimingConfig): Promise<PhaseTimingResult>` that queries meta-cc `query_timestamps` and `query_tools` to extract real wall-clock phase boundaries for a given session ID and phase-boundary spec, and returns a `PhaseTimingResult` with `data_source: 'measured'` always.
2. The module throws `Error('session data unavailable: cannot produce measured timing')` rather than emitting `data_source: 'estimated'` when the session log is not accessible or returns no data — the structural constraint is enforced in code.
3. A captured session fixture file `experiments/skill-quality/fixtures/session-fixtures/sample-session.jsonl` (a synthetic minimal session log) allows unit tests to run without the live meta-cc MCP server.
4. Unit tests in `experiments/skill-quality/lib/timing.test.ts` cover: successful phase extraction from the fixture, the throw path when session data is empty, and the output schema validation (all required fields present, `data_source` is `'measured'`).

## Proposed Approach

`timing.ts` accepts a `TimingConfig` containing: `sessionId`, `phaseBoundarySpec` (array of `{phaseName, startToolPattern, endToolPattern}`), and an optional `metaCcClient` (injectable for testing, defaults to live meta-cc MCP calls). The module queries `query_timestamps` for the session to get tool-call timestamps, then matches start/end patterns to compute phase durations. A schema version check compares the meta-cc response shape against a known-good shape to detect silent breaking changes. The output `PhaseTimingResult` matches the existing `ftb-phase-timing-baseline.md` column structure: phase names, duration in seconds, data_source always `'measured'`. The synthetic session fixture is a minimal JSONL file with enough tool-call events to exercise all code paths. The module has no hard-coded paths — all baime-specific paths come from the caller's config.

## Trade-offs and Risks

Not doing: We are not replacing the existing `ftb-phase-timing-baseline.md` data in this task — that is a follow-up experiment. We are not integrating `timing.ts` into `runner.ts` in this task (that is a potential follow-up). We are not building a CLI wrapper. Risk: meta-cc session log schema may change; the schema version check mitigates silent breakage. Risk: the synthetic fixture must stay representative of real session log structure; if meta-cc changes output format, the fixture needs updating too.

---

# Plan: Build `experiments/lib/timing.ts` session-log timing extractor

Proposal: docs/proposals/proposal-epic-capability-model.md

## Phase A: TimingConfig type, session fixture, and query pipeline core

### Tests (write first)
- `experiments/skill-quality/lib/timing.test.ts` (new file):
  1. Import `extractPhaseTiming` from `timing.ts`; call it with the synthetic fixture loaded as `metaCcClient` mock; assert output has `data_source: 'measured'`
  2. Assert output contains all expected phase names from the `phaseBoundarySpec`
  3. Assert each phase has a numeric `durationSeconds` field
  4. Assert the module throws when `metaCcClient.queryTimestamps()` returns empty array
- `experiments/skill-quality/fixtures/session-fixtures/sample-session.jsonl` (new file): minimal synthetic session log with 3 tool calls at known timestamps

### Implementation
- `experiments/skill-quality/lib/timing.ts` (new file):
  - `TimingConfig` interface: `sessionId`, `phaseBoundarySpec`, optional `metaCcClient`
  - `PhaseTimingResult` interface: `phases` (array of `{phaseName, durationSeconds, startTs, endTs}`), `data_source: 'measured'`, `sessionId`, `generatedAt`
  - `extractPhaseTiming(config)`: query timestamps, match phase boundaries, compute durations
  - Structural guard: throw if session data is empty/unavailable instead of returning estimated values

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `cd experiments/skill-quality && npx tsx --test lib/timing.test.ts 2>&1 | grep -q "pass"`

## Phase B: Schema version check and data_source guard enforcement

### Tests (write first)
- `experiments/skill-quality/lib/timing.test.ts` additions:
  1. Mock `metaCcClient` returns a response with an unexpected schema shape; assert the module throws with a message containing "schema"
  2. Mock `metaCcClient` returns a response with `data_source: 'estimated'` field; assert the module ignores it and still outputs `data_source: 'measured'`
  3. Assert `! grep -q "data_source.*estimated" experiments/skill-quality/lib/timing.ts` — the string `estimated` never appears as an assignable value in the source

### Implementation
- `experiments/skill-quality/lib/timing.ts` additions:
  - `validateMetaCcResponseSchema(response)`: check required fields; throw if schema version mismatch detected
  - Explicit override: output always has `data_source: 'measured'` regardless of any input field

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `cd experiments/skill-quality && npx tsx --test lib/timing.test.ts 2>&1 | grep -q "pass"`
- [ ] `! grep -q "data_source.*'estimated'" experiments/skill-quality/lib/timing.ts`

## Constraints
- `timing.ts` must have no hard-coded baime paths — all paths come from caller config
- The module must be written to be project-agnostic (suitable for future `plugin/` lift)
- No live meta-cc MCP calls in unit tests — injectable client required
- `data_source: 'estimated'` must never appear as an assignable output value in `timing.ts` source

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `cd experiments/skill-quality && npx tsx --test lib/timing.test.ts 2>&1 | grep -q "pass"`
- [ ] `grep -q 'TimingConfig\|PhaseTimingResult' experiments/skill-quality/lib/timing.ts`
- [ ] `! grep -q "data_source.*'estimated'" experiments/skill-quality/lib/timing.ts`
- [ ] `grep -q 'session data unavailable' experiments/skill-quality/lib/timing.ts`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal self-review: APPROVED
Plan review iteration 1: APPROVED
premise-ledger:
[E] goal coverage: goal 1 (extractPhaseTiming API) in Phase A; goal 2 (throw guard) in Phase A + Phase B; goal 3 (session fixture) in Phase A; goal 4 (unit tests) in Phase A + Phase B
[E] TDD structure: both phases have Tests (write first) + Implementation + DoD sections
[E] DoD executability: all DoD items are executable shell commands
[E] acceptance gate: first item is bash scripts/validate-plugin.sh matching CFG_TEST_ALL
[C] file paths: timing.ts does not exist yet (new file), confirmed by checking lib/ directory; sample-session.jsonl does not exist yet, confirmed by checking fixtures/session-fixtures/ (dir doesn't exist)
[E] phase ordering: Phase A (core pipeline) before Phase B (schema check + guard enforcement) — correct
[H] DoD sufficiency: absence check ! grep -q 'data_source.*estimated' is a strong structural guarantee but could be bypassed by dynamic string construction; relying on code review to catch that
GCL-self-report: E=5 C=1 H=1

claimed: 2026-06-22T12:05:49Z

workerLoop DoD #0: PASS — bash scripts/validate-plugin.sh

workerLoop DoD #1: PASS — cd experiments/skill-quality && npx tsx --test lib/timing.test.ts 2>&1 | grep -q "pass"

workerLoop DoD #2: PASS — grep -q 'TimingConfig\|PhaseTimingResult' experiments/skill-quality/lib/timing.ts

workerLoop DoD #3: PASS — ! grep -q "data_source.*'estimated'" experiments/skill-quality/lib/timing.ts

workerLoop DoD #4: PASS — grep -q 'session data unavailable' experiments/skill-quality/lib/timing.ts

WARNING: agent-summary missing for TASK-156

Completed: 2026-06-22T12:11:04Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 cd experiments/skill-quality && npx tsx --test lib/timing.test.ts 2>&1 | grep -q "pass"
- [ ] #3 grep -q 'TimingConfig\|PhaseTimingResult' experiments/skill-quality/lib/timing.ts
- [ ] #4 ! grep -q "data_source.*'estimated'" experiments/skill-quality/lib/timing.ts
- [ ] #5 grep -q 'session data unavailable' experiments/skill-quality/lib/timing.ts
<!-- DOD:END -->
