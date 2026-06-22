#!/usr/bin/env bash
# check-roi-gate.test.sh — TDD spec for check-roi-gate.sh (new quality-first semantics).
#
# Gate semantics (post-rewrite):
#   PROCEED → exit 0   (evaluator data present, Met%>=70%, cycle<20, replan rate<=5/10)
#   HOLD    → exit 2   (runaway | unstable | no data | quality)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GATE="$SCRIPT_DIR/check-roi-gate.sh"

PASS=0
FAIL=0
check() {
  if [ "$2" -eq "$3" ]; then
    echo "  PASS: $1"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $1 (expected $2, got $3)"
    FAIL=$((FAIL+1))
  fi
}

check_stdout() {
  # check_stdout <label> <expected_exit> <actual_exit> <pattern> <stdout>
  local label="$1" exp_exit="$2" act_exit="$3" pattern="$4" out="$5"
  if [ "$act_exit" -eq "$exp_exit" ] && echo "$out" | grep -q "$pattern"; then
    echo "  PASS: $label"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $label (exit expected=$exp_exit got=$act_exit, pattern='$pattern')"
    FAIL=$((FAIL+1))
  fi
}

CLEANUP_DIRS=()
cleanup() {
  for d in "${CLEANUP_DIRS[@]:-}"; do
    [ -n "$d" ] && rm -rf "$d"
  done
}
trap cleanup EXIT

# mk_cycle: creates a file the gate counts as one full cycle.
# Frontmatter has status: Meta-Done in first ~4 lines, body has evaluator line.
mk_cycle() { # mk_cycle <dir> <n> <replan?> <verdict: Met|NotMet|none>
  local dir="$1" n="$2" replan="$3" verdict="$4"
  {
    printf -- "---\n"
    printf "id: TASK-%s\n" "$n"
    printf "status: Meta-Done\n"
    printf -- "---\n"
    printf "# Task %s\n" "$n"
    printf "idempotentReconcile: cycle %s\n" "$n"
    [ "$replan" = "yes" ] && printf "replan: impl — fixture cycle %s\n" "$n"
    [ "$verdict" != "none" ] && printf "evaluator: %s | data_source: measured\n" "$verdict"
  } > "$dir/task-${n}.md"
}

# mk_no_data_cycle: status: Meta-Done in frontmatter but NO evaluator line
mk_no_data_cycle() {
  local dir="$1" n="$2"
  {
    printf -- "---\n"
    printf "id: TASK-%s\n" "$n"
    printf "status: Meta-Done\n"
    printf -- "---\n"
    printf "# Task %s — no evaluator recorded\n" "$n"
    printf "idempotentReconcile: cycle %s\n" "$n"
  } > "$dir/task-${n}.md"
}

# mk_non_cycle: has idempotentReconcile: in body but NO frontmatter status: Meta-Done
mk_non_cycle() {
  local dir="$1" n="$2"
  {
    printf "# Task %s — not a real cycle\n" "$n"
    printf "idempotentReconcile: appears in body but no frontmatter status\n"
    printf "evaluator: Met | data_source: measured\n"
  } > "$dir/task-${n}.md"
}

# --- Scenario 1: 3 cycles, 0 replans, Met 100% → PROCEED -------------------
echo "--- Scenario 1: 3 cycles, 0 replans, Met 100% → PROCEED ---"
D1=$(mktemp -d); CLEANUP_DIRS+=("$D1")
mk_cycle "$D1" 1 no Met
mk_cycle "$D1" 2 no Met
mk_cycle "$D1" 3 no Met
OUT1=$(bash "$GATE" --tasks-dir "$D1" 2>&1)
RC1=$?
check_stdout "3 cycles, 0 replans, Met 100% → PROCEED (exit 0)" 0 "$RC1" "PROCEED" "$OUT1"

# --- Scenario 2: 8 cycles, 2 replans, Met 80% → PROCEED --------------------
echo "--- Scenario 2: 8 cycles, 2 replans, Met 80% → PROCEED ---"
D2=$(mktemp -d); CLEANUP_DIRS+=("$D2")
mk_cycle "$D2" 1 yes Met
mk_cycle "$D2" 2 yes Met
mk_cycle "$D2" 3 no  Met
mk_cycle "$D2" 4 no  Met
mk_cycle "$D2" 5 no  Met
mk_cycle "$D2" 6 no  Met
mk_cycle "$D2" 7 no  NotMet
mk_cycle "$D2" 8 no  NotMet
# Met=6, NotMet=2 → 75% ≥ 70%; replan_rate = (2*10)/8 = 2 ≤ 5 → PROCEED
OUT2=$(bash "$GATE" --tasks-dir "$D2" 2>&1)
RC2=$?
check_stdout "8 cycles, 2 replans, Met 80% → PROCEED (exit 0)" 0 "$RC2" "PROCEED" "$OUT2"

# --- Scenario 3: 25 cycles (runaway) → HOLD --------------------------------
echo "--- Scenario 3: 25 cycles (runaway) → HOLD ---"
D3=$(mktemp -d); CLEANUP_DIRS+=("$D3")
for i in $(seq 1 25); do
  mk_cycle "$D3" "$i" no Met
done
OUT3=$(bash "$GATE" --tasks-dir "$D3" 2>&1)
RC3=$?
check_stdout "25 cycles runaway → HOLD (exit 2)" 2 "$RC3" "HOLD" "$OUT3"
echo "$OUT3" | grep -qi "runaway\|Runaway" && echo "  PASS: runaway keyword in output" && PASS=$((PASS+1)) || { echo "  FAIL: runaway keyword missing from output"; FAIL=$((FAIL+1)); }

# --- Scenario 4: 10 cycles, 6 replan events (unstable) → HOLD --------------
echo "--- Scenario 4: 10 cycles, 6 replan events (unstable) → HOLD ---"
D4=$(mktemp -d); CLEANUP_DIRS+=("$D4")
for i in $(seq 1 6); do
  mk_cycle "$D4" "$i" yes Met
done
for i in $(seq 7 10); do
  mk_cycle "$D4" "$i" no Met
done
# replan_rate = (6*10)/10 = 6 > 5 → HOLD unstable
OUT4=$(bash "$GATE" --tasks-dir "$D4" 2>&1)
RC4=$?
check_stdout "10 cycles, 6 replans (rate=6/10 > 5) → HOLD (exit 2)" 2 "$RC4" "HOLD" "$OUT4"
echo "$OUT4" | grep -qi "unstable\|Unstable" && echo "  PASS: unstable keyword in output" && PASS=$((PASS+1)) || { echo "  FAIL: unstable keyword missing from output"; FAIL=$((FAIL+1)); }

# --- Scenario 5: 3 cycles, no evaluator line (no data) → HOLD --------------
echo "--- Scenario 5: 3 cycles, no evaluator line (no data) → HOLD ---"
D5=$(mktemp -d); CLEANUP_DIRS+=("$D5")
mk_no_data_cycle "$D5" 1
mk_no_data_cycle "$D5" 2
mk_no_data_cycle "$D5" 3
OUT5=$(bash "$GATE" --tasks-dir "$D5" 2>&1)
RC5=$?
check_stdout "3 cycles no evaluator → HOLD (exit 2)" 2 "$RC5" "HOLD" "$OUT5"
echo "$OUT5" | grep -qi "no data\|No data" && echo "  PASS: 'no data' keyword in output" && PASS=$((PASS+1)) || { echo "  FAIL: 'no data' keyword missing from output"; FAIL=$((FAIL+1)); }

# --- Scenario 6: 4 cycles, Met 50% (quality) → HOLD -----------------------
echo "--- Scenario 6: 4 cycles, Met 50% (quality fail) → HOLD ---"
D6=$(mktemp -d); CLEANUP_DIRS+=("$D6")
mk_cycle "$D6" 1 no Met
mk_cycle "$D6" 2 no Met
mk_cycle "$D6" 3 no NotMet
mk_cycle "$D6" 4 no NotMet
# Met=2, NotMet=2 → 50% < 70% → HOLD quality
OUT6=$(bash "$GATE" --tasks-dir "$D6" 2>&1)
RC6=$?
check_stdout "4 cycles, Met 50% → HOLD quality (exit 2)" 2 "$RC6" "HOLD" "$OUT6"
echo "$OUT6" | grep -qi "quality\|Quality" && echo "  PASS: quality keyword in output" && PASS=$((PASS+1)) || { echo "  FAIL: quality keyword missing from output"; FAIL=$((FAIL+1)); }

# --- Scenario 7: file with idempotentReconcile: in body but no frontmatter
#     status: Meta-Done must NOT be counted as a cycle → no data → HOLD -----
echo "--- Scenario 7: non-cycle file (body-only idempotentReconcile) → HOLD ---"
D7=$(mktemp -d); CLEANUP_DIRS+=("$D7")
mk_non_cycle "$D7" 1
mk_non_cycle "$D7" 2
mk_non_cycle "$D7" 3
OUT7=$(bash "$GATE" --tasks-dir "$D7" 2>&1)
RC7=$?
# evaluator_total should be 0 (non-cycle files ignored) → HOLD no_data
check_stdout "non-cycle files not counted → HOLD (exit 2)" 2 "$RC7" "HOLD" "$OUT7"
echo "$OUT7" | grep -qi "no data\|No data\|evaluator_total=0\|no evaluator" && echo "  PASS: no-data reason for non-cycle" && PASS=$((PASS+1)) || { echo "  FAIL: no-data reason expected for non-cycle"; FAIL=$((FAIL+1)); }

# --- Smoke test: report body always printed --------------------------------
echo "--- Smoke: report body produced ---"
OUT_SMOKE=$(bash "$GATE" --tasks-dir "$D1" 2>&1)
echo "$OUT_SMOKE" | grep -q "ROI Gate Measurement Report"
check "report body produced on PROCEED" 0 $?

# --- Smoke test: --emit-json writes provenance-stamped JSON ----------------
echo "--- Smoke: --emit-json ---"
D_EJ=$(mktemp -d); CLEANUP_DIRS+=("$D_EJ")
mk_cycle "$D_EJ" 1 no Met
mk_cycle "$D_EJ" 2 no Met
B_EJ=$(mktemp -d); CLEANUP_DIRS+=("$B_EJ")
J_EJ="$B_EJ/replan-stats.json"
bash "$GATE" --tasks-dir "$D_EJ" --emit-json "$J_EJ" >/dev/null 2>&1
grep -q '"generated_by": "scripts/check-roi-gate.sh"' "$J_EJ" 2>/dev/null && \
  grep -q '"data_source": "measured"' "$J_EJ" 2>/dev/null
check "--emit-json stamps generated_by + data_source" 0 $?
grep -q '"decision_reason"' "$J_EJ" 2>/dev/null
check "--emit-json includes decision_reason field" 0 $?
# verify-provenance smoke
bash "$SCRIPT_DIR/verify-provenance.sh" "$B_EJ" >/dev/null 2>&1
check "emitted baseline passes verify-provenance" 0 $?

echo ""
echo "check-roi-gate.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
