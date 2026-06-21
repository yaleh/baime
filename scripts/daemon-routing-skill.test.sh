#!/usr/bin/env bash
set -e; PASS=0; FAIL=0
check() { if eval "$2"; then echo "  PASS: $1"; PASS=$((PASS+1)); else echo "  FAIL: $1"; FAIL=$((FAIL+1)); fi; }
check "proposal-approved branch" "grep -q 'proposal-approved:TASK-' plugin/skills/loop-backlog/SKILL.md"
check "plan-approved branch"     "grep -q 'plan-approved:TASK-' plugin/skills/loop-backlog/SKILL.md"
check "startPlanDraft present"   "grep -q 'startPlanDraft' plugin/skills/loop-backlog/SKILL.md"
check "startFinalise present"    "grep -q 'startFinalise' plugin/skills/loop-backlog/SKILL.md"
check "no run_in_background=false" "! grep -q 'run_in_background=false' plugin/skills/loop-backlog/SKILL.md"
echo "$PASS passed, $FAIL failed"; [ "$FAIL" -eq 0 ]
