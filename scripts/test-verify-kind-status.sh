#!/usr/bin/env bash
# TDD test for verify-kind-status.sh hardening
# Specifically tests that YAML parsing failures are caught
set -euo pipefail

TMPDIR_TEST=$(mktemp -d)
trap "rm -rf $TMPDIR_TEST" EXIT
ORIG_DIR=$(pwd)

# Create a fixture directory with one valid and one invalid task
mkdir -p "$TMPDIR_TEST/tasks"

# Valid task
cat > "$TMPDIR_TEST/tasks/task-valid.md" << 'EOF'
---
id: TASK-VALID
title: Valid Task
status: "Basic: Backlog"
labels:
  - kind:basic
---
Valid task body.
EOF

# Invalid task (unquoted status with colon-space — the original bug)
cat > "$TMPDIR_TEST/tasks/task-broken.md" << 'EOF'
---
id: TASK-BROKEN
title: Broken Task
status: Basic: Backlog
labels:
  - kind:basic
---
Broken task body.
EOF

# Test 1: verify-kind-status.sh must FAIL when given a directory containing the broken file
echo "=== Test 1: Should FAIL on unquoted status ==="
if bash "$ORIG_DIR/scripts/verify-kind-status.sh" --tasks-dir "$TMPDIR_TEST/tasks" 2>&1; then
  echo "FAIL Test 1: script should have exited non-zero for broken YAML but did not"
  exit 1
else
  echo "PASS Test 1: correctly detected broken YAML"
fi

# Remove broken file
rm "$TMPDIR_TEST/tasks/task-broken.md"

# Test 2: verify-kind-status.sh must PASS with only valid files
echo "=== Test 2: Should PASS with valid files ==="
if bash "$ORIG_DIR/scripts/verify-kind-status.sh" --tasks-dir "$TMPDIR_TEST/tasks" 2>&1; then
  echo "PASS Test 2: correctly passed for valid YAML"
else
  echo "FAIL Test 2: script failed on valid YAML"
  exit 1
fi

echo "ALL TESTS PASSED"
