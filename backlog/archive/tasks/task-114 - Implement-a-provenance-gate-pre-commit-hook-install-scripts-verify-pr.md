---
id: TASK-114
title: 'Implement a provenance-gate pre-commit hook: install scripts/verify-pr'
status: Meta-Plan
assignee: []
created_date: '2026-06-20 14:12'
updated_date: '2026-06-20 14:19'
labels: []
dependencies: []
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a provenance-gate pre-commit hook: install scripts/verify-provenance.sh as a git pre-commit hook so that any commit adding or modifying a results JSON file that lacks data_source: measured is rejected before it reaches CI.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Proposal: Provenance-Gate Pre-Commit Hook (TASK-114)

### Background

The TASK-93 post-mortem identified a critical gap: hand-written baseline JSON files
claiming `data_source: measured` — with no traceable generator — reached CI
undetected. `scripts/verify-provenance.sh` was written as the R5 guard, but it
only runs when invoked explicitly (e.g., by CI or a human). Nothing prevents a
fabricated artifact from being committed in the first place.

A git pre-commit hook closes this gap at the earliest possible point: the moment
`git commit` is executed. The hook inspects only the staged diff (`git diff
--cached`), finds any JSON or Markdown files being added or modified, and runs the
provenance guard on them. If any staged file claims `data_source: measured` but
lacks a valid `generated_by` pointing to an existing repo script, the commit is
rejected with a clear error message — before the change ever touches the remote.

The existing `scripts/verify-provenance.sh` already implements the core detection
logic correctly (grep-based, POSIX-safe, exits 0/1/2). Extending it with a
`--pre-commit` mode avoids duplicating logic while keeping the script usable in
both CI (directory scan) and hook (staged-file) contexts.

### Goals

Observable outcomes:

1. `scripts/verify-provenance.sh --pre-commit` exits 1 and prints offender names
   when staged JSON/Markdown files claim `data_source: measured` without a valid
   `generated_by`.
2. `scripts/install-hooks.sh` installs the hook at `.git/hooks/pre-commit` (or
   updates it if already present) by writing a one-liner that delegates to
   `scripts/verify-provenance.sh --pre-commit`.
3. `scripts/verify-provenance.test.sh` includes at least two new test cases
   covering the `--pre-commit` path (one happy-path, one rejection).
4. A commit that adds a fabricated `data_source: measured` JSON without
   `generated_by` is blocked at the pre-commit stage (demonstrable via `git
   stash`/`git commit` in a temp branch).

### Decomposition (3 Subjects)

**Subject A** — Extend `scripts/verify-provenance.sh` for pre-commit mode
Add `--pre-commit` flag. When set: enumerate staged files via `git diff --cached
--name-only --diff-filter=ACM`; filter to `*.json` and `*.md`; run the same
provenance check on each staged file's staged content (via `git show :path`).
Exit codes remain 0/1/2.

**Subject B** — `scripts/install-hooks.sh`
New script. Writes/overwrites `.git/hooks/pre-commit` with a shell stub that calls
`bash scripts/verify-provenance.sh --pre-commit` from repo root, marks it
executable (`chmod +x`). Idempotent: safe to re-run. Prints a confirmation line.

**Subject C** — Tests for the pre-commit hook path
Extend `scripts/verify-provenance.test.sh` with cases that simulate `--pre-commit`
mode: mock `git diff --cached` output, verify exit codes and error messages. Also
add a smoke test for `install-hooks.sh` confirming the hook file is created and
executable.

### Trade-offs

| Option | Pro | Con |
|---|---|---|
| Extend existing `verify-provenance.sh` with `--pre-commit` | Single source of truth | Slightly more complexity in one file |
| Separate `pre-commit` script | Simpler each file | Logic duplication, two files to maintain |
| Husky / lint-staged | Standard tooling | Requires Node.js, adds dependency |

Chosen: extend existing script. No new runtime dependencies. Fits the project's
POSIX-bash-only constraint visible in all existing scripts.

---

# Implementation Plan: Provenance-Gate Pre-Commit Hook (TASK-114)

## Subject A — Extend `scripts/verify-provenance.sh` for pre-commit mode

**Files touched:** `scripts/verify-provenance.sh`

**What changes:**

Add a `--pre-commit` flag to the argument parser. When `--pre-commit` is active:

1. Skip the `DIR` requirement (no directory argument needed).
2. Enumerate staged files: `git diff --cached --name-only --diff-filter=ACM`
3. Filter to `*.json` and `*.md` extensions.
4. For each staged file, extract its staged content via `git show ":$file"` into
   a temp file, then run the existing provenance check logic on that temp file.
5. Accumulate offenders and print them exactly as the directory-scan mode does.
6. Exit codes: 0 (all pass or no measured staged files), 1 (offenders found),
   2 (usage error).

The existing directory-scan code path is unchanged. The two modes share the inner
provenance-check logic via a helper function to avoid duplication.

**Acceptance Criteria:**

- `bash scripts/verify-provenance.sh --pre-commit` exits 0 when no staged JSON/MD
  files claim `data_source: measured`, or when all measured staged files carry a
  valid `generated_by` pointing to an existing script.
- `bash scripts/verify-provenance.sh --pre-commit` exits 1 and names the offending
  file when a staged JSON file claims `data_source: measured` with no
  `generated_by` field.
- The existing directory-scan interface (`verify-provenance.sh <DIR>`) continues to
  work without modification (all 7 existing tests still pass).

---

## Subject B — `scripts/install-hooks.sh`

**Files touched:** `scripts/install-hooks.sh` (new file)

**What it does:**

A standalone POSIX-bash script that:

1. Detects the repo root via `git rev-parse --show-toplevel`.
2. Writes `.git/hooks/pre-commit` with the content:

   ```sh
   #!/usr/bin/env bash
   REPO_ROOT="$(git rev-parse --show-toplevel)"
   exec bash "$REPO_ROOT/scripts/verify-provenance.sh" --pre-commit
   ```

3. Sets `chmod +x .git/hooks/pre-commit`.
4. Prints: `install-hooks: pre-commit hook installed at .git/hooks/pre-commit`
5. Idempotent: if the hook file already contains the provenance delegation line,
   prints `install-hooks: pre-commit hook already up to date` and exits 0.
6. If `.git/hooks/pre-commit` exists but contains other content (not managed by
   this script), appends the provenance call and prints a warning to stderr.

**Acceptance Criteria:**

- Running `bash scripts/install-hooks.sh` creates `.git/hooks/pre-commit` that is
  executable and invokes `verify-provenance.sh --pre-commit`.
- Re-running `bash scripts/install-hooks.sh` a second time exits 0 without
  duplicating content (idempotency).
- The hook file delegates to `scripts/verify-provenance.sh --pre-commit` via an
  absolute path resolved from `git rev-parse --show-toplevel`, not a hardcoded
  path.

---

## Subject C — Tests for the pre-commit hook path

**Files touched:** `scripts/verify-provenance.test.sh`

**What changes:**

Append new test cases (Test 8 onward) to the existing test file. Tests mock git
operations using a temporary bare git repo or by directly invoking
`verify-provenance.sh --pre-commit` with `GIT_DIR` and `GIT_INDEX_FILE` overrides
so the test controls what `git diff --cached` returns without touching the real
repo index.

New test cases:

- **Test 8** (`--pre-commit`, no staged files): exits 0, PASS message.
- **Test 9** (`--pre-commit`, staged measured JSON with valid `generated_by`):
  exits 0.
- **Test 10** (`--pre-commit`, staged measured JSON without `generated_by`):
  exits 1, offender filename in output.
- **Test 11** (`--pre-commit`, staged measured JSON with nonexistent `generated_by`):
  exits 1.
- **Test 12** (smoke test for `install-hooks.sh`): creates a temp `GIT_DIR`,
  runs `install-hooks.sh`, asserts `.git/hooks/pre-commit` exists and is
  executable; re-runs and asserts idempotency (exit 0, no duplicate lines).

**Acceptance Criteria:**

- All new tests (Test 8–12) pass when `bash scripts/verify-provenance.test.sh` is
  run from the repo root.
- No existing tests (Test 1–7) regress.
- The test file prints a final summary line in the format
  `verify-provenance.test.sh: N passed, 0 failed` with N >= 12.

---

## Implementation Order

Subject A must land first (B and C depend on it). B and C can proceed in parallel
once A is merged. Integration smoke test (C/Test 12) requires B to be present but
can stub it if needed.

## Out of Scope

- CI pipeline integration (the hook gates commits locally; CI already runs
  `verify-provenance.sh` on the full results directory via `validate-plugin.sh`).
- Automatic hook installation on clone (requires a `post-checkout` hook or
  developer onboarding doc — separate task).
- Windows support (project is Linux/bash only per CLAUDE.md).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Drafting implementation plan.

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->
