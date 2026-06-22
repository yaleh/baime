#!/usr/bin/env bash
# setup.sh <fixture-repo-dir>
# Sets up a minimal BAIME backlog fixture with one Basic: Ready task.
set -euo pipefail
FIXTURE_DIR="${1:-$(pwd)}"
cd "$FIXTURE_DIR"

# Initialize backlog structure
mkdir -p backlog/tasks backlog/.caps

cat > backlog/tasks/task-1-smoke-test-task.md << 'EOF'
---
id: TASK-1
title: Smoke test task
status: Basic: Ready
kind: basic
created: 2026-01-01
updated: 2026-01-01
---
# Smoke test task

Implement a trivial change: create file `output.txt` with content "done".

## Definition of Done
- [ ] `test -f output.txt`
EOF

git add backlog/
git commit -q -m "feat: smoke test fixture — one Basic: Ready task"
echo "Fixture setup complete: TASK-1 at Basic: Ready"
