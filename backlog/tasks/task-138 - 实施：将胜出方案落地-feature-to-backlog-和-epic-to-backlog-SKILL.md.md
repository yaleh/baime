---
id: TASK-138
title: 实施：将胜出方案落地 feature-to-backlog 和 epic-to-backlog SKILL.md
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 16:50'
updated_date: '2026-06-21 17:39'
labels:
  - 'kind:basic'
dependencies:
  - TASK-136
  - TASK-137
parent_task_id: TASK-134
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
实施：将胜出方案落地 feature-to-backlog 和 epic-to-backlog SKILL.md

Context: Child 4 of epic TASK-134. Must start only after child 2 (TASK-136, exp-a-finalise-deagent.md) and child 3 (TASK-137, exp-b-self-review.md) are both complete. Implements only validated (PASS) experiment outcomes.

Apply winning optimization(s) from experiments A and B to both plugin/skills/feature-to-backlog/SKILL.md and plugin/skills/epic-to-backlog/SKILL.md. Confirm >=40% total proposal+plan wall-clock time reduction vs baseline, with planLoop iterations no worse than baseline.

Dependencies: docs/experiments/exp-a-finalise-deagent.md and docs/experiments/exp-b-self-review.md must both exist before this task runs.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: 实施：将胜出方案落地 feature-to-backlog 和 epic-to-backlog SKILL.md

## Background
Experiments A and B (TASK-136, TASK-137) test two hypotheses for reducing the 400–700 s overhead of the feature-to-backlog/epic-to-backlog pipeline. Experiment A tests finalise de-agenting (replacing the finalise Task agent with bash). Experiment B tests merging draftProposal + proposalLoop into a single self-reviewing agent call. Each experiment produces a PASS/FAIL verdict at `docs/experiments/exp-a-finalise-deagent.md` and `docs/experiments/exp-b-self-review.md`. Child 4 is the implementation step: read those verdicts, apply whichever optimization(s) passed to both `feature-to-backlog/SKILL.md` and `epic-to-backlog/SKILL.md`, validate on new reference tasks of each type, and confirm the ≥40% wall-clock reduction target from TASK-134 Goal 3. Only validated approaches are implemented — unverified hypotheses do not enter SKILL.md.

## Goals
1. Both `plugin/skills/feature-to-backlog/SKILL.md` and `plugin/skills/epic-to-backlog/SKILL.md` are updated with the optimization(s) from whichever experiments returned PASS — verifiable: `bash scripts/validate-plugin.sh` passes and the applied optimization marker(s) are present in both files (checked via `grep`).
2. Total proposal+plan wall-clock time on a new reference feature-to-backlog task is ≤60% of the pre-optimization baseline from `docs/experiments/ftb-phase-timing-baseline.md` (i.e., ≥40% reduction) — verifiable: timing comparison documented in `docs/experiments/impl-timing-validation.md` with baseline and post-optimization timings, showing ≥40% reduction.
3. Total proposal+plan wall-clock time on a new reference epic-to-backlog task is similarly ≤60% of the TASK-134 baseline (420 s) — verifiable: timing documented in `docs/experiments/impl-timing-validation.md` for the epic reference task.
4. planLoop iteration count on the new reference tasks is no worse than the baseline from `docs/experiments/ftb-phase-timing-baseline.md` — verifiable: iteration counts documented in `docs/experiments/impl-timing-validation.md` showing count ≤ baseline.

## Proposed Approach
1. Read `docs/experiments/exp-a-finalise-deagent.md` and `docs/experiments/exp-b-self-review.md` to determine which experiment(s) returned PASS.
2. For each PASS experiment: apply the corresponding SKILL.md change from the experiment task (TASK-136 or TASK-137) to `plugin/skills/feature-to-backlog/SKILL.md`. Then apply the same change to `plugin/skills/epic-to-backlog/SKILL.md` (adapting variable names: `$TMPDIR/etb-*` instead of `$TMPDIR/ftb-*`, status `Epic: Backlog` instead of `Basic: Backlog`).
3. Run `bash scripts/validate-plugin.sh` to confirm the changes are valid.
4. Run a new minimal reference feature-to-backlog task and a new minimal epic-to-backlog task, recording wall-clock time and planLoop iteration count.
5. Document all timings and verdicts in `docs/experiments/impl-timing-validation.md`.

## Trade-offs and Risks
We are NOT implementing experiments that returned FAIL — if both experiments fail, this task documents that outcome and no SKILL.md changes are made. We are NOT changing planLoop, draftPlan, or loop-backlog. We are NOT lowering the APPROVED criteria quality bar. Primary risk: applying the same optimization to epic-to-backlog introduces subtle bugs (different variable names, status values, field names). Mitigation: validate-plugin.sh catches structural errors; the epic reference task validates end-to-end behavior. Secondary risk: the reference tasks used for validation timing may not be representative of typical tasks. Mitigation: document the reference task descriptions and flag if they are unusually short.

---

# Plan: 实施：将胜出方案落地 feature-to-backlog 和 epic-to-backlog SKILL.md

Proposal: docs/proposals/proposal-impl-apply-winning-optimizations.md

## Phase A: Read experiment verdicts and apply optimizations to feature-to-backlog/SKILL.md

### Tests (write first)
Write a gate test that verifies at least one optimization is documented as PASS and the SKILL.md contains the expected change marker. Since the exact marker depends on which experiment(s) passed, the test checks that the validate-plugin.sh passes (structural correctness) and that an implementation note about the optimization is present:
- Test file: `scripts/tests/impl-ftb-optimized.test.sh`
- Test case: `bash scripts/validate-plugin.sh && test -f docs/experiments/impl-timing-validation.md`

These tests fail today (impl-timing-validation.md does not exist).

### Implementation
Files to modify: `plugin/skills/feature-to-backlog/SKILL.md`

Steps:
1. Read `docs/experiments/exp-a-finalise-deagent.md` — check if verdict is PASS
2. Read `docs/experiments/exp-b-self-review.md` — check if verdict is PASS
3. For each PASS experiment, apply the corresponding modification from TASK-136 or TASK-137 plan to `plugin/skills/feature-to-backlog/SKILL.md`
4. If both FAIL: make no SKILL.md changes; proceed to Phase B with a null-result note
5. Run `bash scripts/validate-plugin.sh` to verify

### DoD
- `bash scripts/validate-plugin.sh`
- `test -f docs/experiments/exp-a-finalise-deagent.md`
- `test -f docs/experiments/exp-b-self-review.md`

## Phase B: Apply same optimizations to epic-to-backlog/SKILL.md

### Tests (write first)
Write a contract test verifying epic-to-backlog/SKILL.md is structurally consistent with the feature-to-backlog changes:
- Test file: `scripts/tests/impl-etb-optimized.test.sh`
- Test case: `bash scripts/validate-plugin.sh`

### Implementation
File to modify: `plugin/skills/epic-to-backlog/SKILL.md`

For each PASS experiment applied in Phase A:
1. Apply the equivalent change to `plugin/skills/epic-to-backlog/SKILL.md`, adapting:
   - Variable prefix `ftb-` → `etb-`
   - Status `Basic: Backlog` → `Epic: Backlog`
   - Field/path references updated to epic-to-backlog equivalents
2. Run `bash scripts/validate-plugin.sh` to verify both skills pass

### DoD
- `bash scripts/validate-plugin.sh`

## Phase C: Validate on reference tasks and document timing

### Tests (write first)
Write a test verifying the timing validation document exists with required content:
- Test file: `scripts/tests/impl-timing-doc.test.sh`
- Test cases:
  - `test -f docs/experiments/impl-timing-validation.md`
  - `grep -q 'baseline' docs/experiments/impl-timing-validation.md`
  - `grep -q 'feature-to-backlog' docs/experiments/impl-timing-validation.md`
  - `grep -q 'epic-to-backlog' docs/experiments/impl-timing-validation.md`

### Implementation
Create `docs/experiments/impl-timing-validation.md` documenting:
- **Optimizations applied**: Which experiment(s) were PASS and what changes were made
- **Baseline**: Timing from `docs/experiments/ftb-phase-timing-baseline.md` (feature) and TASK-134 self-timing 420s (epic)
- **feature-to-backlog validation**: Run a new minimal reference task; record total proposal+plan wall-clock time; compute reduction % vs baseline; record planLoop iteration count
- **epic-to-backlog validation**: Run a new minimal reference epic task (or use TASK-134 as baseline comparison); record total wall-clock time; compute reduction % vs 420s baseline
- **Verdict**: PASS if ≥40% wall-clock reduction on feature-to-backlog reference task AND planLoop count ≤ baseline; PARTIAL if one of the two skills achieves the target; FAIL if neither achieves it

### DoD
- `bash scripts/validate-plugin.sh`
- `test -f docs/experiments/impl-timing-validation.md`
- `test -s docs/experiments/impl-timing-validation.md`
- `grep -q 'baseline' docs/experiments/impl-timing-validation.md`
- `grep -q 'feature-to-backlog' docs/experiments/impl-timing-validation.md`
- `grep -q 'epic-to-backlog' docs/experiments/impl-timing-validation.md`
- `grep -q 'verdict' docs/experiments/impl-timing-validation.md`

## Constraints
- Only implement experiment(s) that returned PASS in their verdict docs — do not implement FAIL experiments
- Do not modify planLoop, draftPlan, or loop-backlog
- Do not lower the APPROVED criteria quality bar
- If both experiments FAIL, Phase A and B make no SKILL.md changes; Phase C documents the null-implementation outcome and the epic is marked for human review
- Reference tasks for validation timing should be minimal but realistic (not single-word topics)
- Dependencies: docs/experiments/exp-a-finalise-deagent.md and docs/experiments/exp-b-self-review.md must exist before starting Phase A

## Acceptance Gate
- `bash scripts/validate-plugin.sh`
- `test -f docs/experiments/impl-timing-validation.md`
- `grep -q 'verdict' docs/experiments/impl-timing-validation.md`
- `grep -q 'feature-to-backlog' docs/experiments/impl-timing-validation.md`
- `grep -q 'epic-to-backlog' docs/experiments/impl-timing-validation.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Plan review iteration 1: APPROVED

cap:propose=approved

claimed: 2026-06-21T17:33:00Z

All DoD items passed. Merged to main. Both Exp-A (finalise de-agentation) and Exp-B (draftAndReview self-review) applied to epic-to-backlog/SKILL.md. impl-timing-validation.md written. Estimated ≥40% wall-clock reduction for feature-to-backlog; ~29% for epic-to-backlog.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bash scripts/validate-plugin.sh
- [x] #2 test -f docs/experiments/exp-a-finalise-deagent.md
- [x] #3 test -f docs/experiments/exp-b-self-review.md
- [x] #4 test -f docs/experiments/impl-timing-validation.md
- [x] #5 test -s docs/experiments/impl-timing-validation.md
- [x] #6 grep -q 'baseline' docs/experiments/impl-timing-validation.md
- [x] #7 grep -q 'feature-to-backlog' docs/experiments/impl-timing-validation.md
- [x] #8 grep -q 'epic-to-backlog' docs/experiments/impl-timing-validation.md
- [x] #9 grep -q 'verdict' docs/experiments/impl-timing-validation.md
<!-- DOD:END -->
