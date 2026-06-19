---
name: run-quantitative-experiment
description: Run a pre-registered quantitative experiment with held-out fixtures, multi-model k=5 execution, statistical verdict, and evidence write-back. Use when starting a new domain experiment that requires hard verdicts (CONFIRMED/NULL/REJECTED) rather than soft self-assessment.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
contracts:
  - grep: "hypotheses"
    target: self
  - grep: "CONFIRMED"
    target: self
  - grep: "\\[measured\\]"
    target: self
  - grep: "evidence_pointer"
    target: self
  - not-grep: "V_instance.*0\\.[0-9]"
    target: self
---

# Run Quantitative Experiment

**Operator Skill for executing pre-registered quantitative experiments with held-out fixtures, multi-model runs, and hard statistical verdicts.**

This skill encodes the epistemic discipline required by `docs/baime-and-quantitative-experiments.md` §二 Codify: every claim about methodology effectiveness must come from hypotheses frozen before execution, not from post-hoc rationalization.

---

## λ spec

```
runQuantitativeExperiment :: (Domain, Hypotheses, FixtureSet, ModelConfig[], k) → ExperimentResult

runQuantitativeExperiment(domain, hypotheses, fixtures, models, k) =
  | ¬frozen(hypotheses)   → raise NotPreRegistered
  | ¬calibrated(oracle)   → raise OracleNotCalibrated
  | otherwise             → execute(fixtures, models, k)
                              ∧ score(results)
                              ∧ verdict(hypotheses, scores)
                              ∧ writeBack(evidence_pointer)

ExperimentResult = {
  verdicts: HypothesisVerdict[],   -- CONFIRMED | NULL | REJECTED
  V_meta_experiment: number,       -- [measured] experiment quality score
  evidence_pointer: string         -- path for write-back to frontmatter
}

HypothesisVerdict = {
  id: string,
  direction: "CONFIRMED" | "NULL" | "REJECTED",
  observed: number,
  threshold: number,
  confidence: "high" | "medium" | "[underpowered]"
}
```

---

## contracts

The following epistemic constraints are mechanically enforced by `validate-plugin.sh` Layer 2:

1. **hypotheses must appear**: Every experiment run must reference pre-registered hypotheses
2. **Hard verdicts required**: Results must include CONFIRMED, NULL, or REJECTED — not soft scores alone
3. **[measured] annotation**: Any numeric claim in results must be tagged `[measured]` (oracle-validated) or `[soft]` (self-assessed)
4. **evidence_pointer present**: The write-back path to the source results file must be declared
5. **No bare V_instance self-scores**: The `V_instance` field used with bare decimal values (e.g. `V_instance = 0.XX`) is prohibited — use `[measured]` or `[soft]` tags

---

## lifecycle

Each experiment run proceeds through five mandatory phases:

### Phase 1 — Pre-register hypotheses
- Write `hypotheses.md` with explicit thresholds and direction
- Git commit before any LLM calls (timestamp proves freeze)
- Format: `H-<id>: metric ≥ threshold` or `metric ≤ threshold`
- Output: frozen `hypotheses.md` with commit hash

### Phase 2 — Construct fixtures
- Create held-out fixtures in `fixtures/` directory (version-controlled)
- Validate fixture schema matches the oracle's expected input format
- Minimum: `n ≥ 8` per decision class for adequate statistical power; `n < 8` → tag `[underpowered]`
- Output: `fixtures/<class>/*.json` with `id`, `answer`, `answerType`

### Phase 3 — Execute (multi-model, k=5)
- Run against `≥ 2` models (cross-model consistency check)
- Default `k = 5` repetitions per fixture for variance estimate
- Checkpoint/resume support to handle timeout
- Output: `artifacts/runs/<experiment>/<class>/<model>/<fixture_id>/result.json`

### Phase 4 — Verdict
- Score each hypothesis against its pre-registered threshold
- Label: `CONFIRMED` (observed ≥ threshold), `REJECTED` (observed < threshold), `NULL` (direction reversed)
- Compute `V_meta_experiment` from the four [measured] components below
- Output: `artifacts/analysis/<experiment>-results.json` with verdicts and `evidence_pointer`

### Phase 5 — Write-back
- Use `evidence_pointer` to update originating SKILL.md frontmatter or docs
- Tag written-back claims as `[measured: <evidence_pointer>]`
- Trigger `knowledge-extractor` agent if claim updates existing methodology

---

## V_meta(experiment) components

Four components, all `[measured]` (mechanically verifiable):

| Component | Measurement | Pass condition |
|---|---|---|
| Pre-registration discipline | git commit timestamp of `hypotheses.md` vs first LLM call | commit is earlier |
| Statistical power | `k ≥ 5` and `n ≥ 8` per fixture class | both met; else `[underpowered]` |
| Oracle calibration | oracle model has independent calibration experiment before use | calibration run exists |
| Confound control | no known uncontrolled variables in experimental design | open_confounds list is empty |

`V_meta_experiment = (components_passed / 4)` — tagged `[measured]` in results.

---

## directory layout

```
experiments/<domain>-<NNN>/
  hypotheses.md          # pre-registered, frozen, git-committed before Phase 3
  fixtures/
    <class-a>/*.json     # held-out fixtures, version-controlled
    <class-b>/*.json
  artifacts/
    runs/                # gitignored — raw LLM responses
    analysis/
      <exp>-results.json # final verdicts + evidence_pointer
  lib/                   # domain-specific harness (or symlink to shared lib)
  iteration-N.md         # per-round observations, [measured]/[soft] tagged
  results.md             # human-readable summary + evidence_pointer
  knowledge/             # knowledge-extractor write-back artifacts
```

---

## integration

### Hooking into `iteration-executor`

During `work_execution` in `lifecycle_execution`, when the current domain has an external oracle:

1. Identify whether the task involves a quantitative claim that needs hard validation
2. If yes, invoke `/run-quantitative-experiment` instead of relying on `dual_value_calculation`
3. The skill returns `evidence_pointer` pointing to `artifacts/analysis/<exp>-results.json`
4. Pass `evidence_pointer` to `knowledge-extractor` for write-back to methodology docs

This replaces soft `V_instance` self-scoring with hard `CONFIRMED/NULL/REJECTED` verdicts when an oracle is available.

### When to use this skill vs. soft assessment

| Situation | Approach |
|---|---|
| New methodology claim, oracle available | `/run-quantitative-experiment` → `[measured]` tag |
| Existing claim, no oracle budget | Keep as-is, add `[soft]` tag |
| Cross-model consistency check needed | Always use this skill (≥2 models required) |
| k < 5 or n < 8 | Run but output `[underpowered]` tag in verdicts |

---

## [measured]/[soft] annotation rules

All numeric claims in experiment outputs and methodology docs must carry one of:

- **`[measured]`**: Value comes from a pre-registered experiment with held-out fixtures and oracle verdict. The `evidence_pointer` field identifies the source.
- **`[soft]`**: Value comes from self-assessment, theoretical estimate, or non-pre-registered observation.
- **`[underpowered]`**: Value comes from a pre-registered experiment but with `k < 5` or `n < 8`; treat as directional only.

Example usage in `results.md`:
```markdown
H-oracle-C: CONFIRMED [measured] — Haiku F1 = 1.00 ≥ 0.80 threshold
evidence_pointer: experiments/skill-quality/artifacts/analysis/exp-b-results.json
```
