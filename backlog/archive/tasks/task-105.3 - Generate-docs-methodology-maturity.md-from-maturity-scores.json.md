---
id: TASK-105.3
title: Generate docs/methodology-maturity.md from maturity-scores.json
status: Backlog
assignee: []
created_date: '2026-06-20 10:39'
updated_date: '2026-06-20 10:39'
labels: []
dependencies: []
parent_task_id: TASK-105
priority: medium
ordinal: 114000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write a script (scripts/generate-maturity-doc.sh or Python equivalent) that reads experiments/maturity/maturity-scores.json (produced by TASK-105.2) and renders docs/methodology-maturity.md — the human-readable methodology maturity scorecard. The document must include: a header, a summary table of per-claim evidence strength (claim_id, oca_strength, verdict counts), and a section listing any P0 claims with zero measured evidence.

This is Phase 3 of the 4-phase TASK-105 pipeline. Its output (docs/methodology-maturity.md) is the primary deliverable of the parent meta-task.

Parent task: TASK-105
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/generate-maturity-doc.sh || test -f scripts/generate-maturity-doc.py
- [ ] #2 bash scripts/generate-maturity-doc.sh || python3 scripts/generate-maturity-doc.py
- [ ] #3 test -f docs/methodology-maturity.md
- [ ] #4 grep -q '## Evidence Summary' docs/methodology-maturity.md
- [ ] #5 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Plan: Generate docs/methodology-maturity.md from maturity-scores.json

## Context
The maturity scorecard (TASK-105 primary deliverable) must be a human-readable markdown document in docs/. It is generated from the scored JSON produced by scripts/score-maturity.py. This phase closes the pipeline by producing the artifact that stakeholders will read.

## Phase 1: Design document structure
The output document must contain:
- `# Methodology Maturity Scorecard` header with generation timestamp
- `## Evidence Summary` section: a markdown table with columns | Claim ID | OCA Strength | Met | NotMet | Inconclusive | P0? |
- `## P0 Claims With Zero Evidence` section: list any claim where p0_flag=true and met_count=0
- `## Generated From` section: list the source files and generation date

### DoD
- `grep -q '## Evidence Summary' docs/methodology-maturity.md`

## Phase 2: Implement scripts/generate-maturity-doc.py
Write the Python script that:
1. Reads `experiments/maturity/maturity-scores.json`
2. Renders the markdown table rows sorted by oca_strength ascending (weakest first)
3. Writes `docs/methodology-maturity.md` (creates docs/ if needed)
4. Exits non-zero if maturity-scores.json does not exist

### DoD
- `test -f scripts/generate-maturity-doc.py`
- `python3 -m py_compile scripts/generate-maturity-doc.py`

## Phase 3: Run and validate output
Execute the script and verify the document structure.

### DoD
- `python3 scripts/generate-maturity-doc.py`
- `test -f docs/methodology-maturity.md`
- `grep -q '## Evidence Summary' docs/methodology-maturity.md`
- `grep -q '## P0 Claims With Zero Evidence' docs/methodology-maturity.md`
- `[ $(wc -l < docs/methodology-maturity.md) -ge 10 ]`

## Constraints
- Do not hardcode claim IDs; derive entirely from maturity-scores.json
- No external pip dependencies; use only Python stdlib
- Document must be regeneratable idempotently (re-running overwrites the file cleanly)

## Acceptance Gate
- `python3 scripts/generate-maturity-doc.py && grep -q '## Evidence Summary' docs/methodology-maturity.md`

parentTask: TASK-105
<!-- SECTION:NOTES:END -->
