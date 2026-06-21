---
id: TASK-111
title: 'Create a backlog task archival automation: write scripts/archive-done-'
status: Meta-Plan
assignee: []
created_date: '2026-06-20 14:12'
updated_date: '2026-06-20 14:18'
labels: []
dependencies: []
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a backlog task archival automation: write scripts/archive-done-tasks.sh that moves all Done-status task markdown files older than 30 days into backlog/archive/, and adds a CI cron job to run it weekly.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Backlog Task Archival Automation (TASK-111)

## Background

The `backlog/tasks/` directory accumulates Done-status task markdown files indefinitely. As the project matures and hundreds of tasks complete, this creates three compounding problems: (1) directory listing noise makes it harder for humans and tools to locate active tasks; (2) scripts that scan `backlog/tasks/` — such as `extract-replan-markers.sh`, `check-roi-gate.sh`, and the loop-backlog daemon — incur unnecessary I/O over stale files on every invocation; (3) CI jobs that read task counts or iterate over task files take longer and produce noisier output as the completed set grows. A lightweight archival step — moving old Done files to a stable archive location — eliminates the clutter without destroying history. Running it on a weekly CI schedule keeps the working directory clean automatically with no manual intervention required.

## Goals

1. A script `scripts/archive-done-tasks.sh` exists and, when executed, moves every Done-status `.md` file in `backlog/tasks/` that was last modified more than 30 days ago into `backlog/archive/tasks/`, creating the destination directory if absent.
2. After the script runs on a repository with qualifying files, those files are absent from `backlog/tasks/` and present under `backlog/archive/tasks/` with their filenames preserved.
3. A GitHub Actions workflow `.github/workflows/archive-tasks.yml` exists with a weekly cron trigger and a job that checks out the repository, runs `scripts/archive-done-tasks.sh`, and commits and pushes any moved files back to `main`.
4. Running the script on a repository with no qualifying files produces no file changes and exits 0.

## Decomposition Approach

Two independent subjects cover the full scope:

- **Subject A — Archive script**: Implement `scripts/archive-done-tasks.sh`. The script scans `backlog/tasks/` for `.md` files whose content marks them as Done (filename prefix `task-` and status line matching `Done`) and whose filesystem mtime is older than 30 days, then moves them to `backlog/archive/tasks/` (creating the directory as needed).
- **Subject B — CI cron workflow**: Implement `.github/workflows/archive-tasks.yml` with a `schedule: cron` trigger (weekly, e.g. Sundays at 02:00 UTC), a checkout step, a run step invoking the archive script, and a commit-and-push step that only fires when files were actually moved.

## Scope

In scope: the shell script, the CI workflow file, and `backlog/archive/tasks/` directory creation.

Out of scope: restoring archived tasks to active status, pruning or expiring the archive itself, archiving non-Done statuses, migrating tasks across milestones, and any UI or API surface for browsing archived tasks.

---

# Implementation Plan: Backlog Task Archival Automation (TASK-111)

## Subject A — Archive Script

**What**: Implement `scripts/archive-done-tasks.sh`, a POSIX-compatible shell script that identifies Done-status task markdown files in `backlog/tasks/` whose mtime is older than 30 days and moves them to `backlog/archive/tasks/`. The script determines Done status by reading the `Status:` field from each file's YAML front-matter (matching the value `Done`). It creates `backlog/archive/tasks/` if it does not exist, moves each qualifying file preserving its filename, and prints a summary line per moved file. It exits 0 in all normal cases, including when no files qualify.

**Files**:
- `scripts/archive-done-tasks.sh` (new)
- `backlog/archive/tasks/.gitkeep` (new, ensures archive directory is tracked in git)

**Deliverable**: An executable shell script that can be invoked with `bash scripts/archive-done-tasks.sh` from the repository root and correctly archives qualifying Done-status task files.

**Estimated sub-tasks**: 2
1. Implement and manually verify the archive script against a fixture set of task files spanning both qualifying and non-qualifying cases.
2. Add a unit-test shell script `scripts/archive-done-tasks.test.sh` that creates synthetic task files, runs the archive script, and asserts correct file movement and exit codes.

**Acceptance Criteria**:
- Running `bash scripts/archive-done-tasks.sh` on a repo containing at least one Done-status `.md` file with mtime older than 30 days results in that file being present under `backlog/archive/tasks/` and absent from `backlog/tasks/`.
- Running `bash scripts/archive-done-tasks.sh` on a repo with no qualifying files exits 0 and makes no filesystem changes.

---

## Subject B — CI Cron Workflow

**What**: Implement `.github/workflows/archive-tasks.yml`, a GitHub Actions workflow that runs on a weekly `schedule` cron trigger (Sundays at 02:00 UTC). The workflow checks out the repository with `fetch-depth: 0` and write permissions, runs `bash scripts/archive-done-tasks.sh`, then uses a conditional commit-and-push step (guarded by `git diff --quiet`) that only commits when files were actually moved. The commit message identifies the automation as the author. The workflow follows the same step structure as the existing `ci.yml`.

**Files**:
- `.github/workflows/archive-tasks.yml` (new)

**Deliverable**: A valid GitHub Actions YAML workflow file that triggers weekly, archives qualifying tasks, and commits moved files back to `main` only when changes exist.

**Estimated sub-tasks**: 1
1. Author and validate `.github/workflows/archive-tasks.yml` including correct cron syntax, checkout configuration, script invocation, and conditional commit-push step.

**Acceptance Criteria**:
- The workflow YAML is valid (`actionlint` or GitHub's own YAML parser accepts it without errors).
- The workflow's cron expression resolves to a weekly schedule (verified by parsing `0 2 * * 0`).
- The commit-and-push step is conditional on `git diff --cached --quiet` or equivalent, so the workflow does not produce empty commits when no files were archived.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Drafting implementation plan.

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->
