---
id: TASK-113
title: 'Build a cross-skill duplicate-detection linter: scan all SKILL.md file'
status: Meta-Plan
assignee: []
created_date: '2026-06-20 14:12'
updated_date: '2026-06-20 14:21'
labels: []
dependencies: []
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a cross-skill duplicate-detection linter: scan all SKILL.md files for reviewLoop and detectLang implementations that are near-identical (>80% token overlap), and report them in validate-plugin.sh output so they can be extracted to a shared spec.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# META-PROPOSAL: Cross-Skill Duplicate-Detection Linter

## Background

The plugin currently ships **26 SKILL.md files** (25 in `plugin/skills/`, plus internal `.claude/skills/`).
Several skills — notably `feature-to-backlog`, `task-to-backlog`, `loop-meta`, and `loop-backlog` —
share common algorithmic primitives that are copy-pasted rather than referenced:

- **`reviewLoop`**: appears in at least 4 SKILL.md files with near-identical prose, type signature,
  and iteration-counting logic. Each copy is a divergence risk: a bug fix or threshold change in one
  file may not be applied to the others.
- **`detectLang`**: appears in `feature-to-backlog` and `loop-backlog` with the same
  `detectLang :: () → Lang -- see spec-stdlib § detectLang` stub, suggesting both reference a
  shared spec that is not yet enforced by tooling.

As the skill library grows, copy-paste drift becomes a quality hazard:
specification changes must be applied to N files instead of one, and reviewers
have no automated signal when a new skill silently duplicates an existing implementation.

`validate-plugin.sh` already includes a **Trigger Overlap Detection** section (Jaccard on
description trigrams). The natural next step is an analogous **Cross-Skill Implementation Overlap**
section that checks *body content* — specifically named function implementations — rather than
just frontmatter descriptions.

## Goals

**Primary observable**: after this work, running `bash scripts/validate-plugin.sh` prints a new
section:

```
=== Cross-Skill Implementation Overlap ===
  WARN: reviewLoop body overlap 0.87 between 'feature-to-backlog' and 'task-to-backlog'
  WARN: reviewLoop body overlap 0.83 between 'loop-meta' and 'task-to-backlog'
  PASS: detectLang body overlap below threshold (max 0.61 across 2 occurrences)
```

Warnings (not errors) for overlap above a configurable threshold (initial value: **0.80 token
overlap**). The threshold is explicitly noted as a **replan risk**: 0.80 may be too tight
(false-positives on short shared stubs) or too loose (misses subtle drift). A calibration step
is included in the decomposition.

**Secondary observable**: a new `scripts/skill-similarity.sh` script (invoked by
`validate-plugin.sh`) that can be run standalone for spot-checks.

## Decomposition (4 Subjects)

| Subject | Scope | Key File(s) | Est. Sub-tasks |
|---------|-------|-------------|----------------|
| A | Token-overlap similarity function | `scripts/skill-similarity.sh` (new) | 2–3 |
| B | Named-function extraction + cross-file comparison loop | `scripts/skill-similarity.sh` | 2–3 |
| C | Integration into `validate-plugin.sh` as new WARNING section | `scripts/validate-plugin.sh` | 2 |
| D | Regression tests + calibration fixtures | `scripts/fixtures/`, `scripts/skill-similarity.test.sh` | 2–3 |

## Trade-offs

| Decision | Chosen approach | Rationale |
|----------|----------------|-----------|
| Severity | WARNING (not FAIL) | Duplication is a smell, not a blocker; avoids breaking CI on existing skills |
| Granularity | Named function blocks (`### funcName` headings) | Matches existing `validate_skill_internals` heading convention |
| Threshold | 0.80 token overlap (initial) | **Replan risk**: empirical calibration against real skill corpus needed |
| Scope | `reviewLoop` + `detectLang` as initial targets | Most-duplicated primitives identified in discovery scan |
| Script location | `scripts/skill-similarity.sh` | Consistent with `scripts/skill-lint.sh` pattern |

## Risks and Replan Triggers

- **Threshold ambiguity** (HIGH): 0.80 may produce too many false-positives on short stubs or
  miss meaningful drift in long blocks. Subject D includes a calibration step; if calibration
  shows the threshold needs significant adjustment, a replan note is expected.
- **Tokenisation strategy**: simple whitespace tokenisation vs. AST-aware splitting. Starting
  with whitespace (simpler); replan if results are noisy.
- **Scope creep**: resist adding other heuristics (e.g., line-diff similarity) until the token
  overlap baseline is validated.

---

# META-PLAN: Cross-Skill Duplicate-Detection Linter

## Subject A — Token-Overlap Similarity Function (`scripts/skill-similarity.sh`)

**Goal**: Implement and expose a reusable `token_overlap_score` function in a new standalone
script `scripts/skill-similarity.sh`. The function takes two text blocks and returns a
floating-point Jaccard-on-word-tokens score (0.0–1.0).

**Files**:
- `scripts/skill-similarity.sh` (new)

**Observable deliverable**: `bash scripts/skill-similarity.sh --self-test` exits 0 and prints
`PASS: token_overlap_score unit tests` covering at least: identical input → 1.0, disjoint input
→ 0.0, known partial overlap within ±0.02 of expected.

**Implementation notes**:
- Use Python 3 (consistent with `validate-plugin.sh`) for the scoring logic; the shell script
  is a thin wrapper that sources/invokes the Python helper inline via a heredoc.
- Tokenise by splitting on whitespace and punctuation (`re.split(r'[^a-zA-Z0-9_]+', text)`);
  lowercase normalisation.
- Export `TOKEN_OVERLAP_THRESHOLD` env-var override (default 0.80) so callers can adjust
  without editing the script.

**Estimated sub-tasks**: 2
- A.1 Implement `token_overlap_score` Python helper + `--self-test` mode
- A.2 Add `TOKEN_OVERLAP_THRESHOLD` env-var wiring and CLI `--threshold` flag

**Acceptance Criteria**:
- `bash scripts/skill-similarity.sh --self-test` exits 0
- Identical 50-word blocks score ≥ 0.99; completely disjoint blocks score ≤ 0.01

---

## Subject B — Named-Function Extraction + Cross-File Comparison Loop

**Goal**: Extend `scripts/skill-similarity.sh` with a `--scan-skills DIR` mode that:
1. Parses each SKILL.md body for named function blocks delimited by `### FuncName` headings
2. Groups extracted blocks by function name across all skills
3. Runs pairwise `token_overlap_score` for each group with ≥2 members
4. Prints `WARN:` lines for pairs above threshold, `PASS:` summary otherwise

**Files**:
- `scripts/skill-similarity.sh` (extend)

**Observable deliverable**: `bash scripts/skill-similarity.sh --scan-skills plugin/skills/`
run against the real corpus produces output that correctly identifies `reviewLoop` appearing in
`feature-to-backlog`, `task-to-backlog`, `loop-meta`, and `loop-backlog`, and prints at least one
`WARN:` line for high-overlap pairs (or `PASS:` if all are below threshold after calibration).

**Implementation notes**:
- Function-block extraction: from a `### FuncName` heading, collect all lines until the next
  `### ` heading or end of body section. Consistent with `validate_skill_internals` logic.
- Only scan within the body (strip frontmatter `---` delimiters first).
- Functions with body < 10 tokens are skipped (too short to be meaningful).

**Estimated sub-tasks**: 3
- B.1 Implement `extract_named_blocks(filepath)` Python function
- B.2 Implement cross-file comparison loop with grouped pairwise scoring
- B.3 Calibration run against real corpus; document observed scores in code comment

**Acceptance Criteria**:
- `--scan-skills` on real corpus exits without Python traceback
- `reviewLoop` group is detected and at least one pair is reported (WARN or PASS depending on calibrated threshold)

---

## Subject C — Integration into `validate-plugin.sh`

**Goal**: Add a new `=== Cross-Skill Implementation Overlap ===` section to
`scripts/validate-plugin.sh` that calls `scripts/skill-similarity.sh --scan-skills "$SKILLS_DIR"`,
captures warnings, and increments `$WARNINGS` (not `$ERRORS`) for each reported overlap.

**Files**:
- `scripts/validate-plugin.sh` (modify)
- `scripts/skill-similarity.sh` (must be present; Subject A/B prerequisite)

**Observable deliverable**: `bash scripts/validate-plugin.sh` output includes the new section
header and exits 0 (warnings do not fail the build).

**Implementation notes**:
- Follow the existing `set +e` / capture-exit-code pattern used in the Contract Density Check
  and Meta-lint sections (lines 574–615 of `validate-plugin.sh`).
- If `scripts/skill-similarity.sh` is absent, emit `WARN: skill-similarity.sh not found — skipping`
  (graceful degradation, no error).
- Section output is prefixed with the standard `  PASS:` / `  WARN:` tokens for consistency
  with existing sections.

**Estimated sub-tasks**: 2
- C.1 Add `=== Cross-Skill Implementation Overlap ===` section calling `skill-similarity.sh`
- C.2 Wire `WARNINGS` increment and graceful-degradation guard

**Acceptance Criteria**:
- `bash scripts/validate-plugin.sh` exits 0 and prints `=== Cross-Skill Implementation Overlap ===`
- Removing `scripts/skill-similarity.sh` causes a WARN (not FAIL) in the section

---

## Subject D — Regression Tests + Calibration Fixtures

**Goal**: Provide deterministic fixture files that exercise both the "high overlap → WARN" and
"low overlap → PASS" code paths, and a `scripts/skill-similarity.test.sh` test runner wired
into the existing `run_skill_unit_tests` loop in `validate-plugin.sh`.

**Files**:
- `scripts/fixtures/skill-sim-high-overlap.md` (new — synthetic SKILL.md with duplicate `reviewLoop`)
- `scripts/fixtures/skill-sim-low-overlap.md` (new — synthetic SKILL.md with distinct `reviewLoop`)
- `scripts/skill-similarity.test.sh` (new)

**Observable deliverable**: `bash scripts/skill-similarity.test.sh` exits 0 and prints at least:
- `PASS: high-overlap fixture detected above threshold`
- `PASS: low-overlap fixture not flagged`

The fixtures also serve as the calibration artefacts: running Subject B's comparison against
them with the initial threshold (0.80) confirms whether the threshold needs adjustment. If the
high-overlap fixture scores < 0.80, the threshold must be lowered and a replan note appended to
TASK-113.

**Implementation notes**:
- High-overlap fixture: copy `reviewLoop` block from `feature-to-backlog/SKILL.md` verbatim into
  a synthetic SKILL.md; expected score ≥ 0.95.
- Low-overlap fixture: write a clearly distinct `reviewLoop` stub (< 20% shared tokens); expected
  score ≤ 0.40.
- Test runner invokes `skill-similarity.sh --scan-skills scripts/fixtures/` and asserts exit-code
  and output patterns via `grep`.

**Estimated sub-tasks**: 3
- D.1 Create high-overlap and low-overlap fixture SKILL.md files
- D.2 Write `skill-similarity.test.sh` with PASS/FAIL assertions
- D.3 Calibration run: record observed scores in a comment block at top of `skill-similarity.sh`

**Acceptance Criteria**:
- `bash scripts/skill-similarity.test.sh` exits 0
- `bash scripts/validate-plugin.sh` includes `unit test: skill-similarity.test.sh` in Unit Tests section

---

## Global Acceptance Criteria

1. `bash scripts/validate-plugin.sh` exits 0 (all existing checks still pass, new section is warnings-only).
2. `bash scripts/skill-similarity.sh --self-test` exits 0 independently of `validate-plugin.sh`.
3. Threshold is documented as a comment in `skill-similarity.sh` with the calibrated corpus scores
   for `reviewLoop` pairs (or a replan note if calibration forces a threshold change).
4. No `- [ ]` checklist items in any deliverable file.

## Replan Triggers

- Calibration (Subject D.3) shows real `reviewLoop` pairs score below 0.70 → lower threshold to 0.70 and append replan note to TASK-113.
- Calibration shows false-positive rate > 20% on unrelated functions → switch to bigram overlap or raise threshold to 0.90.
- Python traceback in any fixture run → block Subject C integration until fixed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Drafting implementation plan.

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->
