#!/usr/bin/env bash
# merge-guard.test.sh - Phase C regression test for TASK-128
# exit 0 = pass
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)/plugin/skills/loop-backlog/SKILL.md"
# C1: explicit no-pipe rule comment for git merge
grep -q 'never pipe.*git merge\|do not pipe.*git merge\|no-pipe' "$SKILL"
# C2: MERGE_HEAD / unmerged-files guard present before Basic: Done
grep -q 'MERGE_HEAD' "$SKILL"
grep -q 'diff-filter=U' "$SKILL"
# C3: merge exit code is still consumed by an if-guard (not piped)
grep -q 'if git merge --no-ff' "$SKILL"
# C4: no piped git-merge anywhere (exit-code masking)
! grep -qE 'git merge[^|]*\| *(tail|cat|head|tee)' "$SKILL"
echo "merge-guard.test.sh: PASS"
