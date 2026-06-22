#!/usr/bin/env bash
# epic-to-backlog.test.sh — unit tests for epic-to-backlog branching logic
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

# fromStatus: maps epic status → entry point name
fromStatus() {
  case "$1" in
    "Epic: Plan") echo "PlanLoop" ;;
    *)            echo "ProposalLoop" ;;
  esac
}

# resolveOrCreate: returns the entry point path chosen
resolveOrCreate() {
  local topic="$1"
  if isTaskId "$topic"; then
    echo "resolveOrCreate"
  else
    echo "createTask"
  fi
}

# manifest validation: resolveOrCreate path requires skip_draft=true
validateManifest() {
  local entry_point="$1" skip_draft="$2"
  if [ "$entry_point" = "resolveOrCreate" ] && [ "$skip_draft" != "true" ]; then
    echo "invalid"
  else
    echo "valid"
  fi
}

# ── Test group 1: isTaskId routing ────────────────────────────────────────────

check "TASK-12 → resolveOrCreate path" \
  '[ "$(resolveOrCreate TASK-12)" = "resolveOrCreate" ]'

check "TASK-999 → resolveOrCreate path" \
  '[ "$(resolveOrCreate TASK-999)" = "resolveOrCreate" ]'

check "free-form description → createTask path" \
  '[ "$(resolveOrCreate "add user authentication")" = "createTask" ]'

check "TASK-12 prefix with extra text → createTask path" \
  '[ "$(resolveOrCreate "TASK-12 add feature")" = "createTask" ]'

# ── Test group 2: isTaskId pattern matching ───────────────────────────────────

check "TASK-1 matches isTaskId" \
  'isTaskId "TASK-1"'

check "TASK-100 matches isTaskId" \
  'isTaskId "TASK-100"'

check "task-12 (lowercase) matches isTaskId (case-insensitive)" \
  'isTaskId "task-12"'

check "empty string does NOT match isTaskId" \
  '! isTaskId ""'

check "plain text does NOT match isTaskId" \
  '! isTaskId "fix the login bug"'

check "TASK- with no digits does NOT match isTaskId" \
  '! isTaskId "TASK-"'

# ── Test group 3: fromStatus mapping ─────────────────────────────────────────

check "Epic: Plan → PlanLoop" \
  '[ "$(fromStatus "Epic: Plan")" = "PlanLoop" ]'

check "Epic: Proposal → ProposalLoop" \
  '[ "$(fromStatus "Epic: Proposal")" = "ProposalLoop" ]'

check "Epic: Backlog → ProposalLoop" \
  '[ "$(fromStatus "Epic: Backlog")" = "ProposalLoop" ]'

check "Epic: Awaiting Children → ProposalLoop" \
  '[ "$(fromStatus "Epic: Awaiting Children")" = "ProposalLoop" ]'

# ── Test group 4: manifest validation ────────────────────────────────────────

check "resolveOrCreate + skip_draft=true → valid" \
  '[ "$(validateManifest resolveOrCreate true)" = "valid" ]'

check "resolveOrCreate + skip_draft=false → invalid" \
  '[ "$(validateManifest resolveOrCreate false)" = "invalid" ]'

check "createTask + skip_draft=false → valid" \
  '[ "$(validateManifest createTask false)" = "valid" ]'

check "createTask + skip_draft=true → valid" \
  '[ "$(validateManifest createTask true)" = "valid" ]'

# premise-ledger spec assertions (TASK-151)
[ $(grep -c 'premise-ledger' plugin/skills/epic-to-backlog/SKILL.md) -ge 2 ] \
  || { echo "FAIL: premise-ledger must appear ≥2 times in etb SKILL.md"; exit 1; }
grep -q 'GCL-self-report' plugin/skills/epic-to-backlog/SKILL.md \
  || { echo "FAIL: GCL-self-report not found in etb SKILL.md"; exit 1; }
grep -q '靠背景' plugin/skills/epic-to-backlog/SKILL.md \
  || { echo "FAIL: H-type definition (靠背景) not found in etb SKILL.md"; exit 1; }

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "epic-to-backlog.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
