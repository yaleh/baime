#!/usr/bin/env bash
# expect.sh <fixture-repo-dir>
# Pure shell assertions — no LLM calls.
set -euo pipefail
FIXTURE_DIR="${1:-$(pwd)}"
cd "$FIXTURE_DIR"

PASS=0
FAIL=0

check() {
  local desc="$1"; shift
  if eval "$@"; then
    echo "PASS: $desc"
    ((PASS++))
  else
    echo "FAIL: $desc"
    ((FAIL++))
  fi
}

# Assertion 1: TASK-1 reached Basic: Done
TASK_FILE=$(ls backlog/tasks/task-1-*.md 2>/dev/null | head -1)
check "TASK-1 status is Basic: Done" \
  "[[ -n '${TASK_FILE}' ]] && grep -q 'status: Basic: Done' '${TASK_FILE}'"

# Assertion 2: at least one commit beyond the setup commit
check "at least 2 commits in fixture repo" \
  "[[ \$(git log --oneline | wc -l) -ge 2 ]]"

# Assertion 3: no task stuck at Basic: In Progress
check "no task stuck at Basic: In Progress" \
  "! grep -r 'status: Basic: In Progress' backlog/tasks/ 2>/dev/null"

echo "---"
echo "Results: ${PASS} passed, ${FAIL} failed"
[[ $FAIL -eq 0 ]]
