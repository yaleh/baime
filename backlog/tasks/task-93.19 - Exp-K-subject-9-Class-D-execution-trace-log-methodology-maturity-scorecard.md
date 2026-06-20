---
id: TASK-93.19
title: 'Exp-K subject 9: Class-D execution trace log + methodology maturity scorecard'
status: Backlog
assignee: []
created_date: '2026-06-20 10:50'
updated_date: '2026-06-20 10:53'
labels: []
dependencies: []
parent_task_id: TASK-93
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two related observability additions: (1) Extend the Class-D test runner (experiments/skill-quality/scripts/run-class-d.ts) to append a structured JSONL trace record after each fixture run to experiments/skill-quality/artifacts/trace-log.jsonl, with fields {fixture_id, skill, verdict, elapsed_ms, timestamp}. Add a schema validator scripts for the trace log. (2) Build a methodology maturity scorecard: scan all backlog tasks tagged Exp-*, extract Met/NotMet verdicts from task notes, apply OCA convergence criteria, and generate docs/methodology-maturity.md with an evidence-strength table and a P0 zero-evidence section. Add a scripts/check-p0-evidence.sh gate that exits non-zero if any P0 claim has zero Met verdicts, and integrate it into validate-plugin.sh.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 2 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.

Sub-tasks:
- TASK-93.19.1: Extend Class-D test runner with structured JSONL execution trace logging
- TASK-93.19.2: Build methodology maturity scorecard from Exp-* task verdicts
<!-- SECTION:NOTES:END -->
