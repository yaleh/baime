---
id: TASK-93.12
title: 'Exp-K subject 2: loop-backlog daemon structured JSON event emission'
status: Backlog
assignee: []
created_date: '2026-06-20 10:50'
updated_date: '2026-06-20 10:55'
labels: []
dependencies: []
parent_task_id: TASK-93
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Instrument the loop-backlog daemon to emit a structured NDJSON event line to .daemon.log for every task status transition (task-ready, done, needs-human). Each record must carry fields: event, task_id, timestamp (ISO-8601), and prior_status. Update extract-replan-markers.sh to parse these JSON lines in a backward-compatible way. Add unit tests covering both the emitter schema and the parser's ability to handle mixed plain-text and JSON log lines. This enables provenance-stamped trace replay in the evaluator slice (loop-meta SKILL.md replayTraces function).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 3 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.

- TASK-93.12.1: Instrument loop-backlog daemon to emit structured NDJSON events for task status transitions
- TASK-93.12.2: Update extract-replan-markers.sh to parse structured JSON event lines from .daemon.log
- TASK-93.12.3: Add unit tests for loop-backlog JSON event emitter schema and mixed-log parser in extract-replan-markers.sh
<!-- SECTION:NOTES:END -->
