---
id: TASK-100.2
title: Add GitHub Actions cron workflow to run archive-done-tasks.sh weekly
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:49'
labels: []
dependencies: []
parent_task_id: TASK-100
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create `.github/workflows/archive-done-tasks.yml`: a GitHub Actions workflow triggered on a weekly cron schedule (every Monday at 02:00 UTC) that runs `bash scripts/archive-done-tasks.sh` and commits any newly archived files back to the repository.

Parent task: TASK-100 (Create a backlog task archival automation).
Sub-task 2 of 2: depends on TASK-100.1 (the script) existing and being correct. This sub-task wires it into CI so archival runs automatically without manual intervention.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add GitHub Actions cron workflow to run archive-done-tasks.sh weekly

## Context
TASK-100 requires a CI cron job to automate the weekly archival of Done backlog tasks.
This is sub-task 2 of 2; it depends on TASK-100.1 (`scripts/archive-done-tasks.sh`) being merged first.
Without this workflow, the script must be run manually and archival will be neglected over time.

## Phase 1: Create the GitHub Actions workflow file
Create `.github/workflows/archive-done-tasks.yml` with:
- `on.schedule` cron: `'0 2 * * 1'` (every Monday at 02:00 UTC).
- `on.workflow_dispatch` for manual triggering.
- Single job `archive` running on `ubuntu-latest`.
- Steps:
  1. `actions/checkout@v4` with `persist-credentials: true` and `fetch-depth: 0`.
  2. Run `bash scripts/archive-done-tasks.sh`.
  3. Commit and push any changes using `git add backlog/archive/ && git diff --cached --quiet || git commit -m "chore: archive done tasks [skip ci]" && git push`.
- Set `permissions: contents: write` at job level.

### DoD
- [ ] `test -f .github/workflows/archive-done-tasks.yml`
- [ ] `grep -q "0 2 \* \* 1" .github/workflows/archive-done-tasks.yml`
- [ ] `grep -q "archive-done-tasks.sh" .github/workflows/archive-done-tasks.yml`
- [ ] `grep -q "workflow_dispatch" .github/workflows/archive-done-tasks.yml`

## Phase 2: Validate workflow YAML syntax
Verify the workflow file is valid YAML and passes any local CI checks:
- If `actionlint` is available: run `actionlint .github/workflows/archive-done-tasks.yml`.
- Otherwise validate YAML syntax with Python: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/archive-done-tasks.yml'))"`.
- Run the project validation gate.

### DoD
- [ ] `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/archive-done-tasks.yml'))" && echo ok`
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- Do not modify any existing workflows.
- The commit step must include `[skip ci]` in the message to prevent recursive workflow triggers.
- No secrets or tokens beyond the default `GITHUB_TOKEN` (use `permissions: contents: write`).

## Acceptance Gate
- [ ] `test -f .github/workflows/archive-done-tasks.yml`
- [ ] `grep -q "0 2 \* \* 1" .github/workflows/archive-done-tasks.yml`
- [ ] `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/archive-done-tasks.yml'))" && echo ok`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-100
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f .github/workflows/archive-done-tasks.yml
- [ ] #2 grep -q "0 2 \* \* 1" .github/workflows/archive-done-tasks.yml
- [ ] #3 grep -q "archive-done-tasks.sh" .github/workflows/archive-done-tasks.yml
- [ ] #4 python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/archive-done-tasks.yml'))" && echo ok
- [ ] #5 bash scripts/validate-plugin.sh
<!-- DOD:END -->
