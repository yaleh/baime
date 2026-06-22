---
id: TASK-103.1
title: Adapt verify-provenance.sh to detect staged JSON files via git diff --cached
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:39'
labels: []
dependencies: []
parent_task_id: TASK-103
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modify `scripts/verify-provenance.sh` so that, when invoked with no arguments, it auto-discovers all JSON files staged for commit by running `git diff --cached --name-only --diff-filter=ACM` and filters for `*.json` paths. For each detected file it checks that the file contains `"data_source": "measured"`; if any file fails the check the script exits non-zero with a clear message identifying the offending file.

**Why it exists:** The existing `verify-provenance.sh` script validates provenance fields but operates on explicit file paths. To work as a pre-commit hook it must auto-discover staged files itself.

**Parent goal (TASK-103):** This is the core logic layer of the provenance-gate pre-commit hook. The install script (sub-task 2) and tests (sub-task 3) both depend on this adapted script.

**parentTask: TASK-103**
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'diff --cached' scripts/verify-provenance.sh
- [ ] #2 grep -q 'diff-filter=ACM' scripts/verify-provenance.sh
- [ ] #3 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Plan: Adapt verify-provenance.sh to detect staged JSON files via git diff --cached

## Context
`scripts/verify-provenance.sh` currently validates provenance fields when file paths are passed as arguments. To serve as a pre-commit hook it must auto-discover staged JSON files via `git diff --cached` when invoked with no arguments. This is the foundational change enabling the TASK-103 provenance gate.

## Phase 1: Inspect existing verify-provenance.sh
Read `scripts/verify-provenance.sh` to understand its current interface (argument parsing, validation logic, exit codes).

### DoD
- `test -f scripts/verify-provenance.sh`
- `grep -q 'data_source' scripts/verify-provenance.sh`

## Phase 2: Add staged-file auto-discovery
When the script is invoked with zero arguments, run `git diff --cached --name-only --diff-filter=ACM` and collect `*.json` files. Pass the resulting list through existing validation logic. If any JSON file lacks `"data_source": "measured"`, print the offending filename and exit 1. If no JSON files are staged, exit 0.

### DoD
- `grep -q 'diff --cached' scripts/verify-provenance.sh`
- `grep -q 'diff-filter=ACM' scripts/verify-provenance.sh`
- `grep -q 'exit 1' scripts/verify-provenance.sh`

## Phase 3: Validate plugin
Run the project validation gate.

### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- Preserve existing argument-based usage if present
- Do not alter the validation logic for `data_source: measured` — only add the discovery layer
- No new dependencies beyond bash and git

## Acceptance Gate
- `grep -q 'diff --cached' scripts/verify-provenance.sh`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:NOTES:END -->
