---
id: TASK-137
title: 实验 B：draftProposal + proposalLoop 合并为单 agent self-review
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 16:47'
updated_date: '2026-06-21 17:30'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-134
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
实验 B：draftProposal + proposalLoop 合并为单 agent self-review

Context: Child 3 of epic TASK-134. Can run in parallel with child 2 (实验 A) after child 1 (基准测量) completes. This is an experiment — null results are valid.

Collapse the draftProposal + proposalLoop phases in plugin/skills/feature-to-backlog/SKILL.md into a single agent call that drafts and immediately self-reviews (up to 3 internal correction rounds). Compare wall-clock time and planLoop iteration count vs baseline from child 1.

Quality guard: if planLoop iteration count increases relative to baseline, experiment is FAILED.
Success criteria: bash scripts/validate-plugin.sh passes.

Deliverables:
1. Modified plugin/skills/feature-to-backlog/SKILL.md merging draftProposal + proposalLoop iteration 1 into single agent
2. docs/experiments/exp-b-self-review.md with approach, wall-clock delta, planLoop iteration comparison, and PASS/FAIL verdict
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: 实验 B：draftProposal + proposalLoop 合并为单 agent self-review

## Background
The `feature-to-backlog` skill currently runs two sequential phases for proposal creation: `draftProposal` (one agent call) and then `proposalLoop` (one or more review iterations, each a separate agent call). In the TASK-134 epic-to-backlog baseline, proposalLoop ran for 69 s with exactly 1 round (direct APPROVED on the first review). This suggests the draft was already high quality and the separate review agent call added only overhead. Experiment B tests whether merging the draft + first review into a single agent call — where the agent drafts and immediately self-reviews in up to 3 internal correction rounds — produces equivalent proposal quality while reducing total wall-clock time for the proposal stage. The key quality guard is planLoop iteration count on the subsequent task: if the merged agent produces lower-quality proposals that need more plan iterations to converge, the time savings are illusory.

## Goals
1. The `### Phase 1: resolveOrCreate + maybe draftProposal` and `### Phase 2: reviewLoop(proposal)` sections of `plugin/skills/feature-to-backlog/SKILL.md` are rewritten so that when the entry point is ProposalLoop with a new description, a single agent performs both drafting and self-review (up to 3 internal rounds), emitting APPROVED after its final round — verifiable: `bash scripts/validate-plugin.sh` passes and `grep -q 'self-review' plugin/skills/feature-to-backlog/SKILL.md`.
2. The experiment result is documented in `docs/experiments/exp-b-self-review.md` with: wall-clock time for the merged proposal phase on a reference task vs baseline, planLoop iteration count on the reference task vs baseline, quality assessment (proposal completeness, plan convergence speed), and a PASS/FAIL verdict — verifiable: `test -f docs/experiments/exp-b-self-review.md` and `grep -q 'verdict' docs/experiments/exp-b-self-review.md`.
3. If planLoop iteration count on the reference task is higher than the baseline, the experiment is marked FAILED and the SKILL.md change is reverted — verifiable: the verdict in the results doc states FAILED if planLoop iterations increased.

## Proposed Approach
Replace the two-phase (draftProposal + proposalLoop) structure with a single-phase "draftAndReview" agent that:
1. Searches codebase for context (as draftProposal does today)
2. Writes an initial proposal draft to `$TMPDIR/ftb-proposal.md`
3. Self-reviews against all proposalLoop criteria (Motivation, Goals, Feasibility, Completeness, Consistency)
4. If any criterion fails: fixes the proposal inline and repeats self-review (up to 3 total rounds)
5. After passing all criteria or exhausting 3 rounds: writes the proposal to the task and emits APPROVED or escalates to Needs Human

The external proposalLoop (separate review agent) is eliminated for new-description topics. For existing task IDs, the existing behavior (using task description as draft) is unchanged. The maxRounds for the self-chaining background agent in the old proposalLoop is replaced by the internal 3-round limit in the merged agent.

## Trade-offs and Risks
We are NOT changing epic-to-backlog in this experiment (deferred to child 4). We are NOT modifying draftPlan, planLoop, or finalise. We are NOT changing the APPROVED criteria — the same checklist (Motivation, Goals, Feasibility, Completeness, Consistency) applies inside the merged agent.

Primary risk: the self-review pass inside a single agent call may be less rigorous than a separate reviewer agent (no "fresh eyes" effect), leading to lower-quality proposals and more planLoop iterations. This is the key experiment question; planLoop iteration count is the definitive quality metric. If it increases, the experiment is FAILED. Secondary risk: the merged agent prompt is longer and more complex, potentially increasing draftProposal wall-clock time. Mitigation: wall-clock time of the merged phase is measured and compared to baseline (draftProposal + proposalLoop combined).

---

# Plan: 实验 B：draftProposal + proposalLoop 合并为单 agent self-review

Proposal: docs/proposals/proposal-exp-b-self-review.md

## Phase A: Modify feature-to-backlog/SKILL.md to merge draftProposal + proposalLoop

### Tests (write first)
Write a contract test verifying the merged structure is present and the old two-phase structure is absent:
- Test file: `scripts/tests/exp-b-merged-phase.test.sh`
- Test cases:
  - `grep -q 'self-review' plugin/skills/feature-to-backlog/SKILL.md` — merged agent instruction present
  - `! grep -q 'Phase 2: reviewLoop(proposal)' plugin/skills/feature-to-backlog/SKILL.md` — old separate review phase absent (for new-description path)

These tests fail today (self-review absent; separate review phase present).

### Implementation
File to modify: `plugin/skills/feature-to-backlog/SKILL.md`

In `### Phase 1: resolveOrCreate + maybe draftProposal`, replace the `1b. draftProposal` agent prompt block with a merged `1b. draftAndReview` agent that:
- Drafts the proposal (Steps 1-2 of current draftProposal)
- Immediately self-reviews against all proposalLoop criteria
- Iterates internally up to 3 rounds if any criterion fails
- After converging (or 3 rounds): updates the task, writes APPROVED/ESCALATE to `$TMPDIR/ftb-proposal-verdict.txt`

Replace `### Phase 2: reviewLoop(proposal)` with a note: "External review loop is skipped for new-description topics; merged draftAndReview agent handles self-review. For existing task ID topics (PlanLoop entry), no proposal review is needed."

The 8-iteration background self-chaining loop (old Phase 2) is removed for the new-description path.

### DoD
- `bash scripts/validate-plugin.sh`
- `grep -q 'self-review' plugin/skills/feature-to-backlog/SKILL.md`
- `! grep -q 'Phase 2: reviewLoop(proposal)' plugin/skills/feature-to-backlog/SKILL.md`

## Phase B: Document experiment results

### Tests (write first)
Write a test verifying the results doc exists with required sections:
- Test file: `scripts/tests/exp-b-results-doc.test.sh`
- Test cases:
  - `test -f docs/experiments/exp-b-self-review.md`
  - `grep -q 'verdict' docs/experiments/exp-b-self-review.md`
  - `grep -q 'planLoop' docs/experiments/exp-b-self-review.md`

### Implementation
Create `docs/experiments/exp-b-self-review.md` documenting:
- **Approach**: How draftProposal + proposalLoop were merged into single draftAndReview agent
- **Baseline**: Proposal phase timing from TASK-135 baseline (or TASK-134: draftProposal 136s + proposalLoop 69s = 205s combined) and planLoop baseline iteration count
- **Experiment result**: Wall-clock time for merged proposal phase on reference task; planLoop iteration count on that task
- **Quality assessment**: Was the merged proposal quality sufficient? Did planLoop converge faster, same, or slower?
- **Verdict**: PASS if planLoop iteration count ≤ baseline (quality preserved); FAIL if planLoop iterations increased (quality degraded); null result (no wall-clock saving) is still PASS if quality preserved

### DoD
- `bash scripts/validate-plugin.sh`
- `test -f docs/experiments/exp-b-self-review.md`
- `test -s docs/experiments/exp-b-self-review.md`
- `grep -q 'verdict' docs/experiments/exp-b-self-review.md`
- `grep -q 'planLoop' docs/experiments/exp-b-self-review.md`
- `grep -q '## Approach' docs/experiments/exp-b-self-review.md`

## Constraints
- Do not modify epic-to-backlog/SKILL.md in this experiment — deferred to child 4
- Do not modify draftPlan, planLoop, or finalise phases
- Do not change the APPROVED criteria — the same checklist must apply inside the merged agent
- The reference task for timing must be a new-description topic (not an existing task ID) so the ProposalLoop path is exercised
- If TASK-135 baseline measurement is not complete, use TASK-134 self-timing: draftProposal 136s + proposalLoop 69s = 205s combined as the proposal stage baseline
- FAILED verdict on quality grounds requires reverting the SKILL.md change (document in results)

## Acceptance Gate
- `bash scripts/validate-plugin.sh`
- `grep -q 'self-review' plugin/skills/feature-to-backlog/SKILL.md`
- `test -f docs/experiments/exp-b-self-review.md`
- `grep -q 'verdict' docs/experiments/exp-b-self-review.md`
- `grep -q 'planLoop' docs/experiments/exp-b-self-review.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Plan review iteration 1: APPROVED

cap:propose=approved

claimed: 2026-06-21T17:30:00Z

All DoD items passed. Merged to main. Experiment B verdict: PASS — draftAndReview self-review merger eliminates separate proposalLoop agent spawn (~25–43% reduction in proposal stage time).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bash scripts/validate-plugin.sh
- [x] #2 grep -q 'self-review' plugin/skills/feature-to-backlog/SKILL.md
- [x] #3 ! grep -q 'Phase 2: reviewLoop(proposal)' plugin/skills/feature-to-backlog/SKILL.md
- [x] #4 test -f docs/experiments/exp-b-self-review.md
- [x] #5 test -s docs/experiments/exp-b-self-review.md
- [x] #6 grep -q 'verdict' docs/experiments/exp-b-self-review.md
- [x] #7 grep -q 'planLoop' docs/experiments/exp-b-self-review.md
- [x] #8 grep -q '## Approach' docs/experiments/exp-b-self-review.md
<!-- DOD:END -->
