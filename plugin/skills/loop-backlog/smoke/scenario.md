# Smoke Test Scenario: loop-backlog — basic-ready → Basic: Done

## Setup
A minimal BAIME backlog with one task (TASK-1) at Basic: Ready.

## Trigger
Run `/loop-backlog` (or invoke the loop-backlog skill).

## Expected Outcome
- TASK-1 advances from Basic: Ready → Basic: In Progress → Basic: Done
- At least one new git commit is created in the fixture repo
- No task is left at Basic: In Progress after the loop completes

## Assertions (see expect.sh)
1. `backlog/tasks/task-1-*.md` contains `status: Basic: Done`
2. `git log --oneline | wc -l` > 1 (at least one commit beyond setup)
3. No task file contains `status: Basic: In Progress`
