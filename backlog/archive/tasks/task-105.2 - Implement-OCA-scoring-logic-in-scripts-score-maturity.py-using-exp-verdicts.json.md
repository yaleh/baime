---
id: TASK-105.2
title: >-
  Implement OCA scoring logic in scripts/score-maturity.py using
  exp-verdicts.json
status: Backlog
assignee: []
created_date: '2026-06-20 10:38'
updated_date: '2026-06-20 10:39'
labels: []
dependencies: []
parent_task_id: TASK-105
priority: medium
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a Python script at scripts/score-maturity.py that reads experiments/maturity/exp-verdicts.json (produced by TASK-105.1) and applies the OCA (Observational Convergence Analysis) criteria to compute per-claim evidence strength. For each unique claim_id, the script aggregates Met/NotMet/Inconclusive verdicts, applies OCA convergence thresholds, and emits a scored JSON at experiments/maturity/maturity-scores.json with fields: {claim_id, exp_count, met_count, not_met_count, inconclusive_count, oca_strength, p0_flag}.

This is Phase 2 of the 4-phase TASK-105 pipeline. Its output is consumed by the docs generator in the next sub-task.

Parent task: TASK-105
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/score-maturity.py
- [ ] #2 python3 scripts/score-maturity.py
- [ ] #3 test -f experiments/maturity/maturity-scores.json
- [ ] #4 python3 -m json.tool experiments/maturity/maturity-scores.json > /dev/null
- [ ] #5 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Plan: Implement OCA scoring logic in scripts/score-maturity.py

## Context
The OCA (Observational Convergence Analysis) convergence criteria (defined in TASK-54) are the canonical evidence-strength framework for this project. This script applies those criteria to the extracted Exp-* verdicts to produce a machine-readable maturity score per claim, which the doc-generator step will render into docs/methodology-maturity.md.

## Phase 1: Review OCA convergence criteria
Read TASK-54 notes and any docs referencing OCA convergence thresholds. Identify:
- The evidence-strength levels (e.g. Weak / Moderate / Strong / Convergent)
- The verdict-count thresholds per level
- How p0_flag is determined (claim priority tagging)

### DoD
- `grep -ri 'OCA' backlog/tasks/ | grep -q 'convergence'`

## Phase 2: Implement scripts/score-maturity.py
Write the Python script. It must:
1. Load `experiments/maturity/exp-verdicts.json`
2. Group entries by `claim_id`
3. For each claim: count Met, NotMet, Inconclusive; compute `oca_strength` per OCA thresholds
4. Set `p0_flag: true` if the claim has a `P0` prefix or is tagged as priority-0
5. Write `experiments/maturity/maturity-scores.json` as a JSON array

### DoD
- `test -f scripts/score-maturity.py`
- `python3 -m py_compile scripts/score-maturity.py`

## Phase 3: Run and validate output
Execute the script against the real exp-verdicts.json (requires TASK-105.1 to have run first; use fixture data if not available).

### DoD
- `python3 scripts/score-maturity.py`
- `test -f experiments/maturity/maturity-scores.json`
- `python3 -m json.tool experiments/maturity/maturity-scores.json > /dev/null`
- `python3 -c "import json; d=json.load(open('experiments/maturity/maturity-scores.json')); assert all('oca_strength' in r for r in d), 'missing oca_strength'"`

## Constraints
- Script must read from experiments/maturity/exp-verdicts.json; do not re-scan backlog tasks
- OCA threshold values must reference TASK-54 / docs; do not invent thresholds
- No external pip dependencies; use only Python stdlib

## Acceptance Gate
- `python3 scripts/score-maturity.py && python3 -m json.tool experiments/maturity/maturity-scores.json > /dev/null`

parentTask: TASK-105
<!-- SECTION:NOTES:END -->
