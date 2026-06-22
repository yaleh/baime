#!/usr/bin/env bash
# TDD test: migrate-board.sh must produce valid quoted YAML status values
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TMPDIR_TEST=$(mktemp -d)
trap "rm -rf $TMPDIR_TEST" EXIT

# Create a minimal fixture task file with bare status (pre-migration state)
cat > "$TMPDIR_TEST/task-fixture.md" << 'EOF'
---
id: TASK-FIXTURE
title: Fixture Task
status: Backlog
labels: []
---

# Fixture Task
EOF

# Verify the fixture has an unquoted bare status
if python3 -c "
import yaml, re, sys
content = open('$TMPDIR_TEST/task-fixture.md').read()
m = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
data = yaml.safe_load(m.group(1))
assert data['status'] == 'Backlog', f'Expected Backlog, got {data[\"status\"]}'
print('Fixture confirmed: bare status Backlog')
"; then
  echo "Fixture setup OK"
else
  echo "FAIL fixture setup"
  exit 1
fi

# Run migrate-board.sh pointed at the temp dir
bash "$SCRIPT_DIR/migrate-board.sh" --tasks-dir "$TMPDIR_TEST" 2>&1 || true

# Verify output has quoted status value when it contains ': '
result=$(python3 -c "
import yaml, re
content = open('$TMPDIR_TEST/task-fixture.md').read()
# Check raw text for proper quoting when value contains ': '
raw_lines = [l for l in content.split('\n') if l.startswith('status:')]
if not raw_lines:
    print('FAIL: no status line found in file')
    exit(1)
raw_status = raw_lines[0]
print(f'raw_line={raw_status!r}')
value_part = raw_status.split('status: ', 1)[1]
print(f'value_part={value_part!r}')
if ': ' in value_part and '\"' not in value_part:
    print('FAIL: status value with colon-space must be quoted in raw YAML')
    exit(1)
print('PASS: status value is properly quoted')
" 2>&1)

echo "$result"
if echo "$result" | grep -q "^PASS"; then
  exit 0
else
  exit 1
fi
