#!/usr/bin/env bash
# feature-to-backlog.test.sh — unit tests for feature-to-backlog branching logic
# Tests pure logic patterns extracted from the skill spec (no LLM calls, no network).
set -uo pipefail

PASS=0
FAIL=0

check() {
  local label="$1"
  if eval "$2"; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label"
    FAIL=$((FAIL + 1))
  fi
}

# ── Pure logic helpers (replicate the skill's branching logic) ─────────────────

# isTaskId: matches TASK-<digits> case-insensitively
isTaskId() {
  echo "$1" | grep -qiE '^task-[0-9]+$'
}

# fromStatus: maps basic task status → entry point name
fromStatus() {
  case "$1" in
    "Basic: Plan") echo "PlanLoop" ;;
    *)             echo "ProposalLoop" ;;
  esac
}

# resolveOrCreate: returns the entry point path chosen
resolveOrCreate() {
  local topic="$1"
  if isTaskId "$topic"; then
    echo "resolveExisting"
  else
    echo "createTask"
  fi
}

# approvalRoundCounter: simulates advancing through MaxRound rounds
# Returns the final round number reached when loop terminates
runRounds() {
  local max_round="$1"
  local round=0
  while [ "$round" -lt "$max_round" ]; do
    round=$((round + 1))
  done
  echo "$round"
}

# ── Test group 1: isTaskId routing ───────────────────────────────────────────

check "TASK-1 → resolveExisting path" \
  '[ "$(resolveOrCreate TASK-1)" = "resolveExisting" ]'

check "TASK-93 → resolveExisting path" \
  '[ "$(resolveOrCreate TASK-93)" = "resolveExisting" ]'

check "free-form description → createTask path" \
  '[ "$(resolveOrCreate "add OAuth login")" = "createTask" ]'

check "partial TASK prefix with text → createTask path" \
  '[ "$(resolveOrCreate "TASK-5 cleanup")" = "createTask" ]'

# ── Test group 2: isTaskId pattern matching ───────────────────────────────────

check "TASK-7 matches isTaskId" \
  'isTaskId "TASK-7"'

check "TASK-144 matches isTaskId" \
  'isTaskId "TASK-144"'

check "task-12 (lowercase) matches isTaskId (case-insensitive)" \
  'isTaskId "task-12"'

check "Task-5 (mixed case) matches isTaskId" \
  'isTaskId "Task-5"'

check "empty string does NOT match isTaskId" \
  '! isTaskId ""'

check "bare number does NOT match isTaskId" \
  '! isTaskId "144"'

# ── Test group 3: fromStatus mapping ─────────────────────────────────────────

check "Basic: Plan → PlanLoop" \
  '[ "$(fromStatus "Basic: Plan")" = "PlanLoop" ]'

check "Basic: Proposal → ProposalLoop" \
  '[ "$(fromStatus "Basic: Proposal")" = "ProposalLoop" ]'

check "Basic: Backlog → ProposalLoop" \
  '[ "$(fromStatus "Basic: Backlog")" = "ProposalLoop" ]'

check "Basic: In Progress → ProposalLoop" \
  '[ "$(fromStatus "Basic: In Progress")" = "ProposalLoop" ]'

# ── Test group 4: approval-round counting ────────────────────────────────────

check "round counter starts at 0, terminates at MaxRound=1" \
  '[ "$(runRounds 1)" = "1" ]'

check "round counter reaches MaxRound=3 correctly" \
  '[ "$(runRounds 3)" = "3" ]'

check "round 1 → round 2 → round 3 sequence (MaxRound=3)" \
  '[[ "$(runRounds 3)" -eq 3 ]]'

check "MaxRound=8 terminates at 8 (reviewLoop bound)" \
  '[ "$(runRounds 8)" = "8" ]'

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "feature-to-backlog.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
