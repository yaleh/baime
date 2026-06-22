---
id: TASK-104.3
title: >-
  Update evaluator documentation to reference trace-log.jsonl as the
  trace_replay data source
status: Backlog
assignee: []
created_date: '2026-06-20 10:40'
updated_date: '2026-06-20 10:41'
labels: []
dependencies: []
parent_task_id: TASK-104
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the loop-meta evaluator documentation in plugin/skills/loop-meta/SKILL.md to specify that the trace_replay slice (replayTraces function) reads its execution log data from experiments/skill-quality/artifacts/trace-log.jsonl. Currently SKILL.md defines the replayTraces call but does not document the concrete data source path or the expected record schema. This makes the evaluator's trace slice underdocumented for implementers.

Why: Once TASK-104.1 produces trace-log.jsonl and TASK-104.2 validates its schema, the evaluator's trace_replay slice needs its documentation updated so that implementers know where to find the trace data and what schema to expect. Without this, the link from the evaluator spec to the actual artifact is invisible.

How it fits: This is sub-task 3 of 3 in TASK-104. It is the consumer-side documentation completing the full pipeline: production (104.1) → validation (104.2) → documented consumption (104.3).

parentTask: TASK-104
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Update evaluator documentation to reference trace-log.jsonl as the trace_replay data source

## Context
`plugin/skills/loop-meta/SKILL.md` defines `replayTraces(metaId)` as the trace_replay slice of the evaluator (line ~299), but nowhere specifies the concrete data source file path or the expected record schema. TASK-104.1 produces `experiments/skill-quality/artifacts/trace-log.jsonl` with schema `{fixture_id, skill, tool_calls, verdict, timestamp}`. This task makes that link explicit in the spec.

## Phase 1: Read the relevant section of SKILL.md
Read the evaluator section (lines ~288–313) to identify the exact insertion point for the documentation update.

### DoD
- `grep -q 'replayTraces' plugin/skills/loop-meta/SKILL.md`
- `grep -n 'trace_replay\|replayTraces' plugin/skills/loop-meta/SKILL.md`

## Phase 2: Insert trace_replay data source documentation
Edit `plugin/skills/loop-meta/SKILL.md` to add a comment block immediately before or after the `trace_replay` slice type comment (near line 294) that documents:
1. The concrete data source file: `experiments/skill-quality/artifacts/trace-log.jsonl`
2. The expected record schema: `{fixture_id: string, skill: string, tool_calls: array, verdict: PASS|FAIL|dry-run, timestamp: ISO-8601}`
3. How replayTraces uses the file: filters records by meta-task's child skill names, checks that at least one PASS verdict exists per child fixture_id.

Add a `replayTraces` pseudo-definition below the `evaluator` block:
```
-- replayTraces: reads experiments/skill-quality/artifacts/trace-log.jsonl
-- Record schema: {fixture_id: string, skill: string, tool_calls: array,
--                 verdict: "PASS"|"FAIL"|"dry-run", timestamp: ISO-8601}
-- Returns Passed if ≥1 PASS record exists for each skill in doneChildren;
-- returns Failed with reason listing missing skills otherwise.
replayTraces :: TaskId → TraceSlice
replayTraces(metaId) = {
  logPath : "experiments/skill-quality/artifacts/trace-log.jsonl",
  records : readJsonl(logPath),  -- validated by validate-trace-log.sh
  skills  : [child.skill | child ← getChildren(metaId), status(child) = Done],
  covered : [s | s ← skills, ∃r ∈ records: r.skill = s ∧ r.verdict = "PASS"],
  missing : skills \ covered,
  return: if empty(missing): TraceSlice{label: "Passed", data_source: "measured"}
          else: TraceSlice{label: "Failed",
                           reason: "no PASS trace for: " + join(", ", missing),
                           data_source: "measured"}
}
```

### DoD
- `grep -q 'trace-log.jsonl' plugin/skills/loop-meta/SKILL.md`
- `grep -q 'replayTraces' plugin/skills/loop-meta/SKILL.md`
- `grep -q 'fixture_id.*skill.*tool_calls\|fixture_id: string' plugin/skills/loop-meta/SKILL.md`

## Phase 3: Run plugin validation
Confirm that the SKILL.md edit passes the plugin validation suite.

### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- Only edit `plugin/skills/loop-meta/SKILL.md` — do not change run-class-d.ts or the validator script in this sub-task
- The existing evaluator block must remain structurally intact; only add the replayTraces documentation block
- No code execution — this is a documentation-only change

## Acceptance Gate
- `grep -q 'trace-log.jsonl' plugin/skills/loop-meta/SKILL.md && grep -q 'replayTraces' plugin/skills/loop-meta/SKILL.md && bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-104

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'replayTraces' plugin/skills/loop-meta/SKILL.md
- [ ] #2 grep -q 'trace-log.jsonl' plugin/skills/loop-meta/SKILL.md
- [ ] #3 grep -q 'fixture_id.*skill.*tool_calls\|fixture_id: string' plugin/skills/loop-meta/SKILL.md
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->
