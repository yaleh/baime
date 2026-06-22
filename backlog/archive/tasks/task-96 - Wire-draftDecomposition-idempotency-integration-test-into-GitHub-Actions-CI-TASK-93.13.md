---
id: TASK-96
title: >-
  Wire draftDecomposition idempotency integration test into GitHub Actions CI
  (TASK-93.13)
status: Backlog
assignee: []
created_date: '2026-06-20 10:54'
updated_date: '2026-06-20 10:54'
labels: []
dependencies:
  - TASK-93.13
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a step to .github/workflows/ci.yml (or create that file if it doesn't exist) that runs tests/integration/test-draftDecomposition-idempotency.sh on every push and pull_request. The CI job must fail if the test exits non-zero, surfacing idempotency regressions automatically. This completes TASK-93.13 by ensuring the guard verified in the test is continuously checked in the pipeline.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Wire draftDecomposition idempotency integration test into GitHub Actions CI

## Context
TASK-93.13 requires the idempotency integration test to run on every push, so regressions in
the draftDecomposition guard are caught automatically. A CI workflow already exists at
.github/workflows/ci.yml; this task adds the integration test as a new job or step there.

## Phase 1: Audit existing CI workflow
Read .github/workflows/ci.yml to understand existing jobs, steps, Node/shell setup,
and where to insert the new integration-test step with minimal disruption.
Run: `cat /home/yale/work/baime/.github/workflows/ci.yml`
### DoD
- [ ] `test -f /home/yale/work/baime/.github/workflows/ci.yml`
- [ ] `grep -q 'on:' /home/yale/work/baime/.github/workflows/ci.yml`

## Phase 2: Add integration test step to ci.yml
Edit .github/workflows/ci.yml to add a step (or new job) that:
- Runs on: [push, pull_request]
- Executes: `bash tests/integration/test-draftDecomposition-idempotency.sh`
- Has a clear name: "Integration test: draftDecomposition idempotency"
- Runs after any dependency-installation steps so the backlog CLI is available
Preserve all existing steps and jobs unchanged.
### DoD
- [ ] `grep -q 'draftDecomposition idempotency\|test-draftDecomposition-idempotency' /home/yale/work/baime/.github/workflows/ci.yml`
- [ ] `grep -q 'bash tests/integration/test-draftDecomposition-idempotency.sh' /home/yale/work/baime/.github/workflows/ci.yml`

## Phase 3: Validate the updated workflow YAML is well-formed
Run a YAML lint check to confirm the edited ci.yml is valid YAML and won't fail to parse in GitHub Actions.
Use: `python3 -c "import yaml; yaml.safe_load(open('/home/yale/work/baime/.github/workflows/ci.yml'))" && echo OK`
or `npx --yes js-yaml /home/yale/work/baime/.github/workflows/ci.yml > /dev/null && echo OK`
### DoD
- [ ] `python3 -c "import yaml; yaml.safe_load(open('/home/yale/work/baime/.github/workflows/ci.yml'))" && echo OK`
- [ ] `grep -q 'bash tests/integration/test-draftDecomposition-idempotency.sh' /home/yale/work/baime/.github/workflows/ci.yml`

## Constraints
- Do not remove or alter any existing CI steps or jobs
- The new step must not require secrets or special permissions beyond what the existing workflow uses
- YAML indentation must be consistent with the rest of ci.yml

## Acceptance Gate
- [ ] `grep -q 'bash tests/integration/test-draftDecomposition-idempotency.sh' /home/yale/work/baime/.github/workflows/ci.yml`
- [ ] `python3 -c "import yaml; yaml.safe_load(open('/home/yale/work/baime/.github/workflows/ci.yml'))" && echo OK`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.13
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f /home/yale/work/baime/.github/workflows/ci.yml
- [ ] #2 grep -q 'on:' /home/yale/work/baime/.github/workflows/ci.yml
- [ ] #3 grep -q 'draftDecomposition idempotency\|test-draftDecomposition-idempotency' /home/yale/work/baime/.github/workflows/ci.yml
- [ ] #4 grep -q 'bash tests/integration/test-draftDecomposition-idempotency.sh' /home/yale/work/baime/.github/workflows/ci.yml
- [ ] #5 python3 -c "import yaml; yaml.safe_load(open('/home/yale/work/baime/.github/workflows/ci.yml'))" && echo OK
- [ ] #6 grep -q 'bash tests/integration/test-draftDecomposition-idempotency.sh' /home/yale/work/baime/.github/workflows/ci.yml
- [ ] #7 grep -q 'bash tests/integration/test-draftDecomposition-idempotency.sh' /home/yale/work/baime/.github/workflows/ci.yml
- [ ] #8 python3 -c "import yaml; yaml.safe_load(open('/home/yale/work/baime/.github/workflows/ci.yml'))" && echo OK
- [ ] #9 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->
