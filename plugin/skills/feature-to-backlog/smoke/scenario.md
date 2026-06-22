# Smoke Test Scenario: feature-to-backlog — Basic: Proposal → Basic: Backlog

## Setup
A minimal BAIME backlog fixture with one task (TASK-1) at Basic: Proposal.
The task describes adding a greeting.sh script that prints Hello World.

## Trigger
Invoke `/feature-to-backlog` with TASK-1 (existing task path).
The skill runs the full proposal → plan → finalise pipeline end-to-end with no human gates.

Note: skill runs end-to-end (gates removed in TASK-147).

## Expected Outcome
- TASK-1 advances from Basic: Proposal → Basic: Backlog
- Implementation Plan field is populated in the task file
- No task is left at Basic: Proposal after the skill completes

## Assertions (see expect.sh)
1. `backlog/tasks/task-1-*.md` contains `status: 'Basic: Backlog'`
2. Task file contains a Proposal or Plan section (## Background, ## Proposal, # Proposal, or # Plan)
3. No task file contains `status: 'Basic: Proposal'`
