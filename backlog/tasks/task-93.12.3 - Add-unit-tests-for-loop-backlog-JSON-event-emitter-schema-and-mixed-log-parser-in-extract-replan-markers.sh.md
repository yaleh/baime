---
id: TASK-93.12.3
title: >-
  Add unit tests for loop-backlog JSON event emitter schema and mixed-log parser
  in extract-replan-markers.sh
status: Backlog
assignee: []
created_date: '2026-06-20 10:54'
updated_date: '2026-06-20 10:55'
labels: []
dependencies: []
parent_task_id: TASK-93.12
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write unit tests covering two concerns introduced by TASK-93.12: (1) the NDJSON emitter schema produced by the loop-backlog daemon, and (2) the parser's ability to handle mixed plain-text and JSON log lines in extract-replan-markers.sh.

**What:** Create a test script (e.g. `scripts/test-daemon-event-schema.sh`) that:
1. Emitter schema test: constructs a sample JSON line using the same logic as the daemon's `emit_event` function and validates it has exactly the four required fields (`event`, `task_id`, `timestamp`, `prior_status`) with correct types (all strings, timestamp matches ISO-8601 pattern).
2. Parser mixed-log test: creates a temp `.daemon.log` containing both plain-text and JSON lines, runs `extract-replan-markers.sh` against it, and asserts: (a) JSON lines are parsed and their fields appear in output; (b) plain-text lines are processed by existing logic; (c) no error exit code.
3. Parser plain-text-only test: runs `extract-replan-markers.sh` against a plain-text-only log and asserts the script exits 0.

**Why:** Without tests, regressions in the emitter schema or parser can silently corrupt the evaluator's trace replay data. This is the third and final slice of TASK-93.12.

**How it fits the parent goal:** TASK-93.12 requires tests covering both the emitter schema and the parser's mixed-line handling. This sub-task delivers that test coverage, making TASK-93.12 fully verifiable end-to-end.

**Done looks like:**
- `scripts/test-daemon-event-schema.sh` exists and is executable.
- Running it exits 0 with all assertions passing.
- The test explicitly validates the JSON schema (field presence and string type).
- The test explicitly validates mixed-log parsing (JSON and plain-text both handled).
- `bash scripts/validate-plugin.sh` passes.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add unit tests for loop-backlog JSON event emitter schema and mixed-log parser

## Context
TASK-93.12 introduces structured NDJSON emission (TASK-93.12.1) and a parser update
(TASK-93.12.2). Without tests, schema drift or parser regressions would silently corrupt
`replayTraces` data in the loop-meta evaluator. This plan creates a standalone test script
covering both concerns.

## Phase 1: Scaffold test script
Create `scripts/test-daemon-event-schema.sh` as a bash test harness:
- Source or inline the `emit_event` helper logic from `plugin/loop-backlog/SKILL.md`
- Define a `assert_eq` helper function: `assert_eq() { [ "$1" = "$2" ] || { echo "FAIL: $3"; exit 1; }; }`
- Make the script executable: `chmod +x scripts/test-daemon-event-schema.sh`

### DoD
- [ ] `test -f /home/yale/work/baime/scripts/test-daemon-event-schema.sh`
- [ ] `test -x /home/yale/work/baime/scripts/test-daemon-event-schema.sh`

## Phase 2: Write emitter schema test
Add a test block to `scripts/test-daemon-event-schema.sh` that:
- Calls `emit_event task-ready TASK-99 Ready` (or equivalent) to a temp log file
- Reads the resulting JSON line and validates with jq:
  - `jq -e '.event == "task-ready"'`
  - `jq -e '.task_id == "TASK-99"'`
  - `jq -e '.prior_status == "Ready"'`
  - `jq -e '.timestamp | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T")'`

### DoD
- [ ] `grep -q 'task-ready\|emit_event' /home/yale/work/baime/scripts/test-daemon-event-schema.sh`
- [ ] `grep -q 'prior_status' /home/yale/work/baime/scripts/test-daemon-event-schema.sh`

## Phase 3: Write mixed-log and plain-text-only parser tests
Add two test blocks:
1. Mixed-log: create a temp file with one JSON line + one plain-text line, run
   `extract-replan-markers.sh` and assert exit 0 and that JSON fields appear in output.
2. Plain-text-only: create a temp file with only plain-text lines, run
   `extract-replan-markers.sh` and assert exit 0.

### DoD
- [ ] `grep -q 'mixed\|plain.text' /home/yale/work/baime/scripts/test-daemon-event-schema.sh`
- [ ] `bash /home/yale/work/baime/scripts/test-daemon-event-schema.sh`

## Phase 4: Run full validation suite
Ensure the new test file does not break any existing plugin validation.

### DoD
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`

## Constraints
- Tests must be self-contained and not require network access or running the actual daemon
- Use temp files (`mktemp`) for all test log files; clean up with `trap 'rm -f $TMPLOG' EXIT`
- Tests must pass on both macOS and Linux (no GNU-only date flags)

## Acceptance Gate
- [ ] `bash /home/yale/work/baime/scripts/test-daemon-event-schema.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED — all DoD and Acceptance Gate items are shell commands, phases ordered correctly (scaffold → schema test → parser test → validate), portability constraint is explicit.

parentTask: TASK-93.12
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f /home/yale/work/baime/scripts/test-daemon-event-schema.sh
- [ ] #2 test -x /home/yale/work/baime/scripts/test-daemon-event-schema.sh
- [ ] #3 grep -q 'task-ready\|emit_event' /home/yale/work/baime/scripts/test-daemon-event-schema.sh
- [ ] #4 grep -q 'prior_status' /home/yale/work/baime/scripts/test-daemon-event-schema.sh
- [ ] #5 grep -q 'mixed\|plain.text' /home/yale/work/baime/scripts/test-daemon-event-schema.sh
- [ ] #6 bash /home/yale/work/baime/scripts/test-daemon-event-schema.sh
- [ ] #7 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->
