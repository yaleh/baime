---
id: TASK-93.12.1
title: >-
  Instrument loop-backlog daemon to emit structured NDJSON events for task
  status transitions
status: Backlog
assignee: []
created_date: '2026-06-20 10:52'
updated_date: '2026-06-20 10:53'
labels: []
dependencies: []
parent_task_id: TASK-93.12
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add structured NDJSON event emission to the loop-backlog daemon for task status transitions.

**What:** Instrument the loop-backlog daemon (plugin/loop-backlog skill) to emit a structured NDJSON event line to `.daemon.log` on every task status transition. Each emitted line must be valid JSON with fields: `event` (string: "task-ready" | "done" | "needs-human"), `task_id` (string), `timestamp` (ISO-8601 string), and `prior_status` (string). Non-JSON lines already in the log must remain untouched — new JSON lines are appended alongside any existing plain-text output.

**Why:** This is a prerequisite for TASK-93.12 (Exp-K subject 2). Provenance-stamped trace replay in the loop-meta evaluator (`replayTraces` function in SKILL.md) requires machine-readable event records. Without structured emission, the evaluator cannot reconstruct per-transition provenance or compute replan trigger rates.

**How it fits the parent goal:** TASK-93.12 instruments the daemon, updates the parser, and adds tests. This sub-task covers the daemon instrumentation slice only, establishing the schema contract that the parser and tests depend on.

**Done looks like:**
- Every task status transition (task-ready, done, needs-human) appends one JSON line to `.daemon.log`.
- The JSON line validates against the schema: `{event, task_id, timestamp, prior_status}` with correct types.
- Existing plain-text lines are preserved; the file remains a mixed NDJSON + plain-text log.
- A manual smoke-test command (e.g. `grep '^{' .daemon.log | jq .`) shows parseable JSON records for a real run.
- No regressions in existing loop-backlog behavior (validate-plugin.sh passes).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Instrument loop-backlog daemon to emit structured NDJSON events for task status transitions

## Context
The loop-backlog daemon currently writes plain-text log lines. The loop-meta evaluator's
`replayTraces` function requires machine-readable, provenance-stamped records to reconstruct
per-transition history and compute replan trigger rates. Adding JSON emission unblocks TASK-93.12.

## Phase 1: Locate and understand the daemon's status-transition code
Read the loop-backlog skill files to identify where task status transitions are written
(task-ready, done, needs-human). Check `plugin/loop-backlog/SKILL.md` and any shell
scripts under `plugin/loop-backlog/` for the log-write points.

### DoD
- [ ] `grep -rq 'daemon\.log\|task-ready\|needs-human' /home/yale/work/baime/plugin/loop-backlog/`

## Phase 2: Add JSON emission helper and instrument transition sites
Add a `emit_event()` shell function (or equivalent) to the daemon script that:
- Accepts arguments: event, task_id, prior_status
- Constructs ISO-8601 timestamp via `date -u +%Y-%m-%dT%H:%M:%SZ`
- Appends a single JSON line: `{"event":"<event>","task_id":"<id>","timestamp":"<ts>","prior_status":"<prior>"}` to `.daemon.log`
- Calls `emit_event` at each of the three transition sites (task-ready, done, needs-human)

### DoD
- [ ] `grep -q 'emit_event\|emit_json' /home/yale/work/baime/plugin/loop-backlog/SKILL.md`
- [ ] `grep -q '"event"' /home/yale/work/baime/plugin/loop-backlog/SKILL.md`

## Phase 3: Validate no regressions
Run the full plugin validation suite to confirm no regressions and that the new code
is syntactically correct within the skill definition.

### DoD
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`

## Constraints
- Do not alter any existing plain-text log lines — append-only, backward-compatible
- Do not introduce external dependencies (jq is assumed available for tests, not runtime)
- Schema must exactly match: `{event, task_id, timestamp, prior_status}` with no extra fields

## Acceptance Gate
- [ ] `grep -q 'prior_status' /home/yale/work/baime/plugin/loop-backlog/SKILL.md`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED — all DoD items are shell commands, absence-check antipattern removed, phases are ordered and scoped correctly.

parentTask: TASK-93.12
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -rq 'daemon\.log\|task-ready\|needs-human' /home/yale/work/baime/plugin/loop-backlog/
- [ ] #2 grep -q 'emit_event\|emit_json' /home/yale/work/baime/plugin/loop-backlog/SKILL.md
- [ ] #3 grep -q '"event"' /home/yale/work/baime/plugin/loop-backlog/SKILL.md
- [ ] #4 grep -q 'prior_status' /home/yale/work/baime/plugin/loop-backlog/SKILL.md
- [ ] #5 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->
