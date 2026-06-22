---
id: TASK-104.1
title: Extend Class-D runner to write trace-log.jsonl entries after each fixture run
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:38'
labels: []
dependencies: []
parent_task_id: TASK-104
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modify the Class-D test framework runner (in experiments/skill-quality/) so that after each fixture run completes, it appends a structured JSON record to experiments/skill-quality/artifacts/trace-log.jsonl. Each record must include the fields: fixture_id, skill, tool_calls, verdict, and timestamp.

Why: The evaluator's trace_replay slice needs a machine-readable audit trail of every fixture execution to replay and analyze tool-call sequences. Without this file, the evaluator cannot perform trace-based analysis. This sub-task is the core instrumentation work required by parent task TASK-104.

How it fits: TASK-104 adds a per-skill execution-trace log to the Class-D test framework. This sub-task is the first and most critical piece: actually producing the trace data. The schema validator sub-task and the evaluator documentation sub-task both depend on this file existing.

parentTask: TASK-104
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Extend Class-D runner to write trace-log.jsonl entries after each fixture run

## Context
The Class-D runner (`experiments/skill-quality/scripts/run-class-d.ts`) currently writes only a single `exp-class-d-results.json` summary. The evaluator's trace_replay slice needs a per-run structured JSONL log at `experiments/skill-quality/artifacts/trace-log.jsonl` with fields `{fixture_id, skill, tool_calls, verdict, timestamp}` to replay and analyse tool-call sequences per fixture.

## Phase 1: Understand the existing output structure and artifact path
Read `run-class-d.ts` to identify the per-fixture loop and the artifact write path, and confirm `artifacts/` directory exists.

### DoD
- `test -f experiments/skill-quality/scripts/run-class-d.ts`
- `test -d experiments/skill-quality/artifacts`

## Phase 2: Add trace-log append logic to the Class-D runner
Edit `experiments/skill-quality/scripts/run-class-d.ts` to:
1. Import `appendFile` from `node:fs/promises` alongside existing imports.
2. Define the trace-log path constant: `const TRACE_LOG = join(EXP_ROOT, 'artifacts', 'trace-log.jsonl');`
3. After each fixture run (inside the `for (const fixture of fixtures)` loop, after `per_fixture.push(...)`) append a JSON record:
   ```ts
   const traceRecord = {
     fixture_id: fixture.id,
     skill: fixture.skill,
     tool_calls: per_fixture[per_fixture.length - 1]!.passes + per_fixture[per_fixture.length - 1]!.failures,
     verdict: DRY_RUN ? 'dry-run' : (per_fixture[per_fixture.length - 1]!.compliance_rate !== null && per_fixture[per_fixture.length - 1]!.compliance_rate! >= 0.9 ? 'PASS' : 'FAIL'),
     timestamp: new Date().toISOString(),
   };
   await appendFile(TRACE_LOG, JSON.stringify(traceRecord) + '\n');
   ```
   Note: `tool_calls` should record the actual ToolBlock array from the last run trace (capture `trace` variable from the inner run loop at the outer fixture scope). Adjust so `tool_calls` is the array of `{tool_name, position}` objects for the last run's trace.

### DoD
- `grep -q 'trace-log.jsonl' experiments/skill-quality/scripts/run-class-d.ts`
- `grep -q 'appendFile' experiments/skill-quality/scripts/run-class-d.ts`
- `grep -q 'fixture_id' experiments/skill-quality/scripts/run-class-d.ts`

## Phase 3: Verify TypeScript compiles cleanly
Run the TypeScript compiler check to ensure no type errors were introduced.

### DoD
- `cd experiments/skill-quality && npx tsc --noEmit 2>&1 | grep -c error | grep -q '^0$'`

## Phase 4: Run dry-run and verify trace-log.jsonl is produced
Execute the runner in dry-run mode and confirm the trace-log file is created with valid JSONL records.

### DoD
- `cd experiments/skill-quality && npx tsx scripts/run-class-d.ts --dry-run`
- `test -f experiments/skill-quality/artifacts/trace-log.jsonl`
- `python3 -c "import json,sys; records=[json.loads(l) for l in open('experiments/skill-quality/artifacts/trace-log.jsonl') if l.strip()]; assert all(set(['fixture_id','skill','tool_calls','verdict','timestamp']).issubset(r.keys()) for r in records), 'missing fields'; print(f'{len(records)} valid records')"`

## Constraints
- Do not change the existing `exp-class-d-results.json` output format
- Do not alter compliance-checking logic or fixture loading
- `tool_calls` field must be the array of ToolBlock objects from the last run, not a count
- In dry-run mode, `tool_calls` will be an empty array (acceptable)

## Acceptance Gate
- `test -f experiments/skill-quality/artifacts/trace-log.jsonl && python3 -c "import json; records=[json.loads(l) for l in open('experiments/skill-quality/artifacts/trace-log.jsonl') if l.strip()]; assert len(records)>0; assert all('fixture_id' in r and 'skill' in r and 'tool_calls' in r and 'verdict' in r and 'timestamp' in r for r in records); print('PASS')"`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-104

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f experiments/skill-quality/scripts/run-class-d.ts
- [ ] #2 test -d experiments/skill-quality/artifacts
- [ ] #3 grep -q 'trace-log.jsonl' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #4 grep -q 'appendFile' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #5 grep -q 'fixture_id' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #6 cd experiments/skill-quality && npx tsc --noEmit 2>&1 | grep -c error | grep -q '^0$'
- [ ] #7 test -f experiments/skill-quality/artifacts/trace-log.jsonl
- [ ] #8 python3 -c "import json,sys; records=[json.loads(l) for l in open('experiments/skill-quality/artifacts/trace-log.jsonl') if l.strip()]; assert all(set(['fixture_id','skill','tool_calls','verdict','timestamp']).issubset(r.keys()) for r in records), 'missing fields'; print(f'{len(records)} valid records')"
- [ ] #9 bash scripts/validate-plugin.sh
<!-- DOD:END -->
