---
id: TASK-97.3
title: Add unit tests for loop-backlog-daemon.js JSON event emission format
status: Backlog
assignee: []
created_date: '2026-06-20 10:38'
updated_date: '2026-06-20 10:49'
labels: []
dependencies: []
parent_task_id: TASK-97
ordinal: 112000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write unit tests that verify loop-backlog-daemon.js emits correctly structured JSON event lines for each of the three transition types: task-ready, done, needs-human. Tests should parse the emitted NDJSON and assert the required fields (event, taskId, ts, worktree) are present and correctly typed.

Parent goal: TASK-97 — Instrument loop-backlog daemon to emit structured JSON event lines to .daemon.log for every task status transition, enabling provenance-stamped trace replay in the evaluator slice.

Why it exists: Without automated tests, the JSON schema can silently drift when the daemon is modified. Tests lock in the contract between the emitter (daemon) and the consumer (extract-replan-markers.sh / evaluator slice).

How it fits: This is the verification layer. It depends on TASK-97.1 (emission) and TASK-97.2 (parser). Tests confirm both the emitter output schema and that the parser handles the emitted format correctly. These tests are the final quality gate before the feature is considered done.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add unit tests for loop-backlog-daemon.js JSON event emission format

## Context
After TASK-97.1 adds JSON emission and TASK-97.2 updates the parser, this task adds automated tests to lock in the JSON schema contract. Tests prevent silent drift when the daemon or parser is later modified.

## Phase 1: Explore existing test infrastructure
Check plugin/loop-backlog/ for any existing test files, package.json (test runner), or test conventions. Determine whether to use Node's built-in test runner, jest, or a bash-based test harness.

### DoD
- [ ] `find plugin/loop-backlog -name 'package.json' -o -name '*.test.*' -o -name '*spec*' | grep -q . || test -f plugin/loop-backlog/package.json`

## Phase 2: Write tests for JSON event emission
Create a test file (e.g., loop-backlog-daemon.test.js or test-daemon-events.sh) that:
1. Imports or sources the daemon's emitEvent helper (or runs a dry-run cycle)
2. Captures output written to a temp .daemon.log
3. Parses each JSON line and asserts: event field is one of task-ready/done/needs-human, taskId is a non-empty string, ts is an ISO-8601 string, worktree is a non-empty string

### DoD
- [ ] `find plugin/loop-backlog -name '*.test.*' -o -name 'test-daemon-events*' | grep -q .`
- [ ] `grep -q 'task-ready\|done\|needs-human' $(find plugin/loop-backlog -name '*.test.*' -o -name 'test-daemon-events*' | head -1)`

## Phase 3: Write tests for JSON parser in extract-replan-markers.sh
Add a test or test section that pipes sample NDJSON lines through extract-replan-markers.sh and asserts the correct fields are extracted. Use a fixture file of known JSON lines.

### DoD
- [ ] `grep -q 'extract-replan\|replan' $(find plugin/loop-backlog -name '*.test.*' -o -name 'test-daemon-events*' | head -1)`

## Phase 4: Ensure tests pass and validate plugin
Run all tests and the project validation gate.

### DoD
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- Tests must be runnable without network access
- Use a temp directory for .daemon.log output in tests — do not write to the real log
- Tests must not start the actual daemon event loop

## Acceptance Gate
- [ ] `find plugin/loop-backlog -name '*.test.*' -o -name 'test-daemon-events*' | grep -q .`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-97
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 find plugin/loop-backlog -name '*.test.*' -o -name '*test*' | grep -q .
- [ ] #2 bash scripts/validate-plugin.sh
<!-- DOD:END -->
