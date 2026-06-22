---
id: TASK-135
title: 基准测量：各阶段耗时与 proposalLoop 修改率统计
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 16:39'
updated_date: '2026-06-21 17:06'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-134
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Baseline measurement: collect per-phase wall-clock timings for draftProposal, proposalLoop, draftPlan, planLoop, and finalise across ≥2 feature-to-backlog reference tasks and the TASK-134 epic-to-backlog run. Count proposalLoop iteration rates. Produce docs/experiments/ftb-phase-timing-baseline.md with a phase × task table covering both feature and epic runs.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 基准测量：各阶段耗时与 proposalLoop 修改率统计

## Context
The feature-to-backlog and epic-to-backlog skills run five sequential agent phases costing 400–700 s per task. Before running speedup experiments (children 2 and 3 of TASK-134), we need a firm per-phase timing baseline from real transcripts to know where time is actually spent and to provide a comparison baseline for experiment results.

## Phase 1: Locate reference task transcripts via meta-cc

Use the meta-cc MCP tools to identify recent feature-to-backlog runs. Query conversation summaries and timestamps for tasks processed through the full five-phase pipeline.

Concrete steps:
1. Run `mcp__plugin_meta-cc_meta-cc__query_summaries` to find sessions containing "draftProposal", "proposalLoop", "draftPlan", "planLoop", "finalise" keywords.
2. For each matching session, run `mcp__plugin_meta-cc_meta-cc__query_timestamps` to extract phase start/end times.
3. Identify ≥2 feature-to-backlog task runs with full pipeline data.
4. Record TASK-134 epic-to-backlog self-timing as the first epic data point: draftProposal 136s, proposalLoop 69s (1 round → APPROVED), draftPlan 91s, planLoop 68s, finalise 56s, total 420s.
5. Write session IDs and task IDs found to `docs/experiments/ftb-session-index.txt` for traceability.

### DoD
- `test -f docs/experiments/ftb-session-index.txt`
- `test -s docs/experiments/ftb-session-index.txt`

## Phase 2: Extract per-phase timings and iteration counts

For each identified session and task:
1. Extract wall-clock timestamps for the start and end of each phase agent call.
2. Compute duration per phase in seconds.
3. Count proposalLoop iteration count (number of rounds until APPROVED verdict).
4. Count planLoop iteration count similarly.
5. Note any phases that were skipped or combined.

Write raw extracted data to `docs/experiments/ftb-timing-raw.txt` for verification and reproducibility.

### DoD
- `test -f docs/experiments/ftb-timing-raw.txt`
- `test -s docs/experiments/ftb-timing-raw.txt`
- `grep -q 'draftProposal' docs/experiments/ftb-timing-raw.txt`

## Phase 3: Produce the baseline findings document

Create `docs/experiments/ftb-phase-timing-baseline.md` with:
- A table: rows = phases (draftProposal, proposalLoop, draftPlan, planLoop, finalise, total), columns = each reference task + TASK-134 epic column.
- A summary row: mean per phase across feature tasks.
- A proposalLoop iteration rate table: how many tasks needed 1 round, 2 rounds, 3+ rounds.
- A planLoop iteration rate table similarly.
- A "Findings" section: which phase dominates wall-clock time, what the proposalLoop revision rate is, what TASK-134 shows as epic baseline.

Write using standard markdown. Reference `ftb-session-index.txt` and `ftb-timing-raw.txt` for data provenance.

### DoD
- `test -f docs/experiments/ftb-phase-timing-baseline.md`
- `test -s docs/experiments/ftb-phase-timing-baseline.md`
- `grep -q 'proposalLoop' docs/experiments/ftb-phase-timing-baseline.md`
- `grep -q 'TASK-134' docs/experiments/ftb-phase-timing-baseline.md`
- `grep -q '## Findings' docs/experiments/ftb-phase-timing-baseline.md`

## Constraints
- Do not run any live feature-to-backlog task to generate timing data — read existing transcripts only
- Do not modify any SKILL.md files
- Do not create branches or worktrees
- If fewer than 2 feature-to-backlog sessions are found with full timing data, document what was found and note the gap — a partial baseline with clear caveats is acceptable
- Timing precision: report to nearest second; sub-second precision is not required

## Acceptance Gate
- `test -f docs/experiments/ftb-phase-timing-baseline.md`
- `test -s docs/experiments/ftb-phase-timing-baseline.md`
- `grep -q 'proposalLoop' docs/experiments/ftb-phase-timing-baseline.md`
- `grep -q '## Findings' docs/experiments/ftb-phase-timing-baseline.md`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

cap:propose=approved

claimed: 2026-06-21T17:00:00Z

Completed: 2026-06-21T17:10:00Z
All 11 DoD checks PASS. Merged task/TASK-135 → main (no-ff). cap:execute=done
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f docs/experiments/ftb-session-index.txt
- [ ] #2 test -s docs/experiments/ftb-session-index.txt
- [ ] #3 test -f docs/experiments/ftb-timing-raw.txt
- [ ] #4 test -s docs/experiments/ftb-timing-raw.txt
- [ ] #5 grep -q 'draftProposal' docs/experiments/ftb-timing-raw.txt
- [ ] #6 test -f docs/experiments/ftb-phase-timing-baseline.md
- [ ] #7 test -s docs/experiments/ftb-phase-timing-baseline.md
- [ ] #8 grep -q 'proposalLoop' docs/experiments/ftb-phase-timing-baseline.md
- [ ] #9 grep -q 'TASK-134' docs/experiments/ftb-phase-timing-baseline.md
- [ ] #10 grep -q '## Findings' docs/experiments/ftb-phase-timing-baseline.md
- [ ] #11 bash scripts/validate-plugin.sh
<!-- DOD:END -->
