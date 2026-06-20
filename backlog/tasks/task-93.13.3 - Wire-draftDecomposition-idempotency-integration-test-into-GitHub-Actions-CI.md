---
id: TASK-93.13.3
title: Wire draftDecomposition idempotency integration test into GitHub Actions CI
status: Backlog
assignee: []
created_date: '2026-06-20 11:01'
labels: []
dependencies:
  - TASK-93.13.2
parent_task_id: TASK-93.13
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a step to .github/workflows/ci.yml (or create that file if it doesn't exist) that runs tests/integration/test-draftDecomposition-idempotency.sh on every push and pull_request. The CI job must fail if the test exits non-zero, surfacing idempotency regressions automatically.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f /home/yale/work/baime/.github/workflows/ci.yml
- [ ] #2 grep -q 'bash tests/integration/test-draftDecomposition-idempotency.sh' /home/yale/work/baime/.github/workflows/ci.yml
- [ ] #3 python3 -c "import yaml; yaml.safe_load(open('/home/yale/work/baime/.github/workflows/ci.yml'))" && echo OK
- [ ] #4 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.13
<!-- SECTION:NOTES:END -->
