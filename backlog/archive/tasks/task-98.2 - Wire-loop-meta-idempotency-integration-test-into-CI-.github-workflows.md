---
id: TASK-98.2
title: Wire loop-meta idempotency integration test into CI (.github/workflows)
status: Backlog
assignee: []
created_date: '2026-06-20 10:38'
updated_date: '2026-06-20 10:49'
labels: []
dependencies: []
parent_task_id: TASK-98
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the loop-meta idempotency integration test (scripts/test-loop-meta-idempotency.sh, created in TASK-98.1) as a step in the project's GitHub Actions CI workflow under .github/workflows/.

The CI job must:
1. Run scripts/test-loop-meta-idempotency.sh as part of the test suite.
2. Fail the workflow if the script exits non-zero.
3. Report the PASS/FAIL output as part of the workflow step logs.
4. Execute only after the unit tests already defined in the workflow pass (sequential ordering, not a new parallel job unless the workflow already uses matrix strategy for integration tests).

Parent task: TASK-98 (Add loop-meta idempotency integration test).
This is phase 2 of 2: CI wiring after the test script itself (TASK-98.1) has been written.
TASK-98.1 must be Done before this task is started.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Wire loop-meta idempotency integration test into CI (.github/workflows)

## Context
TASK-98.1 produces scripts/test-loop-meta-idempotency.sh. This sub-task wires that script into .github/workflows/ci.yml so every push/PR proves the idempotency guard holds. The CI workflow currently has a single "validate" job with one step (bash scripts/validate-plugin.sh) running on ubuntu-latest with Python 3.11 and Node.js 22.

## Phase 1: Confirm prerequisite script exists and passes locally
Verify scripts/test-loop-meta-idempotency.sh is present and exits 0. This gate ensures TASK-98.1 is actually done before CI wiring proceeds.

### DoD
- `test -f scripts/test-loop-meta-idempotency.sh`
- `bash scripts/test-loop-meta-idempotency.sh`

## Phase 2: Add integration test step to .github/workflows/ci.yml
Append a new step to the existing "validate" job in ci.yml, immediately after the "Run plugin validation" step:

```yaml
      - name: Run loop-meta idempotency integration test
        run: bash scripts/test-loop-meta-idempotency.sh
```

This keeps sequential ordering (unit validation first, integration test second) within the same job, reusing the already-configured Python/Node.js environment.

### DoD
- `grep -q 'test-loop-meta-idempotency' .github/workflows/ci.yml`
- `grep -q 'Run loop-meta idempotency integration test' .github/workflows/ci.yml`

## Phase 3: Validate CI YAML syntax and run full local gate
Check the YAML is syntactically valid and the full validate-plugin.sh still passes.

### DoD
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK`
- `bash scripts/validate-plugin.sh`

## Constraints
- Do not create a new workflow file; add to the existing ci.yml validate job only.
- Do not change the trigger conditions (push/PR on main).
- Do not alter any existing steps — only append the new step after "Run plugin validation".
- No secrets or environment variables are required for this test.

## Acceptance Gate
- `grep -q 'test-loop-meta-idempotency' .github/workflows/ci.yml`
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-98

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/test-loop-meta-idempotency.sh
- [ ] #2 bash scripts/test-loop-meta-idempotency.sh
- [ ] #3 grep -q 'test-loop-meta-idempotency' .github/workflows/ci.yml
- [ ] #4 grep -q 'Run loop-meta idempotency integration test' .github/workflows/ci.yml
- [ ] #5 python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK
- [ ] #6 bash scripts/validate-plugin.sh
<!-- DOD:END -->
