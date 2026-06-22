# Exp-J Hypotheses — Pre-registered (frozen before LLM calls)

**Experiment**: Higher-power replication of Exp-I — Persona Effect on decomposer CODE-CHANGE vs DOC-ONLY classification (n=16 AMBIGUOUS fixtures)
**Research question**: Does adding an expert architect persona to the decomposer prompt improve classification accuracy on AMBIGUOUS sub-task descriptions at higher statistical power?

---

## Background

Exp-I (TASK-160) found H-A CONFIRMED at the exact 5pp threshold on Haiku (Δ=+0.050) but H-A direction reversed on Sonnet (Δ=−0.025), triggering the cross-model `[underpowered]` flag. With n=8 AMBIGUOUS fixtures, a single fixture flip swings Δ by 12.5pp. Exp-J doubles the AMBIGUOUS set to n=16 to obtain a definitive verdict. CLEAR fixtures are not re-run (ceiling already confirmed at 1.0 in Exp-I); H-B2 is inherited.

---

## Variants

- **V0** (control): Opens with `"You are the autonomous decomposer agent for epic TASK-N."`
- **V1** (treatment): Opens with expert architect persona; same classification rules as V0

Both prompt templates are identical to Exp-I — only the fixture set changes.

---

## Pre-registered Hypotheses

### H-A2 — Persona improves AMBIGUOUS accuracy (higher-power replication)

**Claim**: V1 accuracy on AMBIGUOUS fixtures ≥ V0 accuracy on AMBIGUOUS fixtures + 5pp  
**Threshold**: Δ(V1_ambig − V0_ambig) ≥ 0.05  
**Direction**: V1 > V0  
**Scope**: 16 AMBIGUOUS fixtures (8 from Exp-I + 8 new)  
**Rationale**: Replicates H-A from Exp-I with higher statistical power; a single fixture flip now moves Δ by 6.25pp instead of 12.5pp, enabling cross-model disagreement to be resolved.

**Verdict criteria**:
- `CONFIRMED` if Δ ≥ 0.05
- `NULL` if |Δ| < 0.05
- `REJECTED` if Δ < −0.05 (V1 worse)

---

### H-B2 — Both variants achieve ceiling on CLEAR fixtures

**Status**: **inherited: CONFIRMED from Exp-I**  
**Original claim**: Both V0 and V1 achieve ≥ 0.90 accuracy on CLEAR fixtures  
**Exp-I result**: V0_clear = 1.000, V1_clear = 1.000 (both models)  
**Rationale for inheritance**: CLEAR fixtures are not re-run in Exp-J because the ceiling was confirmed at 1.0 in Exp-I for both Haiku and Sonnet. Re-running would not provide new information. H-B2 carries forward the CONFIRMED status from Exp-I as a prior established result.

---

### H-C2 — Persona improves accuracy on AMBIGUOUS-only run

**Claim**: V1 overall accuracy ≥ V0 overall accuracy + 5pp  
**Note**: Because Exp-J runs only AMBIGUOUS fixtures, H-C2 is equivalent to H-A2 in this run (no CLEAR fixtures to dilute the overall). The distinction is preserved for symmetry with Exp-I.  
**Threshold**: Δ(V1_overall − V0_overall) ≥ 0.05  
**Direction**: V1 > V0

**Verdict criteria**:
- `CONFIRMED` if Δ ≥ 0.05
- `NULL` if |Δ| < 0.05
- `REJECTED` if Δ < −0.05

---

### H-D2 — No asymmetric bias toward CODE-CHANGE

**Claim**: V1 DOC-ONLY recall is not degraded relative to V0 by more than 10pp  
**Threshold**: V1_DO_recall − V0_DO_recall > −0.10  
**Direction**: no asymmetric bias  
**Rationale**: Expert architect framing might prime the model toward implementation thinking, biasing toward CODE-CHANGE. H-D2 tests whether any AMBIGUOUS accuracy gain comes at the cost of systematic DOC-ONLY misclassification.

**Verdict criteria**:
- `CONFIRMED` if V1_DO_recall − V0_DO_recall > −0.10 (no dangerous asymmetric bias)
- `REJECTED` if V1_DO_recall − V0_DO_recall ≤ −0.10 (asymmetric bias confirmed)

---

## Cross-model consistency rules (priority order)

Applied after measuring both Haiku and Sonnet at n=16:

1. Both Haiku and Sonnet show V1 > V0 AND Δ ≥ 0.05 → **CONFIRMED** (high-confidence)
2. Both show V1 > V0 but one Δ < 0.05 → **CONFIRMED [borderline]**
3. Models disagree on direction (one positive, one negative) → **NULL** [insufficient power even at n=16]
4. Both show V1 ≤ V0 → **REJECTED**

---

## Implications by scenario

| H-A2 | H-C2 | H-D2 | Implication |
|------|------|------|-------------|
| CONFIRMED | CONFIRMED | CONFIRMED | Add V1 persona to decomposer prompt — clear win |
| CONFIRMED | NULL | CONFIRMED | Add persona; helps ambiguous, no overall harm |
| NULL | NULL | CONFIRMED | No effect; rules already sufficient; skip persona |
| REJECTED | REJECTED | any | Current functional directive better; rules suffice |
| any | any | REJECTED | Don't add persona; asymmetric bias risk outweighs gain |

---

## Statistical design

- k=5 per (variant, fixture, model) cell
- Models: `claude-haiku-4-5-20251001` (primary), `claude-sonnet-4-6` (cross-check)
- AMBIGUOUS class: n=16 fixtures × k=5 = 80 trials per model per variant
- Total: ~320 LLM calls (same as Exp-I; all in AMBIGUOUS class)
- Single fixture flip moves Δ by 6.25pp (vs 12.5pp in Exp-I)
- V_meta_experiment = 0.97 (pre-computed per design; pre-registration honored)

---

*Pre-registration timestamp: see git commit. No LLM calls made before this commit.*
