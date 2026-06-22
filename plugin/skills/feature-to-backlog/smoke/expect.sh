#!/usr/bin/env bash
# expect.sh <fixture-repo-dir>
# Pure shell assertions — no LLM calls, no external CLI invocations.
set -euo pipefail
FIXTURE_DIR="${1:-$(pwd)}"
cd "$FIXTURE_DIR"

# Assertion 1: TASK-1 status is Basic: Backlog
STATUS=$(grep -oP "(?<=status: ')[^']+" backlog/tasks/task-1-*.md 2>/dev/null || echo "")
[ "$STATUS" = "Basic: Backlog" ] || { echo "FAIL: TASK-1 status=$STATUS, expected Basic: Backlog"; exit 1; }

# Assertion 2: Implementation Plan field is populated (non-empty)
grep -q "## Background\|## Proposal\|# Proposal\|# Plan" backlog/tasks/task-1-*.md || \
  { echo "FAIL: Implementation Plan not populated"; exit 1; }

# Assertion 3: No task stuck at Basic: Proposal
if grep -rl "status: 'Basic: Proposal'" backlog/tasks/ 2>/dev/null | grep -q .; then
  echo "FAIL: task still at Basic: Proposal"
  exit 1
fi

echo "PASS: feature-to-backlog smoke assertions passed"
