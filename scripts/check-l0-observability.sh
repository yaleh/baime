#!/usr/bin/env bash
# check-l0-observability.sh — audit L0 (loop-backlog) observability compliance.
#
# For each Done task, checks whether Implementation Notes contain:
#   G1: parseable DoD PASS/FAIL entries  (pattern: "DoD #N: PASS" or "DoD #N: FAIL")
#   G2: verifyDod attempt-count entries  (pattern: "DoD #N ✗ attempt" or "DoD #N attempt")
#
# Exits 0 always. Prints a summary report to stdout.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$(cd "$(dirname "$0")/.." && pwd)")"
TASKS_DIR="${REPO_ROOT}/backlog/tasks"
BASELINE_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

G1_PASS=0   # tasks with at least one "DoD #N: PASS" line
G1_FAIL=0   # tasks with at least one "DoD #N: FAIL" line
G1_ANY=0    # tasks with at least one DoD PASS or FAIL line
G2_ANY=0    # tasks with at least one attempt-count line
TOTAL=0

declare -a SAMPLED_IDS=()

# Find Done tasks
while IFS= read -r TASK_FILE; do
  # Extract task ID from filename
  BASENAME="$(basename "$TASK_FILE" .md)"
  TASK_ID="$(echo "$BASENAME" | grep -oP '^task-\d+' | tr 'a-z' 'A-Z' | sed 's/^TASK-/TASK-/' || true)"
  [ -z "$TASK_ID" ] && continue

  CONTENT="$(cat "$TASK_FILE" 2>/dev/null || true)"
  # Extract Implementation Notes section
  NOTES="$(echo "$CONTENT" | awk '/^## Implementation Notes/,0' | tail -n +2 || true)"

  HAS_PASS=false
  HAS_FAIL=false
  HAS_ATTEMPT=false

  if echo "$NOTES" | grep -qP 'DoD #\d+: PASS'; then HAS_PASS=true; fi
  if echo "$NOTES" | grep -qP 'DoD #\d+: FAIL'; then HAS_FAIL=true; fi
  if echo "$NOTES" | grep -qP 'DoD #\d+ (✗ )?attempt'; then HAS_ATTEMPT=true; fi

  TOTAL=$((TOTAL + 1))
  [ "$HAS_PASS" = "true" ] && G1_PASS=$((G1_PASS + 1))
  [ "$HAS_FAIL" = "true" ] && G1_FAIL=$((G1_FAIL + 1))
  if [ "$HAS_PASS" = "true" ] || [ "$HAS_FAIL" = "true" ]; then G1_ANY=$((G1_ANY + 1)); fi
  [ "$HAS_ATTEMPT" = "true" ] && G2_ANY=$((G2_ANY + 1))

  SAMPLED_IDS+=("$TASK_ID")
done < <(grep -rl "^status: Done" "$TASKS_DIR" 2>/dev/null | sort)

echo "============================================================"
echo " L0 Observability Audit Report"
echo " Generated: ${BASELINE_TS}"
echo "============================================================"
echo ""
echo " Tasks sampled (Done status): ${TOTAL}"
echo ""
echo " G1 — DoD PASS/FAIL notes"
echo "   Tasks with ≥1 DoD PASS note:  ${G1_PASS} / ${TOTAL}"
echo "   Tasks with ≥1 DoD FAIL note:  ${G1_FAIL} / ${TOTAL}"
echo "   Tasks with ≥1 DoD PASS or FAIL: ${G1_ANY} / ${TOTAL}"
echo ""
echo " G2 — verifyDod attempt-count notes"
echo "   Tasks with ≥1 attempt note:   ${G2_ANY} / ${TOTAL}"
echo ""

if [ "$TOTAL" -eq 0 ]; then
  echo " NOTE: No Done tasks found — nothing to audit."
  echo ""
elif [ "$G1_ANY" -eq 0 ] && [ "$G2_ANY" -eq 0 ]; then
  echo " NOTE: 历史任务无可用记录——格式改动将从此次后生效"
  echo "       (Historical tasks have no parseable DoD/attempt records."
  echo "        The new format takes effect from this change onward.)"
  echo ""
else
  echo " Compliance:"
  if [ "$G1_ANY" -gt 0 ]; then
    echo "   G1: PARTIAL — ${G1_ANY}/${TOTAL} tasks have parseable DoD notes"
  else
    echo "   G1: ABSENT  — no tasks have parseable DoD notes (pre-format-change baseline)"
  fi
  if [ "$G2_ANY" -gt 0 ]; then
    echo "   G2: PARTIAL — ${G2_ANY}/${TOTAL} tasks have attempt-count notes"
  else
    echo "   G2: ABSENT  — no tasks have attempt-count notes (pre-format-change baseline)"
  fi
  echo ""
fi

echo " Sampled task IDs: ${SAMPLED_IDS[*]:-none}"
echo ""
echo "============================================================"
echo " Gate result: PASS (audit completed; new format active from TASK-85)"
echo "============================================================"
