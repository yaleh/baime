---
id: TASK-109
title: 'Add a loop-meta idempotency integration test: run draftDecomposition t'
status: Meta-Plan
assignee: []
created_date: '2026-06-20 14:12'
updated_date: '2026-06-20 14:15'
labels: []
dependencies: []
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a loop-meta idempotency integration test: run draftDecomposition twice on the same meta-task fixture and assert that the second run appends 'children already exist' and creates zero new sub-tasks.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: loop-meta draftDecomposition Idempotency Integration Test

## Background

`draftDecomposition` in `.claude/skills/loop-meta/SKILL.md` contains an idempotency
guard (section §0) that queries existing child tasks and, when `EXISTING > 0`, appends
the note `"draftDecomposition: children already exist (N) — skipping creation"` instead
of creating duplicates. This guard is a correctness invariant: if it regresses, every
meta-task restart or daemon restart could create duplicate sub-tasks, polluting the
backlog and breaking downstream tooling. TASK-93's post-mortem identified unguarded
re-entry as a root cause of backlog noise during loop-meta experiments.

The existing `scripts/test-loop-meta-idempotent.sh` tests `idempotentReconcile`
(the Meta-Active reconciliation path) but does **not** exercise `draftDecomposition`'s
own guard at the top of the Meta-Plan path. There is no integration test today that
calls `draftDecomposition` twice against the same meta-task fixture and asserts the
second call is a no-op. Without such a test the guard can silently regress in CI.

## Goals

1. An integration test script (`scripts/test-draft-decomposition-idempotent.sh`) exists,
   is executable, passes `bash scripts/validate-plugin.sh`, and is registered in CI so
   that any regression in the idempotency guard fails the pipeline.
2. Running the test script twice against the same meta-task fixture produces: first run
   creates N ≥ 1 sub-tasks; second run creates zero new sub-tasks and appends a note
   containing `"children already exist"`.

## Decomposition Approach

**Subject A — Test fixture and driver script**
Create a minimal meta-task markdown fixture (a static `.md` file representing a
Meta-Plan task with no children) and `scripts/test-draft-decomposition-idempotent.sh`
that stubs the backlog CLI interactions (using an in-process state machine, following
the pattern in `test-loop-meta-idempotent.sh`) and calls the `draftDecomposition`
logic twice, asserting idempotency.

**Subject B — CI wiring**
Add a step to `.github/workflows/ci.yml` that runs
`bash scripts/test-draft-decomposition-idempotent.sh` so the test is enforced on every
push and PR to `main`.

## Trade-offs and Scope Limits

- The test uses an in-memory stub (no live backlog MCP), keeping it fast and hermetic;
  it does not exercise the full Claude subagent decomposer call.
- Scope is limited to the `draftDecomposition` guard (`§0` of the bash spec); the
  `idempotentReconcile` path already has coverage and is out of scope here.
- No new dependencies are introduced; the test is plain bash, consistent with the
  existing test suite style.

---

# Implementation Plan: loop-meta draftDecomposition Idempotency Integration Test

## Subject A — Test fixture and driver script

**Goal:** Create a hermetic integration test that calls the `draftDecomposition`
idempotency guard logic twice on the same fixture and asserts the second call is a no-op.

### Files to create

- `scripts/fixtures/draft-decomposition-idempotent-fixture.md`
  — A minimal static meta-task markdown file in Meta-Plan status with no children.
  Used as the fixture input for the driver script.

- `scripts/test-draft-decomposition-idempotent.sh`
  — Driver script. Uses an in-process bash state machine (same pattern as
  `scripts/test-loop-meta-idempotent.sh`) to stub backlog CLI calls. Implements a
  minimal `draftDecomposition` function mirroring the §0 guard from SKILL.md:

  ```
  draftDecomposition(META_ID, TITLES_LIST):
    EXISTING = count_children(META_ID)
    if EXISTING > 0:
      append_note(META_ID, "draftDecomposition: children already exist (EXISTING) — skipping creation")
      return 0
    for TITLE in TITLES_LIST:
      create_child(META_ID, TITLE)
    return count created
  ```

  Assertions:
  1. First call with META_ID="TASK-FIXTURE-1" and 2 stub titles returns 2 (two children created).
  2. After first call, `count_children("TASK-FIXTURE-1")` equals 2.
  3. Second call returns 0 (guard fires, no new children created).
  4. After second call, `count_children("TASK-FIXTURE-1")` still equals 2 (no duplicates).
  5. The note appended on the second call contains the string `"children already exist"`.
  6. A fresh parent (no prior children) still creates normally (guard does not over-block).

### Acceptance Criteria

- `bash scripts/test-draft-decomposition-idempotent.sh` exits 0 with all assertions
  passing ("N passed, 0 failed") when run from the repo root.
- The script emits the literal string `"children already exist"` to stdout during the
  second-call assertion, confirming the guard note was appended.

---

## Subject B — CI wiring

**Goal:** Ensure the idempotency test runs automatically on every push/PR to `main`,
so a regression in the `draftDecomposition` guard breaks the pipeline.

### File to modify

- `.github/workflows/ci.yml`
  — Add a new step inside the existing `validate` job, after the "Run plugin validation"
  step:

  ```yaml
  - name: Run draftDecomposition idempotency integration test
    run: bash scripts/test-draft-decomposition-idempotent.sh
  ```

  No new job or matrix is needed; the test is fast (pure bash, no network calls) and
  fits naturally inside the existing `validate` job.

### Acceptance Criteria

- `.github/workflows/ci.yml` contains `bash scripts/test-draft-decomposition-idempotent.sh`
  as a `run:` step.
- `bash scripts/validate-plugin.sh` passes after the CI file is updated (confirming no
  YAML or contract breakage is introduced).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Drafting implementation plan.

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->
