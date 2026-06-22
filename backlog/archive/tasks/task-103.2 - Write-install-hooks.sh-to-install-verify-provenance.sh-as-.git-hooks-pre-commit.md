---
id: TASK-103.2
title: >-
  Write install-hooks.sh to install verify-provenance.sh as
  .git/hooks/pre-commit
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:49'
labels: []
dependencies: []
parent_task_id: TASK-103
ordinal: 107000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create `scripts/install-hooks.sh` that installs `scripts/verify-provenance.sh` as the git pre-commit hook by writing (or symlinking) it to `.git/hooks/pre-commit` and making it executable. The script should be idempotent: running it multiple times must not corrupt the hook. It should warn if a pre-commit hook already exists and is not the provenance gate.

**Why it exists:** The adapted `verify-provenance.sh` (TASK-103.1) must be wired into the git workflow. Developers need a one-command setup that places the hook correctly regardless of their OS.

**Parent goal (TASK-103):** This is the installation layer of the provenance-gate pre-commit hook. It depends on TASK-103.1 (the adapted script) and enables TASK-103.3 (the tests that exercise the full hook path).

**parentTask: TASK-103**
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/install-hooks.sh
- [ ] #2 bash scripts/install-hooks.sh
- [ ] #3 test -x .git/hooks/pre-commit
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Plan: Write install-hooks.sh to install verify-provenance.sh as .git/hooks/pre-commit

## Context
After adapting `verify-provenance.sh` to auto-discover staged JSON files, it must be wired into git's pre-commit hook mechanism. This script provides a one-command setup so any developer can activate the provenance gate immediately after cloning.

## Phase 1: Design install-hooks.sh
Write `scripts/install-hooks.sh` that:
1. Resolves the repo root via `git rev-parse --show-toplevel`
2. Checks if `.git/hooks/pre-commit` already exists; if it does and is NOT the provenance gate, prints a warning and exits 1
3. Copies (or symlinks) `scripts/verify-provenance.sh` to `.git/hooks/pre-commit`
4. Runs `chmod +x .git/hooks/pre-commit`
5. Prints a success message

### DoD
- `test -f scripts/install-hooks.sh`
- `grep -q 'pre-commit' scripts/install-hooks.sh`
- `grep -q 'chmod' scripts/install-hooks.sh`

## Phase 2: Verify idempotency
Run `bash scripts/install-hooks.sh` twice; confirm second run exits 0 without error.

### DoD
- `bash scripts/install-hooks.sh`
- `test -x .git/hooks/pre-commit`

## Phase 3: Validate plugin
Run the project validation gate.

### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- Must work on Linux and macOS (bash + POSIX utilities only)
- Must be idempotent
- Must not overwrite an unrelated pre-commit hook silently

## Acceptance Gate
- `test -f scripts/install-hooks.sh`
- `test -x .git/hooks/pre-commit`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:NOTES:END -->
