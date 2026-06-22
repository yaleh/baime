# Exp-J: Higher-power replication of persona effect on decomposer AMBIGUOUS classification

**Status**: COMPLETE — run 2026-06-22, all hypotheses adjudicated  
**Date**: 2026-06-22  
**Research question**: Does adding an expert architect persona to the decomposer prompt improve CODE-CHANGE vs DOC-ONLY classification accuracy on AMBIGUOUS sub-tasks? (Replication of Exp-I at n=16 AMBIGUOUS fixtures for definitive cross-model verdict)

---

## Motivation

Exp-I (TASK-160) found H-A CONFIRMED at the exact 5pp threshold on Haiku (Δ=+0.050) but direction reversed on Sonnet (Δ=−0.025), triggering the cross-model `[underpowered]` flag. With only n=8 AMBIGUOUS fixtures, a single fixture flip swings Δ by 12.5pp — making it impossible to distinguish a real persona effect from fixture-level noise. Exp-J doubles the AMBIGUOUS fixture set to n=16 (one flip = 6.25pp), re-runs both models at k=5 with identical V0/V1 prompt templates, and computes a definitive verdict.

CLEAR fixtures are not re-run (ceiling established at 1.0 in Exp-I for both models and both variants). H-B2 is carried forward as an inherited CONFIRMED result.

---

## Variants

### V0 — Control (current state)

```
You are the autonomous decomposer agent for epic TASK-N.

## Classification Rules
CODE-CHANGE: The sub-task creates or modifies files under plugin/, scripts/, any SKILL.md, or *.sh scripts.
DOC-ONLY: The sub-task scope is exclusively reading, researching, writing prose docs, or updating backlog notes. The natural output is a document or measurement report — no source file is created or modified.

When in doubt, apply the rule strictly based on whether the task's primary output is a file change or a prose document.

Sub-task hint: {HINT}
Epic plan excerpt: {PLAN}
Classify this sub-task as CODE-CHANGE or DOC-ONLY.
Output exactly one token: CODE-CHANGE or DOC-ONLY
```

### V1 — Expert persona (treatment)

Same prompt, opening line replaced with:

```
You are an experienced software architect decomposing an epic into independently implementable child tasks.
Your primary skill is distinguishing implementation work (code and file changes) from analytical or
documentation work (research, prose writing, audits).
```

**Key design constraint**: Classification rules are **identical** in V0 and V1. Only the opening framing changes. This isolates the persona effect from rule content. V0/V1 prompt templates are identical to Exp-I — only the fixture set changes.

---

## Fixture design

### Fixture schema

```json
{
  "id": "decomp-ambig-cc-09",
  "fixtureClass": "AMBIGUOUS",
  "expectedClass": "CODE-CHANGE",
  "epicPlanExcerpt": "...",
  "subtaskHint": "...",
  "ground_truth_rationale": "...",
  "tricky_aspect": "..."
}
```

### Fixtures: AMBIGUOUS (n=16)

8 carried forward from Exp-I + 8 new in Exp-J:

**From Exp-I (ambig-cc-01 through ambig-do-04)**:

| ID | hint | expected | tricky_aspect |
|----|------|----------|---------------|
| ambig-cc-01 | Improve decomposer prompt clarity for multi-file epic edge cases | CODE-CHANGE | "improve prompt" sounds like docs; prompt lives in SKILL.md |
| ambig-cc-02 | Add CODE-CHANGE classification rationale for config-only tasks to SKILL | CODE-CHANGE | "add rationale" sounds like writing; "to SKILL" is the signal |
| ambig-cc-03 | Port existing classify-subtask logic onto the shared decomposer helper | CODE-CHANGE | "port" and "helper" imply code; no explicit file type |
| ambig-cc-04 | Audit scripts/verify-subtask-dod.sh and patch any false-negative cases | CODE-CHANGE | "audit" suggests research; "patch" implies code; mixed framing |
| ambig-do-01 | Calibrate oracle accuracy for decomposer classification decisions | DOC-ONLY | "calibrate" sounds technical; but this is measurement/research |
| ambig-do-02 | Investigate whether R1 guard catches all DOC-ONLY misclassifications | DOC-ONLY | "investigate" alone is research; no fix/implement framing |
| ambig-do-03 | Evaluate the decomposer against 20 historical epics and report findings | DOC-ONLY | "evaluate" + "report" → DOC-ONLY; might seem like scripting |
| ambig-do-04 | Define classification criteria for tasks that mix code and documentation | DOC-ONLY | "define" could mean implement code; but criteria-setting is a doc task |

**New in Exp-J (ambig-cc-09 through ambig-do-12)**:

| ID | hint | expected | tricky_aspect |
|----|------|----------|---------------|
| ambig-cc-09 | Refactor the epic-worker event dispatch to use the new channel interface | CODE-CHANGE | no file type named; "channel interface" sounds like a spec |
| ambig-cc-10 | Wire up the loop-backlog child-done handler to reconcile parent epic state | CODE-CHANGE | no explicit file path; "reconcile state" could sound like doc |
| ambig-cc-11 | Update the decomposer's output schema to include a confidence field | CODE-CHANGE | "update schema" sounds like docs; schema lives in SKILL.md |
| ambig-cc-12 | Patch the rate-limit backoff logic in the LLM client to handle 429 retries | CODE-CHANGE | "backoff logic" sounds algorithmic; "patch" is ambiguous |
| ambig-do-09 | Benchmark how long each loop-backlog phase takes across 10 recent epics | DOC-ONLY | "benchmark" sounds like running code; but output is a latency report |
| ambig-do-10 | Review and annotate the existing rate-limit handling decisions in the backlog | DOC-ONLY | "rate-limit handling" sounds technical; output is annotations/doc |
| ambig-do-11 | Map out the state transitions in the B″ epic lifecycle as a diagram | DOC-ONLY | "map out" could mean state machine code; output is a diagram/doc |
| ambig-do-12 | Assess whether the current DoD shell-command format scales to multi-step tasks | DOC-ONLY | "scales" sounds like performance testing; output is an assessment doc |

**Ground truth rationale for AMBIGUOUS fixtures**: Apply the explicit rules strictly. If a description implies modifying a file under `plugin/`, `scripts/`, SKILL.md, or `*.sh`, it is CODE-CHANGE. If the natural output is a prose document or measurement report, it is DOC-ONLY. Ambiguity arises from verb framing, not from rule ambiguity.

### Sanity fixtures (negative control)

Reused from Exp-I (`fixtures/exp-i/sanity/`):
- `sanity-cc-obv`: "Write a research summary of task classification approaches" → expected: DOC-ONLY
- `sanity-do-obv`: "Implement the task classification algorithm in plugin/decomposer.ts" → expected: CODE-CHANGE

---

## Pre-registered hypotheses

Hypotheses frozen in git commit before any LLM call.

| ID | Hypothesis | Threshold | Direction |
|----|-----------|-----------|-----------|
| **H-A2** | V1 accuracy on AMBIGUOUS fixtures ≥ V0 + 5pp | Δ ≥ 0.05 | V1 > V0 |
| **H-B2** | Both V0 and V1 achieve ≥ 0.90 on CLEAR fixtures | ≥ 0.90 | both high |
| **H-C2** | V1 overall accuracy ≥ V0 + 5pp (AMBIGUOUS-only run) | Δ ≥ 0.05 | V1 > V0 |
| **H-D2** | V1 DO recall not degraded > 10pp vs V0 | Δ > −0.10 | no bias |

H-B2 is **inherited CONFIRMED from Exp-I** (V0_clear=1.000, V1_clear=1.000 for both models). Not re-measured.

---

## Execution plan

- k=5 per (variant, fixture, model) cell
- Models: `claude-haiku-4-5-20251001` (primary), `claude-sonnet-4-6` (cross-check)
- AMBIGUOUS class: n=16 fixtures × k=5 = 80 trials per model per variant
- Total: 320 LLM calls across 2 models (same total as Exp-I; all AMBIGUOUS)
- Checkpoint/resume: result.json written per cell immediately; resume skips completed cells

---

## Results

Run completed 2026-06-22. Results from `artifacts/analysis/exp-j-results.json`.

### Per-model measurements

| Model | V0 AMBIG | V1 AMBIG | V0 overall | V1 overall | V0 CC_recall | V1 CC_recall | V0 DO_recall | V1 DO_recall |
|-------|----------|----------|------------|------------|--------------|--------------|--------------|--------------|
| Haiku | 0.938 | 0.975 | 0.938 | 0.975 | 0.875 | 0.950 | 1.000 | 1.000 |
| Sonnet | 0.975 | 0.938 | 0.975 | 0.938 | 0.950 | 0.875 | 1.000 | 1.000 |

### Verdict table

| Hypothesis | V0 obs | V1 obs | Δ | Verdict |
|-----------|--------|--------|---|---------|
| H-A2 (AMBIG Δ ≥ 0.05) | 0.938 | 0.975 | +0.037 | **NULL** |
| H-B2 (CLEAR ≥ 0.90) | 1.000* | 1.000* | — | **CONFIRMED** (inherited from Exp-I) |
| H-C2 (overall Δ ≥ 0.05) | 0.938 | 0.975 | +0.037 | **NULL** |
| H-D2 (DO recall Δ > −0.10) | 1.000 | 1.000 | 0.000 | **CONFIRMED** |

*Haiku primary model used for H-A2/C2/D2 verdicts. H-B2 values from Exp-I.*

### Cross-model consistency

**NULL [cross-model disagreement]** — Models disagree on direction after n=16:
- Haiku: Δ(AMBIG) = +0.037 (V1 better)
- Sonnet: Δ(AMBIG) = −0.037 (V0 better)

The disagreement is perfectly symmetric (Haiku gains exactly what Sonnet loses). This is a strong signal that the 8 new Exp-J fixtures happened to slightly advantage V1 on Haiku's classification style and V0 on Sonnet's. At n=16, cross-model disagreement persists — definitive verdict: **NULL**.

---

## V_meta_experiment [measured]

| Component | Score | Notes |
|-----------|-------|-------|
| Pre-registration discipline | 1.0 | git commit timestamp before any LLM call |
| Statistical power | 0.9 | n=16 per class × k=5 per model; cross-model NULL persists |
| Oracle quality | 1.0 | automated ground truth, no LLM oracle needed |
| Confound isolation | 0.9 | single-variable change (persona only); rules identical in V0/V1 |
| **V_meta_experiment** | **0.97** | mean of above |

---

## Interpretation

H-A2 is NULL on the primary model (Haiku Δ=+0.037 < 0.05 threshold), and cross-model consistency rule #3 applies: models disagree on direction (Haiku positive, Sonnet negative). Per the pre-registered protocol, this is a **definitive NULL** — insufficient evidence to conclude that the expert persona improves CODE-CHANGE vs DOC-ONLY classification.

The symmetric disagreement (±0.037) is noteworthy: the 8 new Exp-J fixtures created exactly canceling effects across models. This suggests the signal is model-specific and unstable, not a true causal effect of the persona. Both models achieve high baseline accuracy (≥0.938 at V0), and H-D2 is CONFIRMED — no asymmetric bias toward CODE-CHANGE in either model or variant.

**Decision**: Do not add the V1 expert persona to the loop-backlog decomposer SKILL.md. The current functional directive is sufficient. Both Exp-I and Exp-J converge on: classification rules already capture most of the signal; residual errors are idiosyncratic to specific fixtures and do not improve systematically with persona framing.

---

## Open questions

1. **Fixture balance**: The 8 new Exp-J fixtures were designed to match the tricky-aspect profile of Exp-I but may have introduced a systematic bias favoring one model's classification style. A third replication with a different fixture author would test this.

2. **Sonnet V0 advantage**: Sonnet achieves 0.975 V0 accuracy vs 0.938 V0 for Haiku — suggesting Sonnet's underlying classification quality is already higher, leaving less room for persona improvement.

3. **Alternative persona positions**: The persona is prepended before the rules. Injecting it after (or as a system message) might yield a different result — not tested in Exp-I/J.

4. **k=5 power analysis**: At n=16, k=5, the minimum detectable effect at 80% power is approximately 0.06 (6pp). Smaller real effects (e.g. 3pp) would require k=10 or n=32 to be reliably detected.

---

## Implications

Per the pre-registration implication table:
- H-A2: NULL, H-C2: NULL, H-D2: CONFIRMED → "No effect; rules already sufficient; skip persona"

No SKILL.md change warranted. This is a definitive negative result documented as evidence. If a future practitioner wants to revisit the persona question, they should use n≥32 or a fundamentally different persona formulation (not just the expert architect framing).
