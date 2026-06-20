#!/usr/bin/env bash
# oracle-provenance.test.sh — Tests that oracle result artifacts pass provenance check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ARTIFACTS_DIR="$EXP_ROOT/artifacts/analysis"

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

# check-provenance.sh passes for oracle-class-a-results.json
bash "$SCRIPT_DIR/check-provenance.sh" "$ARTIFACTS_DIR/oracle-class-a-results.json" > /dev/null 2>&1
check "provenance_class_a" "$?"

# check-provenance.sh passes for oracle-class-b-results.json
bash "$SCRIPT_DIR/check-provenance.sh" "$ARTIFACTS_DIR/oracle-class-b-results.json" > /dev/null 2>&1
check "provenance_class_b" "$?"

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
