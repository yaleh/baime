#!/bin/bash
# verify-cap-markers.sh — Advisory check for cap:* idempotency markers.
# For each task NOT at its initial column (Basic: Backlog or Epic: Proposal),
# check that the task body contains at least one cap:* line.
# Warns on missing markers (does NOT fail — many tasks pre-date this system).
# Exit 0 always (advisory only).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASKS_DIR="$REPO_ROOT/backlog/tasks"

CHECKED=0
WARNED=0

# Initial column for each kind (tasks starting here don't need cap markers yet)
BASIC_INITIAL="basic: backlog"
EPIC_INITIAL="epic: proposal"

check_file() {
    local file="$1"
    local basename
    basename="$(basename "$file")"

    python3 - "$file" <<'PYEOF'
import sys, re

file_path = sys.argv[1]
basename = file_path.split('/')[-1]

BASIC_INITIAL = "basic: backlog"
EPIC_INITIAL  = "epic: proposal"

content = open(file_path).read()
m = re.match(r'^---\n([\s\S]*?)^---', content, re.MULTILINE)
if not m:
    sys.exit(0)  # No frontmatter, skip

fm = m.group(1)

# Extract status
sm = re.search(r'^status:\s*(.+)$', fm, re.MULTILINE)
if not sm:
    sys.exit(0)
status = sm.group(1).strip().strip('"\'').lower()

# Skip tasks at any "entry" column (Proposal or Backlog are both entry points)
BASIC_ENTRY = {"basic: proposal", "basic: backlog", "basic: plan"}
EPIC_ENTRY  = {"epic: proposal", "epic: plan"}
if status in BASIC_ENTRY or status in EPIC_ENTRY:
    sys.exit(0)

# Also skip done/needs-human terminals where cap markers are less relevant
if status in ('basic: done', 'epic: done', 'basic: needs human', 'epic: needs human'):
    sys.exit(0)

# Check for cap:* in body (after frontmatter)
body = content[m.end():]
has_cap = bool(re.search(r'\bcap:[a-z_]+=\w+', body))

if not has_cap:
    print(f"  WARN: missing cap:* marker in {basename} (status: {status})")
    sys.exit(1)
else:
    sys.exit(0)
PYEOF
}

echo "=== verify-cap-markers.sh: Advisory check for cap:* markers ==="
echo ""

for file in "$TASKS_DIR"/*.md; do
    [ -f "$file" ] || continue
    CHECKED=$((CHECKED + 1))
    if ! check_file "$file"; then
        WARNED=$((WARNED + 1))
    fi
done

echo ""
echo "=== Summary: checked=$CHECKED warned=$WARNED ==="
if [ "$WARNED" -gt 0 ]; then
    echo "NOTE: $WARNED task(s) lack cap:* markers — advisory only (many tasks pre-date B″ system)"
else
    echo "PASS: All checked tasks have cap:* markers or are at initial column"
fi

# Always exit 0 — this is an advisory check
exit 0
