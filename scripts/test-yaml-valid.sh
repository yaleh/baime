#!/usr/bin/env bash
# TDD test: assert all task files have valid YAML and quoted status values.
set -euo pipefail
TASKS_DIR="backlog/tasks"
FAIL=0

for f in "$TASKS_DIR"/*.md; do
  # Extract YAML frontmatter (between --- delimiters)
  frontmatter=$(awk '/^---$/{if(++n==1) next; if(n==2) exit} n==1{print}' "$f")

  # Check 1: status line must have quoted value (contains colon+space in value)
  status_line=$(echo "$frontmatter" | grep '^status:' || true)
  if [ -n "$status_line" ]; then
    # If the status value contains ": " but is NOT quoted, that's a bug
    status_val=$(echo "$status_line" | sed 's/^status: *//')
    if echo "$status_val" | grep -q ': ' && ! echo "$status_val" | grep -qE '^".*"$'; then
      echo "FAIL unquoted status in $f: $status_line"
      FAIL=1
    fi
  fi

  # Check 2: strict YAML parse via python3
  if ! python3 -c "
import sys, re
content = open('$f').read()
# Extract frontmatter
m = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
if m:
    import yaml
    yaml.safe_load(m.group(1))
" 2>/dev/null; then
    echo "FAIL yaml parse error in $f"
    FAIL=1
  fi
done

if [ "$FAIL" -eq 0 ]; then
  echo "PASS all task files have valid quoted YAML status values"
  exit 0
else
  echo "FAIL see errors above"
  exit 1
fi
