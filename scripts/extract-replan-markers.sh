#!/usr/bin/env bash
# extract-replan-markers.sh
# Scans task notes for replan markers and outputs raw counts.
# Usage: bash scripts/extract-replan-markers.sh

set -euo pipefail

NOTES_DIR="$(dirname "$0")/../plugin/loop-meta/data/task-notes"

if [[ ! -d "$NOTES_DIR" ]]; then
  echo "ERROR: task-notes directory not found: $NOTES_DIR" >&2
  exit 1
fi

echo "=== Replan Markers in Task Notes ==="
echo "Directory: $NOTES_DIR"
echo ""

total=0

for file in "$NOTES_DIR"/*.md; do
  [[ -f "$file" ]] || continue
  matches=$(grep -n "^replan:" "$file" 2>/dev/null || true)
  if [[ -n "$matches" ]]; then
    count=$(echo "$matches" | wc -l)
    total=$((total + count))
    echo "File: $(basename "$file")"
    while IFS= read -r line; do
      echo "  $line"
    done <<< "$matches"
    echo ""
  fi
done

echo "=== Summary ==="
echo "Total replan markers found: $total"

exit 0
