---
id: TASK-93.7
title: >-
  G2.1: Author ≥10 real meta-task inputs for Exp-K (varying complexity, ≥2
  replan-triggering)
status: Done
assignee: []
created_date: '2026-06-20 10:04'
updated_date: '2026-06-20 10:21'
labels: []
dependencies: []
parent_task_id: TASK-93
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design and write a set of ≥10 real meta-task input specifications to serve as the experiment corpus for TASK-93 (Exp-K: loop-meta replan baseline). These are the actual goals that will be fed into loop-meta and executed through full Meta-Active→Meta-Done lifecycles to collect replan trigger and evaluator verdict data.

Requirements:
- At least 10 distinct meta-task goals, each with a meaningful description suitable for draftDecomposition to decompose into 2–4 sub-tasks
- Varying complexity: some goals with 2 sub-tasks, some with 3–4
- At least 2 goals that are likely to trigger a replan event (e.g. goals with ambiguous acceptance criteria, multi-step dependencies, or known friction points in the current loop-meta implementation)
- Goals should be real and useful to the baime project — not fabricated or trivial ("add a comment", "rename a variable")
- Each input spec recorded as a structured JSON entry in plugin/loop-meta/data/task-notes/meta-task-inputs.json with fields: id (MT-01..MT-10+), goal, estimated_subtasks, replan_expected (bool), rationale
- The inputs.json file is the deliverable; its existence and schema are what the DoD gates check

This sub-task is part of TASK-93 meta-task G2 (Execute ≥10 real meta-task lifecycles). The inputs created here feed directly into G2.2 (execute the lifecycles).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Context
TASK-93 (Exp-K) requires executing ≥10 real meta-task lifecycles through loop-meta to collect replan-trigger and evaluator-verdict data. Before any lifecycle can be executed, the experiment corpus must be designed: a set of well-specified meta-task input records that vary in complexity and include at least 2 goals expected to trigger replanning. This plan produces that corpus as a JSON file consumed by G2.2.

## Phase 1: Author and write meta-task-inputs.json
Survey loop-meta's draftDecomposition logic and the existing backlog to identify ≥10 real baime improvement goals. Then write `plugin/loop-meta/data/task-notes/meta-task-inputs.json`.

Concretely:
- Read `plugin/loop-meta/` skill files to understand what kinds of goals draftDecomposition handles well vs. poorly, and identify known friction points (e.g. WIP_CAP enforcement, evaluator ROI gating, multi-step data dependencies)
- Run `backlog task list --plain` to survey existing tasks for real project needs
- Write the JSON array to `plugin/loop-meta/data/task-notes/meta-task-inputs.json`

Each entry must have:
- `id`: string, format MT-01 through MT-10+ (zero-padded two digits)
- `goal`: string, ≥20 chars, specific enough for draftDecomposition to produce 2–4 sub-tasks
- `estimated_subtasks`: integer 2–4
- `replan_expected`: boolean
- `rationale`: string explaining why this goal is useful to baime and (if `replan_expected=true`) why it is likely to trigger a replan

Distribution requirements:
- At least 3 entries with `estimated_subtasks == 2`
- At least 3 entries with `estimated_subtasks >= 3`
- At least 2 entries with `replan_expected == true`
- All goals must be real baime project needs (not synthetic/trivial)

### DoD
- `test -f /home/yale/work/baime/plugin/loop-meta/data/task-notes/meta-task-inputs.json`
- `test -s /home/yale/work/baime/plugin/loop-meta/data/task-notes/meta-task-inputs.json`

## Phase 2: Validate schema and distribution
Parse the JSON file and confirm structural integrity and distribution constraints.

Run:
```bash
cd /home/yale/work/baime && python3 -c "
import json, sys
data = json.load(open('plugin/loop-meta/data/task-notes/meta-task-inputs.json'))
entries = data if isinstance(data, list) else data['entries']
assert len(entries) >= 10, f'Need >=10 entries, got {len(entries)}'
for e in entries:
    assert 'id' in e and 'goal' in e and 'estimated_subtasks' in e
    assert 'replan_expected' in e and 'rationale' in e
    assert isinstance(e['replan_expected'], bool), f'replan_expected must be bool in {e[\"id\"]}'
    assert 2 <= e['estimated_subtasks'] <= 4, f'estimated_subtasks out of range in {e[\"id\"]}'
    assert len(e['goal']) >= 20, f'goal too short in {e[\"id\"]}'
replan = [e for e in entries if e['replan_expected']]
assert len(replan) >= 2, f'Need >=2 replan_expected, got {len(replan)}'
two_sub = [e for e in entries if e['estimated_subtasks'] == 2]
three_plus = [e for e in entries if e['estimated_subtasks'] >= 3]
assert len(two_sub) >= 3, f'Need >=3 with 2 subtasks, got {len(two_sub)}'
assert len(three_plus) >= 3, f'Need >=3 with 3+ subtasks, got {len(three_plus)}'
print('PASS: schema and distribution OK')
"
```

### DoD
- `python3 -c "import json; data=json.load(open('plugin/loop-meta/data/task-notes/meta-task-inputs.json')); entries=data if isinstance(data,list) else data['entries']; assert len(entries)>=10"`
- `python3 -c "import json; data=json.load(open('plugin/loop-meta/data/task-notes/meta-task-inputs.json')); entries=data if isinstance(data,list) else data['entries']; assert len([e for e in entries if e['replan_expected']])>=2"`
- `grep -q '"replan_expected"' /home/yale/work/baime/plugin/loop-meta/data/task-notes/meta-task-inputs.json`
- `grep -q '"estimated_subtasks"' /home/yale/work/baime/plugin/loop-meta/data/task-notes/meta-task-inputs.json`

## Constraints
- Do not fabricate goals; every goal must correspond to a real observable need in the baime project
- Do not create goals that duplicate existing Ready/In-Progress tasks without adding experimental value
- Do not execute any meta-task lifecycle in this phase — execution is G2.2's responsibility
- Do not modify loop-meta skill code as part of this task
- The JSON file is the sole deliverable; no documentation files should be written

## Acceptance Gate
- `test -f /home/yale/work/baime/plugin/loop-meta/data/task-notes/meta-task-inputs.json`
- `python3 -c "import json; data=json.load(open('plugin/loop-meta/data/task-notes/meta-task-inputs.json')); entries=data if isinstance(data,list) else data['entries']; assert len(entries)>=10 and len([e for e in entries if e['replan_expected']])>=2; print('PASS')"`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: NEEDS_REVISION — Phase 1 DoD incorrectly referenced the output file before Phase 2 created it. Fixed by merging survey into Phase 1 (authoring phase) and removing the premature DoD check. Plan review iteration 2: APPROVED

parentTask: TASK-93

claimed: 2026-06-20T10:15:00Z

Phase 1 ✓ 2026-06-20T00:00:00Z
Surveyed loop-meta SKILL.md, identified friction points (reviewLoop exhaustion, ambiguous thresholds, output-format conflicts), surveyed 93+ backlog tasks for real project needs, authored 12 meta-task entries in meta-task-inputs.json covering all distribution requirements.

Phase 2 ✓ 2026-06-20T00:00:00Z
Validation passed: 12 entries, 2 replan_expected (MT-05, MT-08), 5 with estimated_subtasks==2, 7 with estimated_subtasks>=3, all goals >=20 chars, all replan_expected are bool.

DoD #1: PASS — test -f /home/yale/work/baime/plugin/loop-meta/data/task-notes/meta-task-inputs.json

DoD #2: PASS — test -s /home/yale/work/baime/plugin/loop-meta/data/task-notes/meta-task-inputs.json

DoD #3: PASS — python3 len(entries)>=10 (got 12)

DoD #4: PASS — python3 len([e for e in entries if e['replan_expected']])>=2 (got 2)

DoD #5: PASS — grep -q '"replan_expected"' meta-task-inputs.json

DoD #6: PASS — grep -q '"estimated_subtasks"' meta-task-inputs.json

DoD #7: PASS — bash scripts/validate-plugin.sh → Errors: 0, ALL CHECKS PASSED

## Execution Summary
Result: Done
Commit: b2da343 (worktree task/TASK-93.7), 2964f76 (main branch)
1. Phase 1 ✓: Surveyed loop-meta SKILL.md and backlog; authored 12 meta-task entries
2. Phase 2 ✓: Schema and distribution validation passed
3. DoD #1-#7: All PASS
4. Committed to worktree branch task/TASK-93.7 and main branch

workerLoop DoD verified: all 7 commands passed
Completed: 2026-06-20T10:22:00Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f /home/yale/work/baime/plugin/loop-meta/data/task-notes/meta-task-inputs.json
- [ ] #2 test -s /home/yale/work/baime/plugin/loop-meta/data/task-notes/meta-task-inputs.json
- [ ] #3 python3 -c "import json; data=json.load(open('plugin/loop-meta/data/task-notes/meta-task-inputs.json')); entries=data if isinstance(data,list) else data['entries']; assert len(entries)>=10"
- [ ] #4 python3 -c "import json; data=json.load(open('plugin/loop-meta/data/task-notes/meta-task-inputs.json')); entries=data if isinstance(data,list) else data['entries']; assert len([e for e in entries if e['replan_expected']])>=2"
- [ ] #5 grep -q '"replan_expected"' /home/yale/work/baime/plugin/loop-meta/data/task-notes/meta-task-inputs.json
- [ ] #6 grep -q '"estimated_subtasks"' /home/yale/work/baime/plugin/loop-meta/data/task-notes/meta-task-inputs.json
- [ ] #7 bash scripts/validate-plugin.sh
<!-- DOD:END -->
