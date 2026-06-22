#!/usr/bin/env bash
set -e; PASS=0; FAIL=0
check() { if eval "$2"; then echo "  PASS: $1"; PASS=$((PASS+1)); else echo "  FAIL: $1"; FAIL=$((FAIL+1)); fi; }
check "etb run_in_background=true"         "grep -q 'run_in_background=true' plugin/skills/epic-to-backlog/SKILL.md"
check "etb no awaiting-plan marker"        "! grep -q 'etb-awaiting-plan' plugin/skills/epic-to-backlog/SKILL.md"
check "etb no awaiting-backlog marker"     "! grep -q 'etb-awaiting-backlog' plugin/skills/epic-to-backlog/SKILL.md"
check "ftb run_in_background=true"         "grep -q 'run_in_background=true' plugin/skills/feature-to-backlog/SKILL.md"
check "ftb no awaiting-plan marker"        "! grep -q 'ftb-awaiting-plan' plugin/skills/feature-to-backlog/SKILL.md"
check "ftb no awaiting-backlog marker"     "! grep -q 'ftb-awaiting-backlog' plugin/skills/feature-to-backlog/SKILL.md"
check "ftb no auto Phase 3 advance"        "! grep -q 'APPROVED.*proceed to Phase 3' plugin/skills/feature-to-backlog/SKILL.md"
check "ftb no auto Phase 5 advance"        "! grep -q 'APPROVED.*proceed to Phase 5' plugin/skills/feature-to-backlog/SKILL.md"
check "decomposer uses feature-to-backlog" "grep -q 'feature-to-backlog' plugin/skills/loop-backlog/SKILL.md"
check "decomposer no raw task create in DECOMP" "! grep -v 'never\|NEVER' plugin/skills/loop-backlog/SKILL.md | grep -q 'backlog task create'"
echo "$PASS passed, $FAIL failed"; [ "$FAIL" -eq 0 ]
