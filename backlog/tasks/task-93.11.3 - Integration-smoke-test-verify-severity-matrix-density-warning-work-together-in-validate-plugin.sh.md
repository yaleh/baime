---
id: TASK-93.11.3
title: >-
  Integration smoke-test: verify severity-matrix + density-warning work together
  in validate-plugin.sh
status: Backlog
assignee: []
created_date: '2026-06-20 10:55'
updated_date: '2026-06-20 10:56'
labels: []
dependencies:
  - TASK-93.11.1
  - TASK-93.11.2
parent_task_id: TASK-93.11
ordinal: 113000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After TASK-93.11.1 (lint-severity matrix) and TASK-93.11.2 (contracts-density ratio warning) are both done, write and run an integration smoke-test script (scripts/validate-integration.test.sh) that exercises the combined behaviour: a synthetic plugin fixture with known P0/P1/P2 failures and a low-density SKILL.md is run through validate-plugin.sh, and the test asserts correct exit codes and output labels.

Why: Each sub-change was tested in isolation. This test validates the two changes compose correctly — P0 still blocks, P1/P2 do not, and density warnings appear without causing a failure exit. This is the third and final sub-task of TASK-93.11.

Done looks like:
- scripts/validate-integration.test.sh exists, is self-contained, cleans up temp files, exits 0 when all assertions pass
- bash scripts/validate-plugin.sh passes on the current repo
- bash scripts/validate-integration.test.sh passes standalone
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Integration smoke-test: verify severity-matrix + density-warning work together in validate-plugin.sh

## Context
TASK-93.11.1 adds a lint-severity matrix (P0/P1/P2) and TASK-93.11.2 updates the contracts-density check to use a ratio threshold. Each was tested in isolation. This sub-task writes an integration smoke-test that exercises both changes together: confirm P0 failures still block, P1/P2 failures do not block, and density warnings appear as warnings (not errors).

## Phase 1: Design the integration fixture

The integration test needs three scenarios exercised via a synthetic fixture. Plan what each scenario will contain:

Scenario A — P0 failure: a plugin with invalid plugin.json (unparseable JSON) → validate-plugin.sh must exit non-zero.
Scenario B — P1 failure only: a plugin with a valid plugin.json but a SKILL.md missing a symlink (P1) → validate-plugin.sh must exit 0.
Scenario C — density warning only: a plugin with a valid plugin.json, valid SKILL.md with a sparse contracts section (contract_count < spec_lines/50) → validate-plugin.sh must exit 0 and output a WARNING line.

Document the fixture design in /tmp/integration-fixture-design.txt.

### DoD
- [ ] `test -f /tmp/integration-fixture-design.txt`
- [ ] `grep -q "Scenario A" /tmp/integration-fixture-design.txt`
- [ ] `grep -q "Scenario C" /tmp/integration-fixture-design.txt`

## Phase 2: Write scripts/validate-integration.test.sh

Create /home/yale/work/baime/scripts/validate-integration.test.sh that:
1. Creates a temp workspace in /tmp/validate-integration-$$ and sets up the three scenario fixtures.
2. For Scenario A: points validate-plugin.sh at a broken plugin dir and asserts exit code != 0.
   Note: validate-plugin.sh uses hardcoded REPO_ROOT paths; the test must either call the density/severity Python blocks directly or use a wrapper approach.
3. For Scenario B: injects a P1-only failure by temporarily creating a synthetic check call and asserting exit 0.
4. For Scenario C: runs the density-check Python block standalone against a sparse-contracts fixture and asserts exit 0 (warnings only) but output contains "WARNING".
5. Registers a trap to clean up /tmp/validate-integration-$$ on exit.
6. Exits 0 if all assertions pass, non-zero otherwise (with descriptive failure messages).

The script will be picked up by run_skill_unit_tests() in validate-plugin.sh.

### DoD
- [ ] `test -f /home/yale/work/baime/scripts/validate-integration.test.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-integration.test.sh`
- [ ] `grep -q "Scenario" /home/yale/work/baime/scripts/validate-integration.test.sh`

## Phase 3: Validate end-to-end

Run the full validation suite. The new integration test must be picked up and pass.

### DoD
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "Errors: 0"`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "PASS: unit test: validate-integration.test.sh"`

## Constraints
- This task must not be started until TASK-93.11.1 and TASK-93.11.2 are both in Done status.
- The integration test must be self-contained (no network calls, no external fixtures) and clean up its own temp files.
- Do not modify validate-plugin.sh logic in this task; test only.

## Acceptance Gate
- [ ] `bash /home/yale/work/baime/scripts/validate-integration.test.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "PASS: unit test: validate-integration.test.sh"`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.11

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f /tmp/integration-fixture-design.txt
- [ ] #2 grep -q "Scenario A" /tmp/integration-fixture-design.txt
- [ ] #3 grep -q "Scenario C" /tmp/integration-fixture-design.txt
- [ ] #4 test -f /home/yale/work/baime/scripts/validate-integration.test.sh
- [ ] #5 bash /home/yale/work/baime/scripts/validate-integration.test.sh
- [ ] #6 grep -q "Scenario" /home/yale/work/baime/scripts/validate-integration.test.sh
- [ ] #7 bash /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #8 bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "Errors: 0"
- [ ] #9 bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "PASS: unit test: validate-integration.test.sh"
<!-- DOD:END -->
