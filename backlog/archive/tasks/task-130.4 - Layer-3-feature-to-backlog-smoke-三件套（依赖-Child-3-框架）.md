---
id: TASK-130.4
title: 'Layer 3: feature-to-backlog smoke 三件套（依赖 Child 3 框架）'
status: 'Basic: Backlog'
assignee: []
created_date: '2026-06-21 15:07'
updated_date: '2026-06-22 04:23'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-130
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background
TASK-130 Layer 3 requires smoke coverage for the feature-to-backlog skill, which drives the Proposal-to-Backlog two-round convergence pipeline. This child depends on TASK-130.3 (the `run-smoke-test.sh` framework) and adds the three smoke artefacts specific to feature-to-backlog: a fixture setup, a scenario description, and a pure-shell assertion script.

## Approach
Create `plugin/skills/feature-to-backlog/smoke/` with three files. `setup.sh` initializes a temp fixture repo containing a minimal feature description document and any stub files needed to simulate the skill's inputs. `scenario.md` describes the "proposal → APPROVED → plan → APPROVED two-round convergence" happy path in plain text. `expect.sh` asserts that the fixture repo contains a task file whose status field equals `Basic: Backlog` (the expected output of a successful feature-to-backlog run).

## Phase A: fixture setup
### Tests (write first)
After running `setup.sh`, manually verify the fixture repo contains the expected input files (feature doc stub, no pre-existing task).
### Implementation
- Create `plugin/skills/feature-to-backlog/smoke/setup.sh`: init git repo, write a minimal feature-description stub file, configure any required env vars as exports.
### DoD
- [ ] `bash scripts/run-smoke-test.sh feature-to-backlog`

## Phase B: scenario and expect
### Tests (write first)
`expect.sh` is the test: assert that after setup, the fixture repo's backlog task directory contains a file with `status: Basic: Backlog`.
### Implementation
- Create `plugin/skills/feature-to-backlog/smoke/scenario.md`: document the two-round APPROVED convergence scenario.
- Create `plugin/skills/feature-to-backlog/smoke/expect.sh`: grep the fixture repo for a task file containing `status: Basic: Backlog`, exit 0 on match, exit 1 otherwise.
### DoD
- [ ] `bash scripts/run-smoke-test.sh feature-to-backlog`

## Constraints
- This child MUST NOT be started before TASK-130.3 is Basic: Done (the framework must exist first).
- `expect.sh` must be pure shell with no LLM calls.
- The fixture in `setup.sh` must be minimal — only what is needed for the assertion, not a full real skill run.
- `scenario.md` is documentation only; it is not executed.

## Acceptance Gate
- [ ] `bash scripts/run-smoke-test.sh feature-to-backlog`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/run-smoke-test.sh feature-to-backlog
<!-- DOD:END -->
