#!/usr/bin/env bash
# dod-eval.test.sh - Phase B regression test for TASK-128
# exit 0 = pass
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)/plugin/skills/loop-backlog/SKILL.md"
TMP=$(mktemp); printf 'hello world\n' > "$TMP"
# B1: a !-prefixed DoD command must return success when the pattern is ABSENT
CMD="! grep -q ABSENTPATTERN \"$TMP\""
bash -c "$CMD"
rm -f "$TMP"
# B2: the DoD execution sites must use bash -c, not bare eval of $CMD/$DOD_CMD
! grep -q 'eval "\$CMD"' "$SKILL"
! grep -q 'eval "\$DOD_CMD"' "$SKILL"
grep -q 'bash -c "\$CMD"' "$SKILL"
grep -q 'bash -c "\$DOD_CMD"' "$SKILL"
echo "dod-eval.test.sh: PASS"
