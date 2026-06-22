---
id: TASK-100.1
title: >-
  Write and test scripts/archive-done-tasks.sh — move Done-status task files
  older than 30 days into backlog/archive/
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:37'
labels: []
dependencies: []
parent_task_id: TASK-100
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write `scripts/archive-done-tasks.sh`: a shell script that scans `backlog/tasks/` for Markdown files whose YAML frontmatter `status` field equals `Done` and whose file modification date is older than 30 days, then moves those files into `backlog/archive/` (creating the directory if absent), logging each archived filename to stdout.

Parent task: TASK-100 (Create a backlog task archival automation).
Sub-task 1 of 2: this script is the primary deliverable; the CI cron sub-task depends on it.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Write and test scripts/archive-done-tasks.sh

## Context
TASK-100 requires a shell script that automates archival of old Done-status backlog tasks.
This script is sub-task 1 of 2 and is a prerequisite for the CI cron job (sub-task 2).
Without it, completed tasks accumulate in `backlog/tasks/` indefinitely.

## Phase 1: Implement archive-done-tasks.sh
Write `scripts/archive-done-tasks.sh` with the following behaviour:
- Accept optional `--dry-run` flag: print what would be moved without moving anything.
- Scan all `.md` files in `backlog/tasks/`.
- For each file, extract the `status:` field from YAML frontmatter (first `---` block).
- Skip files whose status is not `Done`.
- For remaining files, check modification date: skip if modified within the last 30 days.
- Move qualifying files to `backlog/archive/` (create directory with `mkdir -p` if absent).
- Print `Archived: <filename>` for each moved file; print `No tasks to archive.` if none qualify.
- Exit 0 in all normal cases; exit 1 only on unexpected errors.
- Make the script executable (`chmod +x`).

### DoD
- [ ] `test -f scripts/archive-done-tasks.sh`
- [ ] `test -x scripts/archive-done-tasks.sh`
- [ ] `grep -q 'No tasks to archive' scripts/archive-done-tasks.sh`

## Phase 2: Manual smoke-test with fixture files
Create temporary fixture files to validate the script logic:
- Create `backlog/archive/` if absent.
- Create a fixture Done-status `.md` file in `backlog/tasks/` with an old mtime (use `touch -d '60 days ago'`).
- Create a fixture Done-status `.md` file with a recent mtime (today) — must NOT be archived.
- Create a fixture non-Done `.md` file with an old mtime — must NOT be archived.
- Run `bash scripts/archive-done-tasks.sh` and assert correct files moved.
- Clean up fixture files.

### DoD
- [ ] `bash scripts/archive-done-tasks.sh --dry-run 2>&1 | grep -qE "(No tasks to archive|Archived|Dry run)"`
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- Do not modify any real backlog task files during testing; use fixtures with distinct names.
- Script must be POSIX-compatible sh (no bashisms beyond `[[ ]]` if already used in the project).
- No external dependencies beyond standard coreutils and `grep`/`awk`/`sed`.

## Acceptance Gate
- [ ] `test -f scripts/archive-done-tasks.sh`
- [ ] `test -x scripts/archive-done-tasks.sh`
- [ ] `bash scripts/archive-done-tasks.sh --dry-run 2>&1 | grep -qE "(No tasks to archive|Archived|Dry run)"`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-100
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/archive-done-tasks.sh
- [ ] #2 test -x scripts/archive-done-tasks.sh
- [ ] #3 bash scripts/archive-done-tasks.sh --dry-run 2>&1 | grep -qE "(No tasks to archive|Archived|Dry run)"
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->
