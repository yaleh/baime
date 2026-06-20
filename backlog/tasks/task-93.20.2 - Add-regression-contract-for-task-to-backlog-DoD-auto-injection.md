---
id: TASK-93.20.2
title: Add regression contract for task-to-backlog DoD auto-injection
status: Backlog
assignee: []
created_date: '2026-06-20 11:00'
labels: []
dependencies:
  - TASK-93.20.1
parent_task_id: TASK-93.20
ordinal: 112000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write scripts/test-task-to-backlog-dod-contract.sh that exercises the task-to-backlog finalise phase with a fixture that has no DoD section, and asserts the output task file contains a '## Definition of Done' section with at least one checkbox. Integrate this test into scripts/validate-plugin.sh as a contract check. This is the verification half of TASK-93.20 (the implementation half is TASK-93.20.1).
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/test-task-to-backlog-dod-contract.sh
- [ ] #2 bash scripts/test-task-to-backlog-dod-contract.sh
- [ ] #3 grep -q 'test-task-to-backlog-dod-contract' scripts/validate-plugin.sh
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-93.20
<!-- SECTION:NOTES:END -->
