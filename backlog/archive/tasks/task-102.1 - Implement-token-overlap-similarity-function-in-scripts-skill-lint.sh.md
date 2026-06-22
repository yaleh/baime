---
id: TASK-102.1
title: Implement token-overlap similarity function in scripts/skill-lint.sh
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:39'
labels: []
dependencies: []
parent_task_id: TASK-102
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a `compute_token_overlap` bash function to `scripts/skill-lint.sh` (creating the file if it does not exist) that:
- Accepts two text strings as arguments
- Tokenizes each string by splitting on whitespace and punctuation
- Computes the Jaccard similarity: |intersection| / |union| of the two token sets
- Returns a decimal between 0 and 1 (printed to stdout)
- Reads the threshold from env var `SKILL_DUP_THRESHOLD` (default: 0.80)
- Exposes a `--self-test` flag that runs at least 3 built-in unit test cases:
  (a) identical pair → score ≥ 0.99
  (b) high-overlap pair (>80% shared tokens) → score ≥ 0.80
  (c) low-overlap pair (<20% shared tokens) → score < 0.50

This is the algorithmic foundation of TASK-102 (Build a cross-skill duplicate-detection linter). Without a reliable similarity primitive, the cross-file comparison loop and validate-plugin.sh integration have nothing to call. Isolating and verifying the function first reduces the risk of threshold mis-calibration found late.

TASK-102 scans all SKILL.md files for reviewLoop and detectLang implementations that are near-identical (>80% token overlap). This sub-task delivers the core similarity primitive that all three remaining sub-tasks depend on.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Implement token-overlap similarity function in scripts/skill-lint.sh

## Context
TASK-102 requires a linter that detects near-identical implementations across SKILL.md files using >80% token overlap. This sub-task implements the core similarity primitive (`compute_token_overlap`) in `scripts/skill-lint.sh` so all downstream sub-tasks (cross-file loop, validate-plugin.sh integration, regression tests) have a verified building block to call.

## Phase 1: Scaffold scripts/skill-lint.sh with compute_token_overlap

Check if `scripts/skill-lint.sh` exists. If not, create it with a standard bash header (`#!/usr/bin/env bash`, `set -euo pipefail`).

Add the `compute_token_overlap` function:
1. Accept two positional arguments: `TEXT_A="$1"` and `TEXT_B="$2"`.
2. Tokenize each by running through `tr -cs '[:alnum:]' '\n' | sort -u` to get a sorted unique token list.
3. Compute intersection: `comm -12 <(echo "$TOKENS_A") <(echo "$TOKENS_B") | wc -l`
4. Compute union using `comm` on both sorted lists.
5. Use `awk` to divide intersection by union and print the decimal.
6. Read `SKILL_DUP_THRESHOLD` from environment (default `0.80`); the function returns the score — callers apply the threshold.

Add a `--self-test` flag that runs three cases:
- Case A: identical strings → score ≥ 0.99
- Case B: strings sharing ~85% tokens → score ≥ 0.80
- Case C: strings sharing ~10% tokens → score < 0.50

Each case prints PASS/FAIL; exit 1 if any FAIL.

### DoD
- `grep -q 'compute_token_overlap' scripts/skill-lint.sh`
- `grep -q 'SKILL_DUP_THRESHOLD' scripts/skill-lint.sh`
- `grep -q '\-\-self-test' scripts/skill-lint.sh`

## Phase 2: Run self-test and validate plugin

Run the self-test to confirm all three cases pass, then run the full plugin validator:

### DoD
- `bash scripts/skill-lint.sh --self-test`
- `bash scripts/validate-plugin.sh`

## Constraints
- Do not implement the cross-file comparison loop here — that is sub-task 2
- Do not modify validate-plugin.sh to call skill-lint.sh — that is sub-task 3
- The function must be pure bash; only standard POSIX utilities allowed

## Acceptance Gate
- `bash scripts/skill-lint.sh --self-test`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-102
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'compute_token_overlap' scripts/skill-lint.sh
- [ ] #2 grep -q 'SKILL_DUP_THRESHOLD' scripts/skill-lint.sh
- [ ] #3 grep -q '\-\-self-test' scripts/skill-lint.sh
- [ ] #4 bash scripts/skill-lint.sh --self-test
- [ ] #5 bash scripts/validate-plugin.sh
<!-- DOD:END -->
