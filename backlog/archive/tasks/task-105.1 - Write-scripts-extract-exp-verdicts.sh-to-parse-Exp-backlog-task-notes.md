---
id: TASK-105.1
title: Write scripts/extract-exp-verdicts.sh to parse Exp-* backlog task notes
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:38'
labels: []
dependencies: []
parent_task_id: TASK-105
priority: medium
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a shell script at scripts/extract-exp-verdicts.sh that scans all backlog task markdown files whose filenames or tags include "Exp-*", reads their task notes sections, and extracts result verdicts (Met / NotMet / Inconclusive) along with the associated claim ID and task ID. The script outputs a structured JSON file at experiments/maturity/exp-verdicts.json with entries shaped as {task_id, exp_tag, claim_id, verdict, source_file}.

This is Phase 1 of the 4-phase methodology maturity scorecard pipeline (TASK-105). Its output (exp-verdicts.json) is consumed by the OCA scoring script in the next sub-task. Without this extraction step, scoring is manual and error-prone.

Parent task: TASK-105
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/extract-exp-verdicts.sh
- [ ] #2 test -f experiments/maturity/exp-verdicts.json
- [ ] #3 python3 -m json.tool experiments/maturity/exp-verdicts.json > /dev/null
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Plan: Write scripts/extract-exp-verdicts.sh to parse Exp-* backlog task notes

## Context
TASK-105 requires a methodology maturity scorecard built from Exp-* experiment results. Before scoring can happen, all experiment verdicts must be extracted from backlog task notes into a machine-readable JSON format. This script is Phase 1 of that pipeline.

## Phase 1: Discover Exp-* tasks
Scan `backlog/tasks/` for markdown files whose filename contains "Exp-" (case-insensitive). Also check YAML frontmatter `labels:` field for tags matching `Exp-*`. Collect the set of candidate files.

### DoD
- `[ $(find backlog/tasks -name '*[Ee]xp-*' | wc -l) -ge 1 ]`

## Phase 2: Implement scripts/extract-exp-verdicts.sh
Write the shell script. For each candidate task file:
1. Extract `task_id` from the filename (pattern `task-NNN`).
2. Extract `exp_tag` from filename or frontmatter label matching `Exp-*`.
3. Scan the Notes section for lines containing verdict keywords: `Met`, `NotMet`, `Inconclusive`.
4. Extract `claim_id` if present (pattern `claim:` or `Claim-` prefix near verdict).
5. Emit one JSON object per verdict found, plus the `source_file` path.
6. Write the array to `experiments/maturity/exp-verdicts.json` (create directory if needed).
7. Exit non-zero if no Exp-* tasks are found.

### DoD
- `test -f scripts/extract-exp-verdicts.sh`
- `test -x scripts/extract-exp-verdicts.sh`

## Phase 3: Run script and validate output
Execute the script and verify the output is valid JSON containing at least one entry for a known Exp-* task (e.g. TASK-39, TASK-40, or TASK-45).

### DoD
- `bash scripts/extract-exp-verdicts.sh`
- `test -f experiments/maturity/exp-verdicts.json`
- `python3 -m json.tool experiments/maturity/exp-verdicts.json > /dev/null`
- `python3 -c "import json,sys; data=json.load(open('experiments/maturity/exp-verdicts.json')); assert len(data)>=1, 'no entries'"`

## Constraints
- Script must be pure shell (bash); no Python in the script itself
- Do not modify any backlog task files
- Output JSON must be an array even if empty (never null)

## Acceptance Gate
- `bash scripts/extract-exp-verdicts.sh && python3 -m json.tool experiments/maturity/exp-verdicts.json > /dev/null`

parentTask: TASK-105
<!-- SECTION:NOTES:END -->
