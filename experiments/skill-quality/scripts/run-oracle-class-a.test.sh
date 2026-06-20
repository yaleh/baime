#!/usr/bin/env bash
# run-oracle-class-a.test.sh — Offline tests for run-oracle-class-a.ts
# Tests grep the runner source for required patterns.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="$SCRIPT_DIR/run-oracle-class-a.ts"

PASS=0
FAIL=0

check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "0" ]; then
    echo "PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $name"
    FAIL=$((FAIL + 1))
  fi
}

# Test: file exists
test -f "$RUNNER"
check "file_exists" "$?"

# Test: --threshold flag present
grep -q -- '--threshold' "$RUNNER"
check "threshold_flag" "$?"

# Test: --skill flag present
grep -q -- '--skill' "$RUNNER"
check "skill_flag" "$?"

# Test: task-from-template/SKILL.md referenced
grep -q 'task-from-template/SKILL.md' "$RUNNER"
check "task_from_template_skill_md" "$?"

# Test: P-full injection present
grep -q 'P-full' "$RUNNER"
check "p_full_injection" "$?"

# Test: FRESH and STALE present
grep -Eq "FRESH|STALE" "$RUNNER"
check "fresh_stale_present" "$?"

# Test: 'exact' scoring mode present
grep -q "'exact'" "$RUNNER"
check "exact_mode" "$?"

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
