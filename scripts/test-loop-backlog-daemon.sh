#!/bin/bash
# Tests for scripts/loop-backlog-daemon.py
# Must be run from repo root.

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
DAEMON="$REPO_ROOT/scripts/loop-backlog-daemon.py"
TASKS_DIR=$(mktemp -d)
PID_FILE="$TASKS_DIR/.daemon.pid"
STOP_FILE="$TASKS_DIR/.loop-stop"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; exit 1; }

cleanup() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE" 2>/dev/null || true)
        [ -n "$PID" ] && kill "$PID" 2>/dev/null || true
    fi
    rm -rf "$TASKS_DIR"
}
trap cleanup EXIT

# Helper: create a minimal task file
make_task() {
    local id="$1" status="$2"
    cat > "$TASKS_DIR/${id}.md" <<EOF
# Task ${id}

Status: ${status}
EOF
}

# ── test_daemon_writes_pid_file ──────────────────────────────────────────────
test_daemon_writes_pid_file() {
    rm -f "$PID_FILE"
    python3 "$DAEMON" --tasks-dir "$TASKS_DIR" --pid-file "$PID_FILE" \
        --stop-file "$STOP_FILE" --interval 0.1 >/dev/null 2>&1 &
    sleep 0.4
    [ -f "$PID_FILE" ] || fail "test_daemon_writes_pid_file: pid file not created"
    PID=$(cat "$PID_FILE")
    [[ "$PID" =~ ^[0-9]+$ ]] || fail "test_daemon_writes_pid_file: pid not numeric (got '$PID')"
    kill "$PID" 2>/dev/null || true
    sleep 0.3
    pass "test_daemon_writes_pid_file"
}

# ── test_daemon_emits_task_ready_line ────────────────────────────────────────
test_daemon_emits_task_ready_line() {
    make_task TASK-1 "Ready"
    OUT_FILE=$(mktemp)
    python3 "$DAEMON" --tasks-dir "$TASKS_DIR" --pid-file "$PID_FILE" \
        --stop-file "$STOP_FILE" --interval 0.1 >"$OUT_FILE" 2>/dev/null &
    sleep 0.6
    PID=$(cat "$PID_FILE" 2>/dev/null || true)
    [ -n "$PID" ] && kill "$PID" 2>/dev/null || true
    sleep 0.3
    grep -q "task-ready:TASK-1" "$OUT_FILE" \
        || fail "test_daemon_emits_task_ready_line: no task-ready line in output (got: $(cat "$OUT_FILE"))"
    rm -f "$OUT_FILE" "$TASKS_DIR/TASK-1.md"
    pass "test_daemon_emits_task_ready_line"
}

# ── test_daemon_debounces_repeated_ready ─────────────────────────────────────
test_daemon_debounces_repeated_ready() {
    make_task TASK-2 "Ready"
    OUT_FILE=$(mktemp)
    python3 "$DAEMON" --tasks-dir "$TASKS_DIR" --pid-file "$PID_FILE" \
        --stop-file "$STOP_FILE" --interval 0.1 >"$OUT_FILE" 2>/dev/null &
    sleep 0.8
    PID=$(cat "$PID_FILE" 2>/dev/null || true)
    [ -n "$PID" ] && kill "$PID" 2>/dev/null || true
    sleep 0.3
    COUNT=$(grep -c "task-ready:TASK-2" "$OUT_FILE" || true)
    [ "$COUNT" -eq 1 ] \
        || fail "test_daemon_debounces_repeated_ready: expected 1 emission, got $COUNT"
    rm -f "$OUT_FILE" "$TASKS_DIR/TASK-2.md"
    pass "test_daemon_debounces_repeated_ready"
}

# ── test_daemon_re_emits_after_status_reset ──────────────────────────────────
test_daemon_re_emits_after_status_reset() {
    make_task TASK-3 "Ready"
    OUT_FILE=$(mktemp)
    python3 "$DAEMON" --tasks-dir "$TASKS_DIR" --pid-file "$PID_FILE" \
        --stop-file "$STOP_FILE" --interval 0.1 >"$OUT_FILE" 2>/dev/null &
    sleep 0.5
    # flip to non-Ready
    make_task TASK-3 "In Progress"
    sleep 0.3
    # flip back to Ready
    make_task TASK-3 "Ready"
    sleep 0.5
    PID=$(cat "$PID_FILE" 2>/dev/null || true)
    [ -n "$PID" ] && kill "$PID" 2>/dev/null || true
    sleep 0.3
    COUNT=$(grep -c "task-ready:TASK-3" "$OUT_FILE" || true)
    [ "$COUNT" -ge 2 ] \
        || fail "test_daemon_re_emits_after_status_reset: expected >=2 emissions, got $COUNT"
    rm -f "$OUT_FILE" "$TASKS_DIR/TASK-3.md"
    pass "test_daemon_re_emits_after_status_reset"
}

# ── test_daemon_stops_on_sentinel ────────────────────────────────────────────
test_daemon_stops_on_sentinel() {
    python3 "$DAEMON" --tasks-dir "$TASKS_DIR" --pid-file "$PID_FILE" \
        --stop-file "$STOP_FILE" --interval 0.1 >/dev/null 2>/dev/null &
    sleep 0.4
    PID=$(cat "$PID_FILE" 2>/dev/null || true)
    touch "$STOP_FILE"
    sleep 0.5
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null || true
        fail "test_daemon_stops_on_sentinel: daemon still running after sentinel"
    fi
    rm -f "$STOP_FILE"
    pass "test_daemon_stops_on_sentinel"
}

# ── test_daemon_removes_pid_on_exit ──────────────────────────────────────────
test_daemon_removes_pid_on_exit() {
    python3 "$DAEMON" --tasks-dir "$TASKS_DIR" --pid-file "$PID_FILE" \
        --stop-file "$STOP_FILE" --interval 0.1 >/dev/null 2>/dev/null &
    sleep 0.4
    PID=$(cat "$PID_FILE" 2>/dev/null || true)
    touch "$STOP_FILE"
    sleep 0.5
    [ ! -f "$PID_FILE" ] \
        || fail "test_daemon_removes_pid_on_exit: pid file still exists after exit"
    [ -n "$PID" ] && kill "$PID" 2>/dev/null || true
    rm -f "$STOP_FILE"
    pass "test_daemon_removes_pid_on_exit"
}

echo "=== loop-backlog-daemon tests ==="
test_daemon_writes_pid_file
test_daemon_emits_task_ready_line
test_daemon_debounces_repeated_ready
test_daemon_re_emits_after_status_reset
test_daemon_stops_on_sentinel
test_daemon_removes_pid_on_exit
echo "=== All tests passed ==="
