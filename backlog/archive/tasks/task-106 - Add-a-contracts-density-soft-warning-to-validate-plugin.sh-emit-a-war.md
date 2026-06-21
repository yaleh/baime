---
id: TASK-106
title: 'Add a contracts-density soft-warning to validate-plugin.sh: emit a war'
status: Meta-Plan
assignee: []
created_date: '2026-06-20 14:04'
updated_date: '2026-06-20 14:10'
labels: []
dependencies: []
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a contracts-density soft-warning to validate-plugin.sh: emit a warning when any SKILL.md has fewer than 1 contract per 50 lines of spec, helping catch under-specified skills early in CI.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Proposal: Add contracts-density soft-warning to validate-plugin.sh

## Background

validate-plugin.sh enforces contract existence (the `contracts:` YAML key) and runs
contract grep/not-grep assertions, but it does not relate contract count to skill
complexity. A 600-line skill with 3 contracts has the same surface area as a 27-line
stub yet receives identical treatment from CI. The current "Contract Density Check"
section (lines 569–615) applies only an absolute threshold — skills must have ≥3
contracts if they exceed 500 lines — which misses the proportional relationship
entirely. Empirical measurement across all 25 SKILL.md files shows that 20 of 25 skills
fall below 1 contract per 50 lines of spec, including long skills such as
cross-cutting-concerns (613 lines, density 0.24) and methodology-bootstrapping (654
lines, density 0.23). Under the current gate these files pass silently. A proportional
soft-warning closes this gap without blocking the build, letting authors discover
under-specification while still keeping CI green.

## Goals

1. validate-plugin.sh emits a `WARNING: contracts density low` line (visible in CI
   stdout) for every SKILL.md whose contract count is fewer than 1 per 50 lines of spec,
   so that an evaluator reading raw CI output can identify each under-specified skill by
   name.
2. The warning is soft: the script exits 0 even when warnings are present, and the
   existing `Warnings:` counter in the Summary section increments, making the count
   machine-readable without failing the build.
3. The density formula and threshold (1 contract per 50 lines) are expressed as named
   constants in the check implementation, so an evaluator inspecting the script can
   read the policy without reverse-engineering the arithmetic.

## Decomposition Approach

**Subject 1 — Replace absolute threshold with proportional density ratio.**
Rewrite the existing "Layer 0: Contract Density Check" Python block to compute
`density = contract_count / (spec_lines / 50)` and emit a WARNING when
`density < 1.0`, replacing the current `lines > 500 and count < 3` logic. The
named constants `LINES_PER_CONTRACT = 50` and `MIN_DENSITY = 1.0` make the policy
legible.

**Subject 2 — Update or add unit/smoke tests for the density check.**
Add a test fixture pair (one SKILL.md at density ≥ 1.0, one at density < 1.0) and a
test assertion in the existing scripts test harness that validates the warning fires for
the under-dense fixture and is absent for the conforming one.

**Subject 3 — Backfill or document the density gap for current skills.**
Produce a brief audit note (inline comment or doc entry) listing which of the current 25
skills fall below threshold, so authors know the baseline state when the warning first
activates in CI — preventing surprise noise without silent suppression.

## Trade-offs and Scope Limits

- This is a WARNING, not a gate. No skill is blocked from merging. Changing it to a
  hard error is explicitly out of scope for this work item.
- Contract content quality (whether the grep patterns are meaningful) is not evaluated;
  only the count-to-line ratio is checked.
- The spec-line count includes frontmatter. Excluding frontmatter would add complexity
  for marginal accuracy gain and is out of scope.
- Retroactively fixing all 20 under-dense skills to meet the threshold is out of scope;
  that is a separate authoring concern.
- No changes to the contract execution logic (`validate_contracts` function) are
  included; this proposal touches only the density heuristic.

---

# Implementation Plan: Add contracts-density soft-warning to validate-plugin.sh

## Subject A: Replace absolute threshold with proportional density ratio in validate-plugin.sh
**What**: Rewrite the Python block in the "Layer 0: Contract Density Check" section (lines 569–615 of `scripts/validate-plugin.sh`). Replace the current `LINE_THRESHOLD = 500` / `CONTRACT_THRESHOLD = 3` absolute logic with two named constants `LINES_PER_CONTRACT = 50` and `MIN_DENSITY = 1.0`, compute `density = contract_count / (spec_lines / LINES_PER_CONTRACT)`, and emit `WARNING: contracts density low: <skill> (<lines> lines, <contracts> contracts, density <d:.2f>)` whenever `density < MIN_DENSITY`. The `set +e` / `set -e` guard and `WARNINGS=$((WARNINGS + DENSITY_WARNINGS))` accumulation logic remain unchanged so the script still exits 0 on warnings.
**Files**: `scripts/validate-plugin.sh` — specifically the Python heredoc starting at line 575 (between the `PYEOF` delimiters inside the "Contract Density Check" section)
**Deliverable**: Running `bash scripts/validate-plugin.sh` on the current plugin tree emits at least one `WARNING: contracts density low` line (since the proposal confirms 20 of 25 skills are under-dense) and exits 0; the `Warnings:` counter in the Summary section is non-zero
**Estimated sub-tasks**: 1

## Subject B: Add density-check unit test fixtures and a test script
**What**: Create two minimal SKILL.md fixture files — one conforming (density ≥ 1.0, e.g. 50 lines with 1 contract) and one under-dense (density < 1.0, e.g. 100 lines with 1 contract) — and a new `scripts/density-check.test.sh` that invokes the density logic against each fixture and asserts the warning fires for the under-dense case and is absent for the conforming one. The test script follows the same pattern as existing `*.test.sh` files discovered by `run_skill_unit_tests` (line 242 of `validate-plugin.sh`) so it is picked up automatically by CI.
**Files**:
- `scripts/fixtures/density-low-fixture/SKILL.md` (new under-dense fixture)
- `scripts/fixtures/density-ok-fixture/SKILL.md` (new conforming fixture)
- `scripts/density-check.test.sh` (new test script)
**Deliverable**: `bash scripts/density-check.test.sh` exits 0 and prints PASS for both the warning-fires and warning-absent assertions; the test appears as a passing line in the `=== Unit Tests ===` section of `bash scripts/validate-plugin.sh`
**Estimated sub-tasks**: 2

## Subject C: Add inline audit comment listing current under-dense skills
**What**: Add a brief comment block directly above the Python heredoc in the "Layer 0: Contract Density Check" section of `scripts/validate-plugin.sh`, listing which of the current 25 skills are below the 1-per-50-lines threshold at the time of implementation (derived from the proposal's empirical data: e.g. cross-cutting-concerns 613 lines density 0.24, methodology-bootstrapping 654 lines density 0.23, etc.). This gives authors a baseline snapshot so CI warning noise on first activation is expected and documented.
**Files**: `scripts/validate-plugin.sh` — comment block inserted immediately before the `python3 - "$SKILLS_DIR" <<'PYEOF'` line in the Contract Density Check section
**Deliverable**: `grep -A 30 'Contract Density Check' scripts/validate-plugin.sh` reveals a comment listing at least the two longest under-dense skills by name with their line counts and computed densities
**Estimated sub-tasks**: 1

## Acceptance Criteria
1. `bash scripts/validate-plugin.sh` exits 0 and the stdout contains at least one line matching `WARNING: contracts density low` naming a specific skill, confirming the proportional check fires against the live plugin tree.
2. The Summary line `Warnings: N` in the script output shows N > 0 (the density warnings accumulate into the existing counter) while `Errors: 0` confirms no build break.
3. `bash scripts/density-check.test.sh` exits 0, and the `=== Unit Tests ===` section of `bash scripts/validate-plugin.sh` shows `PASS: unit test: density-check.test.sh`.
4. `grep 'LINES_PER_CONTRACT\|MIN_DENSITY' scripts/validate-plugin.sh` returns both constant definitions, confirming the policy is legible without reverse-engineering arithmetic.
5. `grep -A 30 'Contract Density Check' scripts/validate-plugin.sh` reveals an inline comment referencing at least two specific under-dense skills by name, establishing the baseline audit note.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Drafting implementation plan.

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->
