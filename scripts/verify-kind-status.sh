#!/bin/bash
# verify-kind-status.sh — Verify all backlog/tasks/*.md have kind:basic XOR kind:epic
# and status within the correct column subset.
# Emits "column-overlap-violation: <file>" on violations. Exits non-zero on any violation.
# Usage: verify-kind-status.sh [--tasks-dir <path>]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASKS_DIR="$REPO_ROOT/backlog/tasks"

# Parse optional --tasks-dir argument
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tasks-dir)
      TASKS_DIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

VIOLATIONS=0
CHECKED=0

check_file() {
    local file="$1"
    local basename
    basename="$(basename "$file")"

    # Strict YAML parse: extract frontmatter and validate with PyYAML
    local frontmatter
    frontmatter=$(awk '/^---$/{if(++n==1) next; if(n==2) exit} n==1{print}' "$file")
    if ! python3 -c "import yaml, sys; yaml.safe_load(sys.stdin.read())" <<< "$frontmatter" 2>/dev/null; then
        echo "  FAIL yaml-parse-error: $basename"
        return 1
    fi

    python3 - "$file" <<'PYEOF'
import sys, re

file_path = sys.argv[1]
basename = file_path.split('/')[-1]

BASIC_STATUSES = {
    "Basic: Proposal", "Basic: Plan", "Basic: Backlog", "Basic: Ready",
    "Basic: In Progress", "Basic: Done", "Basic: Needs Human"
}
EPIC_STATUSES = {
    "Epic: Proposal", "Epic: Plan", "Epic: Backlog", "Epic: Ready",
    "Epic: Decomposing", "Epic: Awaiting Children", "Epic: Evaluating",
    "Epic: Done", "Epic: Needs Human"
}

content = open(file_path).read()
m = re.match(r'^---\n(.*?)^---', content, re.DOTALL | re.MULTILINE)
if not m:
    print(f"  WARNING: No frontmatter in {basename} — skipping")
    sys.exit(0)

fm = m.group(1)

# Extract status
sm = re.search(r'^status:\s*(.+)$', fm, re.MULTILINE)
if not sm:
    print(f"  WARNING: No status field in {basename} — skipping")
    sys.exit(0)
status = sm.group(1).strip().strip('"\'')

# Extract labels (inline or block list)
labels = set()
inline = re.search(r'^labels:\s*\[([^\]]*)\]', fm, re.MULTILINE)
if inline:
    for item in inline.group(1).split(','):
        item = item.strip().strip('"\'')
        if item:
            labels.add(item)
else:
    block = re.findall(r'^  -\s+(.+)$', fm, re.MULTILINE)
    labels = set(b.strip().strip('"\'') for b in block)

has_basic = 'kind:basic' in labels
has_epic = 'kind:epic' in labels

violations = []

# Check XOR kind
if has_basic and has_epic:
    violations.append(f"both kind:basic and kind:epic")
elif not has_basic and not has_epic:
    violations.append(f"missing kind label (neither kind:basic nor kind:epic)")

# Check status in correct subset
if has_basic and status not in BASIC_STATUSES:
    violations.append(f"kind:basic but status '{status}' not in Basic:* subset")
if has_epic and status not in EPIC_STATUSES:
    violations.append(f"kind:epic but status '{status}' not in Epic:* subset")
if not has_basic and not has_epic:
    # Check if status is in either subset at all
    if status not in BASIC_STATUSES and status not in EPIC_STATUSES:
        violations.append(f"status '{status}' not in any B″ column")

if violations:
    for v in violations:
        print(f"  column-overlap-violation: {basename} — {v}")
    sys.exit(1)
else:
    sys.exit(0)
PYEOF
}

echo "=== verify-kind-status.sh: Checking B″ kind/status invariants ==="
echo ""

for file in "$TASKS_DIR"/*.md; do
    [ -f "$file" ] || continue
    CHECKED=$((CHECKED + 1))
    if ! check_file "$file"; then
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
done

echo ""
echo "=== Summary: checked=$CHECKED violations=$VIOLATIONS ==="

if [ "$VIOLATIONS" -gt 0 ]; then
    echo "FAIL: $VIOLATIONS file(s) violate B″ kind/status invariants"
    exit 1
fi

echo "PASS: All $CHECKED task files have valid kind/status"
exit 0
