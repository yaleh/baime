---
id: TASK-93.18.2
title: Write scripts/install-hooks.sh — idempotent pre-commit hook installer
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:54'
labels: []
dependencies: []
modified_files:
  - scripts/install-hooks.sh
parent_task_id: TASK-93.18
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create scripts/install-hooks.sh that installs scripts/verify-provenance.sh as the git pre-commit hook at .git/hooks/pre-commit. The script must be idempotent: if the hook already points to verify-provenance.sh, it is a no-op. If a different pre-commit hook already exists, it warns the user and exits non-zero rather than silently overwriting. The installer writes a small wrapper script to .git/hooks/pre-commit that calls `bash scripts/verify-provenance.sh` from the repo root.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Write scripts/install-hooks.sh — idempotent pre-commit hook installer

## Context
TASK-93.18 requires a one-command install experience. install-hooks.sh encapsulates the logic to place the hook, making it reproducible across developer machines and CI bootstrap.

## Phase 1: Create scripts/install-hooks.sh
Write the script with these behaviors:
1. Detect repo root via `git rev-parse --show-toplevel`.
2. Target: `$REPO_ROOT/.git/hooks/pre-commit`.
3. If target exists and already contains `verify-provenance.sh`: print "already installed" and exit 0 (idempotent).
4. If target exists but does NOT contain `verify-provenance.sh`: warn to stderr "pre-commit hook already exists and does not reference verify-provenance.sh — aborting" and exit 1.
5. Otherwise: create `$REPO_ROOT/.git/hooks/` if needed, write:
   ```
   #!/usr/bin/env bash
   exec bash "$(git rev-parse --show-toplevel)/scripts/verify-provenance.sh"
   ```
   then `chmod +x`.
6. Print success message.
### DoD
- `test -f scripts/install-hooks.sh`
- `grep -q 'verify-provenance' scripts/install-hooks.sh`
- `grep -q 'already installed\|already exists' scripts/install-hooks.sh`

## Phase 2: Validate plugin
### DoD
- `bash scripts/validate-plugin.sh`

## Constraints
- Must not overwrite a pre-existing hook that doesn't reference verify-provenance.sh
- Must create .git/hooks/ if it doesn't exist
- No dependencies beyond bash and git

## Acceptance Gate
- `test -f scripts/install-hooks.sh`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.18
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/install-hooks.sh
- [ ] #2 grep -q 'verify-provenance' scripts/install-hooks.sh
- [ ] #3 bash scripts/validate-plugin.sh
<!-- DOD:END -->
