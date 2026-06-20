---
id: TASK-93.15.1
title: Write scripts/archive-done-tasks.sh with --dry-run and --older-than flags
status: Backlog
assignee: []
created_date: '2026-06-20 10:52'
updated_date: '2026-06-20 10:53'
labels: []
dependencies: []
parent_task_id: TASK-93.15
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write scripts/archive-done-tasks.sh that moves Done-status task markdown files older than 30 days from backlog/tasks/ into backlog/archive/. The script must parse the status field from YAML frontmatter (not from filename), accept --dry-run (preview without moving) and --older-than N (days, default 30) flags, create backlog/archive/ if absent, be idempotent (skip files already in archive), and print a summary of moved files (count and paths).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Write scripts/archive-done-tasks.sh

## Context
TASK-93.15 (Exp-K subject 5) requires automating backlog hygiene by moving old Done-status tasks to archive. This script is the core logic component; a sibling GitHub Actions workflow task will invoke it on a weekly cron schedule.

## Phase 1: Implement scripts/archive-done-tasks.sh

Create /home/yale/work/baime/scripts/archive-done-tasks.sh. Logic requirements:
- Parse `status:` from YAML frontmatter block (between `---` delimiters); fall back to `Status:` line in Backlog.md body format
- Accept --dry-run flag (print "DRY RUN: would move …" but do not move)
- Accept --older-than N (integer days, default 30); compare to file mtime
- mkdir -p backlog/archive/
- Skip files already present in archive (idempotent)
- Print per-file action and a final "Summary: N file(s) moved/would be moved, M skipped"
- chmod +x the script

### DoD
- [ ] `test -f scripts/archive-done-tasks.sh`
- [ ] `test -x scripts/archive-done-tasks.sh`
- [ ] `bash scripts/archive-done-tasks.sh --dry-run --older-than 0 2>&1 | grep -q 'Summary'`

## Phase 2: Smoke test

Create a synthetic Done task file with mtime 31 days ago; run the script (non-dry-run) and verify it was moved. Create a second Done file with mtime 1 day ago; verify it is skipped.

### DoD
- [ ] `bash scripts/archive-done-tasks.sh --dry-run --older-than 0 2>&1 | grep -q 'Summary'`

## Phase 3: Validation gate

### DoD
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- Parse status from YAML frontmatter only (not filename)
- Do not delete files; only move them
- --dry-run must never modify the filesystem

## Acceptance Gate
- [ ] `test -x scripts/archive-done-tasks.sh`
- [ ] `bash scripts/archive-done-tasks.sh --dry-run --older-than 0 2>&1 | grep -q 'Summary'`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.15
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/archive-done-tasks.sh
- [ ] #2 test -x scripts/archive-done-tasks.sh
- [ ] #3 bash scripts/archive-done-tasks.sh --dry-run --older-than 0 2>&1 | grep -q 'Summary'
- [ ] #4 bash scripts/validate-plugin.sh
<!-- DOD:END -->
