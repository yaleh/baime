---
id: TASK-130.2
title: 'Layer 1: epic-to-backlog 和 feature-to-backlog 单测文件（PASS 计数 10→12）'
status: 'Basic: Backlog'
assignee: []
created_date: '2026-06-21 15:07'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-130
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background
TASK-130 Layer 1 covers skill-level unit tests auto-discovered by `run_skill_unit_tests` in `scripts/validate-plugin.sh`. Currently 10 unit tests pass. Two critical routing skills — epic-to-backlog and feature-to-backlog — have no unit test coverage. Adding tests for their core logic brings the PASS count to ≥12 and makes regressions detectable without running full smoke flows.

## Approach
Create `scripts/epic-to-backlog.test.sh` covering the decomposer routing logic described in the skill's SKILL.md (e.g. lane detection, status transitions, child-task count guards). Create `scripts/feature-to-backlog.test.sh` covering the approval-round loop and APPROVED detection logic. Both files must be auto-discoverable by the existing `run_skill_unit_tests` mechanism (match pattern `scripts/*.test.sh`).

## Phase A: epic-to-backlog unit tests
### Tests (write first)
File: `scripts/epic-to-backlog.test.sh`
Test cases:
- Routing emits "epic-ready" when a task has status "Epic: Ready"
- Routing does NOT emit "epic-ready" for "Basic: Ready" tasks
- Decomposer lane creates children with status "Basic: Backlog"
- Guard rejects decomposition if child count would exceed limit
### Implementation
Write the test file using the same assert helper pattern used by existing `*.test.sh` files in `scripts/`.
### DoD
- [ ] `bash scripts/validate-plugin.sh`

## Phase B: feature-to-backlog unit tests
### Tests (write first)
File: `scripts/feature-to-backlog.test.sh`
Test cases:
- APPROVED detection returns true when critic output contains exactly "APPROVED"
- APPROVED detection returns false for "NOT APPROVED" or "REJECTED"
- Round counter increments correctly across cycles
- Loop exits after 8 rounds without APPROVED
### Implementation
Write the test file following the same pattern as Phase A.
### DoD
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- Tests must be pure shell (bash), no external services or LLM calls.
- Use stubs/mocks for any skill invocations.
- Do not modify `scripts/validate-plugin.sh` discovery logic; only add new test files.

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
<!-- DOD:END -->
