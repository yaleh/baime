---
id: TASK-104.2
title: Add trace-log.jsonl schema validator for Class-D execution trace records
status: Backlog
assignee: []
created_date: '2026-06-20 10:39'
updated_date: '2026-06-20 10:39'
labels: []
dependencies: []
parent_task_id: TASK-104
ordinal: 113000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a schema validator script that checks every record in experiments/skill-quality/artifacts/trace-log.jsonl conforms to the required schema: each line must be valid JSON with exactly the fields fixture_id (string), skill (string), tool_calls (array), verdict (string), timestamp (ISO-8601 string).

Why: Once the Class-D runner writes trace records (TASK-104.1), we need a lightweight validator to catch schema drift early — e.g. missing fields, wrong types, malformed timestamps — before the evaluator's trace_replay slice ingests the file.

How it fits: TASK-104 requires all three sub-tasks for completeness. This sub-task (2 of 3) adds the validation gate between trace production (TASK-104.1) and evaluator consumption (TASK-104.3 documentation). The validator can be run in CI or manually before evaluator runs.

parentTask: TASK-104
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add trace-log.jsonl schema validator for Class-D execution trace records

## Context
TASK-104.1 extends the Class-D runner to produce `experiments/skill-quality/artifacts/trace-log.jsonl`. This task adds a validator script so schema conformance can be checked before the evaluator's trace_replay slice ingests the file, preventing silent failures from malformed records.

## Phase 1: Create the validator script
Create `experiments/skill-quality/scripts/validate-trace-log.sh` as a standalone bash script that:
1. Accepts an optional path argument (defaults to `experiments/skill-quality/artifacts/trace-log.jsonl` relative to repo root).
2. Checks the file exists and is non-empty.
3. For each line (skipping blank lines), validates:
   - Line is valid JSON (use `python3 -c "import json; json.loads(...)"`)
   - All five required keys are present: `fixture_id`, `skill`, `tool_calls`, `verdict`, `timestamp`
   - `fixture_id` and `skill` are non-empty strings
   - `tool_calls` is an array (JSON type check)
   - `verdict` is one of: `PASS`, `FAIL`, `dry-run`
   - `timestamp` matches ISO-8601 pattern (regex: `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}`)
4. Prints a summary: `N records validated — PASS` or exits non-zero with the first schema error.

Script skeleton:
```bash
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT=$(git rev-parse --show-toplevel)
TRACE_LOG="${1:-$REPO_ROOT/experiments/skill-quality/artifacts/trace-log.jsonl}"

if [ ! -f "$TRACE_LOG" ]; then echo "ERROR: $TRACE_LOG not found"; exit 1; fi
if [ ! -s "$TRACE_LOG" ]; then echo "ERROR: $TRACE_LOG is empty"; exit 1; fi

python3 - "$TRACE_LOG" <<'PYEOF'
import json, sys, re

path = sys.argv[1]
errors = []
count = 0
with open(path) as f:
    for i, line in enumerate(f, 1):
        line = line.strip()
        if not line:
            continue
        count += 1
        try:
            r = json.loads(line)
        except json.JSONDecodeError as e:
            errors.append(f"Line {i}: invalid JSON: {e}")
            continue
        for key in ['fixture_id', 'skill', 'tool_calls', 'verdict', 'timestamp']:
            if key not in r:
                errors.append(f"Line {i}: missing field '{key}'")
        if 'fixture_id' in r and not isinstance(r['fixture_id'], str):
            errors.append(f"Line {i}: fixture_id must be string")
        if 'skill' in r and not isinstance(r['skill'], str):
            errors.append(f"Line {i}: skill must be string")
        if 'tool_calls' in r and not isinstance(r['tool_calls'], list):
            errors.append(f"Line {i}: tool_calls must be array")
        if 'verdict' in r and r['verdict'] not in ('PASS', 'FAIL', 'dry-run'):
            errors.append(f"Line {i}: verdict must be PASS|FAIL|dry-run, got '{r['verdict']}'")
        if 'timestamp' in r and not re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', str(r['timestamp'])):
            errors.append(f"Line {i}: timestamp not ISO-8601")
if errors:
    for e in errors:
        print(f"SCHEMA ERROR: {e}", file=sys.stderr)
    sys.exit(1)
print(f"{count} records validated — PASS")
PYEOF
```

### DoD
- `test -f experiments/skill-quality/scripts/validate-trace-log.sh`
- `grep -q 'fixture_id' experiments/skill-quality/scripts/validate-trace-log.sh`
- `grep -q 'tool_calls' experiments/skill-quality/scripts/validate-trace-log.sh`
- `grep -q 'ISO-8601\|\\\\d{4}-\\\\d{2}-\\\\d{2}' experiments/skill-quality/scripts/validate-trace-log.sh`

## Phase 2: Make the script executable and smoke-test it
Make the script executable and test it against both a valid and an invalid trace record.

### DoD
- `test -x experiments/skill-quality/scripts/validate-trace-log.sh`
- `echo '{"fixture_id":"f1","skill":"s","tool_calls":[],"verdict":"PASS","timestamp":"2026-01-01T00:00:00Z"}' > /tmp/trace-ok.jsonl && experiments/skill-quality/scripts/validate-trace-log.sh /tmp/trace-ok.jsonl`
- `echo '{"fixture_id":"f1","skill":"s"}' > /tmp/trace-bad.jsonl && ! experiments/skill-quality/scripts/validate-trace-log.sh /tmp/trace-bad.jsonl`

## Phase 3: Validate the plugin suite still passes
Confirm the new script does not break existing validation.

### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- The validator script must be standalone bash + python3 stdlib only (no pip installs, no npm)
- Do not modify run-class-d.ts in this sub-task
- Script path must be `experiments/skill-quality/scripts/validate-trace-log.sh`

## Acceptance Gate
- `test -x experiments/skill-quality/scripts/validate-trace-log.sh && echo '{"fixture_id":"x","skill":"loop-backlog","tool_calls":[],"verdict":"PASS","timestamp":"2026-01-01T00:00:00Z"}' > /tmp/ttb-trace-accept.jsonl && experiments/skill-quality/scripts/validate-trace-log.sh /tmp/ttb-trace-accept.jsonl`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-104

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f experiments/skill-quality/scripts/validate-trace-log.sh
- [ ] #2 grep -q 'fixture_id' experiments/skill-quality/scripts/validate-trace-log.sh
- [ ] #3 grep -q 'tool_calls' experiments/skill-quality/scripts/validate-trace-log.sh
- [ ] #4 test -x experiments/skill-quality/scripts/validate-trace-log.sh
- [ ] #5 echo '{"fixture_id":"f1","skill":"s","tool_calls":[],"verdict":"PASS","timestamp":"2026-01-01T00:00:00Z"}' > /tmp/trace-ok.jsonl && experiments/skill-quality/scripts/validate-trace-log.sh /tmp/trace-ok.jsonl
- [ ] #6 echo '{"fixture_id":"f1","skill":"s"}' > /tmp/trace-bad.jsonl && ! experiments/skill-quality/scripts/validate-trace-log.sh /tmp/trace-bad.jsonl
- [ ] #7 bash scripts/validate-plugin.sh
<!-- DOD:END -->
