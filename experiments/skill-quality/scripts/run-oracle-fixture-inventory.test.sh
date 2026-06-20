#!/usr/bin/env bash
# run-oracle-fixture-inventory.test.sh — Fixture inventory tests
# Verifies fixture counts, lint, and absence of AMBIGUOUS class-b fixtures.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLASS_A_DIR="$EXP_ROOT/fixtures/exp-b/class-a"
CLASS_B_DIR="$EXP_ROOT/fixtures/exp-b/class-b"

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

# test_class_a_lint: runs fixture-lint.sh on fixtures/exp-b/class-a, asserts exit 0
bash "$SCRIPT_DIR/fixture-lint.sh" "$CLASS_A_DIR" > /dev/null 2>&1
check "test_class_a_lint" "$?"

# test_class_b_no_ambiguous: asserts no AMBIGUOUS file in class-b
! grep -rq '"fixtureClass": "AMBIGUOUS"' "$CLASS_B_DIR/" 2>/dev/null && \
! grep -rq '"fixtureClass":"AMBIGUOUS"' "$CLASS_B_DIR/" 2>/dev/null
check "test_class_b_no_ambiguous" "$?"

# test_class_a_count: asserts 10 files
COUNT=$(ls "$CLASS_A_DIR"/*.json 2>/dev/null | wc -l)
[ "$COUNT" -eq 10 ]
check "test_class_a_count" "$?"

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
