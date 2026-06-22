---
id: TASK-97.1
title: >-
  Add structured JSON event emission to loop-backlog-daemon.js for task status
  transitions
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:37'
labels: []
dependencies: []
parent_task_id: TASK-97
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modify plugin/loop-backlog/loop-backlog-daemon.js to emit a newline-delimited JSON (NDJSON) event line to .daemon.log whenever a task transitions status. Each emitted line must include: { "event": "<event-type>", "taskId": "<id>", "ts": "<ISO-8601>", "worktree": "<path>" }. Event types: "task-ready" (task picked up from Ready queue), "done" (task completed and merged), "needs-human" (task escalated).

Parent goal: TASK-97 — Instrument loop-backlog daemon to emit structured JSON event lines to .daemon.log for every task status transition, enabling provenance-stamped trace replay in the evaluator slice.

Why it exists: The evaluator slice needs machine-readable traces of task lifecycle events. Plain text logs cannot be reliably parsed; structured JSON is required for provenance-stamped replay.

How it fits: This is the core emission layer. Sub-tasks for parser update and unit tests both depend on the JSON format stabilised here.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add structured JSON event emission to loop-backlog-daemon.js for task status transitions

## Context
The loop-backlog daemon currently logs task transitions in unstructured plain text. The evaluator slice (check-roi-gate.sh and related tooling) needs machine-readable provenance traces. This task adds NDJSON emission to .daemon.log at three transition points: task-ready, done, and needs-human.

## Phase 1: Understand current daemon logging structure
Read plugin/loop-backlog/loop-backlog-daemon.js to identify where task status transitions occur and how logging is currently done. Identify the LOG_FILE variable and the three transition points to instrument.

### DoD
- [ ] `grep -q 'LOG_FILE\|daemon\.log\|log\b' plugin/loop-backlog/loop-backlog-daemon.js`

## Phase 2: Add JSON schema constant and emit function
Edit loop-backlog-daemon.js to add a JSON schema constant (inline comment) and an emitEvent(eventType, taskId, worktree) helper that appends a newline-delimited JSON line to LOG_FILE. The schema: { "event": "<event-type>", "taskId": "<id>", "ts": "<ISO-8601>", "worktree": "<path>" }.

### DoD
- [ ] `grep -q 'emitEvent\|emit_event\|JSON\.stringify\|json_event' plugin/loop-backlog/loop-backlog-daemon.js`
- [ ] `grep -q '"event"\|event:' plugin/loop-backlog/loop-backlog-daemon.js`

## Phase 3: Instrument the three transition points
Call emitEvent at each transition: (a) when a task is picked from Ready queue → "task-ready", (b) when a task completes and merges → "done", (c) when a task is escalated → "needs-human". Ensure the .daemon.log append is non-blocking (no crash if file unwritable).

### DoD
- [ ] `grep -q 'task-ready' plugin/loop-backlog/loop-backlog-daemon.js`
- [ ] `grep -q '"done"\|done.*emit\|emit.*done' plugin/loop-backlog/loop-backlog-daemon.js`
- [ ] `grep -q 'needs-human' plugin/loop-backlog/loop-backlog-daemon.js`

## Phase 4: Validate with plugin validation
Run the project validation gate to confirm no contracts are broken.

### DoD
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- Do not change the existing plain-text log lines (additive only)
- emitEvent must be synchronous-safe (use appendFileSync or equivalent)
- The .daemon.log path must follow the existing LOG_FILE convention — do not hardcode

## Acceptance Gate
- [ ] `grep -qE 'task-ready' plugin/loop-backlog/loop-backlog-daemon.js`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-97
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'LOG_FILE\|daemon\.log\|log\b' plugin/loop-backlog/loop-backlog-daemon.js
- [ ] #2 grep -q 'emitEvent\|emit_event\|JSON\.stringify\|json_event' plugin/loop-backlog/loop-backlog-daemon.js
- [ ] #3 grep -q '"event"\|event:' plugin/loop-backlog/loop-backlog-daemon.js
- [ ] #4 grep -q 'task-ready' plugin/loop-backlog/loop-backlog-daemon.js
- [ ] #5 grep -q '"done"\|done.*emit\|emit.*done' plugin/loop-backlog/loop-backlog-daemon.js
- [ ] #6 grep -q 'needs-human' plugin/loop-backlog/loop-backlog-daemon.js
- [ ] #7 bash scripts/validate-plugin.sh
<!-- DOD:END -->
