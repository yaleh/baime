---
id: TASK-93.18.1
title: Adapt verify-provenance.sh for pre-commit hook mode (staged file detection)
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:54'
labels: []
dependencies: []
modified_files:
  - scripts/verify-provenance.sh
parent_task_id: TASK-93.18
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modify scripts/verify-provenance.sh so it can operate as a git pre-commit hook. When invoked with no positional DIR argument, the script discovers staged JSON files via `git diff --cached --name-only --diff-filter=ACM`, filters for *.json paths, and validates each for provenance. A staged file that claims `data_source: measured` but lacks a valid `generated_by` causes exit 1, rejecting the commit. If no staged JSON files exist the script exits 0 (no-op). Existing explicit-DIR behavior is preserved.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Adapt verify-provenance.sh for pre-commit hook mode

## Context
TASK-93.18 requires installing verify-provenance.sh as a git pre-commit hook. The current script only accepts an explicit DIR argument; running it with no arguments exits 2. A hook needs zero-argument invocation that auto-discovers staged files.

## Phase 1: Read the current script
Read scripts/verify-provenance.sh to understand the argument-parsing and validation loop before modifying.
### DoD
- `grep -q 'while \[ \$# -gt 0 \]' scripts/verify-provenance.sh`

## Phase 2: Add hook mode to verify-provenance.sh
When no DIR is set after argument parsing, enter hook mode:
1. Run `git diff --cached --name-only --diff-filter=ACM` to get staged paths.
2. Filter lines ending in `.json`.
3. For each path, apply the same measured/generated_by validation already in the script.
4. If violations found, print them and exit 1. If no staged JSON files, exit 0.

Replace the `if [ -z "$DIR" ]` exit-2 block with a hook-mode branch.
### DoD
- `grep -q 'git diff --cached' scripts/verify-provenance.sh`

## Phase 3: Smoke-test hook mode
Verify script still passes existing tests and shows help correctly.
### DoD
- `bash scripts/verify-provenance.sh --help 2>&1 | grep -q Usage`
- `bash scripts/verify-provenance.test.sh`

## Phase 4: Validate plugin
### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- Do not break explicit DIR mode
- No external dependencies beyond bash + git + grep

## Acceptance Gate
- `bash scripts/verify-provenance.test.sh`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.18
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'git diff --cached' scripts/verify-provenance.sh
- [ ] #2 bash scripts/verify-provenance.test.sh
- [ ] #3 bash scripts/validate-plugin.sh
<!-- DOD:END -->
