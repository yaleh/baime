# GCL Hypothesis Validation: H5 + H6 + H7

**Status:** Initial validation — null results due to class imbalance
**Date:** 2026-06-24
**Dataset:** `docs/research/gcl-events.jsonl` (N = 23 gate events)
**Analyst:** TASK-176.6 automated analysis

---

## 1. Pre-Registration

This section was written before analysis. Hypotheses, field definitions, and test selections are stated in advance.

### 1.1 Hypotheses

**H5 — GCL predicts escape rate**
> Low GCL scores (below a threshold, e.g., GCL < 6) are positively associated with escape_rate = 1.
> A gate event with escape_rate = 1 indicates the task escaped the gate without quality issues being caught — i.e., a false negative.
> **Planned test:** Spearman rank correlation between GCL (continuous) and escape_rate (binary 0/1). If variance is too low for Spearman, fall back to point-biserial correlation. Significance threshold: p < 0.05 two-tailed.
> **Directional prediction:** rho < 0, i.e., lower GCL → higher escape rate.

**H6 — evidence_independence predicts escape_rate independently of GCL**
> Gates where evidence is fully independent of the premise source (evidence_independence = "independent") have lower escape_rate than gates where evidence is circular or self-referential, even after controlling for GCL.
> **Planned test:** Partial correlation (Spearman-based) of evidence_independence with escape_rate, partialling out GCL. If evidence_independence is only binary, use logistic regression with GCL as covariate.
> **Directional prediction:** independent evidence reduces escape_rate.

**H7 — gate_actor_type has no significant effect on escape_rate when controlling for evidence_independence**
> Whether the gate is evaluated by an LLM or a human does not significantly affect escape_rate once evidence_independence is held constant.
> **Planned test:** Fisher exact test on a 2 × 2 contingency table (gate_actor_type × escape_rate), stratified by evidence_independence level. Null: no significant difference between actor types.
> **Directional prediction:** null (no significant effect).

### 1.2 Fields Used

| Field | Type | Role |
|---|---|---|
| GCL | integer (4–10) | Predictor for H5 |
| escape_rate | binary 0/1 | Outcome for all hypotheses |
| evidence_independence | categorical | Predictor for H6, covariate for H7 |
| gate_actor_type | categorical (llm/human) | Factor for H7 |
| E, C, H | integers | GCL components (exploratory) |
| gate_type | categorical (plan/proposal) | Stratification variable |
| task_kind | categorical (basic/epic) | Stratification variable |

### 1.3 Test Selection Rationale

- Spearman (H5): appropriate for ordinal/non-normal data with moderate N; robust to outliers.
- Partial correlation (H6): removes confounding GCL from the evidence_independence → escape_rate path.
- Fisher exact (H7): appropriate for small N with binary variables; exact p-values without large-sample assumptions.

---

## 2. Dataset Summary

```
N = 23 gate events
Date range: 2026-06-22 to 2026-06-24
Gate types: plan (15), proposal (8)
Task kinds: basic (8), epic (15)
Reviewer model: claude-sonnet-4-6 (all)
```

### 2.1 GCL Distribution

| GCL | Count |
|-----|-------|
| 4 | 5 |
| 5 | 2 |
| 6 | 3 |
| 7 | 7 |
| 8 | 1 |
| 9 | 4 |
| 10 | 1 |

- Mean GCL = 6.57, SD = 1.84
- Range: [4, 10]

### 2.2 Component Distributions

| Component | Mean | SD | Range |
|-----------|------|----|-------|
| E (evidence count) | 4.65 | 2.73 | [1, 9] |
| C (concerns count) | 1.22 | 0.78 | [0, 3] |
| H (hypothesis links) | 0.70 | 0.47 | [0, 1] |

### 2.3 Field Availability

| Field | Values Present | Usable |
|-------|---------------|--------|
| escape_rate | {0} — all zero | **No variance** |
| evidence_independence | {"unknown"} — all unknown | **No variance** |
| gate_actor_type | {"llm"} — all LLM | **No variance** |

---

## 3. Statistical Results

### 3.1 H5 — GCL vs escape_rate (Spearman Correlation)

**Input:** GCL (N=23, range 4–10), escape_rate (N=23, all = 0)

**Result:**
- Spearman rho = **undefined (NaN)**
- p-value = **undefined (NaN)**
- Reason: escape_rate has zero variance (all values = 0). Spearman correlation requires at least two distinct values in each variable. With a constant outcome, the rank correlation is mathematically undefined.

**Verdict: H5 UNTESTABLE — insufficient outcome variance.**

The test cannot be run. This is not a negative result; it is a data collection gap.

### 3.2 H6 — evidence_independence vs escape_rate (Partial Correlation)

**Input:** evidence_independence (N=23, all = "unknown"), escape_rate (N=23, all = 0)

**Result:**
- Partial correlation = **undefined**
- Reason: Both the predictor (evidence_independence = "unknown" for all records) and the outcome (escape_rate = 0 for all records) have zero variance. The partial correlation cannot be computed.

**Verdict: H6 UNTESTABLE — both predictor and outcome fields lack variance.**

The evidence_independence field requires a structured assessment protocol (e.g., manual coding of whether evidence is drawn independently of the premise). "unknown" is a placeholder, not a measurement.

### 3.3 H7 — gate_actor_type × escape_rate (Fisher Exact Test)

**Input:** gate_actor_type (N=23, all = "llm"), escape_rate (N=23, all = 0)

**Contingency table:**

|  | escape_rate=0 | escape_rate=1 |
|---|---|---|
| gate_actor_type=llm | 23 | 0 |
| gate_actor_type=human | 0 | 0 |

**Result:**
- Fisher exact test = **not applicable** (degenerate table)
- Reason: Both variables are constant. There are no human-actor gate events and no escape events. The 2×2 table collapses to a single cell.

**Verdict: H7 UNTESTABLE — no variation in either variable.**

---

## 4. Power Analysis

Even if escape events were present, the current dataset is underpowered for the planned tests.

**For H5 (Spearman correlation, N=23, alpha=0.05, two-tailed):**
- t critical (df=21): 2.080
- Minimum detectable |rho| at 80% power: ~0.41
- This means only large effect sizes are detectable with this N.
- Cohen's benchmark: rho=0.1 (small), 0.3 (medium), 0.5 (large).
- At N=23, medium effects (rho=0.3) are undetectable without inflated false negative risk.

**For H7 (Fisher exact, 2×2 table):**
- To detect a meaningful difference (OR ≈ 3.0) between actor types with 80% power at alpha=0.05, approximately 50–100 events per cell are needed.
- Current N=23 across a single actor type provides no power.

**Recommended minimum N for future tests:**
- H5: N ≥ 84 (for rho=0.3 detection, alpha=0.05, 80% power)
- H6/H7: N ≥ 30 with balanced classes (escape_rate=0 and escape_rate=1 each ≥ 15)

---

## 5. Limitations

### 5.1 Class Imbalance — Critical Blocker
All 23 records have `escape_rate = 0`. This is the dominant limitation. Without any positive escape events, no hypothesis about escape_rate predictors can be tested. This may reflect:
- A genuinely low escape rate (gates are effective)
- Incomplete escape_rate labeling (the field defaults to 0 without an active labeling process)
- Selection bias in the backfilled historical records (only approved gate events were backfilled)

### 5.2 Evidence Independence Not Coded
`evidence_independence = "unknown"` in all records. This field requires manual or automated coding of whether the evidence supporting a gate decision is independent from the premise under review. A coding rubric and labeling protocol is needed before H6 can be tested.

### 5.3 Single Actor Type
All gate events have `gate_actor_type = "llm"`. No human-actor gate events exist in the dataset. H7 requires at least some human-evaluated gates to test actor type effects.

### 5.4 Small Sample Size
N=23 over a 3-day period (2026-06-22 to 2026-06-24). The GCL score distribution is skewed toward moderate-to-high values (median=7), with limited representation of low-GCL events (GCL≤5: only 7 records). The dataset is not yet representative of the full task diversity.

### 5.5 Data Source Concentration
All records come from a single reviewer model (claude-sonnet-4-6) and two gate types (plan, proposal). Generalization to other gate types (evaluate, quality) requires additional data.

---

## 6. Next Steps

### Immediate (unblock H5)
1. **Add escape_rate labeling process.** When a defect that should have been caught at a gate is discovered downstream, retroactively label the gate event as escape_rate=1. Document this in the schema.
2. **Collect more events over time.** Continue accumulating gcl-events.jsonl; target N≥100 before re-running H5.
3. **Consider synthetic escape events.** Manually construct or identify known-bad gate approvals to seed the positive class, with clear methodology documentation.

### Immediate (unblock H6)
4. **Define an evidence_independence coding rubric.** A gate event's evidence is "independent" if the supporting artifacts (docs, tests, code) were produced by a different agent/process than the one whose work is under review. Code all existing records retrospectively.

### Immediate (unblock H7)
5. **Introduce human-actor gate reviews.** Even a small set of human-reviewed gates (N≥5) would allow a preliminary H7 test.

### Longer-term
6. **Longitudinal tracking.** Track escape_rate over multiple weeks to allow temporal analysis (does lower GCL predict escape weeks later?).
7. **Component-level analysis.** With sufficient N, decompose H5 into H-component vs E-component predictors of escape.
8. **Cross-gate-type analysis.** Separate plan vs proposal gate events for subgroup analysis.

---

## 7. Conclusions

H5, H6, and H7 are **not falsified** by this analysis. They are **untestable** with the current dataset due to:
- Zero variance in the outcome variable (escape_rate = 0 for all N=23 records)
- Missing predictor data (evidence_independence = "unknown", gate_actor_type = "llm" only)
- Underpowered sample (N=23 with no positive outcomes)

This is an expected finding for an early-stage instrumentation project. The gcl-events.jsonl schema is in place and functioning; the next priority is producing valid outcome labels (escape_rate=1 events) to enable actual hypothesis testing.

The GCL score distribution itself (mean=6.57, SD=1.84) provides a meaningful baseline: gates are passing at moderate-to-high quality levels. Whether this quality level is *predictive* of downstream defect escape remains an open empirical question requiring longitudinal data collection.

---

## Appendix A: Reproducibility

```bash
# Reproduce analysis
python3 - <<'EOF'
import json, scipy.stats as stats, numpy as np
from collections import Counter

records = [json.loads(l) for l in open('docs/research/gcl-events.jsonl') if l.strip()]
gcl = [r['GCL'] for r in records]
escape_rate = [r['escape_rate'] for r in records]

print(f"N={len(records)}")
print(f"escape_rate unique: {set(escape_rate)}")
print(f"GCL: mean={np.mean(gcl):.2f} std={np.std(gcl):.2f} range=[{min(gcl)},{max(gcl)}]")

# H5
rho, p = stats.spearmanr(gcl, escape_rate)
print(f"H5 Spearman rho={rho} p={p} (undefined if escape_rate is constant)")

# Power
t_crit = stats.t.ppf(0.975, df=len(records)-2)
rho_crit = t_crit / np.sqrt(t_crit**2 + (len(records)-2))
print(f"Min detectable |rho| at N={len(records)}: {rho_crit:.3f}")
EOF
```

**Expected output (as of 2026-06-24):**
```
N=23
escape_rate unique: {0}
GCL: mean=6.57 std=1.84 range=[4,10]
H5 Spearman rho=nan p=nan (undefined if escape_rate is constant)
Min detectable |rho| at N=23: 0.413
```
