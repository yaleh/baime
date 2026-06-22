---
id: TASK-102.3
title: >-
  Integrate duplicate-detection scan into validate-plugin.sh as a new check
  category
status: Backlog
assignee: []
created_date: '2026-06-20 10:39'
updated_date: '2026-06-20 10:49'
labels: []
dependencies: []
parent_task_id: TASK-102
ordinal: 118000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modify `scripts/validate-plugin.sh` to call `scripts/skill-lint.sh --scan` as a new check category named "Duplicate Detection". The integration must:

1. Invoke `bash scripts/skill-lint.sh --scan` and capture its stdout.
2. Count lines matching `^DUPLICATE:` in the output.
3. If count > 0, print each DUPLICATE line under a "=== Duplicate Detection ===" header in validate-plugin.sh output.
4. The check must NOT cause validate-plugin.sh to exit non-zero (reporting only, no hard failure) — this mirrors how other informational checks are handled.
5. Add a summary line: `[INFO] Duplicate detection: N pair(s) found above threshold` (0 is a valid and passing result).

This sub-task depends on TASK-102.1 (compute_token_overlap) and TASK-102.2 (scan_skill_duplicates / --scan flag). Sub-task 4 (regression tests with fixtures) tests this integration end-to-end.

This is part of TASK-102: Build a cross-skill duplicate-detection linter.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Integrate duplicate-detection scan into validate-plugin.sh as a new check category

## Context
TASK-102 requires that duplicate findings appear in `validate-plugin.sh` output so engineers can spot them during normal validation runs. TASK-102.2 delivers `--scan`; this sub-task wires it into the validator as an informational (non-failing) check category.

## Phase 1: Read and understand validate-plugin.sh structure

Read `scripts/validate-plugin.sh` in full to identify:
- Where existing check categories are defined (look for patterns like `echo "=== ... ==="` or function calls).
- How non-fatal informational output is currently emitted (look for `[INFO]` or similar).
- The exit-code logic at the bottom of the script.

Use:
```bash
grep -n '===' scripts/validate-plugin.sh | head -20
grep -n 'INFO\|WARN\|echo' scripts/validate-plugin.sh | tail -20
```

### DoD
- `grep -q '===' scripts/validate-plugin.sh`

## Phase 2: Add duplicate-detection check block to validate-plugin.sh

Insert a new check block after the last existing check category and before the final exit-code logic:

```bash
echo "=== Duplicate Detection ==="
DUP_OUTPUT=$(bash scripts/skill-lint.sh --scan 2>&1)
DUP_COUNT=$(echo "$DUP_OUTPUT" | grep -c '^DUPLICATE:' || true)
if [ "$DUP_COUNT" -gt 0 ]; then
  echo "$DUP_OUTPUT" | grep '^DUPLICATE:'
fi
echo "[INFO] Duplicate detection: ${DUP_COUNT} pair(s) found above threshold"
```

Ensure this block does not alter the script's exit code (wrap in a subshell or use `|| true` guards as needed).

### DoD
- `grep -q 'Duplicate Detection' scripts/validate-plugin.sh`
- `grep -q 'skill-lint.sh --scan' scripts/validate-plugin.sh`
- `grep -q 'Duplicate detection:' scripts/validate-plugin.sh`

## Phase 3: Verify validate-plugin.sh still exits 0 and shows the new section

Run the full validator and confirm:
1. It exits 0.
2. The output contains the "=== Duplicate Detection ===" header.
3. The output contains an `[INFO] Duplicate detection:` summary line.

```bash
bash scripts/validate-plugin.sh 2>&1 | grep -q 'Duplicate Detection'
bash scripts/validate-plugin.sh 2>&1 | grep -q 'Duplicate detection:'
bash scripts/validate-plugin.sh
```

### DoD
- `bash scripts/validate-plugin.sh 2>&1 | grep -q 'Duplicate Detection'`
- `bash scripts/validate-plugin.sh 2>&1 | grep -q 'Duplicate detection:'`
- `bash scripts/validate-plugin.sh`

## Constraints
- Do not make the duplicate check a hard failure (exit non-zero) — reporting only
- Do not create test fixtures here — that is sub-task 4
- Do not change the existing check categories or their exit-code behavior

## Acceptance Gate
- `bash scripts/validate-plugin.sh 2>&1 | grep -q 'Duplicate Detection'`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-102
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'Duplicate Detection' scripts/validate-plugin.sh
- [ ] #2 grep -q 'skill-lint.sh --scan' scripts/validate-plugin.sh
- [ ] #3 grep -q 'Duplicate detection:' scripts/validate-plugin.sh
- [ ] #4 bash scripts/validate-plugin.sh 2>&1 | grep -q 'Duplicate Detection'
- [ ] #5 bash scripts/validate-plugin.sh 2>&1 | grep -q 'Duplicate detection:'
- [ ] #6 bash scripts/validate-plugin.sh
<!-- DOD:END -->
