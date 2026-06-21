---
id: TASK-107
title: 'Build a skill-lint severity matrix: categorise all existing validate-p'
status: Meta-Plan
assignee: []
created_date: '2026-06-20 14:11'
updated_date: '2026-06-20 14:15'
labels: []
dependencies: []
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a skill-lint severity matrix: categorise all existing validate-plugin.sh warnings as P0 (blocker), P1 (warning), or P2 (advisory), and write the mapping to plugin/.claude-plugin/lint-severity.json so CI can gate on P0s only.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Skill-Lint Severity Matrix for validate-plugin.sh

## Background
`scripts/validate-plugin.sh` currently emits checks via two functions: `fail()` (increments `$ERRORS`, causes non-zero exit) and `WARNING`/`WARN` print statements (increments `$WARNINGS`, does not block CI). However, there is no authoritative mapping that describes *which* check belongs to which severity tier. This means CI must either block on all failures or allow all warnings through—there is no middle ground for advisory notices that could become blockers later. A formal severity matrix written to `plugin/.claude-plugin/lint-severity.json` allows CI scripts to query severity intent directly from a machine-readable source, making it possible to gate the pipeline on P0 blockers only, surface P1 warnings as annotations, and track P2 advisories for future attention. The matrix also creates a stable contract between the validator and future tooling (GitHub Actions annotations, loop-meta ROI gates, etc.).

## Goals
1. Every check currently produced by `validate-plugin.sh` is assigned a severity tier (P0 blocker, P1 warning, or P2 advisory) in `plugin/.claude-plugin/lint-severity.json`, with a human-readable rationale for each assignment.
2. The JSON file at `plugin/.claude-plugin/lint-severity.json` exists, is valid JSON, and contains a top-level `"checks"` array where each entry has at minimum the fields `id`, `severity` (one of `"P0"`, `"P1"`, `"P2"`), `description`, and `rationale`.
3. The severity assignments are consistent with their current runtime behaviour: checks that call `fail()` (which exits non-zero) are assigned P0; checks that print `WARNING` or `WARN` without incrementing `$ERRORS` are assigned P1 or P2 based on how actionable and immediate their remediation is.

## Decomposition Approach
- **Subject A — Audit and catalogue checks**: Read `validate-plugin.sh` exhaustively and enumerate every distinct check with its current runtime behaviour (`fail` vs `WARNING`/`WARN` vs informational `pass`), producing an internal enumeration as the basis for tier assignment.
- **Subject B — Author lint-severity.json**: Write `plugin/.claude-plugin/lint-severity.json` containing the full severity matrix, with each check's `id`, `severity`, `description`, and `rationale` fields filled in.
- **Subject C — Wire CI gate**: Update or document how a CI step reads `lint-severity.json` to gate on P0s only (for example, a helper script or inline step that cross-references `validate-plugin.sh` output against the JSON to fail the build only on P0-severity findings).

## Trade-offs and Scope Limits
- The severity matrix documents *intent* at time of authoring; it does not change the runtime behaviour of `validate-plugin.sh` itself in this task—that is a separate refactor.
- Pass-level checks (`pass()` calls) are not listed in the severity matrix since they carry no actionable signal; only failure-mode checks are catalogued.
- Automatically enforcing severity tiers at runtime (patching `validate-plugin.sh` to read `lint-severity.json` dynamically) is out of scope; the goal is a stable machine-readable file that future tasks can consume.
- The CI gate deliverable may be as minimal as a documented shell snippet or a new `scripts/check-severity-gate.sh`; a full GitHub Actions workflow change is not required.

---

# Implementation Plan: Skill-Lint Severity Matrix for validate-plugin.sh

## Subject A: Audit and catalogue all validate-plugin.sh checks
**What**: Read `scripts/validate-plugin.sh` in full and produce an enumeration of every distinct check that can result in a `fail()` call, a `WARNING`/`WARN` print, or a `WARN` print. For each check, record its section heading, the triggering condition, and its current runtime behaviour (increments `$ERRORS` vs increments `$WARNINGS` vs neither). This enumeration is the input for Subject B's severity assignment.
**Files**: `scripts/validate-plugin.sh` (read-only input)
**Deliverable**: An ordered list of check IDs and their runtime classifications is embedded as the source of truth comment block at the top of the JSON produced in Subject B — there is no separate intermediate file.
**Estimated sub-tasks**: 1

## Subject B: Author plugin/.claude-plugin/lint-severity.json
**What**: Write `plugin/.claude-plugin/lint-severity.json` containing a top-level `"checks"` array. Each entry must have: `id` (slug matching the check's section/description), `severity` (`"P0"`, `"P1"`, or `"P2"`), `description` (one sentence), and `rationale` (one sentence explaining the tier assignment). Tier mapping rule: any check that calls `fail()` → P0; any check that prints `WARNING`/`WARN` and increments `$WARNINGS` → P1 (if immediately actionable) or P2 (if advisory/informational); checks that print `WARNING`/`WARN` but do not change `$ERRORS` or `$WARNINGS` → P2.
**Files**: `plugin/.claude-plugin/lint-severity.json` (created)
**Deliverable**: `plugin/.claude-plugin/lint-severity.json` is a valid JSON file with all checks from `validate-plugin.sh` represented and no severity field outside the allowed set `["P0","P1","P2"]`.
**Estimated sub-tasks**: 1

## Subject C: CI severity gate script
**What**: Write `scripts/check-severity-gate.sh` — a short shell script that accepts the text output of `validate-plugin.sh` on stdin (or as a file argument), reads `plugin/.claude-plugin/lint-severity.json`, and exits non-zero only if any P0-severity check ID appears in the failure output. P1 findings are printed as annotations; P2 findings are silently passed through. This gives CI a single entry-point to enforce the P0-only gate without modifying `validate-plugin.sh`.
**Files**: `scripts/check-severity-gate.sh` (created), `plugin/.claude-plugin/lint-severity.json` (read)
**Deliverable**: `scripts/check-severity-gate.sh` exists, is executable, and when given a `validate-plugin.sh` run log that contains only P1/P2 findings it exits 0; when given a log containing a P0 finding it exits non-zero.
**Estimated sub-tasks**: 1

## Acceptance Criteria
1. `plugin/.claude-plugin/lint-severity.json` exists and is parseable as JSON with a top-level `"checks"` array where every entry contains the fields `id`, `severity`, `description`, and `rationale`, and `severity` is one of `"P0"`, `"P1"`, or `"P2"`.
2. The count of P0 entries in `lint-severity.json` equals the number of distinct checks in `validate-plugin.sh` that invoke the `fail()` function, confirming no `fail()` check was silently downgraded.
3. `scripts/check-severity-gate.sh` exists, is executable, and its inline help or header comment references `lint-severity.json` as the source of severity truth.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Drafting implementation plan.

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->
