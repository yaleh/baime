---
id: TASK-130.3
title: 'Layer 3: run-smoke-test.sh 框架 + loop-backlog smoke 三件套'
status: 'Basic: Backlog'
assignee: []
created_date: '2026-06-21 15:07'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-130
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background
TASK-130 Layer 3 introduces end-to-end smoke tests that exercise a skill against a real (but ephemeral) git repo fixture. No smoke test infrastructure currently exists. This child establishes the framework script and delivers the first concrete smoke test for loop-backlog, validating that a Basic: Ready task transitions to Basic: Done when the skill runs.

## Approach
Create `scripts/run-smoke-test.sh`: accepts `<skill-name>` as argument, creates a temp git repo, sources `plugin/skills/<skill-name>/smoke/setup.sh` to populate the fixture, runs `plugin/skills/<skill-name>/smoke/expect.sh`, and reports the exit code. Create `plugin/skills/loop-backlog/smoke/` with three files: `setup.sh` (init fixture repo + write a Basic: Ready task file), `scenario.md` (describe the "basic-ready → Basic: Done" scenario in plain text), and `expect.sh` (pure shell assertions verifying the task file's status field becomes `Basic: Done`).

## Phase A: run-smoke-test.sh framework
### Tests (write first)
Manual verification: invoke `bash scripts/run-smoke-test.sh loop-backlog` and confirm it creates a temp dir, calls setup, calls expect, and cleans up.
### Implementation
- Create `scripts/run-smoke-test.sh` with argument parsing, temp dir lifecycle, and setup/expect delegation.
### DoD
- [ ] `bash scripts/run-smoke-test.sh loop-backlog`

## Phase B: loop-backlog smoke 三件套
### Tests (write first)
`expect.sh` is itself the test; it must assert that after `setup.sh` runs, the task file in the fixture repo contains `status: Basic: Done`.
### Implementation
- Create `plugin/skills/loop-backlog/smoke/setup.sh`: init bare git repo, write a minimal backlog task file with `status: Basic: Ready`.
- Create `plugin/skills/loop-backlog/smoke/scenario.md`: describe the happy-path scenario.
- Create `plugin/skills/loop-backlog/smoke/expect.sh`: grep the task file for `status: Basic: Done`, exit 0 on match, exit 1 otherwise.
### DoD
- [ ] `bash scripts/run-smoke-test.sh loop-backlog`

## Constraints
- `run-smoke-test.sh` must clean up the temp directory on both success and failure (use trap).
- `expect.sh` must be pure shell with no LLM calls — it asserts fixture state only.
- `setup.sh` must be idempotent within a single temp dir invocation.
- `scenario.md` is documentation only; it is not executed.

## Acceptance Gate
- [ ] `bash scripts/run-smoke-test.sh loop-backlog`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/run-smoke-test.sh loop-backlog
<!-- DOD:END -->
