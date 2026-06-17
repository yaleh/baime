# Task Templates

Templates are pre-approved plan documents that allow `task-from-template` to create
Ready-status backlog tasks without going through a full `task-to-backlog` review cycle.

## File Format

Each template is a Markdown file with a YAML front-matter block followed by the plan body.

```markdown
---
slug: <kebab-case-identifier>
title: <Human-readable task title>
last-used: <YYYY-MM-DD>
applicable-when: <one-sentence description of when this template applies>
---

## Context
...

## Phase 1: ...
### DoD
- [ ] `<shell command>`

## Acceptance Gate
- [ ] `<shell command>`
```

## Front-Matter Fields

| Field | Required | Description |
|---|---|---|
| `slug` | yes | Kebab-case identifier matching the filename (without `.md`). Used by `task-from-template <slug>` to locate the file. |
| `title` | yes | Human-readable task title. Used as the backlog task name when a new task is created. |
| `last-used` | yes | ISO date (`YYYY-MM-DD`) of the most recent time this template was used to create a task. Updated automatically by `task-from-template` after each use. |
| `applicable-when` | yes | One-sentence description of the preconditions under which this template applies. Shown to the user during the freshness check if the template is STALE. |

## Freshness Check

Before creating a task, `task-from-template` performs a single LLM freshness check:

- **Input**: template full text + `git log --oneline --since=<last-used>` summary + current date
- **Output**: first line must be `FRESH` or `STALE:<one-line-reason>`
- If `STALE`: print the reason and exit. The user should regenerate the template with `task-to-backlog`.
- If `FRESH`: proceed to create the backlog task.

The freshness check is intentionally lightweight — it is not a full review. It only asks:
*"Given recent changes, does this template still describe valid steps?"*

## Template Lifecycle

1. **First creation**: run `/task-to-backlog` for the task. After approval, save the resulting
   plan as a template by adding front-matter and committing to `backlog/templates/`.
2. **Routine use**: run `/task-from-template <slug>`. If FRESH, a Ready task is created instantly.
3. **After a STALE verdict**: re-run `/task-to-backlog` with updated context, then update the template.
4. **`last-used` maintenance**: `task-from-template` updates this field automatically via `sed -i`
   after each successful task creation.

## Existing Templates

| Slug | Title | Applicable When |
|---|---|---|
| `git-push-release` | 检查 git 状态；push；发布 | Local main has unpushed commits and a CHANGELOG entry for the next version exists |
