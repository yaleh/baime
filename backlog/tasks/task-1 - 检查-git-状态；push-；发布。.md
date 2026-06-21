---
id: TASK-1
title: 检查 git 状态；push ；发布。
status: Basic: Done
assignee: []
created_date: '2026-06-16 15:15'
updated_date: '2026-06-16 15:31'
labels:
  - kind:basic
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
# Plan: 检查 git 状态；push ；发布。

## Context
The baime plugin is at version 1.1.0 with 14 commits ahead of origin/main that have not yet been pushed.
A CHANGELOG entry for [1.1.0] already exists and the `chore: release v1.1.0` commit is in the local history.
The release script (scripts/release/release.sh) handles version bumping in manifests, changelog verification,
annotated tagging, and pushing — the tag push triggers the GitHub Actions release workflow at .github/workflows/release.yml.

## Phase 1: Verify pre-release state
Confirm the working tree has no uncommitted tracked changes, main is the active branch, the v1.1.0 CHANGELOG
entry exists, and main is ahead of origin but no local tag v1.1.0 already exists.

### DoD
- [ ] `git -C /home/yale/work/baime status --porcelain | grep -v '^??' | diff - /dev/null`
- [ ] `git -C /home/yale/work/baime rev-parse --abbrev-ref HEAD | grep -q '^main$'`
- [ ] `grep -q '\[1.1.0\]' /home/yale/work/baime/CHANGELOG.md`
- [ ] `git -C /home/yale/work/baime log --oneline origin/main..HEAD | grep -q '.'`
- [ ] `! git -C /home/yale/work/baime tag | grep -q '^v1.1.0$'`

## Phase 2: Run release script in dry-run mode
Execute the release script with --dry-run to confirm all preconditions pass (jq present, manifests writable,
CHANGELOG entry present) without making any changes to git or remote.

```bash
cd /home/yale/work/baime && bash scripts/release/release.sh v1.1.0 --dry-run
```

### DoD
- [ ] `bash /home/yale/work/baime/scripts/release/release.sh v1.1.0 --dry-run 2>&1 | grep -q 'DRY RUN COMPLETE'`

## Phase 3: Execute the release
Run the release script for real. It will bump version fields in plugin/.claude-plugin/plugin.json and
plugin/.claude-plugin/marketplace.json, verify the CHANGELOG entry, commit those changes, create the
annotated tag v1.1.0, push main to origin, and push the tag (which triggers GitHub Actions).

```bash
cd /home/yale/work/baime && bash scripts/release/release.sh v1.1.0
```

### DoD
- [ ] `git -C /home/yale/work/baime tag | grep -q '^v1.1.0$'`
- [ ] `git -C /home/yale/work/baime ls-remote --tags origin 2>/dev/null | grep -q 'refs/tags/v1.1.0$'`
- [ ] `git -C /home/yale/work/baime log --oneline origin/main..HEAD | diff - /dev/null`

## Phase 4: Confirm GitHub Actions release workflow completed
Verify the release workflow run triggered by the v1.1.0 tag push has completed successfully and the
GitHub Release object is visible.

```bash
gh run list --repo yaleh/baime --workflow release.yml --limit 3
gh release view v1.1.0 --repo yaleh/baime
```

### DoD
- [ ] `gh run list --repo yaleh/baime --workflow release.yml --limit 1 --json conclusion --jq '.[0].conclusion' | grep -q 'success'`
- [ ] `gh release view v1.1.0 --repo yaleh/baime --json tagName --jq '.tagName' | grep -q 'v1.1.0'`

## Constraints
- The release script requires `jq` to be installed on the host.
- Do not force-push to main or delete/re-create the tag once it has been pushed to origin.
- If the release script interactively prompts for a CHANGELOG entry, the entry already exists — press Enter to continue.
- Do not manually run `git push` before the release script; let the script manage all pushes to keep commit and tag atomic.

## Acceptance Gate
- [ ] `gh release view v1.1.0 --repo yaleh/baime --json tagName --jq '.tagName' | grep -q 'v1.1.0'`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 git -C /home/yale/work/baime status --porcelain | grep -v '^??' | diff - /dev/null
- [x] #2 git -C /home/yale/work/baime rev-parse --abbrev-ref HEAD | grep -q '^main$'
- [x] #3 grep -q '\[1.1.0\]' /home/yale/work/baime/CHANGELOG.md
- [ ] #4 git -C /home/yale/work/baime log --oneline origin/main..HEAD | grep -q '.'
- [x] #5 ! git -C /home/yale/work/baime tag | grep -q '^v1.1.0$'
- [x] #6 bash /home/yale/work/baime/scripts/release/release.sh v1.1.0 --dry-run 2>&1 | grep -q 'DRY RUN COMPLETE'
- [x] #7 git -C /home/yale/work/baime tag | grep -q '^v1.1.0$'
- [x] #8 git -C /home/yale/work/baime ls-remote --tags origin 2>/dev/null | grep -q 'refs/tags/v1.1.0$'
- [x] #9 git -C /home/yale/work/baime log --oneline origin/main..HEAD | diff - /dev/null
- [x] #10 gh run list --repo yaleh/baime --workflow release.yml --limit 1 --json conclusion --jq '.[0].conclusion' | grep -q 'success'
- [x] #11 gh release view v1.1.0 --repo yaleh/baime --json tagName --jq '.tagName' | grep -q 'v1.1.0'
- [x] #12 gh release view v1.1.0 --repo yaleh/baime --json tagName --jq '.tagName' | grep -q 'v1.1.0'
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 3: APPROVED

Plan committed: docs/plans/101-git-status-push-release.md

claimed: 2026-06-16T15:27:16Z

Phase 1 completed: 2026-06-16T15:28:16Z

Phase 2 completed: 2026-06-16T15:28:16Z

Phase 3 completed: 2026-06-16T15:29:45Z

Phase 4 completed: 2026-06-16T15:30:35Z

Completed: 2026-06-16T15:31:20Z
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
commit: (no file changes - release done in main)
<!-- SECTION:FINAL_SUMMARY:END -->
