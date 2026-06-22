#!/usr/bin/env bash
set -euo pipefail
# Test: cap:experiment assignment rules documented in proposal-epic-capability-model.md

DOC="$(cd "$(dirname "$0")/../.." && pwd)/docs/proposals/proposal-epic-capability-model.md"

echo "=== cap-experiment-docs tests ==="
echo ""

echo "Test 1: proposal-epic-capability-model.md contains 'cap:experiment'"
if grep -q 'cap:experiment' "$DOC"; then
    echo "  PASS: cap:experiment found in $DOC"
else
    echo "  FAIL: cap:experiment NOT found in $DOC"
    exit 1
fi

echo ""
echo "=== Results: PASS=1 FAIL=0 ==="
