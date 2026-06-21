---
id: TASK-8
title: 检查 git 状态；push ；发布。
status: Basic: Done
assignee: []
created_date: '2026-06-17 07:50'
updated_date: '2026-06-17 08:43'
labels:
  - kind:basic
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
# Plan: 检查 git 状态；push ；发布。

## Context
The baime project (BAIME - Bootstrapped AI Methodology Engineering) has accumulated commits since the last release (v1.1.3). The [Unreleased] section of CHANGELOG.md documents new features (Node.js daemon, event-driven loop-backlog, and related skills). This task audits the working tree, commits any pending backlog file changes, updates CHANGELOG, bumps the version in both manifests, and executes the full release pipeline (commit → tag → push) via the existing `scripts/release/` tooling.

## Phase 1: Audit and Clean Working Tree
Review current git status. Modified/untracked backlog task files exist (task-6 modified, task-7 and task-8 untracked). Stage and commit them as a docs commit so the working tree is clean before the release pipeline runs.

Commands to run:
```sh
cd /home/yale/work/baime
git add backlog/tasks/
git commit -m "docs: update backlog task files"
```

### DoD
- [ ] `git -C /home/yale/work/baime diff --exit-code`
- [ ] `git -C /home/yale/work/baime diff --cached --exit-code`
- [ ] `[ -z "$(git -C /home/yale/work/baime status --porcelain | grep -v '^??')" ]`

## Phase 2: Update CHANGELOG.md
Rename the `## [Unreleased]` header to `## [1.2.0] - 2026-06-17` and insert a new empty `## [Unreleased]` section above it. The CHANGELOG entry must exist before the dry-run and before `release.sh` step 3 can pass without an interactive prompt.

Edit `/home/yale/work/baime/CHANGELOG.md`:
- Replace the first `## [Unreleased]` line with:
  ```
  ## [Unreleased]

  ## [1.2.0] - 2026-06-17
  ```

### DoD
- [ ] `grep -q '\[1\.2\.0\]' /home/yale/work/baime/CHANGELOG.md`
- [ ] `grep -q '\[Unreleased\]' /home/yale/work/baime/CHANGELOG.md`

## Phase 3: Bump Version and Run Pre-Release Validation
Current version is 1.1.3 in both `plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`. The [Unreleased] changes include a new feature (Node.js daemon) and multiple skill additions — warranting a minor bump to v1.2.0. Bump the version in both manifests first, then run the pre-release check to validate all 7 items: jq available, clean working tree, on main branch, tag does not exist, version consistency, validate-plugin.sh passes, and CHANGELOG entry exists.

Commands to run:
```sh
cd /home/yale/work/baime
bash scripts/release/bump-version.sh v1.2.0
bash scripts/release/pre-release-check.sh v1.2.0
```

### DoD
- [ ] `grep -q '"version": "1.2.0"' /home/yale/work/baime/plugin/.claude-plugin/plugin.json`
- [ ] `bash /home/yale/work/baime/scripts/release/pre-release-check.sh v1.2.0 2>&1 | grep -q 'ALL PRE-RELEASE CHECKS PASSED'`

## Phase 4: Run Dry-Run to Confirm Release Pipeline
With version bumped and pre-release checks passing, run a dry-run to confirm the release pipeline would succeed before making real tag/push changes.

Commands to run:
```sh
cd /home/yale/work/baime
bash scripts/release/release.sh v1.2.0 --dry-run
```

### DoD
- [ ] `bash /home/yale/work/baime/scripts/release/release.sh v1.2.0 --dry-run 2>&1 | grep -q 'DRY RUN COMPLETE'`

## Phase 5: Execute Full Release (commit, tag, push)
Run `release.sh v1.2.0` with `--skip-checks` (since pre-checks already passed in Phase 3 and version was already bumped). This will: stage manifests + CHANGELOG, commit as `chore: release v1.2.0`, create annotated tag v1.2.0, push branch to origin/main, and push tag to origin.

Commands to run:
```sh
cd /home/yale/work/baime
bash scripts/release/release.sh v1.2.0 --skip-checks
```

### DoD
- [ ] `git -C /home/yale/work/baime tag | grep -q 'v1\.2\.0'`
- [ ] `[ "$(git -C /home/yale/work/baime rev-parse HEAD)" = "$(git -C /home/yale/work/baime rev-parse origin/main)" ]`

## Phase 6: Verify Remote Publication
Confirm the tag and branch HEAD are visible on the remote (GitHub). The release is considered published when the annotated tag exists on origin.

Commands to run:
```sh
git -C /home/yale/work/baime ls-remote --tags origin | grep v1.2.0
```

### DoD
- [ ] `git -C /home/yale/work/baime ls-remote --tags origin | grep -q 'refs/tags/v1\.2\.0'`
- [ ] `git -C /home/yale/work/baime log --oneline -1 | grep -q 'chore: release v1\.2\.0'`

## Constraints
- Do NOT force-push to main or delete existing tags
- Do NOT skip pre-release checks unless the only failing check is version-mismatch (remedied by running bump-version.sh first)
- CHANGELOG must have the [1.2.0] entry before release.sh step 3 runs or the script will hang on an interactive prompt
- Chosen version must follow semver and not already exist as a git tag
- Do NOT modify backlog task markdown files after Phase 1 commit (keeps the tree clean for release)
- The release pipeline writes to `plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` only — no other source files are modified

## Acceptance Gate
- [ ] `git -C /home/yale/work/baime ls-remote --tags origin | grep -q 'refs/tags/v1\.2\.0'`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 git -C /home/yale/work/baime diff --exit-code
- [ ] #2 git -C /home/yale/work/baime diff --cached --exit-code
- [ ] #3 [ -z "$(git -C /home/yale/work/baime status --porcelain | grep -v '^??')" ]
- [ ] #4 grep -q '\[1\.2\.0\]' /home/yale/work/baime/CHANGELOG.md
- [ ] #5 grep -q '\[Unreleased\]' /home/yale/work/baime/CHANGELOG.md
- [ ] #6 grep -q '"version": "1.2.0"' /home/yale/work/baime/plugin/.claude-plugin/plugin.json
- [ ] #7 bash /home/yale/work/baime/scripts/release/pre-release-check.sh v1.2.0 2>&1 | grep -q 'ALL PRE-RELEASE CHECKS PASSED'
- [ ] #8 bash /home/yale/work/baime/scripts/release/release.sh v1.2.0 --dry-run 2>&1 | grep -q 'DRY RUN COMPLETE'
- [ ] #9 git -C /home/yale/work/baime tag | grep -q 'v1\.2\.0'
- [ ] #10 [ "$(git -C /home/yale/work/baime rev-parse HEAD)" = "$(git -C /home/yale/work/baime rev-parse origin/main)" ]
- [ ] #11 git -C /home/yale/work/baime ls-remote --tags origin | grep -q 'refs/tags/v1\.2\.0'
- [ ] #12 git -C /home/yale/work/baime log --oneline -1 | grep -q 'chore: release v1\.2\.0'
- [ ] #13 git -C /home/yale/work/baime ls-remote --tags origin | grep -q 'refs/tags/v1\.2\.0'
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: NEEDS_REVISION — Phase ordering fixed: CHANGELOG update moved from Phase 3 to Phase 2 so it precedes the dry-run (Phase 3). The release.sh dry-run checks for a CHANGELOG entry for the target version; running it before the CHANGELOG was updated would have caused the dry-run to fail. All other criteria passed.

Plan review iteration 2: NEEDS_REVISION — removed weak Phase 3 DoD item (jq semver format check that didn't verify the target version 1.2.0 and was misleading since bump-version.sh runs in Phase 4). Replaced with just the dry-run completion check. All other DoDs are shell-executable and precise.

Plan review iteration 3: NEEDS_REVISION — Fixed two issues: (1) Phase ordering: moved version bump before dry-run (old Phase 3 dry-run ran before bump, causing version mismatch; now bump+pre-check is Phase 3, dry-run is Phase 4). (2) Phase 5 DoD: replaced unreliable `git status | grep 'Your branch is up to date'` with precise `rev-parse HEAD = rev-parse origin/main` comparison.

Plan review iteration 4: APPROVED

Plan committed: docs/plans/108-check-git-push-publish.md

claimed: 2026-06-17T07:59:10Z

Worker 无法自主执行：任务包含 git push 到 origin/main 和创建 annotated tag v1.2.0，属于不可逆远程操作，需要人类授权后继续。请确认后将任务重新移入 Ready，或手动执行发布流程。

claimed: 2026-06-17T08:40:28Z

Completed: 2026-06-17T08:43:33Z
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Execution Summary

**Result:** Done
**Tag:** v1.2.0 on main (91a14e4)
**Pushed:** origin/main and refs/tags/v1.2.0
<!-- SECTION:FINAL_SUMMARY:END -->
