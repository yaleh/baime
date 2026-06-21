---
id: TASK-84
title: 检查 git 状态；push；发布
status: Basic: Done
assignee: []
created_date: '2026-06-20 02:11'
updated_date: '2026-06-20 03:17'
labels:
  - kind:basic
dependencies: []
ordinal: 64000
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
the CHANGELOG entry for `<VERSION>` exists, main is ahead of origin, and no local tag
`v<VERSION>` already exists.

### DoD
- [ ] `git -C $(git rev-parse --show-toplevel) status --porcelain | grep -v '^??' | diff - /dev/null`
- [ ] `git -C $(git rev-parse --show-toplevel) rev-parse --abbrev-ref HEAD | grep -q '^main$'`
- [ ] `grep -q '\[<VERSION>\]' $(git rev-parse --show-toplevel)/CHANGELOG.md`
- [ ] `git -C $(git rev-parse --show-toplevel) log --oneline origin/main..HEAD | grep -q '.'`
- [ ] `! git -C $(git rev-parse --show-toplevel) tag | grep -q '^v<VERSION>$'`

## Phase 2: Run release script in dry-run mode
Execute the release script with --dry-run to confirm all preconditions pass (jq present,
manifests writable, CHANGELOG entry present) without making any changes to git or remote.

```bash
cd $(git rev-parse --show-toplevel) && bash scripts/release/release.sh v<VERSION> --dry-run
```

### DoD
- [ ] `bash $(git rev-parse --show-toplevel)/scripts/release/release.sh v<VERSION> --dry-run 2>&1 | grep -q 'DRY RUN COMPLETE'`

## Phase 3: Execute the release
Run the release script for real. It handles version bumping, changelog verification, tagging,
and pushing — the tag push triggers GitHub Actions.

```bash
cd $(git rev-parse --show-toplevel) && bash scripts/release/release.sh v<VERSION>
```

### DoD
- [ ] `git -C $(git rev-parse --show-toplevel) tag | grep -q '^v<VERSION>$'`
- [ ] `git -C $(git rev-parse --show-toplevel) ls-remote --tags origin 2>/dev/null | grep -q 'refs/tags/v<VERSION>$'`
- [ ] `git -C $(git rev-parse --show-toplevel) log --oneline origin/main..HEAD | diff - /dev/null`

## Phase 4: Confirm GitHub Actions release workflow completed
Verify the release workflow run triggered by the v<VERSION> tag push has completed
successfully and the GitHub Release object is visible.

```bash
REPO=$(git -C $(git rev-parse --show-toplevel) remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//')
gh run list --repo "$REPO" --workflow release.yml --limit 3
gh release view "v<VERSION>" --repo "$REPO"
```

### DoD
- [ ] `gh run list --repo $(git -C $(git rev-parse --show-toplevel) remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//') --workflow release.yml --limit 1 --json conclusion --jq '.[0].conclusion' | grep -q 'success'`
- [ ] `gh release view v<VERSION> --repo $(git -C $(git rev-parse --show-toplevel) remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//') --json tagName --jq '.tagName' | grep -q 'v<VERSION>'`

## Constraints
- The release script requires `jq` to be installed on the host.
- Do not force-push to main or delete/re-create the tag once it has been pushed to origin.
- If the release script interactively prompts for a CHANGELOG entry, the entry already exists — press Enter to continue.
- Do not manually run `git push` before the release script; let the script manage all pushes to keep commit and tag atomic.
- Replace `<VERSION>` with the actual version string (e.g. `1.3.0`) before running DoD checks.

## Acceptance Gate
- [ ] `gh release view v<VERSION> --repo $(git -C $(git rev-parse --show-toplevel) remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//') --json tagName --jq '.tagName' | grep -q 'v<VERSION>'`
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Escalated: The task uses '<VERSION>' as a placeholder that was never filled in. The CHANGELOG has an [Unreleased] section but no concrete version entry. Also, pushing to origin and creating a GitHub release at https://github.com/yaleh/baime.git are hard-to-reverse actions that require explicit authorization.

To continue: answer in Implementation Notes with:
1. The version number to release (e.g. 1.4.0)
2. Confirm you want to push to origin and publish a GitHub release

Then set status → Ready.

---

Confirmed:

1. The version number to release: 1.4.0
2. Push to origin and publish a GitHub release

claimed: 2026-06-20T03:15:13Z

Completed: 2026-06-20T03:17:24Z
Release v1.4.0 published: https://github.com/yaleh/baime/releases/tag/v1.4.0
<!-- SECTION:NOTES:END -->
