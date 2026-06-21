#!/usr/bin/env bash
# daemon-status.sh — B″ daemon observability.
# Reports liveness, last event, and log freshness for the basic and epic pollers.
#
# Usage:
#   daemon-status.sh           Report status for both daemons (always exit 0).
#   daemon-status.sh --check   Exit non-zero if any daemon is STALE
#                              (pid file present but process dead) and print a
#                              restart hint. Use in health checks / CI.
set -u

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
BACKLOG_DIR="${REPO_ROOT}/backlog"

CHECK_MODE=0
[ "${1:-}" = "--check" ] && CHECK_MODE=1

# daemon name | pid file | log file | restart command
# Unified B″ poller (basic-daemon.js) emits all three channels (basic-ready / epic-ready /
# child-done); the former separate epic-daemon was removed in the unified-worker refactor.
DAEMONS=(
  "unified|${BACKLOG_DIR}/.basic-daemon.pid|${BACKLOG_DIR}/.basic-daemon.log|node scripts/basic-daemon.js"
)

STALE_FOUND=0

echo "=== B″ daemon status ==="
for entry in "${DAEMONS[@]}"; do
  IFS='|' read -r name pidfile logfile restart <<< "$entry"

  if [ ! -f "$pidfile" ]; then
    printf '%-6s DOWN     (no pid file)\n' "$name"
    continue
  fi

  pid=$(cat "$pidfile" 2>/dev/null | tr -d '[:space:]')
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    state="RUNNING  pid=$pid"
  else
    state="STALE    pid=${pid:-?} (pid file present, process dead)"
    STALE_FOUND=1
  fi

  # last event line + log freshness
  last_event="(no log)"
  log_age="-"
  if [ -f "$logfile" ]; then
    le=$(grep -E '(basic|epic)-ready:|child-done:|terminal:' "$logfile" 2>/dev/null | tail -1)
    [ -n "$le" ] && last_event="$le"
    if mtime=$(stat -c %Y "$logfile" 2>/dev/null); then
      now=$(date +%s)
      log_age="$(( (now - mtime) ))s ago"
    fi
  fi

  printf '%-6s %s\n' "$name" "$state"
  printf '       last-event: %s\n' "$last_event"
  printf '       log:        %s (updated %s)\n' "$logfile" "$log_age"

  if [ "$CHECK_MODE" -eq 1 ] && echo "$state" | grep -q STALE; then
    printf '       restart:    rm -f %s && nohup %s &\n' "$pidfile" "$restart"
  fi
done

if [ "$CHECK_MODE" -eq 1 ] && [ "$STALE_FOUND" -eq 1 ]; then
  echo "=== one or more daemons STALE — see restart hints above ==="
  exit 1
fi

exit 0
