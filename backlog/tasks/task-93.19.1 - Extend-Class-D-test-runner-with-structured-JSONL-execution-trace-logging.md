---
id: TASK-93.19.1
title: Extend Class-D test runner with structured JSONL execution trace logging
status: Backlog
assignee: []
created_date: '2026-06-20 10:52'
updated_date: '2026-06-20 10:53'
labels:
  - observability
  - Exp-K
dependencies: []
parent_task_id: TASK-93.19
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modify experiments/skill-quality/scripts/run-class-d.ts to append a JSONL record to experiments/skill-quality/artifacts/trace-log.jsonl after every fixture run. Each record must include: { fixture_id, skill, verdict, elapsed_ms, timestamp }.

Why: Without a structured, machine-readable execution trace there is no auditable history of Class-D runs. The trace log is the raw evidence base that the methodology maturity scorecard (sibling sub-task) will consume.

Parent: TASK-93.19 — two observability additions: trace logging (this task) + maturity scorecard (sibling).

## Implementation Plan

### Phase 1: Audit current runner and identify insertion points
Read experiments/skill-quality/scripts/run-class-d.ts in full. Identify: (a) where each fixture result is recorded, (b) what data is already available (fixture id, skill name, verdict, elapsed time). Note any helper types or result objects already defined.

DoD:
- test -f experiments/skill-quality/scripts/run-class-d.ts
- grep -q 'fixture' experiments/skill-quality/scripts/run-class-d.ts

### Phase 2: Implement JSONL append in run-class-d.ts
After each fixture completes, append one JSON line to experiments/skill-quality/artifacts/trace-log.jsonl. Fields: fixture_id (string), skill (string), verdict ("Met"|"NotMet"|"Skip"), elapsed_ms (number), timestamp (ISO-8601 string). Create the artifacts directory if absent. Use fs.appendFileSync for safety.

DoD:
- grep -q 'trace-log.jsonl' experiments/skill-quality/scripts/run-class-d.ts
- grep -q 'appendFileSync' experiments/skill-quality/scripts/run-class-d.ts
- grep -q 'elapsed_ms' experiments/skill-quality/scripts/run-class-d.ts

### Phase 3: Write schema validator script
Create scripts/validate-trace-log.sh. Parse each line of trace-log.jsonl as JSON; exit non-zero printing the offending line if any record is missing a required field or has a wrong type. If the file does not exist exit 0.

DoD:
- test -f scripts/validate-trace-log.sh
- bash scripts/validate-trace-log.sh
- grep -q 'fixture_id' scripts/validate-trace-log.sh

### Phase 4: Integrate validator into validate-plugin.sh
Add call to bash scripts/validate-trace-log.sh inside validate-plugin.sh.

DoD:
- grep -q 'validate-trace-log' scripts/validate-plugin.sh
- bash scripts/validate-plugin.sh
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-trace-log.sh
- [ ] #2 bash scripts/validate-plugin.sh
- [ ] #3 grep -q 'trace-log.jsonl' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #4 grep -q 'elapsed_ms' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #5 test -f scripts/validate-trace-log.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.19
<!-- SECTION:NOTES:END -->
