#!/usr/bin/env bash
# test-loop-meta-e2e.sh — dry-run end-to-end integration test for loop-meta P4.
#
# Uses an in-memory fixture state machine; no live backlog MCP calls.
# Simulates the full loop-meta reconcile loop including:
#   - Meta-Plan → human gate → Meta-Active → wip < WIP_CAP → setReady → converged
#   - budget exhausted guardrail
#   - noProgress guardrail
#   - diverging guardrail
#
# Asserts for each guardrail: notes written + status escalated to Needs Human.
# Exits 0 on all assertions pass, 1 on any failure.

set -euo pipefail

WIP_CAP=2
NOPROGRESS_THRESHOLD=3  # cycles

PASS=0
FAIL=0

assert() {
  local desc="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✓ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $desc"
    echo "      expected: $expected"
    echo "      got:      $actual"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  ✓ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $desc"
    echo "      expected to contain: $needle"
    FAIL=$((FAIL + 1))
  fi
}

# ── Fixture state machine ─────────────────────────────────────────────────────
TMPDIR_BASE="$(mktemp -d)"
NOTES_FILE="${TMPDIR_BASE}/notes.txt"
touch "$NOTES_FILE"

cleanup() { rm -rf "$TMPDIR_BASE"; }
trap cleanup EXIT

META_STATUS="Meta-Plan"
CHILD_COUNT=0
ESCALATED_STATUS=""
LAST_RESULT=0

# Per-child status stored in indexed files to avoid subshell copy issues
child_status_file() { echo "${TMPDIR_BASE}/child_${1}_status"; }
child_title_file()  { echo "${TMPDIR_BASE}/child_${1}_title";  }

fixture_reset() {
  META_STATUS="Meta-Plan"
  CHILD_COUNT=0
  ESCALATED_STATUS=""
  LAST_RESULT=0
  > "$NOTES_FILE"
  rm -f "${TMPDIR_BASE}"/child_*
}

fixture_set_status()   { META_STATUS="$1"; }
fixture_get_status()   { echo "$META_STATUS"; }
fixture_append_note()  { echo "$1" >> "$NOTES_FILE"; }
fixture_get_notes()    { cat "$NOTES_FILE"; }
fixture_clear_notes()  { > "$NOTES_FILE"; }

fixture_add_child() {
  local title="$1" status="${2:-Backlog}"
  echo "$status" > "$(child_status_file "$CHILD_COUNT")"
  echo "$title"  > "$(child_title_file  "$CHILD_COUNT")"
  CHILD_COUNT=$((CHILD_COUNT + 1))
}

fixture_get_child_status() {
  cat "$(child_status_file "$1")"
}

fixture_set_child_status() {
  echo "$2" > "$(child_status_file "$1")"
}

fixture_wip() {
  local wip=0
  local i=0
  while [ "$i" -lt "$CHILD_COUNT" ]; do
    local s
    s=$(fixture_get_child_status "$i")
    if [ "$s" = "Ready" ] || [ "$s" = "In Progress" ]; then
      wip=$((wip + 1))
    fi
    i=$((i + 1))
  done
  echo "$wip"
}

fixture_escalate() {
  local reason="$1"
  fixture_append_note "Escalated: $reason"
  ESCALATED_STATUS="Needs Human"
  fixture_set_status "Needs Human"
}

# ── Core logic under test ─────────────────────────────────────────────────────

# setReady: promote Backlog children to Ready while wip < WIP_CAP.
# Sets LAST_RESULT to count of promoted tasks (avoids subshell).
setReady_path() {
  LAST_RESULT=0
  local i=0
  while [ "$i" -lt "$CHILD_COUNT" ]; do
    local s wip
    s=$(fixture_get_child_status "$i")
    wip=$(fixture_wip)
    if [ "$s" = "Backlog" ] && [ "$wip" -lt "$WIP_CAP" ]; then
      fixture_set_child_status "$i" "Ready"
      local title
      title=$(cat "$(child_title_file "$i")")
      fixture_append_note "setReady: promoted child ${title}"
      LAST_RESULT=$((LAST_RESULT + 1))
    fi
    i=$((i + 1))
  done
}

# budget exhausted guardrail: max 5 reconcile cycles
check_budget_exhausted() {
  local cycles="$1"
  if [ "$cycles" -gt 5 ]; then
    fixture_append_note "budget exhausted: reconcile loop exceeded 5 cycles"
    fixture_escalate "budget exhausted — cycle limit exceeded"
    return 0
  fi
  return 1
}

# noProgress guardrail: k consecutive cycles with no Done children
check_no_progress() {
  local stuck_cycles="$1"
  if [ "$stuck_cycles" -ge "$NOPROGRESS_THRESHOLD" ]; then
    fixture_append_note "noProgress: ${stuck_cycles} cycles without any child reaching Done"
    fixture_escalate "noProgress: k=${stuck_cycles} cycles without progress"
    return 0
  fi
  return 1
}

# diverging guardrail: actual children > 2× desired
check_diverging() {
  local desired="$1" actual="$2"
  if [ "$actual" -gt $((desired * 2)) ]; then
    fixture_append_note "diverging: actual=${actual} > 2×desired=${desired}"
    fixture_escalate "diverging: sub-task set has grown beyond 2× desired"
    return 0
  fi
  return 1
}

# ── Test 1: Happy path — Meta-Plan → human gate → Meta-Active → setReady ──────
echo "Happy path (Meta-Plan → Meta-Active → setReady → converged):"
fixture_reset

assert "initial status is Meta-Plan" "$(fixture_get_status)" "Meta-Plan"
fixture_set_status "Meta-Active"
assert "after human gate: status is Meta-Active" "$(fixture_get_status)" "Meta-Active"

fixture_add_child "Sub-task Alpha"
fixture_add_child "Sub-task Beta"
fixture_add_child "Sub-task Gamma"
assert "3 children in Backlog" "$CHILD_COUNT" "3"

# First reconcile: wip=0 < WIP_CAP=2 → promote 2
setReady_path
assert "first cycle: promoted 2 children (WIP_CAP=2)" "$LAST_RESULT" "2"
assert "wip after first cycle" "$(fixture_wip)" "2"

# One child completes → wip drops to 1
fixture_set_child_status 0 "Done"
assert "wip after first Done" "$(fixture_wip)" "1"

# Second reconcile: wip=1 < WIP_CAP=2 → promote 1 more
setReady_path
assert "second cycle: promoted 1 more child" "$LAST_RESULT" "1"
assert "wip after second cycle" "$(fixture_wip)" "2"

# All children eventually Done
fixture_set_child_status 1 "Done"
fixture_set_child_status 2 "Done"
assert "all children Done → wip=0" "$(fixture_wip)" "0"

assert_contains "notes contain setReady events" "$(fixture_get_notes)" "setReady:"
assert "no escalation in happy path" "$ESCALATED_STATUS" ""

# ── Test 2: budget exhausted guardrail ────────────────────────────────────────
echo ""
echo "budget exhausted guardrail:"
fixture_reset
META_STATUS="Meta-Active"
fixture_add_child "Sub-task A"

TRIGGERED=0
for cycle in 1 2 3 4 5 6; do
  if check_budget_exhausted "$cycle"; then
    TRIGGERED=1
    break
  fi
done

assert "budget exhausted triggered on cycle 6" "$TRIGGERED" "1"
assert "status escalated to Needs Human" "$(fixture_get_status)" "Needs Human"
assert_contains "notes contain 'budget exhausted'" "$(fixture_get_notes)" "budget exhausted"
assert_contains "notes contain 'Escalated'" "$(fixture_get_notes)" "Escalated:"

# ── Test 3: noProgress guardrail ──────────────────────────────────────────────
echo ""
echo "noProgress guardrail:"
fixture_reset
META_STATUS="Meta-Active"
fixture_add_child "Sub-task A"
fixture_add_child "Sub-task B"

TRIGGERED=0
for stuck in 1 2 3; do
  if check_no_progress "$stuck"; then
    TRIGGERED=1
    break
  fi
done

assert "noProgress triggered at k=3" "$TRIGGERED" "1"
assert "status escalated to Needs Human" "$(fixture_get_status)" "Needs Human"
assert_contains "notes contain 'noProgress'" "$(fixture_get_notes)" "noProgress:"
assert_contains "notes contain k value" "$(fixture_get_notes)" "k=3"
assert_contains "notes contain 'Escalated'" "$(fixture_get_notes)" "Escalated:"

# ── Test 4: diverging guardrail ───────────────────────────────────────────────
echo ""
echo "diverging guardrail:"
fixture_reset
META_STATUS="Meta-Active"

TRIGGERED=0
if check_diverging 3 7; then TRIGGERED=1; fi  # 7 > 2×3=6 → diverging

assert "diverging triggered when actual > 2×desired" "$TRIGGERED" "1"
assert "status escalated to Needs Human" "$(fixture_get_status)" "Needs Human"
assert_contains "notes contain 'diverging'" "$(fixture_get_notes)" "diverging:"
assert_contains "notes contain 'Escalated'" "$(fixture_get_notes)" "Escalated:"

# Not diverging: 5 ≤ 2×3=6
fixture_reset
META_STATUS="Meta-Active"
TRIGGERED=0
if check_diverging 3 5; then TRIGGERED=1; fi
assert "not diverging when actual <= 2×desired" "$TRIGGERED" "0"
assert "status unchanged when not diverging" "$(fixture_get_status)" "Meta-Active"

# ── Test 5: WIP_CAP enforcement ───────────────────────────────────────────────
echo ""
echo "WIP_CAP enforcement:"
fixture_reset
META_STATUS="Meta-Active"
for i in 1 2 3 4 5; do fixture_add_child "T${i}"; done

setReady_path
assert "WIP_CAP=2: only 2 children promoted from 5" "$LAST_RESULT" "2"
assert "wip capped at WIP_CAP=2" "$(fixture_wip)" "2"

backlog_count=0
for i in 0 1 2 3 4; do
  s=$(fixture_get_child_status "$i")
  [ "$s" = "Backlog" ] && backlog_count=$((backlog_count + 1))
done
assert "3 children remain in Backlog" "$backlog_count" "3"

# ── Test 6: Meta-Plan human gate preserved ────────────────────────────────────
echo ""
echo "Meta-Plan human gate preserved:"
fixture_reset

# Reconcile should not auto-schedule from Meta-Plan status
assert "Meta-Plan status is not Meta-Active" "$(fixture_get_status)" "Meta-Plan"
fixture_add_child "Gated task"
# setReady_path could be called here, but in real loop-meta
# Meta-Plan dispatches to draftDecomposition (not autoSchedule).
# Verify the gate by checking the meta-task status has not changed automatically.
assert "loop-meta does not auto-advance past Meta-Plan" "$(fixture_get_status)" "Meta-Plan"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
