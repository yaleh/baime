# Exp-I Hypotheses — Pre-registered (frozen before LLM calls)

**Experiment**: Persona Effect on decomposer CODE-CHANGE vs DOC-ONLY classification accuracy  
**Research question**: Does adding an expert architect persona to the decomposer prompt improve classification accuracy?

---

## Variants

- **V0** (control): Opens with `"You are the autonomous decomposer agent for epic TASK-N."`
- **V1** (treatment): Opens with expert architect persona; same classification rules as V0

---

## Pre-registered Hypotheses

### H-A — Persona improves AMBIGUOUS accuracy

**Claim**: V1 accuracy on AMBIGUOUS fixtures ≥ V0 accuracy on AMBIGUOUS fixtures + 5pp  
**Threshold**: Δ(V1_ambig − V0_ambig) ≥ 0.05  
**Direction**: V1 > V0  
**Rationale**: Expert persona should help on ambiguous cases where explicit rules don't fully determine the answer; the architect framing primes the model to infer implementation vs. documentation intent.

**Verdict criteria**:
- `CONFIRMED` if Δ ≥ 0.05
- `NULL` if |Δ| < 0.05
- `REJECTED` if Δ < −0.05 (V1 worse)

---

### H-B — Both variants achieve ceiling on CLEAR fixtures

**Claim**: Both V0 and V1 achieve ≥ 0.90 accuracy on CLEAR fixtures  
**Threshold**: accuracy(CLEAR) ≥ 0.90 for both variants  
**Direction**: both high  
**Rationale**: CLEAR fixtures have explicit file-type signals that the classification rules directly address; both variants should get these right, establishing a ceiling check. Failure indicates rule comprehension failure unrelated to persona.

**Verdict criteria**:
- `CONFIRMED` if V0_clear ≥ 0.90 AND V1_clear ≥ 0.90
- `REJECTED` otherwise (any variant fails the ceiling)

---

### H-C — Persona improves overall accuracy

**Claim**: V1 overall accuracy ≥ V0 overall accuracy + 5pp  
**Threshold**: Δ(V1_overall − V0_overall) ≥ 0.05  
**Direction**: V1 > V0  
**Rationale**: If H-A is confirmed (persona helps on AMBIGUOUS), the effect should propagate to overall accuracy. H-C tests whether the overall delta clears the practical significance threshold.

**Verdict criteria**:
- `CONFIRMED` if Δ ≥ 0.05
- `NULL` if |Δ| < 0.05
- `REJECTED` if Δ < −0.05

---

### H-D — No asymmetric bias toward CODE-CHANGE

**Claim**: V1 DOC-ONLY recall is not degraded relative to V0 by more than 10pp  
**Threshold**: V1_DO_recall − V0_DO_recall > −0.10  
**Direction**: no asymmetric bias  
**Rationale**: Expert architect framing might prime the model toward implementation thinking, biasing toward CODE-CHANGE and systematically misclassifying DOC-ONLY tasks. H-D tests for this failure mode. A small positive change in CC recall that comes at the cost of a > 10pp drop in DO recall would indicate an asymmetric bias introduced by the persona.

**Verdict criteria**:
- `CONFIRMED` if V1_DO_recall − V0_DO_recall > −0.10 (no dangerous asymmetric bias)
- `REJECTED` if V1_DO_recall − V0_DO_recall ≤ −0.10 (asymmetric bias confirmed)

---

## Implications by scenario

| H-A | H-C | H-D | Implication |
|-----|-----|-----|-------------|
| CONFIRMED | CONFIRMED | CONFIRMED | Add V1 persona to decomposer prompt — clear win |
| CONFIRMED | NULL | CONFIRMED | Add persona; helps ambiguous, no overall harm |
| NULL | NULL | CONFIRMED | No effect; rules already sufficient; skip persona |
| REJECTED | REJECTED | any | Current functional directive better; rules suffice |
| any | any | REJECTED | Don't add persona; asymmetric bias risk outweighs gain |

---

## Statistical design

- k=5 per (variant, fixture, model) cell
- Models: `claude-haiku-4-5-20251001` (primary), `claude-sonnet-4-6` (cross-check)
- AMBIGUOUS class: n=8 fixtures × k=5 = 40 trials per model per variant
- CLEAR class: n=8 fixtures × k=5 = 40 trials per model per variant
- Total: ~320 LLM calls
- Cross-model consistency: if Haiku and Sonnet disagree on direction, tag `[underpowered]`
- V_meta_experiment = 0.97 (pre-computed per design doc)

---

*Pre-registration timestamp: see git commit. No LLM calls made before this commit.*
