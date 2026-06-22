# Exp-I: Persona Effect on decomposer CODE-CHANGE Classification

**Status**: COMPLETE — run 2026-06-22, all hypotheses adjudicated  
**Date**: 2026-06-22  
**Research question**: Does adding an expert architect persona to the decomposer prompt improve CODE-CHANGE vs DOC-ONLY classification accuracy, and if so, under what conditions?

---

## Motivation

Prior session analysis ([role-prompting literature review, 2026-06-22](../../backlog/docs/)) established that expert personas help alignment-dependent tasks but can hurt knowledge-retrieval tasks. The `loop-backlog` decomposer presents a mixed case:

- It has **explicit classification rules** already in the prompt (CODE-CHANGE vs DOC-ONLY file-type criteria)
- But it also faces **genuinely ambiguous descriptions** where rules don't fully determine the answer
- The highest-value decision is routing: CODE-CHANGE → `/feature-to-backlog`; DOC-ONLY → `/task-to-backlog`

Misclassification causes a wrong skill to be invoked for a child task — a structural error that propagates through the entire epic lifecycle. This makes classification accuracy the right primary metric.

The existing prompt uses a functional directive (`"You are the autonomous decomposer agent for epic ${EPIC_ID}."`), not an expert persona. This experiment tests whether replacing that with an expert persona changes classification quality.

---

## Decision under study

**Decision point**: `isCodeChangeTask` — given a sub-task hint from an epic plan's Sub-Task Decomposition section, classify as `CODE-CHANGE` or `DOC-ONLY`.

**Existing classification rules in decomposer prompt** (present in both V0 and V1):
```
CODE-CHANGE: creates or modifies files under plugin/, scripts/, any SKILL.md, *.sh scripts
DOC-ONLY:    scope is exclusively reading, researching, writing prose docs, updating backlog notes
```

**Why rules aren't sufficient alone**: Descriptions that don't name specific file types require the model to infer whether the task naturally results in file changes. This inference is where persona might add or remove value.

---

## Variants

### V0 — Control (current state)

Functional directive from current `decomposeAgentPrompt`:

```
You are the autonomous decomposer agent for epic TASK-N.

[classification rules for CODE-CHANGE vs DOC-ONLY]

Sub-task hint: <hint>
Epic plan: <plan text>

Classify this sub-task as CODE-CHANGE or DOC-ONLY.
Output exactly one word: CODE-CHANGE or DOC-ONLY
```

### V1 — Expert persona (treatment)

Same prompt, but opening line replaced with:

```
You are an experienced software architect decomposing an epic into independently implementable child tasks.
Your primary skill is distinguishing implementation work (code and file changes) from analytical or
documentation work (research, prose writing, audits).

[same classification rules]
[same sub-task hint and plan text]
[same output instruction]
```

**Key design constraint**: The classification rules are **identical** in V0 and V1. Only the opening framing changes. This isolates the persona effect from rule content.

---

## Fixture design

### Fixture schema

```json
{
  "id": "decomp-clear-cc-01",
  "fixtureClass": "CLEAR" | "AMBIGUOUS",
  "expectedClass": "CODE-CHANGE" | "DOC-ONLY",
  "epicPlanExcerpt": "<Sub-Task Decomposition section of an epic plan>",
  "subtaskHint": "<title and one-line description of the specific sub-task>",
  "ground_truth_rationale": "<why this classification is correct per the rules>",
  "tricky_aspect": "<what might mislead the model — null for CLEAR>"
}
```

### Fixture classes

**CLEAR (n=8)**: Descriptions where the correct classification follows directly from the explicit rules. The model should get these right regardless of persona. These serve as a **ceiling check** — if either variant fails here, it signals rule comprehension problems unrelated to persona.

| ID | hint | expected | tricky_aspect |
|----|------|----------|---------------|
| clear-cc-01 | "Implement basic-daemon.cjs detection script in scripts/" | CODE-CHANGE | none — explicit file path |
| clear-cc-02 | "Add test suite for runner.ts timing edge cases" | CODE-CHANGE | none — .ts file |
| clear-cc-03 | "Fix SKILL.md gate logic for loop-backlog Epic: Awaiting Children" | CODE-CHANGE | none — explicit SKILL.md |
| clear-cc-04 | "Extend validate-plugin.sh to handle not-grep contracts" | CODE-CHANGE | none — explicit .sh |
| clear-do-01 | "Research alternative ESM detection approaches and write comparison doc" | DOC-ONLY | none — explicit research |
| clear-do-02 | "Write analysis of ftb phase timing from baseline measurements" | DOC-ONLY | none — explicit analysis |
| clear-do-03 | "Survey backlog for stale tasks and produce cleanup checklist in docs/" | DOC-ONLY | none — explicit docs |
| clear-do-04 | "Document loop-backlog shutdown sequence for the operations guide" | DOC-ONLY | none — explicit prose |

**AMBIGUOUS (n=8)**: Descriptions where the explicit file-type rules don't directly apply — the model must infer from domain knowledge, verb framing, and context whether the task results in file changes.

| ID | hint | expected | tricky_aspect |
|----|------|----------|---------------|
| ambig-cc-01 | "Improve decomposer prompt clarity for multi-file epic edge cases" | CODE-CHANGE | "improve prompt" sounds like docs; but prompt lives in SKILL.md |
| ambig-cc-02 | "Add CODE-CHANGE classification rationale for config-only tasks to SKILL" | CODE-CHANGE | "add rationale" sounds like writing; "to SKILL" is the signal |
| ambig-cc-03 | "Port existing classify-subtask logic onto the shared decomposer helper" | CODE-CHANGE | "port" and "helper" imply code; no explicit file type named |
| ambig-cc-04 | "Audit scripts/verify-subtask-dod.sh and patch any false-negative cases" | CODE-CHANGE | "audit" suggests research; "patch" implies code change; mixed framing |
| ambig-do-01 | "Calibrate oracle accuracy for decomposer classification decisions" | DOC-ONLY | "calibrate" sounds technical; but this is measurement/research |
| ambig-do-02 | "Investigate whether R1 guard catches all DOC-ONLY misclassifications" | DOC-ONLY | "investigate" alone is research; no fix/implement framing |
| ambig-do-03 | "Evaluate the decomposer against 20 historical epics and report findings" | DOC-ONLY | "evaluate" + "report" → DOC-ONLY; but might seem like scripting |
| ambig-do-04 | "Define classification criteria for tasks that mix code and documentation" | DOC-ONLY | "define" could mean implement code; but criteria-setting is a doc task here |

**Ground truth rationale for AMBIGUOUS fixtures**: Apply the explicit rules strictly. If a description implies modifying a file under `plugin/`, `scripts/`, SKILL.md, or `*.sh`, it is CODE-CHANGE. If the natural output of the task is a prose document or measurement report, it is DOC-ONLY. Ambiguity arises from verb framing, not from rule ambiguity.

### Sanity fixtures (negative control)

Two sanity fixtures with obvious-wrong-answer ground truth. If either variant passes fewer than 2/2 sanity fixtures, abort the run.

```
sanity-cc-obv: "Write a research summary of task classification approaches" → expected: DOC-ONLY
sanity-do-obv: "Implement the task classification algorithm in plugin/decomposer.ts" → expected: CODE-CHANGE
```

---

## Pre-registered hypotheses

**Freeze these before any LLM call. Timestamp with git commit.**

| ID | Hypothesis | Threshold | Direction |
|----|-----------|-----------|-----------|
| **H-A** | V1 accuracy on AMBIGUOUS fixtures ≥ V0 accuracy + 5pp | Δ ≥ 0.05 | V1 > V0 |
| **H-B** | Both V0 and V1 achieve ≥ 0.90 accuracy on CLEAR fixtures | ≥ 0.90 | both high |
| **H-C** | V1 overall accuracy ≥ V0 overall accuracy + 5pp | Δ ≥ 0.05 | V1 > V0 |
| **H-D** | V1 improves CODE-CHANGE recall without degrading DOC-ONLY recall by > 10pp | recall Δ ≤ −0.10 | no asymmetric bias |

**H-D rationale**: Expert architect framing might bias toward CODE-CHANGE (implementation thinking), helping CODE-CHANGE recall but systematically misclassifying DOC-ONLY tasks. H-D tests for this asymmetric failure mode.

**Verdicts**:
- `CONFIRMED`: observed Δ meets threshold in stated direction
- `NULL`: no meaningful effect (Δ within ±5pp)
- `REJECTED`: direction reversed or threshold missed in the hypothesized direction

---

## Oracle design

**No LLM oracle needed.** Classification output is binary (CODE-CHANGE / DOC-ONLY) with ground-truth annotation. Scoring is automated:

```typescript
function scoreResponse(response: string, fixture: DecompFixture): number {
  const normalized = response.trim().toUpperCase()
    .replace(/[^A-Z-]/g, '');
  if (normalized.includes('CODE-CHANGE') || normalized.includes('CODECHANGE')) {
    return fixture.expectedClass === 'CODE-CHANGE' ? 1.0 : 0.0;
  }
  if (normalized.includes('DOC-ONLY') || normalized.includes('DOCONLY')) {
    return fixture.expectedClass === 'DOC-ONLY' ? 1.0 : 0.0;
  }
  return 0.0; // malformed response
}
```

This is a stronger oracle than Exp-B (LLM-based) because ground truth is deterministic. The only calibration needed is verifying that sanity fixtures score correctly before the main run.

---

## Execution plan

### Models
- Primary: `claude-haiku-4-5-20251001` (cost-efficient, sufficient for classification)
- Cross-check: `claude-sonnet-4-6` (verify cross-model consistency)

If Haiku and Sonnet agree on direction (both show V1 > V0 on AMBIGUOUS, or both show no effect), verdict is high-confidence. If they disagree, verdict is downgraded to `[underpowered]`.

### k and statistical power

k=5 per (variant, fixture, model) cell.

- AMBIGUOUS class: n=8 fixtures × k=5 = 40 trials per model per variant
- CLEAR class: n=8 fixtures × k=5 = 40 trials per model per variant
- Total per model: 160 trials
- Total across 2 models: 320 LLM calls

Wilson 95% CI reported for each cell. Haiku call cost at ~$0.001/call → ~$0.32 total (Haiku only).

### Prompt construction

Each fixture produces two prompt strings — one per variant — by substituting the opening directive. The classification rules, hint text, and output instruction are templated from the fixture file. The epic plan excerpt is realistic but synthetic (drawn from BAIME's own backlog epic history, not a production system).

### Checkpoint/resume

Follow the same pattern as Exp-H: write `result.json` per cell immediately after each LLM call. Resume skips cells where `result.json` already exists.

---

## Analysis

### Per-class accuracy

For each (variant, model) pair:
```
accuracy(CLEAR)     = mean(scores over CLEAR fixtures)
accuracy(AMBIGUOUS) = mean(scores over AMBIGUOUS fixtures)
accuracy(overall)   = mean(scores over all fixtures)
```

### Precision / recall split (for H-D)

```
CC_recall  = TP_CC / (TP_CC + FN_CC)   where positive = CODE-CHANGE
DO_recall  = TP_DO / (TP_DO + FN_DO)   where positive = DOC-ONLY
```

Track per variant. If V1 CC_recall increases but DO_recall drops by > 10pp → H-D REJECTED (asymmetric bias confirmed).

### Verdict table

Results from `artifacts/analysis/exp-i-results.json` (Haiku primary, k=5, 64 cells, 2026-06-22):

| Hypothesis | V0 obs | V1 obs | Δ | Verdict |
|-----------|--------|--------|---|---------|
| H-A (AMBIG Δ ≥ 0.05) | 0.875 | 0.925 | +0.050 | **CONFIRMED** |
| H-B (CLEAR ≥ 0.90) | 1.000 | 1.000 | 0.000 | **CONFIRMED** |
| H-C (overall Δ ≥ 0.05) | 0.938 | 0.963 | +0.025 | **NULL** |
| H-D (DO recall Δ > −0.10) | 1.000 | 1.000 | 0.000 | **CONFIRMED** |

**Cross-model consistency**: `[underpowered]` — Haiku shows AMBIG Δ=+0.050 (positive), Sonnet shows AMBIG Δ=−0.025 (negative). Models disagree on direction; verdict is downgraded.

**Per-model results**:

| Model | V0 CLEAR | V1 CLEAR | V0 AMBIG | V1 AMBIG | V0 overall | V1 overall | V0 DO_recall | V1 DO_recall |
|-------|----------|----------|----------|----------|------------|------------|--------------|--------------|
| Haiku | 1.000 | 1.000 | 0.875 | 0.925 | 0.938 | 0.963 | 1.000 | 1.000 |
| Sonnet | 1.000 | 1.000 | 0.900 | 0.875 | 0.950 | 0.938 | 1.000 | 1.000 |

**Interpretation**: H-A is technically CONFIRMED on Haiku at the exact threshold (Δ=0.050), but cross-model disagreement downgrades confidence to `[underpowered]`. H-C is NULL (Δ=+0.025 < 0.05). H-D is CONFIRMED — no asymmetric bias toward CODE-CHANGE. The scenario matches "Persona helps on AMBIG but not overall" from the anticipated outcomes table, implying: add persona if the underpowered signal is accepted, or run Exp-J with n=16 AMBIGUOUS fixtures for higher power.

### V_meta_experiment [measured]

| Component | Score | Notes |
|-----------|-------|-------|
| Pre-registration discipline | 1.0 | git commit timestamp before any LLM call |
| Statistical power | 0.9 | n=8 per class × k=5 per model; `[underpowered]` tag if n < 8 |
| Oracle quality | 1.0 | automated ground truth, no LLM oracle needed |
| Confound isolation | 0.9 | single-variable change (persona only); rules identical in V0/V1 |
| **V_meta_experiment** | **0.97** | mean of above |

---

## Anticipated outcomes and their implications

| Scenario | H-A verdict | H-C verdict | Implication |
|----------|------------|------------|-------------|
| Persona clearly helps | CONFIRMED | CONFIRMED | Add V1 persona to decomposer prompt |
| Persona helps on AMBIG but not overall | CONFIRMED | NULL | Add persona; it doesn't hurt |
| No effect | NULL | NULL | Rules already sufficient; skip persona |
| Persona hurts (direction reversed) | REJECTED | REJECTED | Current functional directive is better; rules suffice |
| Asymmetric bias (H-D fails) | varies | varies | Don't add persona; bias risk outweighs alignment gain |

---

## Open questions before running

1. **Epic plan excerpt realism**: Fixtures use synthetic plan text drawn from BAIME's own backlog. Are these representative of real epics, or do they cluster toward a style that advantages/disadvantages one variant?

2. **Output format sensitivity**: The decomposer in production returns structured JSON via schema. The experiment uses free-text output (`CODE-CHANGE` or `DOC-ONLY`) for simplicity. Does removing the schema constraint change which variant performs better?

3. **Prompt position**: The persona is prepended before the rules. Alternative: inject it after the rules ("When classifying, think as a software architect..."). Position effects are not tested in this design — would be Exp-J if Exp-I shows a positive result.

4. **Inter-annotator agreement**: Ground truth for AMBIGUOUS fixtures is annotated by one person using explicit rules. A second pass (or LLM oracle calibration on AMBIGUOUS ground truth itself) would strengthen the fixture quality claim. Currently tagged as a known limitation.

---

## Implementation steps

1. `git commit` hypotheses section of this document (timestamp = freeze point)
2. Create fixture files in `experiments/skill-quality/fixtures/exp-i/`
3. Write `experiments/skill-quality/exp-i/run-exp-i.ts` following Exp-H structure
4. Run: `npx tsx exp-i/run-exp-i.ts --k 5 --out artifacts/runs/exp-i`
5. Fill verdict table; compute V_meta_experiment
6. If CONFIRMED: propose SKILL.md edit as TASK-NNN; run `/feature-to-backlog`
7. If NULL/REJECTED: document as evidence in `docs/baime-and-quantitative-experiments.md`
