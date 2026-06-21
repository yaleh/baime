#!/usr/bin/env bash
# worker-taskfile-merge.test.sh - Phase A regression test for TASK-128
# exit 0 = pass
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)/plugin/skills/loop-backlog/SKILL.md"
# A1: agent prompt must NOT tell the agent to edit the shared task file
! grep -qF 'backlog task edit ${TID} --append-notes' "$SKILL"
# A2: agent must instead record its summary into the worktree signal/summary file
grep -q 'agent-summary' "$SKILL"
# A3: worker (main side) must append the agent summary after merge
grep -q 'post-merge.*append\|append.*agent-summary' "$SKILL"
echo "worker-taskfile-merge.test.sh: PASS"
