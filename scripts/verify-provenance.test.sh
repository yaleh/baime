#!/usr/bin/env bash
# verify-provenance.test.sh — TDD spec for verify-provenance.sh
#
# R5 guard: any artifact labeled `data_source: measured` MUST carry a
# `generated_by:` field naming a generator script that exists. This closes the
# TASK-93 gap where hand-written files claimed "measured" with no traceable
# generator (fabrication masquerading as measurement).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GUARD="$SCRIPT_DIR/verify-provenance.sh"

PASS=0
FAIL=0
check() { if [ "$2" -eq "$3" ]; then echo "  PASS: $1"; PASS=$((PASS+1)); else echo "  FAIL: $1 (expected $2, got $3)"; FAIL=$((FAIL+1)); fi; }

# ---- Test 1: measured + valid generated_by (existing script) → exit 0 ---
D=$(mktemp -d)
cat > "$D/good.json" <<EOF
{ "data_source": "measured", "generated_by": "scripts/check-roi-gate.sh", "replan_total": 4 }
EOF
bash "$GUARD" "$D" >/dev/null 2>&1
check "measured + valid generated_by → exit 0" 0 $?
rm -rf "$D"

# ---- Test 2: measured but NO generated_by → exit 1 ----------------------
D=$(mktemp -d)
cat > "$D/bad.md" <<EOF
# Report
data_source: measured
replan_total: 4
EOF
bash "$GUARD" "$D" >/dev/null 2>&1
check "measured without generated_by → exit 1" 1 $?
rm -rf "$D"

# ---- Test 3: measured + generated_by → nonexistent script → exit 1 ------
D=$(mktemp -d)
cat > "$D/bad2.json" <<EOF
{ "data_source": "measured", "generated_by": "scripts/does-not-exist.sh" }
EOF
bash "$GUARD" "$D" >/dev/null 2>&1
check "measured + nonexistent generator → exit 1" 1 $?
rm -rf "$D"

# ---- Test 4: offender filename reported --------------------------------
D=$(mktemp -d)
cat > "$D/fabricated.md" <<EOF
data_source: measured
EOF
OUT=$(bash "$GUARD" "$D" 2>&1)
echo "$OUT" | grep -q "fabricated.md"
check "offender filename reported" 0 $?
rm -rf "$D"

# ---- Test 5: file without measured label → ignored → exit 0 ------------
D=$(mktemp -d)
cat > "$D/estimated.md" <<EOF
data_source: estimated
note: not subject to provenance gate
EOF
bash "$GUARD" "$D" >/dev/null 2>&1
check "non-measured artifact ignored → exit 0" 0 $?
rm -rf "$D"

# ---- Test 6: no measured files at all → exit 0 -------------------------
D=$(mktemp -d)
echo "nothing here" > "$D/plain.txt"
bash "$GUARD" "$D" >/dev/null 2>&1
check "no measured artifacts → exit 0" 0 $?
rm -rf "$D"

# ---- Test 7: missing dir arg → exit 2 ----------------------------------
bash "$GUARD" >/dev/null 2>&1
check "missing dir arg → exit 2" 2 $?

echo ""
echo "verify-provenance.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
