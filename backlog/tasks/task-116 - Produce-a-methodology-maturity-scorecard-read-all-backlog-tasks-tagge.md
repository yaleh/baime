---
id: TASK-116
title: 'Produce a methodology maturity scorecard: read all backlog tasks tagge'
status: Meta-Plan
assignee: []
created_date: '2026-06-20 14:12'
updated_date: '2026-06-20 14:26'
labels: []
dependencies: []
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Produce a methodology maturity scorecard: read all backlog tasks tagged as Exp-*, extract their result verdicts (Met/NotMet/Inconclusive) from task notes, and generate docs/methodology-maturity.md summarising per-claim evidence strength using the OCA convergence criteria.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Meta-Proposal: TASK-116 — Methodology Maturity Scorecard

## Background (WHY)

BAIME currently has 8 completed quantitative experiments (Exp-A through Exp-H, across TASK-37–46) plus an in-progress macro-experiment (Exp-K, TASK-93). Each experiment produced a verdict—CONFIRMED, NULL, REJECTED, REFUTED, or INCONCLUSIVE—stored in JSON result files under `experiments/skill-quality/artifacts/analysis/` and referenced in prose across `docs/baime-oca-process-refinements.md` and task notes. However:

1. **No consolidated evidence dashboard exists.** Anyone assessing the maturity of a BAIME methodology claim must manually cross-reference task files, JSON result blobs, and OCA documentation. This friction degrades trust and slows adoption.
2. **P0 claims without measured evidence should fail an evidence-strength gate.** `docs/baime-and-quantitative-experiments.md` explicitly warns that soft self-evaluated numbers ("V_instance = 0.87", "195x speedup") in `methodology-bootstrapping` have never been tested against an external oracle. Without a scorecard, these unvalidated claims are indistinguishable from claims backed by real LLM measurements.
3. **OCA convergence criteria are defined but not applied retroactively.** The criteria in `docs/baime-oca-process-refinements.md` (convergence thresholds by oracle class, `substantively-verified` vs `mechanically-passed`, dual-track V_instance) were derived from experiments but have not been used to score the experiments themselves in a unified way.
4. **Exp-K (TASK-93) is ongoing** and its evaluator Met/NotMet data is stored as inline notes in task files rather than in any aggregated artifact—demonstrating the gap between per-task evidence and system-level maturity visibility.

A methodology maturity scorecard closes this gap by: (a) extracting all experiment verdicts into a machine-readable intermediate, (b) scoring each claim against OCA convergence criteria, and (c) emitting `docs/methodology-maturity.md` as the single authoritative evidence-strength dashboard, with a gate script that fails if any P0 claim lacks substantive verification.

## Goals (Observable)

1. `scripts/extract-exp-verdicts.sh` exists and emits a NDJSON stream of `{exp_id, claim, verdict, data_source, oracle_class, evidence_file}` records for every Exp-* task.
2. `scripts/score-oca-maturity.py` reads that NDJSON and produces `data/maturity-scores.json` containing per-claim OCA scores (evidence tier: `substantively-verified` | `mechanically-passed` | `unverified`).
3. `docs/methodology-maturity.md` exists with: a summary table of all experiments, a per-claim evidence section, and an overall maturity rating.
4. `scripts/check-maturity-gate.sh` exits non-zero if any claim tagged P0 lacks `substantively-verified` status; passes in CI.
5. All four scripts are wired into `scripts/validate-plugin.sh` or invocable from it.

## Decomposition (4 Subjects)

| Subject | Description | Key Output |
|---------|-------------|------------|
| **S1: Verdict Extractor** | Shell script that reads all `backlog/tasks/task-*.md` files with `Exp-*` in their name, plus JSON files in `experiments/skill-quality/artifacts/analysis/`, to emit a NDJSON record per hypothesis | `scripts/extract-exp-verdicts.sh` |
| **S2: OCA Scoring Logic** | Script that reads NDJSON from S1 and applies OCA convergence criteria to produce evidence tiers; flags P0 claims | `scripts/score-oca-maturity.py` + `data/maturity-scores.json` |
| **S3: Report Generator** | Script that reads `data/maturity-scores.json` and renders `docs/methodology-maturity.md` with exec summary, evidence table, P0 section, pending section | `scripts/generate-maturity-report.sh` + `docs/methodology-maturity.md` |
| **S4: Gate Script** | CI-ready shell script that exits 1 if any P0 claim is `unverified`; integrated into `validate-plugin.sh` | `scripts/check-maturity-gate.sh` |

## Trade-offs

**Build vs. reuse**: Hybrid approach—shell for task file scanning, Python for JSON parsing and scoring logic. Zero external dependencies.

**Scope of Exp-K (TASK-93)**: Included with `PENDING` verdict and `data_source: in-progress` rather than blocking on completion.

**Report freshness**: `docs/methodology-maturity.md` is generated—carries a `DO NOT HAND-EDIT` header. Never hand-edited.

**Gate strictness**: Only blocks on P0 claims lacking substantive verification. INCONCLUSIVE results (Exp-G) are legitimate scientific states and do not block.

---

# Meta-Plan: TASK-116 — Methodology Maturity Scorecard

## Subjects

### Subject 1: Verdict Extractor (`scripts/extract-exp-verdicts.sh`)

**Goal**: Produce a machine-readable NDJSON stream of all experiment hypothesis verdicts from both task Markdown files and JSON result artifacts.

**Inputs**:
- `backlog/tasks/task-*.md` files whose name contains `Exp-` (currently: TASK-37 through TASK-46, TASK-93)
- `experiments/skill-quality/artifacts/analysis/exp-*-results.json` files

**Output**: stdout NDJSON, one record per hypothesis. Schema:
```json
{"exp_id":"Exp-A","task_id":"TASK-37","hypothesis":"H-P3","claim_text":"P3 content harms LLM decision accuracy","verdict":"NULL","data_source":"prior-data","oracle_class":"none","evidence_file":"experiments/skill-quality/artifacts/analysis/exp-a-results.json"}
```

**Implementation approach**:
- Phase 1 (JSON artifacts): iterate over `exp-*-results.json`; use `jq` to extract `hypothesis`/`hypotheses.*` verdict fields and `data_source`; map to NDJSON records.
- Phase 2 (task file notes): for Exp-K (TASK-93) where verdict is embedded in Markdown notes as `evaluator: Met|NotMet`, parse with `grep`/`awk` and emit `verdict: PENDING` record.
- Script is idempotent and outputs to stdout; callers pipe to file or directly to scorer.

**Acceptance criteria**:
- Running `bash scripts/extract-exp-verdicts.sh | jq -c '.' | wc -l` returns >= 8.
- Every record contains all required fields; `jq` parses each line without error.
- Script is executable and passes shellcheck.

**Files**: `scripts/extract-exp-verdicts.sh` (new)

---

### Subject 2: OCA Scoring Logic (`scripts/score-oca-maturity.py` + `data/maturity-scores.json`)

**Goal**: Map each NDJSON verdict record to an OCA evidence tier and produce a structured JSON score file.

**Inputs**: NDJSON from Subject 1 (read from stdin)

**Evidence tier rules** (derived from `docs/baime-oca-process-refinements.md` §2a):
| verdict | data_source | evidence_tier |
|---------|-------------|---------------|
| CONFIRMED / NULL / REJECTED / REFUTED | measured | `substantively-verified` |
| CONFIRMED / NULL / REJECTED / REFUTED | prior-data | `mechanically-passed` |
| INCONCLUSIVE | measured | `substantively-verified` |
| PENDING / in-progress | any | `unverified` |
| any | estimated | `mechanically-passed` |

**P0 claim tagging**: oracle_class A or B.

**Output**: `data/maturity-scores.json` with `generated`, `records[]`, and `summary` fields including `p0_unverified`.

**Acceptance criteria**:
- Output is valid JSON parseable by `jq`.
- `data/maturity-scores.json` contains `summary.total >= 8`.
- `summary.p0_unverified` field is present and is an integer.

**Files**: `scripts/score-oca-maturity.py` (new), `data/maturity-scores.json` (generated)

---

### Subject 3: Report Generator (`scripts/generate-maturity-report.sh` + `docs/methodology-maturity.md`)

**Goal**: Render `docs/methodology-maturity.md` from `data/maturity-scores.json`.

**Report structure**:
1. Auto-generated header with timestamp and `DO NOT HAND-EDIT` warning.
2. Executive summary: overall maturity rating (Mature / Developing / Early-stage).
3. Full evidence table: Exp ID | Task | Hypothesis | Verdict | Data Source | Oracle Class | Evidence Tier.
4. P0 claims section: highlights any `unverified` P0 as a blocking gap.
5. Pending / Inconclusive section with recommended follow-on experiment references.
6. Rating scale definition (footnote).

**Implementation**: shell script using `jq` to read JSON, `printf`/heredoc to emit Markdown.

**Acceptance criteria**:
- `bash scripts/generate-maturity-report.sh` exits 0 and `docs/methodology-maturity.md` is non-empty.
- `grep -q "Evidence Tier" docs/methodology-maturity.md` passes.
- `grep -q "DO NOT HAND-EDIT" docs/methodology-maturity.md` passes.
- Report contains at least one row per experiment (Exp-A through Exp-K).

**Files**: `scripts/generate-maturity-report.sh` (new), `docs/methodology-maturity.md` (generated)

---

### Subject 4: Gate Script (`scripts/check-maturity-gate.sh`)

**Goal**: CI-ready exit-code gate that fails if any P0 claim lacks substantive verification.

**Inputs**: `data/maturity-scores.json` (errors with message if absent)

**Logic**: if `summary.p0_unverified > 0`: print failing hypothesis names, exit 1; else print "Result: PROCEED", exit 0.

**Integration**: `scripts/validate-plugin.sh` calls `bash scripts/check-maturity-gate.sh`; exit code propagates.

**Acceptance criteria**:
- `bash scripts/check-maturity-gate.sh` exits 0 given `p0_unverified: 0`.
- Given synthetic JSON with `p0_unverified: 1`, exits 1 with human-readable message naming failing hypothesis.
- `bash scripts/validate-plugin.sh` passes end-to-end.

**Files**: `scripts/check-maturity-gate.sh` (new), `scripts/validate-plugin.sh` (modified)

---

## Acceptance Criteria (Task-level)

1. Running `bash scripts/validate-plugin.sh` from the repo root passes and internally executes the full maturity pipeline (extract → score → generate report → gate check) without errors.
2. `docs/methodology-maturity.md` exists, contains a table covering all Exp-A through Exp-K experiments, and has a machine-readable generation timestamp in its header.

## Definition of Done

Shell gate: `bash -c 'bash scripts/extract-exp-verdicts.sh | python3 scripts/score-oca-maturity.py > data/maturity-scores.json && bash scripts/generate-maturity-report.sh && bash scripts/check-maturity-gate.sh && grep -q "Evidence Tier" docs/methodology-maturity.md'`

## Constraints

- `docs/methodology-maturity.md` must carry `<!-- AUTO-GENERATED — DO NOT HAND-EDIT -->` on line 1.
- `data/` directory created by Subject 2 if it does not exist.
- All shell scripts pass `shellcheck`. Python script uses stdlib only (`json`, `sys`, `datetime`).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Drafting implementation plan.

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->
