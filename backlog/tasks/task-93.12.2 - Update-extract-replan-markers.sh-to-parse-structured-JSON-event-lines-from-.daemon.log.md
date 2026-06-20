---
id: TASK-93.12.2
title: >-
  Update extract-replan-markers.sh to parse structured JSON event lines from
  .daemon.log
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:54'
labels: []
dependencies: []
parent_task_id: TASK-93.12
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update extract-replan-markers.sh to parse structured NDJSON event lines emitted by the loop-backlog daemon.

**What:** Modify `scripts/extract-replan-markers.sh` to handle a mixed log file containing both plain-text lines and structured JSON lines (emitted by TASK-93.12.1). When a line starts with `{`, parse it as JSON and extract the `event`, `task_id`, `timestamp`, and `prior_status` fields for downstream consumption. Plain-text lines must continue to be processed by the existing logic unchanged. The script must not break if `.daemon.log` contains only plain-text lines (backward-compatible).

**Why:** The loop-meta evaluator's `replayTraces` function needs to consume structured event records from the log. Without this parser update, the evaluator cannot distinguish JSON event lines from plain-text and will silently skip transition provenance data. This is the second slice of TASK-93.12.

**How it fits the parent goal:** TASK-93.12 has three concerns: daemon emission (TASK-93.12.1), parser update (this task), and unit tests (TASK-93.12.3). This task delivers the parser slice, making JSON events consumable by downstream evaluator code.

**Done looks like:**
- `extract-replan-markers.sh` detects lines starting with `{` and parses them with `jq` (or portable awk/Python fallback).
- Lines not starting with `{` pass through the existing plain-text extraction logic unchanged.
- Running the script against a mixed log (both JSON and plain-text lines) produces correct output for both line types.
- A test with a log containing only plain-text lines produces the same output as the unmodified script.
- `bash scripts/validate-plugin.sh` passes.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Update extract-replan-markers.sh to parse structured JSON event lines from .daemon.log

## Context
`scripts/extract-replan-markers.sh` currently parses only plain-text `.daemon.log` lines.
The loop-backlog daemon will soon emit structured NDJSON lines (TASK-93.12.1). The loop-meta
evaluator's `replayTraces` function requires these JSON event records to reconstruct
per-transition provenance. This plan adds backward-compatible JSON-line handling.

## Phase 1: Read and understand current extract-replan-markers.sh
Read `scripts/extract-replan-markers.sh` to understand its current parsing logic, input format
assumptions, and output format. Identify the line-processing loop where the JSON-dispatch
branch will be inserted.

### DoD
- [ ] `test -f /home/yale/work/baime/scripts/extract-replan-markers.sh`

## Phase 2: Add JSON-line detection and parsing branch
Modify `scripts/extract-replan-markers.sh`:
- Before the existing plain-text logic, add a branch: `if echo "$line" | grep -q '^{'; then`
- Parse the JSON line with `jq -r '[.event, .task_id, .timestamp, .prior_status] | @tsv'`
  (or awk-based fallback if jq is unavailable)
- Emit parsed fields in a structured output line (tab-separated or as a named marker)
- `else` branch: run existing plain-text extraction unchanged

### DoD
- [ ] `grep -q 'grep -q.*\^{' /home/yale/work/baime/scripts/extract-replan-markers.sh`
- [ ] `grep -q 'prior_status\|\.event\|\.task_id' /home/yale/work/baime/scripts/extract-replan-markers.sh`

## Phase 3: Backward-compatibility smoke test
Create a temporary plain-text-only log file and verify the script output matches
pre-modification behavior (i.e., no new output lines introduced for plain-text-only input).

### DoD
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`

## Constraints
- Do not remove or alter any existing plain-text parsing logic
- The JSON branch must be a non-breaking addition — script must not error on plain-text-only input
- jq is the preferred JSON parser; an awk fallback is acceptable if jq is not guaranteed in PATH

## Acceptance Gate
- [ ] `grep -q 'grep -q.*\^{' /home/yale/work/baime/scripts/extract-replan-markers.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED — all DoD and Acceptance Gate items are shell commands, phases are ordered correctly (read before modify before test), backward-compat constraint is explicit.

parentTask: TASK-93.12
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f /home/yale/work/baime/scripts/extract-replan-markers.sh
- [ ] #2 grep -q 'grep -q.*\^{' /home/yale/work/baime/scripts/extract-replan-markers.sh
- [ ] #3 grep -q 'prior_status\|\.event\|\.task_id' /home/yale/work/baime/scripts/extract-replan-markers.sh
- [ ] #4 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->
