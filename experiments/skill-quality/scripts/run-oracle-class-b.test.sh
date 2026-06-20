#!/usr/bin/env bash
# run-oracle-class-b.test.sh — Offline tests for run-oracle-class-b.ts
# Tests grep the runner source for required patterns.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="$SCRIPT_DIR/run-oracle-class-b.ts"

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

# Test: feature-to-backlog/SKILL.md referenced
grep -q 'feature-to-backlog/SKILL.md' "$RUNNER"
check "feature_to_backlog_skill_md" "$?"

# Test: P-full injection present
grep -q 'P-full' "$RUNNER"
check "p_full_injection" "$?"

# Test: 'partial' scoring mode present
grep -q "'partial'" "$RUNNER"
check "partial_mode" "$?"

# Test: score.js imported from lib
grep -q "from '../lib/score.js'" "$RUNNER"
check "score_js_import" "$?"

# Test: verdict_only or verdictOnly present
grep -Eq "verdict_only|verdictOnly" "$RUNNER"
check "verdict_only_present" "$?"

# Test: composite present
grep -q 'composite' "$RUNNER"
check "composite_present" "$?"

# Test: scorer-warning present
grep -q 'scorer-warning' "$RUNNER"
check "scorer_warning_present" "$?"

# Test: - 0.1 threshold check present
grep -q -- '- 0.1' "$RUNNER"
check "minus_0_1_present" "$?"

# Test: AMBIGUOUS guard present
grep -q 'AMBIGUOUS' "$RUNNER"
check "ambiguous_guard" "$?"

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
