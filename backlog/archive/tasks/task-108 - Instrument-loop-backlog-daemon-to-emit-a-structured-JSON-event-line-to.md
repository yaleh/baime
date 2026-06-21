---
id: TASK-108
title: Instrument loop-backlog daemon to emit a structured JSON event line to
status: Meta-Plan
assignee: []
created_date: '2026-06-20 14:12'
updated_date: '2026-06-20 14:16'
labels: []
dependencies: []
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Instrument loop-backlog daemon to emit a structured JSON event line to .daemon.log for every task status transition (task-ready, done, needs-human), enabling provenance-stamped trace replay in the evaluator slice.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Structured JSON Event Emission in loop-backlog Daemon for Provenance-Stamped Trace Replay

## Background

The loop-backlog daemon (`scripts/loop-backlog-daemon.js`, currently v6) emits plain-text event lines such as `task-ready:TASK-N`, `meta-ready:TASK-N` to stdout, which are piped to `backlog/.daemon.log`. This format is adequate for human reading and simple `tail -f` consumption by Monitor, but it lacks the structured metadata needed by an evaluator that needs to reconstruct the task lifecycle from the log.

The evaluator slice in the experiment framework (TASK-93 family) requires trace-replay capability: given a `.daemon.log`, it must be able to reconstruct which task transitioned to which status, when, and what triggered the transition. With the current plain-text lines, there is no timestamp, no event type field, and no correlation back to the originating task status — making causal attribution impossible without re-reading individual task markdown files at each replay step.

Structured NDJSON (newline-delimited JSON) event lines emitted alongside or in place of the existing plain-text lines would give the evaluator a machine-parseable, self-describing record. Each event would carry: `ts` (ISO-8601 timestamp), `event` (event type string), `taskId`, and `status` (the status that triggered emission). The `extract-replan-markers.sh` script and any future evaluator scripts would parse these JSON lines to drive quantitative experiment metrics without needing filesystem access to task files at replay time.

## Goals

1. The evaluator can open `.daemon.log` and find NDJSON lines with fields `ts`, `event`, `taskId`, and `status` for every task status transition that triggered an emission (task-ready, meta-ready, wip-drop meta-ready).
2. The `extract-replan-markers.sh` script (or a successor) can parse `.daemon.log` NDJSON lines to extract transition timestamps and event types, enabling count-based and time-based metrics without re-reading task markdown files.
3. The daemon remains backward-compatible: plain-text event lines continue to be emitted so Monitor's `tail -f` pattern still works without changes to loop-backlog or loop-meta skill files.

## Decomposition Approach

- **Subject A — JSON event emission**: Modify `scripts/loop-backlog-daemon.js` to emit a structured NDJSON line immediately after each existing plain-text event line. Define the JSON schema (`ts`, `event`, `taskId`, `status`, optional `prevStatus` for meta-ready re-emissions).
- **Subject B — Parser update in extract-replan-markers.sh**: Update `scripts/extract-replan-markers.sh` to also scan `.daemon.log` for NDJSON event lines and include their transition counts in the report output.
- **Subject C — Unit tests**: Add test coverage to `scripts/loop-backlog-daemon.test.js` for the JSON event lines (correct schema, correct escaping, emitted on correct transitions).

## Trade-offs and Scope Limits

Plain-text event lines are preserved verbatim to avoid breaking Monitor's existing `grep 'task-ready:'` pattern. JSON lines are additional, not replacements. The daemon does not persist a separate structured log file — it writes to the same `stdout` that is already redirected to `.daemon.log` by `daemonBootstrap`. No new runtime dependencies are introduced; `JSON.stringify` is stdlib. The daemon version tag will be bumped to v7. Schema is flat (no nesting) to keep parsing trivial in bash (`grep | python -c` or `jq`).

---

# Implementation Plan: Structured JSON Event Emission in loop-backlog Daemon

## Subject A — JSON Event Emission in Daemon

**What**: Modify `scripts/loop-backlog-daemon.js` (v6 → v7) to emit a structured NDJSON line immediately after every existing plain-text event line. Each JSON line carries four required fields: `ts` (ISO-8601 UTC timestamp from `new Date().toISOString()`), `event` (string: `"task-ready"`, `"meta-ready"`, or `"wip-drop"`), `taskId` (string matching the task ID), and `status` (the current status string that triggered emission). For meta-ready re-emissions triggered by a status change, an optional `prevStatus` field captures the previous status. For wip-drop re-emissions, an additional `wip` integer field carries the current WIP count. The plain-text lines (`task-ready:TASK-N`, `meta-ready:TASK-N`) are preserved unchanged immediately before the JSON companion line. The daemon's internal `emitEvent(type, id, status, extras)` helper is extracted to centralise the two-line write pattern and avoid drift between the three emission sites (L0 task-ready loop, L1 meta-ready loop, wip-drop loop).

**Files**:
- `scripts/loop-backlog-daemon.js` — primary change; version tag bumped to `v7`
- `plugin/skills/loop-backlog/SKILL.md` — version reference in `ensureDaemonScript` section updated from `v6` to `v7` so the skill overwrites the file on next invocation

**Deliverable**: A running daemon (started via `daemonBootstrap`) whose `.daemon.log` contains interleaved plain-text and NDJSON lines. An evaluator can extract all JSON lines with `grep '^{' backlog/.daemon.log | jq .` and recover a complete, timestamped transition trace without touching any task markdown file.

**Estimated sub-tasks**: 1

---

## Subject B — NDJSON Parser in extract-replan-markers.sh

**What**: Update `scripts/extract-replan-markers.sh` to add a second scan pass that reads `backlog/.daemon.log` (if it exists) and extracts NDJSON event lines. For each parsed line, the script emits a row to stdout showing: task ID, event type, status, and timestamp. Counts are accumulated per event type (`task-ready`, `meta-ready`, `wip-drop`) and reported in the summary block alongside the existing replan-marker counts. The script uses only POSIX tools available without extra installs: `grep`, `python3 -c` (for JSON parsing — available on all Claude Code hosts), or a regex-based fallback if python3 is absent. The `.daemon.log` path is resolved relative to the repo root, not the script's own directory, to match where `daemonBootstrap` writes it.

**Files**:
- `scripts/extract-replan-markers.sh` — add NDJSON scan pass and summary section

**Deliverable**: Running `bash scripts/extract-replan-markers.sh` against a repo whose `backlog/.daemon.log` contains JSON lines produces a "Daemon Event Transitions" section listing per-event-type counts and the most recent timestamp for each task ID seen in the log.

**Estimated sub-tasks**: 1

---

## Subject C — Unit Tests for JSON Event Schema

**What**: Extend `scripts/loop-backlog-daemon.test.js` with tests that exercise the JSON event emission logic. Because the daemon is a long-running process, the tests inline the `emitEvent` helper (keeping it in sync with the daemon, the same pattern already used for `parseTaskId`, `isReady`, and `scanReadyIds`). Tests assert: (1) the JSON line is valid JSON; (2) required fields `ts`, `event`, `taskId`, `status` are all present and have the correct types; (3) `ts` is a valid ISO-8601 string; (4) `event` values match the enum `task-ready | meta-ready | wip-drop`; (5) a task ID containing special characters does not break JSON serialisation; (6) the companion plain-text line is emitted before the JSON line when both are produced together (output ordering). Tests run with `node scripts/loop-backlog-daemon.test.js` and exit non-zero on any failure.

**Files**:
- `scripts/loop-backlog-daemon.test.js` — add JSON schema test suite section

**Deliverable**: `node scripts/loop-backlog-daemon.test.js` exits 0 and prints passing assertions for the new JSON schema suite alongside the existing `parseTaskId`, `isReady`, and `scanReadyIds` suites.

**Estimated sub-tasks**: 1

---

## Acceptance Criteria

1. After starting the daemon against a backlog directory that contains at least one task transitioning from Backlog to Ready, `backlog/.daemon.log` contains NDJSON lines whose `event`, `taskId`, `status`, and `ts` fields correctly describe each transition — verifiable by an evaluator reading the log file alone, without inspecting task markdown files.

2. `bash scripts/extract-replan-markers.sh` completes without error when `backlog/.daemon.log` is absent (graceful skip) and, when the log contains NDJSON lines, the script's output includes a "Daemon Event Transitions" section with correct per-type counts matching the number of JSON lines in the log.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Drafting implementation plan.

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->
