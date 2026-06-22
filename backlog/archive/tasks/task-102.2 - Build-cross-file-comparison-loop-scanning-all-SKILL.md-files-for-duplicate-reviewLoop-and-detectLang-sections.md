---
id: TASK-102.2
title: >-
  Build cross-file comparison loop scanning all SKILL.md files for duplicate
  reviewLoop and detectLang sections
status: Backlog
assignee: []
created_date: '2026-06-20 10:39'
updated_date: '2026-06-20 10:49'
labels: []
dependencies: []
parent_task_id: TASK-102
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a `scan_skill_duplicates` function to `scripts/skill-lint.sh` that iterates over every `SKILL.md` file under `plugin/`, extracts the `reviewLoop` and `detectLang` implementation sections from each file, and calls `compute_token_overlap` (from TASK-102.1) on every pair. Any pair whose overlap score meets or exceeds `SKILL_DUP_THRESHOLD` (default 0.80) is recorded as a duplicate finding.

The function must:
1. Use `find plugin/ -name 'SKILL.md'` to enumerate all skill files.
2. Extract the `reviewLoop` section: text between the `## reviewLoop` heading and the next `##` heading (or EOF).
3. Extract the `detectLang` section: same pattern for `## detectLang`.
4. For each section type independently, compare all N*(N-1)/2 pairs using `compute_token_overlap`.
5. For each pair above threshold, emit a line: `DUPLICATE: <section> <file_a> <file_b> score=<score>`.
6. Expose a `--scan` flag that triggers this loop and exits 0 (even if duplicates found — reporting only, no hard failure yet).

This sub-task depends on TASK-102.1 (compute_token_overlap must exist). Sub-task 3 (validate-plugin.sh integration) and sub-task 4 (regression tests) depend on this sub-task.

This is part of TASK-102: Build a cross-skill duplicate-detection linter.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Build cross-file comparison loop scanning all SKILL.md files for duplicate reviewLoop and detectLang sections

## Context
TASK-102 needs a linter that finds near-identical (>80% token overlap) `reviewLoop` and `detectLang` sections across all skill files. TASK-102.1 provides the `compute_token_overlap` primitive. This sub-task wires that primitive into a full N×N comparison loop over the plugin directory.

## Phase 1: Implement section extractor helper

Add a `extract_section` bash function to `scripts/skill-lint.sh` that:
1. Takes two arguments: `FILE` and `SECTION_HEADING` (e.g. `reviewLoop`).
2. Uses `awk` to extract text between `## <SECTION_HEADING>` and the next `##` heading (or EOF).
3. Prints the extracted text to stdout; prints nothing if the section does not exist.

Verify the extractor works on an existing SKILL.md:
```bash
bash -c 'source scripts/skill-lint.sh; extract_section plugin/loop-meta/SKILL.md reviewLoop' | head -5
```

### DoD
- `grep -q 'extract_section' scripts/skill-lint.sh`
- `bash -c 'source scripts/skill-lint.sh && declare -f extract_section' | grep -q 'awk'`

## Phase 2: Implement scan_skill_duplicates and --scan flag

Add a `scan_skill_duplicates` function and wire it to a `--scan` CLI flag:
1. Collect all SKILL.md files: `mapfile -t SKILL_FILES < <(find plugin/ -name 'SKILL.md' | sort)`.
2. For each section type in `(reviewLoop detectLang)`, iterate all pairs `i < j` using two nested loops over the `SKILL_FILES` array.
3. For each pair, call `extract_section` on both files; skip if either section is empty.
4. Call `compute_token_overlap` on the two extracted texts.
5. If score ≥ `SKILL_DUP_THRESHOLD`, print: `DUPLICATE: <section> <file_i> <file_j> score=<score>`.
6. The `--scan` flag invokes `scan_skill_duplicates` and exits 0 regardless of findings.

### DoD
- `grep -q 'scan_skill_duplicates' scripts/skill-lint.sh`
- `grep -q '\-\-scan' scripts/skill-lint.sh`
- `bash scripts/skill-lint.sh --scan`

## Phase 3: Smoke-test against real plugin directory

Run `--scan` and capture output. Confirm the script completes without error even if zero duplicates are found:
```bash
bash scripts/skill-lint.sh --scan > /tmp/scan-output.txt 2>&1
```
Confirm the output file exists and the script exits 0.

### DoD
- `bash scripts/skill-lint.sh --scan`
- `bash scripts/validate-plugin.sh`

## Constraints
- Do not add the DUPLICATE findings as validate-plugin.sh failures yet — that is sub-task 3
- Do not create test fixtures here — that is sub-task 4
- Section extraction must handle SKILL.md files that lack the target section (skip silently)

## Acceptance Gate
- `bash scripts/skill-lint.sh --scan`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-102
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'extract_section' scripts/skill-lint.sh
- [ ] #2 bash -c 'source scripts/skill-lint.sh && declare -f extract_section' | grep -q 'awk'
- [ ] #3 grep -q 'scan_skill_duplicates' scripts/skill-lint.sh
- [ ] #4 grep -q '\-\-scan' scripts/skill-lint.sh
- [ ] #5 bash scripts/skill-lint.sh --scan
- [ ] #6 bash scripts/validate-plugin.sh
<!-- DOD:END -->
