---
id: TASK-110
title: Extend the run-quantitative-experiment skill to support a replication
status: Meta-Plan
assignee: []
created_date: '2026-06-20 14:12'
updated_date: '2026-06-20 14:15'
labels: []
dependencies: []
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the run-quantitative-experiment skill to support a replication mode: given an existing experiment config JSON, re-run all fixtures and produce a results-replicated.json alongside the original results.json for comparison.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Replication Mode for run-quantitative-experiment Skill

## Background

The `run-quantitative-experiment` skill currently produces a single `results.json` (plus
`results.md`) from one execution run. This one-shot output creates a reproducibility gap:
if results are questioned later — due to model version drift, oracle recalibration, or
suspected fixture contamination — there is no sanctioned path to re-run the same experiment
and compare outcomes. Researchers must either re-execute from scratch (losing the original
as a baseline) or perform ad-hoc comparisons outside the skill's epistemic discipline.
A dedicated replication mode closes this gap by re-running all fixtures against the frozen
config and emitting `results-replicated.json` alongside the original, making divergences
visible and auditable without overwriting the authoritative record.

## Goals

1. A `--replicate` flag (or equivalent invocation pattern) accepts an existing experiment
   config JSON and re-executes all fixtures under the same hypotheses, oracle, and k-value.
2. The replication run writes `artifacts/analysis/<exp>-results-replicated.json` without
   touching the original `<exp>-results.json`.
3. A comparison report (`results-comparison.md`) is generated, highlighting per-hypothesis
   verdict deltas (CONFIRMED↔REJECTED, observed value drift, V_meta_experiment delta).
4. All output values carry `[measured]` or `[underpowered]` annotations consistent with
   the skill's existing epistemic contracts.
5. The skill's `validate-plugin.sh` contracts remain unbroken — no new bare `V_instance`
   floats, `hypotheses` keyword present, `evidence_pointer` declared.

## Decomposition Approach

Three subjects map to distinct, independently testable concerns:

**Subject A — Replicate flag and mode logic**: Extend the SKILL.md spec and lifecycle
description to define `--replicate` invocation, config-loading, and the invariant that
the original results file is never mutated.

**Subject B — Comparison report generator**: Implement the logic that diffs
`results.json` vs `results-replicated.json` and produces `results-comparison.md` with
per-hypothesis verdict deltas and V_meta drift.

**Subject C — Regression fixture and contract validation**: Add a minimal regression
fixture set that exercises the replicate path end-to-end and confirms `validate-plugin.sh`
contracts still pass on replicated output.

## Trade-offs and Scope Limits

- **Output-format contract risk**: The existing `evidence_pointer` contract points to
  `<exp>-results.json`; the replicated file uses a different name. Whether `evidence_pointer`
  in the replicated output should point to itself or the original is ambiguous and may
  require a replan once Subject A is drafted — this is the highest-likelihood scope change.
- Replication does not re-freeze hypotheses (they are already frozen in the original
  config); attempting to re-register would violate the pre-registration discipline contract.
- Cross-model consistency checks in Subject B are bounded to models listed in the original
  config; adding new models is out of scope.

---

# Implementation Plan: Replication Mode for run-quantitative-experiment Skill

## Subject A — Replicate flag and mode logic in SKILL.md

**Scope**: Extend `.claude/skills/run-quantitative-experiment/SKILL.md` to specify the
`--replicate` invocation path as a first-class lifecycle variant.

**Files**:
- `.claude/skills/run-quantitative-experiment/SKILL.md` — primary change surface

**Deliverable**: SKILL.md contains:
1. A new `## replication-mode` section describing `--replicate <config-json>` invocation,
   the config schema fields consumed (`experiment_id`, `hypotheses_path`, `fixtures_dir`,
   `models`, `k`), and the immutability invariant (original `<exp>-results.json` MUST NOT
   be modified).
2. Updated `## λ spec` with `replicateExperiment :: (ConfigJSON, OriginalResults) →
   ReplicatedResult` type signature.
3. Updated `## directory layout` showing `<exp>-results-replicated.json` and
   `results-comparison.md` as output artifacts.
4. `evidence_pointer` contract resolution: replicated output's `evidence_pointer` points
   to `<exp>-results-replicated.json` (self-referential); the comparison report carries a
   `baseline_pointer` to the original.

**Estimated sub-tasks**: 1

**Acceptance Criteria**:
- `bash scripts/validate-plugin.sh` exits 0 after the SKILL.md edit.
- The `replication-mode` section uses `hypotheses` keyword (contract 1), includes
  `CONFIRMED` in example output (contract 2), annotates all numeric examples with
  `[measured]` (contract 3), and declares `evidence_pointer` (contract 4).

---

## Subject B — Comparison report generator spec

**Scope**: Define the algorithm and output schema for the comparison report so that an
implementer can produce `results-comparison.md` deterministically from two results JSON
files.

**Files**:
- `.claude/skills/run-quantitative-experiment/SKILL.md` — add `## comparison-report`
  section with schema and diff algorithm
- `experiments/replication-template/` — example comparison report skeleton (non-executed)

**Deliverable**: SKILL.md `## comparison-report` section specifies:
1. Input: `results.json` (baseline) and `results-replicated.json` (replication).
2. Per-hypothesis diff table columns: `hypothesis_id`, `baseline_verdict`,
   `replicated_verdict`, `baseline_observed [measured]`, `replicated_observed [measured]`,
   `delta`, `stability` (`STABLE` if verdicts match, `FLIPPED` if not).
3. Aggregate row: `V_meta_experiment` baseline vs replicated delta.
4. Report header must carry `evidence_pointer` (replicated) and `baseline_pointer`
   (original) — satisfying contract 4 for both files.
5. Shell gate: `jq` one-liner that asserts both files parse and `experiment_id` fields match.

**Estimated sub-tasks**: 1

**Acceptance Criteria**:
- The `## comparison-report` section is present in SKILL.md and `validate-plugin.sh`
  exits 0.
- The example comparison report skeleton in `experiments/replication-template/` contains
  at least one `CONFIRMED` entry, one `evidence_pointer`, and no bare `V_instance` floats.

---

## Subject C — Regression fixture and contract smoke test

**Scope**: Provide a minimal self-contained fixture set that simulates the replicate path
and verifies `validate-plugin.sh` Layer 2 contracts pass on replicated output format.

**Files**:
- `experiments/replication-template/hypotheses.md` — pre-registered stub hypotheses
- `experiments/replication-template/fixtures/class-a/fixture-001.json` — minimal fixture
- `experiments/replication-template/artifacts/analysis/exp-rep-results.json` — baseline
  results stub (manually authored, not LLM-executed)
- `experiments/replication-template/artifacts/analysis/exp-rep-results-replicated.json`
  — replicated results stub
- `experiments/replication-template/results-comparison.md` — hand-authored comparison
  report exercising the schema from Subject B
- `scripts/test-replication-contracts.sh` — smoke-test script that greps each stub for
  the five contracts and exits non-zero on any miss

**Deliverable**:
- `bash scripts/test-replication-contracts.sh` exits 0, printing one PASS line per contract.
- All five `validate-plugin.sh` contracts pass on both stub results files when grepped
  directly.

**Estimated sub-tasks**: 1

**Acceptance Criteria**:
- `bash scripts/test-replication-contracts.sh` exits 0 without modification.
- `bash scripts/validate-plugin.sh` exits 0 on the repository including all new files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Drafting implementation plan.

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->
