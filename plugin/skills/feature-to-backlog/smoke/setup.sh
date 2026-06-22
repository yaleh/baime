#!/usr/bin/env bash
# setup.sh <fixture-repo-dir>
# Sets up a minimal BAIME backlog fixture with one Basic: Proposal task.
set -euo pipefail
FIXTURE_DIR="${1:-$(pwd)}"
cd "$FIXTURE_DIR"

# Initialize backlog structure
mkdir -p backlog/tasks backlog/.caps

# Create CLAUDE.md with L0 Config section
cat > CLAUDE.md << 'EOF'
# baime

BAIME fixture repo for feature-to-backlog smoke test.

## L0 Config

test-cmd: bash scripts/validate-plugin.sh
test-all: bash scripts/validate-plugin.sh
doc-path: docs
EOF

# Create TASK-1 at Basic: Proposal
cat > backlog/tasks/task-1-add-greeting.md << 'EOF'
---
id: TASK-1
title: Add greeting script
status: Basic: Proposal
labels: [kind:basic]
created: 2026-01-01
updated: 2026-01-01
---
# Add greeting script

Add a greeting.sh script that prints Hello World.
EOF

git init -q
git config user.email "smoke-test@baime.local"
git config user.name "Smoke Test"
git add -A
git commit -q -m "fixture: TASK-1 at Basic: Proposal"
echo "Fixture setup complete: TASK-1 at Basic: Proposal"
