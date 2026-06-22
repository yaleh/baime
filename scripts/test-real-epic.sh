#!/usr/bin/env bash
# TDD test: logs/exp-k-real-epic.log must contain a real terminal marker (not STUB)
set -euo pipefail
FAIL=0

LOG="logs/exp-k-real-epic.log"

if [ ! -f "$LOG" ]; then
  echo "FAIL: $LOG does not exist"
  exit 1
fi

# Must have terminal:TASK-<number> (not STUB)
if ! grep -qE 'terminal:TASK-[0-9]+' "$LOG"; then
  echo "FAIL Test 1: no real terminal:TASK-N marker in $LOG"
  FAIL=1
else
  echo "PASS Test 1: real terminal marker found"
fi

# Must NOT have STUB content
if grep -q 'STUB' "$LOG"; then
  echo "FAIL Test 2: STUB content still present in $LOG"
  FAIL=1
else
  echo "PASS Test 2: no STUB content"
fi

# Must record the epic task ID
if ! grep -qE 'epic_task:TASK-[0-9]+' "$LOG"; then
  echo "FAIL Test 3: no epic_task:TASK-N identifier in $LOG"
  FAIL=1
else
  echo "PASS Test 3: epic_task identifier found"
fi

# Must record at least one child task
if ! grep -qE 'child_task:TASK-[0-9]+' "$LOG"; then
  echo "FAIL Test 4: no child_task:TASK-N record in $LOG"
  FAIL=1
else
  echo "PASS Test 4: child task recorded"
fi

if [ "$FAIL" -eq 0 ]; then
  echo "ALL TESTS PASSED"
  exit 0
else
  echo "TESTS FAILED"
  exit 1
fi
