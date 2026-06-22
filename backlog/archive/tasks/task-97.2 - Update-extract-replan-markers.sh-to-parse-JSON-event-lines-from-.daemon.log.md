---
id: TASK-97.2
title: Update extract-replan-markers.sh to parse JSON event lines from .daemon.log
status: Backlog
assignee: []
created_date: '2026-06-20 10:38'
updated_date: '2026-06-20 10:49'
labels: []
dependencies: []
parent_task_id: TASK-97
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update plugin/loop-backlog/extract-replan-markers.sh (or the equivalent parser script) to recognise and parse the new NDJSON event lines emitted by loop-backlog-daemon.js. The script must extract event fields (event, taskId, ts, worktree) from each JSON line and make them available for downstream evaluator/replan logic.

Parent goal: TASK-97 — Instrument loop-backlog daemon to emit structured JSON event lines to .daemon.log for every task status transition, enabling provenance-stamped trace replay in the evaluator slice.

Why it exists: Once the daemon emits structured JSON, the evaluator toolchain must consume it. The existing extract-replan-markers.sh uses plain-text patterns; it needs JSON-aware parsing so the evaluator slice can replay task transitions by taskId and timestamp.

How it fits: This is the consumer layer. It depends on TASK-97.1 (JSON emission) and feeds provenance data into the evaluator. Unit tests (TASK-97.3) will verify the parser output.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Update extract-replan-markers.sh to parse JSON event lines from .daemon.log

## Context
The loop-backlog daemon will emit NDJSON event lines after TASK-97.1. The evaluator slice currently uses extract-replan-markers.sh with plain-text grep patterns. This task upgrades the script to parse JSON fields, enabling typed extraction of event, taskId, ts, and worktree for provenance replay.

## Phase 1: Locate and read the current parser script
Find and read plugin/loop-backlog/extract-replan-markers.sh. Understand the current plain-text parsing approach and what downstream scripts consume its output.

### DoD
- [ ] `test -f plugin/loop-backlog/extract-replan-markers.sh`

## Phase 2: Identify JSON tool availability
Determine whether jq, python3, or node is available in the script's expected environment. Choose the most portable JSON parsing approach (prefer jq if available, fall back to python3 -c or node -e).

### DoD
- [ ] `grep -q 'jq\|python3\|node' plugin/loop-backlog/extract-replan-markers.sh`

## Phase 3: Add JSON line detection and field extraction
Edit extract-replan-markers.sh to detect NDJSON lines (lines starting with '{') from .daemon.log and extract the event, taskId, ts, and worktree fields. Preserve existing plain-text parsing for backward compatibility with old log lines.

### DoD
- [ ] `grep -q 'event\|taskId\|json\|JSON' plugin/loop-backlog/extract-replan-markers.sh`
- [ ] `grep -q 'task-ready\|done\|needs-human' plugin/loop-backlog/extract-replan-markers.sh`

## Phase 4: Validate with plugin validation
Run the project validation gate to confirm no contracts are broken.

### DoD
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- Backward compatible: existing plain-text log lines must still be parsed correctly
- Do not require jq as a hard dependency; provide a fallback
- Output format must be consumable by the evaluator slice (check-roi-gate.sh)

## Acceptance Gate
- [ ] `grep -q 'event\|taskId\|json\|JSON' plugin/loop-backlog/extract-replan-markers.sh`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-97
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f plugin/loop-backlog/extract-replan-markers.sh
- [ ] #2 grep -q 'event\|taskId\|json\|JSON' plugin/loop-backlog/extract-replan-markers.sh
- [ ] #3 bash scripts/validate-plugin.sh
<!-- DOD:END -->
