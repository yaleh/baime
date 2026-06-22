---
id: TASK-139
title: 将 B″ 看板中的 Basic 前缀替换为 Job：重命名所有状态列、更新 config.yml、SKILL.md、脚本和活跃任务 frontmatter
status: 'Basic: Backlog'
assignee: []
created_date: '2026-06-21 17:09'
updated_date: '2026-06-21 17:55'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
将 B″ 看板中的 Basic 前缀替换为 Job：重命名所有状态列、更新 config.yml、SKILL.md、脚本和活跃任务 frontmatter
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
将 B″ 看板中的 Basic 前缀替换为 Job：重命名所有状态列、更新 config.yml、SKILL.md、脚本和活跃任务 frontmatter

Acceptance Criteria:

---

# Plan: 将 B″ 看板中的 Basic 前缀替换为 Job

Proposal: docs/proposals/proposal-basic-to-job-rename.md

## Phase A: 更新 config.yml 和 backlog-setup SKILL.md（原子核心）

### Tests (write first)
- `grep -q 'Job: Proposal' backlog/config.yml` — must fail before change, pass after
- `! grep -q 'Basic:' backlog/config.yml` — must fail before change, pass after
- `! grep -q 'Basic:' plugin/skills/backlog-setup/SKILL.md` — must fail before change, pass after

### Implementation
Files to edit:
- `backlog/config.yml` — `default_status` → `"Job: Proposal"`; 7 `Basic: *` entries in `statuses` array → `Job: *`
- `plugin/skills/backlog-setup/SKILL.md` — all ~7 occurrences of `Basic:` in REQUIRED_COLUMNS list, Python assertions, shell arrays → `Job:`

These two files must be edited in the same commit; changing config.yml without backlog-setup SKILL.md causes the validate-plugin.sh SKILL bare-status guard to fail.

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'Job: Proposal' backlog/config.yml`
- [ ] `! grep -q 'Basic:' backlog/config.yml`
- [ ] `! grep -q 'Basic:' plugin/skills/backlog-setup/SKILL.md`

## Phase B: 更新所有其余 SKILL.md

### Tests (write first)
- `! grep -r 'Basic:' plugin/skills/ --include='SKILL.md'` — must fail before change (matches exist), pass after all SKILL.md edits

### Implementation
Files to edit (all occurrences of `Basic:` → `Job:`):
- `plugin/skills/loop-backlog/SKILL.md` — ~68 occurrences (status strings, comments, pseudocode, shell examples, test fixtures)
- `plugin/skills/feature-to-backlog/SKILL.md` — ~13 occurrences
- `plugin/skills/task-to-backlog/SKILL.md` — ~7 occurrences
- `plugin/skills/epic-to-backlog/SKILL.md` — ~1 occurrence
- `plugin/skills/task-from-template/SKILL.md` — ~1 occurrence

Strategy: `sed -i 's/Basic: /Job: /g'` per file, then verify no residual `Basic:` remains.

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q 'Basic:' plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'Basic:' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q 'Basic:' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q 'Basic:' plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `! grep -q 'Basic:' plugin/skills/task-from-template/SKILL.md`

## Phase C: 更新脚本文件（含 BASIC_STATUSES → JOB_STATUSES 变量名）

### Tests (write first)
- `! grep -q 'BASIC_STATUSES' scripts/verify-kind-status.sh` — must fail before change, pass after rename
- `grep -q 'JOB_STATUSES' scripts/verify-kind-status.sh` — must fail before change, pass after rename
- `! grep -rE '"Basic: |'"'"'Basic: ' scripts/` — must fail before change, pass after all script edits

### Implementation
Files to edit (all `Basic:` status string occurrences → `Job:`):
- `scripts/verify-kind-status.sh` — rename Python variable `BASIC_STATUSES` → `JOB_STATUSES` (3 occurrences); 7 `"Basic: *"` literals → `"Job: *"`; subset error message → `"Job:*"`
- `scripts/basic-daemon.js` — 4 JSDoc comment lines referencing `Basic:` → `Job:`
- `scripts/basic-daemon.test.js` — ~12 fixture strings (`Basic: Ready`, `Basic: Done`, `Basic: Plan`) → `Job:`
- `scripts/daemon-routing.test.js` — ~12 `Basic:` status strings in `makeTaskFile()` calls and assert labels → `Job:`
- `scripts/validate-plugin.sh` — integrity check: comment and Python inline code `"Basic:"` prefix → `"Job:"`; assertion count comment updated
- `scripts/migrate-board.sh` — STATUS_MAP target values `"Basic: *"` → `"Job: *"`; comments/guards using `Basic:` → `Job:`
- `scripts/unified-loop-smoke.sh` — all `Basic:` status references → `Job:`
- `scripts/exp-k-dryrun.sh` — all `Basic:` status strings and comments → `Job:`
- `scripts/verify-cap-markers.sh` — comment referencing `Basic:` → `Job:`
- `scripts/test-loop-backlog-skill.sh` — `Basic: Ready`, `Basic: In Progress` references → `Job:`; grep pattern updated
- `scripts/test-verify-kind-status.sh` — fixture file contents `"Basic: Backlog"` → `"Job: Backlog"`
- `scripts/fix-yaml-status-quotes.py` — comment example `Basic: Done` → `Job: Done`
- `scripts/merge-guard.test.sh` — comment referencing `Basic: Done` → `Job: Done`

Strategy: `sed -i 's/Basic: /Job: /g'` across all listed files, then targeted `sed -i 's/BASIC_STATUSES/JOB_STATUSES/g'` in `scripts/verify-kind-status.sh`.

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q 'BASIC_STATUSES' scripts/verify-kind-status.sh`
- [ ] `grep -q 'JOB_STATUSES' scripts/verify-kind-status.sh`
- [ ] `! grep -q 'Basic:' scripts/verify-kind-status.sh`
- [ ] `! grep -q 'Basic:' scripts/basic-daemon.js`
- [ ] `! grep -q 'Basic:' scripts/basic-daemon.test.js`
- [ ] `! grep -q 'Basic:' scripts/daemon-routing.test.js`
- [ ] `! grep -q 'Basic:' scripts/validate-plugin.sh`
- [ ] `! grep -q 'Basic:' scripts/migrate-board.sh`
- [ ] `! grep -q 'Basic:' scripts/unified-loop-smoke.sh`
- [ ] `! grep -q 'Basic:' scripts/exp-k-dryrun.sh`
- [ ] `! grep -q 'Basic:' scripts/verify-cap-markers.sh`
- [ ] `! grep -q 'Basic:' scripts/test-loop-backlog-skill.sh`
- [ ] `! grep -q 'Basic:' scripts/test-verify-kind-status.sh`
- [ ] `! grep -q 'Basic:' scripts/fix-yaml-status-quotes.py`
- [ ] `! grep -q 'Basic:' scripts/merge-guard.test.sh`

## Phase D: 批量迁移 backlog/tasks/*.md frontmatter

### Tests (write first)
- `! grep -rq 'status:.*Basic:' backlog/tasks/` — must fail before migration (94 files match), pass after
- `bash scripts/verify-kind-status.sh` — must report 0 violations after migration

### Implementation
Stop daemon before migrating to avoid status mismatch during the migration window.

All 94 task files with `Basic:` in the status field must be updated — including archived `Basic: Done` tasks. After Phase C the updated `JOB_STATUSES` set in `verify-kind-status.sh` no longer recognizes old `Basic:` values, so every remaining file triggers a `column-overlap-violation`.

```bash
# Replace double-quoted form:  status: "Basic: X"  →  status: "Job: X"
sed -i 's/status: "Basic: /status: "Job: /g' backlog/tasks/*.md
# Replace single-quoted form:  status: 'Basic: X'  →  status: 'Job: X'
sed -i "s/status: 'Basic: /status: 'Job: /g" backlog/tasks/*.md
# Replace unquoted form:  status: Basic: X  →  status: Job: X
sed -i 's/status: Basic: /status: Job: /g' backlog/tasks/*.md
```

Do NOT do a body-text blanket `s/Basic: /Job: /g` on task files — task body content may contain historical references to `kind:basic` or script names that must not be changed.

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -rq 'status:.*Basic:' backlog/tasks/`
- [ ] `bash scripts/verify-kind-status.sh`

## Constraints
- Do NOT rename script filenames (`basic-daemon.js`, `basic-daemon.test.js`, etc.) — file names are out of scope
- Do NOT modify `docs/proposals/` historical files — archived, read-only
- Do NOT change `kind:basic` labels — only `status:` prefix values change
- Phase A config.yml and backlog-setup SKILL.md must be edited in the same commit to keep validate-plugin.sh green
- Stop any running loop-backlog daemon before executing Phase D to avoid status mismatch during migration window
- Run `bash scripts/validate-plugin.sh` after every phase before proceeding to the next

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q 'Basic:' backlog/config.yml`
- [ ] `! grep -r 'Basic:' plugin/skills/ --include='SKILL.md'`
- [ ] `! grep -q 'BASIC_STATUSES' scripts/verify-kind-status.sh`
- [ ] `grep -q 'JOB_STATUSES' scripts/verify-kind-status.sh`
- [ ] `! grep -rq 'status:.*Basic:' backlog/tasks/`
- [ ] `bash scripts/verify-kind-status.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
重置为 Basic: Proposal，开始重新计时。start: 2026-06-21T17:42:00Z

Proposal approved (existing description used as draft). Starting plan draft. phase3-start: 2026-06-21T17:49:06Z

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'Job: Proposal' backlog/config.yml
- [ ] #3 ! grep -q 'Basic:' backlog/config.yml
- [ ] #4 ! grep -q 'Basic:' plugin/skills/backlog-setup/SKILL.md
- [ ] #5 bash scripts/validate-plugin.sh
- [ ] #6 ! grep -q 'Basic:' plugin/skills/loop-backlog/SKILL.md
- [ ] #7 ! grep -q 'Basic:' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #8 ! grep -q 'Basic:' plugin/skills/task-to-backlog/SKILL.md
- [ ] #9 ! grep -q 'Basic:' plugin/skills/epic-to-backlog/SKILL.md
- [ ] #10 ! grep -q 'Basic:' plugin/skills/task-from-template/SKILL.md
- [ ] #11 bash scripts/validate-plugin.sh
- [ ] #12 ! grep -q 'BASIC_STATUSES' scripts/verify-kind-status.sh
- [ ] #13 grep -q 'JOB_STATUSES' scripts/verify-kind-status.sh
- [ ] #14 ! grep -q 'Basic:' scripts/verify-kind-status.sh
- [ ] #15 ! grep -q 'Basic:' scripts/basic-daemon.js
- [ ] #16 ! grep -q 'Basic:' scripts/basic-daemon.test.js
- [ ] #17 ! grep -q 'Basic:' scripts/daemon-routing.test.js
- [ ] #18 ! grep -q 'Basic:' scripts/validate-plugin.sh
- [ ] #19 ! grep -q 'Basic:' scripts/migrate-board.sh
- [ ] #20 ! grep -q 'Basic:' scripts/unified-loop-smoke.sh
- [ ] #21 ! grep -q 'Basic:' scripts/exp-k-dryrun.sh
- [ ] #22 ! grep -q 'Basic:' scripts/verify-cap-markers.sh
- [ ] #23 ! grep -q 'Basic:' scripts/test-loop-backlog-skill.sh
- [ ] #24 ! grep -q 'Basic:' scripts/test-verify-kind-status.sh
- [ ] #25 ! grep -q 'Basic:' scripts/fix-yaml-status-quotes.py
- [ ] #26 ! grep -q 'Basic:' scripts/merge-guard.test.sh
- [ ] #27 bash scripts/validate-plugin.sh
- [ ] #28 ! grep -rq 'status:.*Basic:' backlog/tasks/
- [ ] #29 bash scripts/verify-kind-status.sh
- [ ] #30 bash scripts/validate-plugin.sh
- [ ] #31 ! grep -q 'Basic:' backlog/config.yml
- [ ] #32 ! grep -r 'Basic:' plugin/skills/ --include='SKILL.md'
- [ ] #33 ! grep -q 'BASIC_STATUSES' scripts/verify-kind-status.sh
- [ ] #34 grep -q 'JOB_STATUSES' scripts/verify-kind-status.sh
- [ ] #35 ! grep -rq 'status:.*Basic:' backlog/tasks/
- [ ] #36 bash scripts/verify-kind-status.sh
<!-- DOD:END -->
