---
id: TASK-143
title: >-
  TASK-130-A: Layer 0: promote contracts-density check to FAIL + remediate 13
  affected skills
status: 'Basic: Done'
assignee: []
created_date: '2026-06-22 04:58'
updated_date: '2026-06-22 05:10'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-130
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## What

Modify `scripts/validate-plugin.sh` Contract Density Check:
- Lower `LINE_THRESHOLD` from 500 to 300
- Raise `CONTRACT_THRESHOLD` from 3 to 4
- Route density failures from WARNINGS to ERRORS (non-zero exit)
- Sync `plugin/scripts/validate-plugin.sh` copy

In the same commit, add ≥1 behavioral `contracts:` entry to all 13 affected skills (methodology-bootstrapping 654L, cross-cutting-concerns 613L, documentation-management 589L, technical-debt-management 545L, baseline-quality-assessment 473L, rapid-convergence 433L, agent-prompt-evolution 411L, dependency-health 403L, knowledge-transfer 383L, observability-instrumentation 365L, task-to-backlog 358L, ci-cd-optimization 348L, testing-strategy 324L) so validate-plugin.sh exits 0 after the change.

Parent epic: TASK-130

## Definition of Done
- [ ] `bash scripts/validate-plugin.sh` exits 0 (no new errors after remediation)
- [ ] A temporary stub skill with >300 lines and 3 contracts causes non-zero exit
- [ ] `plugin/scripts/validate-plugin.sh` is identical to `scripts/validate-plugin.sh`
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
claimed: 2026-06-22T05:02:38Z

DoD #1: PASS — bash scripts/validate-plugin.sh exits 0
DoD #2: PASS — density gate catches >300-line skills with ≤3 contracts
DoD #3: PASS — plugin/scripts/validate-plugin.sh identical to scripts/validate-plugin.sh

## Execution Summary
Result: done
Commit: dd88852

Completed: 2026-06-22T05:10:06Z
<!-- SECTION:NOTES:END -->
