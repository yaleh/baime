---
id: TASK-162
title: >-
  Run Exp-K: prompt completeness ablation — persona effect under P-minimal /
  P-rules / P-full on decomposer AMBIGUOUS classification
status: 'Basic: Done'
assignee: []
created_date: '2026-06-23 00:36'
updated_date: '2026-06-23 11:03'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Exp-I/Exp-J found cross-model disagreement (Haiku benefits from expert persona, Sonnet is hurt). The prompt used in both experiments contained explicit CODE-CHANGE/DOC-ONLY classification rules. Exp-K tests the interpretation that persona helps when the prompt is underspecified but is redundant or disruptive when rules are already present — by running V0 vs V1 across three prompt completeness levels: P-minimal (no rules, only hint + output instruction), P-rules (current prompt with explicit rules), and P-full (rules + 3 few-shot examples). Fixture set: the 16 AMBIGUOUS fixtures from Exp-J. Models: Haiku and Sonnet. k=5 per cell.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Run Exp-K — prompt completeness ablation on decomposer persona effect

## Context
Exp-I and Exp-J tested whether an expert persona (V1) improves CODE-CHANGE vs DOC-ONLY classification on AMBIGUOUS sub-task descriptions. Both experiments used a prompt containing explicit classification rules. Cross-model disagreement persisted at n=16 (Haiku +3.7pp, Sonnet −3.7pp). Exp-K tests whether prompt completeness mediates this effect: persona should help most when the prompt is underspecified (P-minimal) and least when it is complete (P-full). If the monotone Δ(persona) vs completeness relationship holds, the interpretation is validated.

## Phase 1: Pre-register Exp-K hypotheses
Create experiments/skill-quality/exp-k/hypotheses.md with hypotheses H-K1 through H-K3, defined as:
- H-K1: Persona Δ(AMBIG) at P-minimal > Δ at P-rules (persona helps more when rules absent)
- H-K2: Persona Δ(AMBIG) at P-rules > Δ at P-full (persona helps more with fewer examples)
- H-K3: At P-minimal, both models show positive Δ (persona universally helpful with underspecified prompts)
Git commit the file before writing any fixtures or running any LLM calls.
### DoD
- [ ] `test -f experiments/skill-quality/exp-k/hypotheses.md`
- [ ] `grep -q 'H-K1' experiments/skill-quality/exp-k/hypotheses.md`
- [ ] `grep -q 'H-K3' experiments/skill-quality/exp-k/hypotheses.md`
- [ ] `git log --oneline -1 -- experiments/skill-quality/exp-k/hypotheses.md | grep -q .`

## Phase 2: Build three prompt templates per variant
Create experiments/skill-quality/exp-k/prompts.ts defining six prompt builders (P-minimal×V0, P-minimal×V1, P-rules×V0, P-rules×V1, P-full×V0, P-full×V1):
- P-minimal: opening directive + subtaskHint + epicPlanExcerpt + "Output exactly one word: CODE-CHANGE or DOC-ONLY" — NO classification rules
- P-rules: P-minimal + the explicit CODE-CHANGE/DOC-ONLY rule block (identical to Exp-I/Exp-J)
- P-full: P-rules + 3 few-shot examples (one clear CC, one clear DO, one ambiguous CC — drawn from Exp-I CLEAR fixtures, not from the test AMBIGUOUS set)
V0 opening: "You are the autonomous decomposer agent for epic TASK-N."
V1 opening: "You are an experienced software architect decomposing an epic into independently implementable child tasks. Your primary skill is distinguishing implementation work (code and file changes) from analytical or documentation work (research, prose writing, audits)."
Verify TypeScript compiles: cd experiments/skill-quality && npx tsc --noEmit
### DoD
- [ ] `test -f experiments/skill-quality/exp-k/prompts.ts`
- [ ] `grep -q 'P-minimal' experiments/skill-quality/exp-k/prompts.ts`
- [ ] `grep -q 'P-full' experiments/skill-quality/exp-k/prompts.ts`
- [ ] `! { cd experiments/skill-quality && npx tsc --noEmit 2>&1 | grep -q 'exp-k'; }`

## Phase 3: Implement run-exp-k.ts
Create experiments/skill-quality/exp-k/run-exp-k.ts. Port from run-exp-j.ts with these changes:
- variants: { 'P-minimal/V0', 'P-minimal/V1', 'P-rules/V0', 'P-rules/V1', 'P-full/V0', 'P-full/V1' } — all pointing to the same 16 AMBIGUOUS fixture paths from fixtures/exp-j/ambiguous/
- buildPrompt(fixture, variant): dispatch to the appropriate builder from prompts.ts based on variant key
- modelList: [getModelPrimary(), 'claude-sonnet-4-6']
- outDir default: artifacts/runs/exp-k
- analyze(): compute per-(completeness-level, variant, model) accuracy; compute H-K1/K2/K3 verdicts; write artifacts/analysis/exp-k-results.json with "data_source": "measured"
- Sanity dir: reuse fixtures/exp-i/sanity/
### DoD
- [ ] `test -f experiments/skill-quality/exp-k/run-exp-k.ts`
- [ ] `grep -q 'P-minimal' experiments/skill-quality/exp-k/run-exp-k.ts`
- [ ] `grep -q 'P-full' experiments/skill-quality/exp-k/run-exp-k.ts`
- [ ] `! { cd experiments/skill-quality && npx tsc --noEmit 2>&1 | grep -q 'exp-k'; }`

## Phase 4: Run experiment and compute verdicts
Run: cd experiments/skill-quality && npx tsx exp-k/run-exp-k.ts --k 5 --out artifacts/runs/exp-k
This executes 16 fixtures × 6 variants × 5 reps × 2 models = 960 LLM calls total.
After run completes, fill verdict table: for each (model, completeness-level), record V0 acc, V1 acc, Δ. Compute H-K1/K2/K3 verdicts. If Δ(P-minimal) > Δ(P-rules) > Δ(P-full) holds for both models → interpretation CONFIRMED. Write results to exp-k-results.json.
### DoD
- [ ] `test -f experiments/skill-quality/artifacts/analysis/exp-k-results.json`
- [ ] `grep -q '"data_source": "measured"' experiments/skill-quality/artifacts/analysis/exp-k-results.json`
- [ ] `grep -q 'P-minimal' experiments/skill-quality/artifacts/analysis/exp-k-results.json`

## Phase 5: Write back evidence
Create docs/experiments/exp-k-decomposer-persona.md with full design doc (research question, variants, fixture design, hypotheses, verdict table with measured values, V_meta_experiment, interpretation). Update docs/baime-and-quantitative-experiments.md with Exp-K section. Add note to TASK-162: "exp-k: <one-line verdict>".
### DoD
- [ ] `test -f docs/experiments/exp-k-decomposer-persona.md`
- [ ] `grep -q 'CONFIRMED\|NULL\|REJECTED' docs/experiments/exp-k-decomposer-persona.md`
- [ ] `grep -q 'Exp-K' docs/baime-and-quantitative-experiments.md`
- [ ] `backlog task view TASK-162 --plain | grep -q 'exp-k:'`

## Constraints
- Hypotheses must be git-committed before any LLM call in Phase 4
- Few-shot examples in P-full must come from CLEAR fixtures only — never from the AMBIGUOUS test set
- Do not modify plugin/skills/loop-backlog/SKILL.md in this task
- Cross-model consistency rule: if Haiku and Sonnet disagree on the monotone ordering, tag verdict [underpowered]
- V0/V1 prompt templates identical to Exp-I/Exp-J except for completeness level

## Acceptance Gate
- [ ] `grep -q 'CONFIRMED\|NULL\|REJECTED' docs/experiments/exp-k-decomposer-persona.md`
- [ ] `grep -q '"data_source": "measured"' experiments/skill-quality/artifacts/analysis/exp-k-results.json`
- [ ] `grep -q 'Exp-K' docs/baime-and-quantitative-experiments.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

cap:propose=approved

claimed: 2026-06-23T09:07:02Z

Phase 1 ✓ 2026-06-23T00:00:00Z
hypotheses.md created and committed

Phase 2 ✓ 2026-06-23T00:00:00Z
prompts.ts created, TypeScript clean

Phase 3 ✓ 2026-06-23T00:00:00Z
run-exp-k.ts created, TypeScript clean

Phase 4 ✓ 2026-06-23T10:58:56Z
experiment completed, results written

exp-k: H-K1 CONFIRMED — Δ(P-minimal)=+0.237 vs Δ(P-rules)=+0.025 on Haiku, Sonnet 0.000 vs −0.012; H-K2 NULL cross-model disagreement; H-K3 NULL partial (Haiku +0.237, Sonnet 0.000)

Phase 5 ✓ 2026-06-23T11:00:47Z
docs written, exp-k note added

## Execution Summary
Result: Done
Phases: 1 (hypotheses+commit), 2 (prompts.ts), 3 (run-exp-k.ts), 4 (960 LLM calls), 5 (docs+task-note)

## Key Findings

Exp-K measured:
- Haiku P-minimal: V0=0.700, V1=0.938, Δ=+0.237 (large persona effect without rules)
- Haiku P-rules: V0=0.938, V1=0.963, Δ=+0.025 (small effect with rules)
- Haiku P-full: V0=0.975, V1=0.950, Δ=−0.025 (no effect with rules+examples)
- Sonnet P-minimal: V0=0.875, V1=0.875, Δ=0.000 (no effect; higher baseline)
- Sonnet P-rules: V0=0.950, V1=0.938, Δ=−0.012
- Sonnet P-full: V0=1.000, V1=1.000, Δ=0.000 (ceiling)

H-K1 CONFIRMED: Δ_minimal > Δ_rules (both models agree)
H-K2 NULL [cross-model disagreement] [underpowered]
H-K3 NULL [partial] (Haiku positive, Sonnet zero)

Persona is a rule-substitute not a rule-augment. No change to production decomposer warranted.

Completed: 2026-06-23T11:03:01Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f experiments/skill-quality/exp-k/hypotheses.md
- [ ] #2 grep -q 'H-K1' experiments/skill-quality/exp-k/hypotheses.md
- [ ] #3 grep -q 'H-K3' experiments/skill-quality/exp-k/hypotheses.md
- [ ] #4 git log --oneline -1 -- experiments/skill-quality/exp-k/hypotheses.md | grep -q .
- [ ] #5 test -f experiments/skill-quality/exp-k/prompts.ts
- [ ] #6 grep -q 'P-minimal' experiments/skill-quality/exp-k/prompts.ts
- [ ] #7 grep -q 'P-full' experiments/skill-quality/exp-k/prompts.ts
- [ ] #8 ! { cd experiments/skill-quality && npx tsc --noEmit 2>&1 | grep -q 'exp-k'; }
- [ ] #9 test -f experiments/skill-quality/exp-k/run-exp-k.ts
- [ ] #10 grep -q 'P-minimal' experiments/skill-quality/exp-k/run-exp-k.ts
- [ ] #11 grep -q 'P-full' experiments/skill-quality/exp-k/run-exp-k.ts
- [ ] #12 ! { cd experiments/skill-quality && npx tsc --noEmit 2>&1 | grep -q 'exp-k'; }
- [ ] #13 test -f experiments/skill-quality/artifacts/analysis/exp-k-results.json
- [ ] #14 grep -q '"data_source": "measured"' experiments/skill-quality/artifacts/analysis/exp-k-results.json
- [ ] #15 grep -q 'P-minimal' experiments/skill-quality/artifacts/analysis/exp-k-results.json
- [ ] #16 test -f docs/experiments/exp-k-decomposer-persona.md
- [ ] #17 grep -q 'CONFIRMED\|NULL\|REJECTED' docs/experiments/exp-k-decomposer-persona.md
- [ ] #18 grep -q 'Exp-K' docs/baime-and-quantitative-experiments.md
- [ ] #19 backlog task view TASK-162 --plain | grep -q 'exp-k:'
- [ ] #20 grep -q 'CONFIRMED\|NULL\|REJECTED' docs/experiments/exp-k-decomposer-persona.md
- [ ] #21 grep -q '"data_source": "measured"' experiments/skill-quality/artifacts/analysis/exp-k-results.json
- [ ] #22 grep -q 'Exp-K' docs/baime-and-quantitative-experiments.md
<!-- DOD:END -->
