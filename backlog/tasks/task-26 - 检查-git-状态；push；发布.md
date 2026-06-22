---
id: TASK-26
title: 检查 git 状态；push；发布
status: "Basic: Done"
assignee: []
created_date: '2026-06-18 02:47'
updated_date: '2026-06-18 02:52'
labels:
  - kind:basic
dependencies: []
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context
The baime plugin has local commits on main that have not been pushed to origin.
A CHANGELOG entry for the target version already exists.
The release script (scripts/release/release.sh) handles version bumping in manifests,
changelog verification, annotated tagging, and pushing — the tag push triggers the
GitHub Actions release workflow at .github/workflows/release.yml.

## Phase 1: Verify pre-release state
Confirm the working tree has no uncommitted tracked changes, main is the active branch,
the CHANGELOG entry for `1.1.1` exists, main is ahead of origin, and no local tag
`v1.1.1` already exists.

### DoD
- [ ] `git -C $(git rev-parse --show-toplevel) status --porcelain | grep -v '^??' | diff - /dev/null`
- [ ] `git -C $(git rev-parse --show-toplevel) rev-parse --abbrev-ref HEAD | grep -q '^main$'`
- [ ] `grep -q '\[1.1.1\]' $(git rev-parse --show-toplevel)/CHANGELOG.md`
- [ ] `git -C $(git rev-parse --show-toplevel) log --oneline origin/main..HEAD | grep -q '.'`
- [ ] `! git -C $(git rev-parse --show-toplevel) tag | grep -q '^v1.1.1$'`

## Phase 2: Run release script in dry-run mode
Execute the release script with --dry-run to confirm all preconditions pass (jq present,
manifests writable, CHANGELOG entry present) without making any changes to git or remote.

```bash
cd $(git rev-parse --show-toplevel) && bash scripts/release/release.sh v1.1.1 --dry-run
```

### DoD
- [ ] `bash $(git rev-parse --show-toplevel)/scripts/release/release.sh v1.1.1 --dry-run 2>&1 | grep -q 'DRY RUN COMPLETE'`

## Phase 3: Execute the release
Run the release script for real. It handles version bumping, changelog verification, tagging,
and pushing — the tag push triggers GitHub Actions.

```bash
cd $(git rev-parse --show-toplevel) && bash scripts/release/release.sh v1.1.1
```

### DoD
- [ ] `git -C $(git rev-parse --show-toplevel) tag | grep -q '^v1.1.1$'`
- [ ] `git -C $(git rev-parse --show-toplevel) ls-remote --tags origin 2>/dev/null | grep -q 'refs/tags/v1.1.1$'`
- [ ] `git -C $(git rev-parse --show-toplevel) log --oneline origin/main..HEAD | diff - /dev/null`

## Phase 4: Confirm GitHub Actions release workflow completed
Verify the release workflow run triggered by the v1.1.1 tag push has completed
successfully and the GitHub Release object is visible.

```bash
REPO=$(git -C $(git rev-parse --show-toplevel) remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//')
gh run list --repo "$REPO" --workflow release.yml --limit 3
gh release view "v1.1.1" --repo "$REPO"
```

### DoD
- [ ] `gh run list --repo $(git -C $(git rev-parse --show-toplevel) remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//') --workflow release.yml --limit 1 --json conclusion --jq '.[0].conclusion' | grep -q 'success'`
- [ ] `gh release view v1.1.1 --repo $(git -C $(git rev-parse --show-toplevel) remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//') --json tagName --jq '.tagName' | grep -q 'v1.1.1'`

## Constraints
- The release script requires `jq` to be installed on the host.
- Do not force-push to main or delete/re-create the tag once it has been pushed to origin.
- If the release script interactively prompts for a CHANGELOG entry, the entry already exists — press Enter to continue.
- Do not manually run `git push` before the release script; let the script manage all pushes to keep commit and tag atomic.
- Replace `1.1.1` with the actual version string (e.g. `1.3.0`) before running DoD checks.

## Acceptance Gate
- [ ] `gh release view v1.1.1 --repo $(git -C $(git rev-parse --show-toplevel) remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//') --json tagName --jq '.tagName' | grep -q 'v1.1.1'`
<!-- SECTION:DESCRIPTION:END -->
