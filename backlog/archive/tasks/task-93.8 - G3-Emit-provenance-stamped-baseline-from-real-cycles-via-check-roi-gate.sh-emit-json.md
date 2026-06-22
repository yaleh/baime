---
id: TASK-93.8
title: >-
  G3: Emit provenance-stamped baseline from real cycles via check-roi-gate.sh
  --emit-json
status: In Progress
assignee: []
created_date: '2026-06-20 10:04'
updated_date: '2026-06-20 13:47'
labels: []
dependencies:
  - TASK-93.10
parent_task_id: TASK-93
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After ≥10 real meta-task cycles are complete (G2.2 Done), run check-roi-gate.sh --emit-json to produce the official baseline JSON at plugin/loop-meta/data/baseline/replan-stats.json. Then validate the baseline passes verify-provenance.sh.

This is the ONLY sanctioned way to produce replan-stats.json — the script stamps the file with generated_by: "scripts/check-roi-gate.sh" and data_source: "measured", enabling verify-provenance.sh to trace the artifact back to its generator. A hand-written baseline (as in the first TASK-93 execution post-mortem) fails this provenance gate.

Steps:
1. Run: bash scripts/check-roi-gate.sh --emit-json plugin/loop-meta/data/baseline/replan-stats.json
2. Verify the JSON contains generated_by and data_source fields
3. Run: bash scripts/verify-provenance.sh plugin/loop-meta/data/baseline
4. Confirm the JSON shows meta_task_cycles ≥ 10

This sub-task is part of TASK-93 G3 (baseline generation). It depends on G2.2 being complete.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: G3 — Emit provenance-stamped baseline from real cycles via check-roi-gate.sh --emit-json

## Context
TASK-93 requires a provenance-verifiable baseline JSON at
`plugin/loop-meta/data/baseline/replan-stats.json`. The first TASK-93 attempt
produced a hand-written file that lacked `generated_by`, causing
`verify-provenance.sh` to reject it. The only sanctioned path is to wait until
≥10 real meta-task cycles have completed (G2.2 Done), then run
`scripts/check-roi-gate.sh --emit-json` which auto-stamps `generated_by` and
`data_source: measured` into the output JSON.

## Phase 1: Confirm G2.2 prerequisite is satisfied

Verify the backlog contains ≥10 tasks that have ever held status Meta-Active or
Meta-Done, and that G2.2 is itself Done.

Run:
```
grep -rl 'status: Meta-Active\|status: Meta-Done\|idempotentReconcile:' backlog/tasks/ | wc -l
```

Confirm the count is ≥10. If not, this task must not proceed (mark Needs Human
and wait for more cycles).

### DoD
- [ ] `[ "$(grep -rlE 'status: Meta-Active|status: Meta-Done|idempotentReconcile:' backlog/tasks/ | wc -l)" -ge 10 ]`

## Phase 2: Run check-roi-gate.sh --emit-json to produce baseline

Execute the script targeting the canonical output path:

```bash
bash scripts/check-roi-gate.sh \
  --emit-json plugin/loop-meta/data/baseline/replan-stats.json
```

The script will:
- Scan `backlog/tasks/` for replan markers and evaluator-slice conclusions
- Print the ROI Gate Measurement Report to stdout
- Write the provenance-stamped JSON (with `generated_by` and `data_source: measured`)
- Exit 0 (PROCEED) or 2 (HOLD) — both are valid; HOLD only means P4 automation
  isn't warranted yet, NOT that the baseline is invalid.

The exit code must be captured without causing script failure:

```bash
bash scripts/check-roi-gate.sh \
  --emit-json plugin/loop-meta/data/baseline/replan-stats.json || true
```

### DoD
- [ ] `test -s plugin/loop-meta/data/baseline/replan-stats.json`
- [ ] `grep -q '"data_source": "measured"' plugin/loop-meta/data/baseline/replan-stats.json`
- [ ] `grep -q '"generated_by": "scripts/check-roi-gate.sh"' plugin/loop-meta/data/baseline/replan-stats.json`

## Phase 3: Validate provenance via verify-provenance.sh

Run the provenance gate to confirm the artifact is traceable:

```bash
bash scripts/verify-provenance.sh plugin/loop-meta/data/baseline
```

Expected output: `verify-provenance: PASS — 1 measured artifact(s) all carry a valid generated_by`

If the gate fails, do NOT hand-edit the JSON. Re-run Phase 2 to regenerate it.

### DoD
- [ ] `bash scripts/verify-provenance.sh plugin/loop-meta/data/baseline`

## Phase 4: Confirm meta_task_cycles ≥ 10 in the emitted JSON

Read the JSON and assert the cycle count satisfies the G3 requirement:

```bash
python3 -c "
import json, sys
d = json.load(open('plugin/loop-meta/data/baseline/replan-stats.json'))
cycles = d.get('meta_task_cycles', 0)
print(f'meta_task_cycles: {cycles}')
sys.exit(0 if cycles >= 10 else 1)
"
```

If meta_task_cycles < 10, the file is still valid but indicates G2.2 was not
truly complete — escalate to human review.

### DoD
- [ ] `python3 -c "import json,sys; d=json.load(open('plugin/loop-meta/data/baseline/replan-stats.json')); sys.exit(0 if d.get('meta_task_cycles',0)>=10 else 1)"`

## Constraints
- Never hand-edit `replan-stats.json`; regenerate with the script
- Do not proceed to Phase 2 if G2.2 is not Done (cycle count < 10)
- The gate exit code (PROCEED/HOLD) is separate from baseline validity; a HOLD
  exit still produces a valid baseline JSON
- No modifications to `check-roi-gate.sh` or `verify-provenance.sh` are in scope

## Acceptance Gate
- [ ] `test -s plugin/loop-meta/data/baseline/replan-stats.json`
- [ ] `grep -q '"generated_by": "scripts/check-roi-gate.sh"' plugin/loop-meta/data/baseline/replan-stats.json`
- [ ] `bash scripts/verify-provenance.sh plugin/loop-meta/data/baseline`
- [ ] `python3 -c "import json,sys; d=json.load(open('plugin/loop-meta/data/baseline/replan-stats.json')); sys.exit(0 if d.get('meta_task_cycles',0)>=10 else 1)"`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-93

claimed: 2026-06-20T10:43:00Z

DoD #1: PASS — cycles=13 ≥ 10, Result: PROCEED

DoD #2: PASS — generated_by and data_source verified

DoD #3: PASS — verify-provenance.sh exit 0

DoD #4: PASS — meta_task_cycles ≥ 10 in JSON

## Execution Summary
Result: Done
All DoD items PASS

Completed: 2026-06-20T10:45:15Z

Reset to Backlog 2026-06-20: previous Done was premature — baseline was emitted based on fabricated 13-cycle data (bad G2.2 run in worktree). Must re-run after ≥10 real Meta-Done cycles accumulate in main backlog.

Escalated: Prerequisite not met — 0 real meta-task cycles with evaluator: Met|NotMet data in backlog/tasks/ (need ≥10). DoD #1 loose count=3, DoD #6 tight count=0. Re-queue once loop-meta has completed ≥10 real Meta-Done cycles with evaluateAndReplan evidence.
To continue: run /loop-meta to accumulate real cycles, then set status → Ready.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 [ "$(grep -rlE 'status: Meta-Active|status: Meta-Done|idempotentReconcile:' backlog/tasks/ | wc -l)" -ge 10 ]
- [ ] #2 test -s plugin/loop-meta/data/baseline/replan-stats.json
- [ ] #3 grep -q '"data_source": "measured"' plugin/loop-meta/data/baseline/replan-stats.json
- [ ] #4 grep -q '"generated_by": "scripts/check-roi-gate.sh"' plugin/loop-meta/data/baseline/replan-stats.json
- [ ] #5 bash scripts/verify-provenance.sh plugin/loop-meta/data/baseline
- [ ] #6 python3 -c "import json,sys; d=json.load(open('plugin/loop-meta/data/baseline/replan-stats.json')); sys.exit(0 if d.get('meta_task_cycles',0)>=10 else 1)"
- [ ] #7 bash scripts/validate-plugin.sh
<!-- DOD:END -->
