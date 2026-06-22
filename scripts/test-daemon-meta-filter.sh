#!/usr/bin/env bash
# test-daemon-meta-filter.sh — unit tests for daemon Meta-lane routing.
#
# Creates a temporary tasks directory with fixture files, runs the daemon
# briefly, then asserts that:
#   - Meta-Plan tasks produce  meta-ready:TASK-N  (NOT task-ready)
#   - Ready tasks produce      task-ready:TASK-N  (NOT meta-ready)
#   - Meta-Active tasks produce neither event
#
# Exits 0 on all assertions pass, 1 on any failure.

set -euo pipefail

DAEMON="${BASH_SOURCE[0]%/*}/loop-backlog-daemon.js"
PASS=0
FAIL=0

assert() {
  local desc="$1" result="$2" expected="$3"
  if [ "$result" = "$expected" ]; then
    echo "  ✓ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $desc"
    echo "      expected: $expected"
    echo "      got:      $result"
    FAIL=$((FAIL + 1))
  fi
}

# --- Setup temp environment ---
TMPDIR_BASE="$(mktemp -d)"
TASKS_DIR="${TMPDIR_BASE}/tasks"
PID_FILE="${TMPDIR_BASE}/daemon.pid"
STOP_FILE="${TMPDIR_BASE}/loop-stop"
OUT_FILE="${TMPDIR_BASE}/daemon.out"
mkdir -p "$TASKS_DIR"

cleanup() {
  # Kill daemon if still running
  if [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
  fi
  rm -rf "$TMPDIR_BASE"
}
trap cleanup EXIT

# --- Write fixture tasks ---
# TASK-1: Meta-Plan  → should produce meta-ready (not task-ready)
cat > "${TASKS_DIR}/task-1 - meta-plan-task.md" << 'MD'
# Task
status: Meta-Plan
Title: Meta planning task
MD

# TASK-2: Ready → should produce task-ready (not meta-ready)
cat > "${TASKS_DIR}/task-2 - ready-task.md" << 'MD'
# Task
status: Ready
Title: Normal ready task
MD

# TASK-3: Meta-Active → should produce neither event
cat > "${TASKS_DIR}/task-3 - meta-active-task.md" << 'MD'
# Task
status: Meta-Active
Title: Meta active task (already running)
MD

# TASK-4: Meta-Proposal → should produce meta-ready (not task-ready)
cat > "${TASKS_DIR}/task-4 - meta-proposal-task.md" << 'MD'
# Task
status: Meta-Proposal
Title: Meta proposal task
MD

# TASK-5: Done → should produce neither event
cat > "${TASKS_DIR}/task-5 - done-task.md" << 'MD'
# Task
status: Done
Title: Already done
MD

# --- Start daemon with short interval ---
node "$DAEMON" \
  --tasks-dir "$TASKS_DIR" \
  --pid-file  "$PID_FILE"  \
  --stop-file "$STOP_FILE" \
  --interval  0.1 \
  > "$OUT_FILE" 2>/dev/null &

# Wait for daemon to start (poll for PID file)
for i in $(seq 1 30); do [ -f "$PID_FILE" ] && break; sleep 0.1; done

# Let it run for a couple poll cycles
sleep 0.5

# Stop daemon gracefully
touch "$STOP_FILE"
sleep 0.3

# Read output
OUTPUT="$(cat "$OUT_FILE")"

# --- Assertions ---
echo "meta-ready routing:"
assert "TASK-1 (Meta-Plan) → meta-ready" \
  "$(echo "$OUTPUT" | grep -c 'meta-ready:TASK-1' || true)" "1"
assert "TASK-1 (Meta-Plan) → NOT task-ready" \
  "$(echo "$OUTPUT" | grep -c 'task-ready:TASK-1' || true)" "0"

assert "TASK-4 (Meta-Proposal) → meta-ready" \
  "$(echo "$OUTPUT" | grep -c 'meta-ready:TASK-4' || true)" "1"
assert "TASK-4 (Meta-Proposal) → NOT task-ready" \
  "$(echo "$OUTPUT" | grep -c 'task-ready:TASK-4' || true)" "0"

echo "task-ready routing:"
assert "TASK-2 (Ready) → task-ready" \
  "$(echo "$OUTPUT" | grep -c 'task-ready:TASK-2' || true)" "1"
assert "TASK-2 (Ready) → NOT meta-ready" \
  "$(echo "$OUTPUT" | grep -c 'meta-ready:TASK-2' || true)" "0"

echo "silent tasks (no events):"
assert "TASK-3 (Meta-Active) → NOT meta-ready" \
  "$(echo "$OUTPUT" | grep -c 'meta-ready:TASK-3' || true)" "0"
assert "TASK-3 (Meta-Active) → NOT task-ready" \
  "$(echo "$OUTPUT" | grep -c 'task-ready:TASK-3' || true)" "0"

assert "TASK-5 (Done) → no event" \
  "$(echo "$OUTPUT" | grep -cE 'TASK-5' || true)" "0"

echo ""
echo "${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
