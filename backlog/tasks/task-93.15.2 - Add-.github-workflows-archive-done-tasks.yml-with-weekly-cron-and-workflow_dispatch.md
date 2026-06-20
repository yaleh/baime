---
id: TASK-93.15.2
title: >-
  Add .github/workflows/archive-done-tasks.yml with weekly cron and
  workflow_dispatch
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:53'
labels: []
dependencies:
  - TASK-93.15.1
parent_task_id: TASK-93.15
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create .github/workflows/archive-done-tasks.yml that calls scripts/archive-done-tasks.sh on a weekly schedule (Mondays 02:00 UTC) and on workflow_dispatch. The workflow must checkout the repo, run the archive script, and auto-commit any archived files back to the branch. Requires TASK-93.15.1 (the archive script) to exist first.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add .github/workflows/archive-done-tasks.yml

## Context
TASK-93.15 requires a CI cron that runs the archive script automatically. This workflow is the second deliverable; it depends on TASK-93.15.1 (scripts/archive-done-tasks.sh) being merged first.

## Phase 1: Create .github/workflows/ directory and workflow file

Create /home/yale/work/baime/.github/workflows/archive-done-tasks.yml with:
- `on.schedule`: cron `'0 2 * * 1'` (Mondays 02:00 UTC)
- `on.workflow_dispatch`: (no inputs required)
- Single job `archive`:
  - `runs-on: ubuntu-latest`
  - steps:
    1. `actions/checkout@v4` with `token: ${{ secrets.GITHUB_TOKEN }}`
    2. Run `bash scripts/archive-done-tasks.sh` (no --dry-run)
    3. Auto-commit step:
       ```yaml
       - name: Commit archived files
         run: |
           git config user.name "github-actions[bot]"
           git config user.email "github-actions[bot]@users.noreply.github.com"
           git add backlog/archive/
           git diff --cached --quiet || git commit -m "chore: archive done backlog tasks [skip ci]"
           git push
       ```

### DoD
- [ ] `test -f .github/workflows/archive-done-tasks.yml`
- [ ] `grep -q 'workflow_dispatch' .github/workflows/archive-done-tasks.yml`
- [ ] `grep -q '0 2 \* \* 1' .github/workflows/archive-done-tasks.yml`
- [ ] `grep -q 'archive-done-tasks.sh' .github/workflows/archive-done-tasks.yml`
- [ ] `grep -q 'git commit' .github/workflows/archive-done-tasks.yml`

## Phase 2: Validate YAML syntax

Check the workflow YAML is well-formed using Python's yaml module (available on CI runners).

### DoD
- [ ] `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/archive-done-tasks.yml'))" 2>&1 | grep -qv 'Error' || python3 -c "import yaml; yaml.safe_load(open('/home/yale/work/baime/.github/workflows/archive-done-tasks.yml'))" && echo ok`

## Phase 3: Validation gate

### DoD
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- The auto-commit step must use `git diff --cached --quiet || git commit` so the job does not fail when there is nothing to archive
- Use `[skip ci]` in commit message to avoid triggering recursive workflow runs
- Do not add secrets beyond GITHUB_TOKEN (already available)

## Acceptance Gate
- [ ] `test -f .github/workflows/archive-done-tasks.yml`
- [ ] `grep -q 'workflow_dispatch' .github/workflows/archive-done-tasks.yml`
- [ ] `grep -q '0 2 \* \* 1' .github/workflows/archive-done-tasks.yml`
- [ ] `grep -q 'git commit' .github/workflows/archive-done-tasks.yml`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.15
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f .github/workflows/archive-done-tasks.yml
- [ ] #2 grep -q 'workflow_dispatch' .github/workflows/archive-done-tasks.yml
- [ ] #3 grep -q '0 2 \* \* 1' .github/workflows/archive-done-tasks.yml
- [ ] #4 grep -q 'archive-done-tasks.sh' .github/workflows/archive-done-tasks.yml
- [ ] #5 grep -q 'git commit' .github/workflows/archive-done-tasks.yml
- [ ] #6 bash scripts/validate-plugin.sh
<!-- DOD:END -->
