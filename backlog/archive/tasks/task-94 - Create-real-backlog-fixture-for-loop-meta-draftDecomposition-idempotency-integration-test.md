---
id: TASK-94
title: >-
  Create real backlog fixture for loop-meta draftDecomposition idempotency
  integration test
status: Backlog
assignee: []
created_date: '2026-06-20 10:51'
updated_date: '2026-06-20 10:53'
labels: []
dependencies:
  - TASK-93.13
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a self-contained backlog fixture (a minimal but realistic meta-task file in a test-scoped backlog directory) that can be used as input for running draftDecomposition twice. The fixture must represent a plausible meta-task with a description, status, and no pre-existing children. This is the prerequisite for the TASK-93.13 integration test that verifies the idempotency guard specified in SKILL.md. Done looks like: a fixture file at tests/fixtures/backlog/tasks/task-fixture-idempotency.md with status Meta-Plan and a non-trivial description, plus a README or inline comment documenting the fixture's purpose.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Create real backlog fixture for loop-meta draftDecomposition idempotency integration test

## Context
TASK-93.13 requires an integration test that runs draftDecomposition twice on the same meta-task
and asserts idempotency. That test needs a real backlog fixture (not mocks) as its input.
Without a dedicated fixture, tests would pollute the production backlog or rely on fragile mocks.

## Phase 1: Survey existing test infrastructure
Inspect the repository for any existing test fixtures, test directories, or integration test
patterns to understand the expected location and format for fixtures.
Run: `find /home/yale/work/baime/tests -type f 2>/dev/null | head -30` and
`ls /home/yale/work/baime/tests/ 2>/dev/null` to discover the structure.
Then read an existing backlog task file (e.g. via `head -30 backlog/tasks/*.md | head -60`)
to understand the markdown format required for a valid meta-task fixture.
### DoD
- [ ] `test -d /home/yale/work/baime/backlog/tasks`
- [ ] `ls /home/yale/work/baime/backlog/tasks/*.md | head -1 | xargs test -f`

## Phase 2: Create fixture directory and fixture file
Create the directory `tests/fixtures/backlog/tasks/` and write
`tests/fixtures/backlog/tasks/task-fixture-idempotency.md` conforming to the backlog task
markdown format: YAML or markdown frontmatter with id TASK-FIXTURE-IDEM-1, status `Meta-Plan`,
a non-trivial description (≥3 sentences about a plausible meta-task), and no child references.
Also write `tests/fixtures/backlog/README.md` documenting the fixture purpose and how to extend it.
### DoD
- [ ] `test -f /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md`
- [ ] `grep -q 'Meta-Plan' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md`
- [ ] `grep -q 'TASK-FIXTURE-IDEM-1' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md`
- [ ] `test -f /home/yale/work/baime/tests/fixtures/backlog/README.md`

## Phase 3: Validate fixture is parseable by backlog tooling
Point the backlog CLI at the fixture directory and confirm it can read the fixture task without errors.
Use: `BACKLOG_DIR=/home/yale/work/baime/tests/fixtures/backlog backlog task view TASK-FIXTURE-IDEM-1 --plain`
or equivalent to verify the fixture is well-formed.
### DoD
- [ ] `grep -q 'TASK-FIXTURE-IDEM-1' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md`
- [ ] `grep -q 'Meta-Plan' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md`
- [ ] `! grep -q 'parentTask' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md`

## Constraints
- Do not modify the production backlog directory at all
- The fixture must be a real markdown file in the backlog task format, not a JSON or YAML stub
- No code changes to loop-meta skill or backlog tooling in this sub-task

## Acceptance Gate
- [ ] `test -f /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md`
- [ ] `grep -q 'Meta-Plan' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md`
- [ ] `grep -q 'TASK-FIXTURE-IDEM-1' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md`
- [ ] `! grep -q 'parentTask' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md`
- [ ] `test -f /home/yale/work/baime/tests/fixtures/backlog/README.md`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.13
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -d /home/yale/work/baime/backlog/tasks
- [ ] #2 ls /home/yale/work/baime/backlog/tasks/*.md | head -1 | xargs test -f
- [ ] #3 test -f /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #4 grep -q 'Meta-Plan' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #5 grep -q 'TASK-FIXTURE-IDEM-1' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #6 test -f /home/yale/work/baime/tests/fixtures/backlog/README.md
- [ ] #7 grep -q 'TASK-FIXTURE-IDEM-1' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #8 grep -q 'Meta-Plan' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #9 ! grep -q 'parentTask' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #10 test -f /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #11 grep -q 'Meta-Plan' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #12 grep -q 'TASK-FIXTURE-IDEM-1' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #13 ! grep -q 'parentTask' /home/yale/work/baime/tests/fixtures/backlog/tasks/task-fixture-idempotency.md
- [ ] #14 test -f /home/yale/work/baime/tests/fixtures/backlog/README.md
- [ ] #15 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->
