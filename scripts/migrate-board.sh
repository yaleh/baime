#!/bin/bash
# migrate-board.sh — Migrate backlog/tasks/ to B″ dual-state-machine schema
# Idempotent: safe to re-run. Skips files already using Basic:/Epic: prefixed statuses.
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

MIGRATED=0
SKIPPED=0
ERRORS=0

# Status mapping: bare → Basic:
declare -A STATUS_MAP
STATUS_MAP["Proposal"]="Basic: Proposal"
STATUS_MAP["Plan"]="Basic: Plan"
STATUS_MAP["Backlog"]="Basic: Backlog"
STATUS_MAP["Ready"]="Basic: Ready"
STATUS_MAP["In Progress"]="Basic: In Progress"
STATUS_MAP["Done"]="Basic: Done"
STATUS_MAP["Needs Human"]="Basic: Needs Human"

migrate_file() {
    local file="$1"

    # Read current status from frontmatter
    local current_status
    current_status=$(python3 - "$file" <<'EOF'
import sys, re
content = open(sys.argv[1]).read()
m = re.search(r'^---\n(.*?)^---', content, re.DOTALL | re.MULTILINE)
if not m:
    sys.exit(1)
fm = m.group(1)
sm = re.search(r'^status:\s*(.+)$', fm, re.MULTILINE)
if not sm:
    sys.exit(1)
status = sm.group(1).strip().strip('"\'')
print(status)
EOF
    )

    # Skip if already prefixed
    if [[ "$current_status" == "Basic: "* ]] || [[ "$current_status" == "Epic: "* ]]; then
        SKIPPED=$((SKIPPED + 1))
        return 0
    fi

    # Map status to Basic: prefix
    local new_status="${STATUS_MAP[$current_status]:-}"
    if [ -z "$new_status" ]; then
        echo "  WARNING: Unknown status '$current_status' in $(basename "$file") — skipping"
        SKIPPED=$((SKIPPED + 1))
        return 0
    fi

    # Apply migration using python to handle frontmatter correctly
    python3 - "$file" "$current_status" "$new_status" <<'EOF'
import sys, re

file_path = sys.argv[1]
old_status = sys.argv[2]
new_status = sys.argv[3]

content = open(file_path).read()

# Find frontmatter boundaries
m = re.match(r'^(---\n)(.*?)(^---)', content, re.DOTALL | re.MULTILINE)
if not m:
    print(f"ERROR: no frontmatter in {file_path}", file=sys.stderr)
    sys.exit(1)

front_start = m.group(1)
frontmatter = m.group(2)
front_end = m.group(3)
rest = content[m.end():]

# Replace status line, quoting value if it contains ': ' to produce valid YAML
def replace_status(fm, new_s):
    quoted = '"' + new_s + '"' if ': ' in new_s else new_s
    return re.sub(
        r'^(status:\s*)(.+)$',
        lambda m: m.group(1) + quoted,
        fm,
        flags=re.MULTILINE
    )

# Add kind:basic label if not present
def add_kind_label(fm):
    # Check if kind:basic already present
    if re.search(r'kind:basic|kind: basic', fm):
        return fm
    # Find labels: section
    # Handle both inline list and block list formats
    # Inline: labels: []  -> labels:\n  - kind:basic
    # Block:  labels:\n   - foo  -> labels:\n  - kind:basic\n  - foo

    # Inline empty labels
    if re.search(r'^labels:\s*\[\s*\]\s*$', fm, re.MULTILINE):
        return re.sub(
            r'^(labels:\s*)\[\s*\]\s*$',
            r'labels:\n  - kind:basic',
            fm,
            flags=re.MULTILINE
        )

    # Block list labels: insert kind:basic as first item
    if re.search(r'^labels:\s*$', fm, re.MULTILINE):
        # labels followed by list items
        return re.sub(
            r'^(labels:\s*\n)((\s+-\s+.+\n?)*)',
            lambda m: m.group(1) + '  - kind:basic\n' + m.group(2),
            fm,
            flags=re.MULTILINE
        )

    # Block list labels: present but not matching above pattern
    # Try: labels:\n  - something
    def insert_label(m):
        return m.group(1) + '  - kind:basic\n' + m.group(2)

    new_fm = re.sub(
        r'(^labels:\n)((?:  - .+\n)*)',
        insert_label,
        fm,
        flags=re.MULTILINE
    )
    if new_fm != fm:
        return new_fm

    # Fallback: add labels section before dependencies
    return re.sub(
        r'^(dependencies:)',
        r'labels:\n  - kind:basic\n\1',
        fm,
        flags=re.MULTILINE,
        count=1
    )

frontmatter = replace_status(frontmatter, new_status)
frontmatter = add_kind_label(frontmatter)

new_content = front_start + frontmatter + front_end + rest
open(file_path, 'w').write(new_content)
EOF

    local rc=$?
    if [ $rc -ne 0 ]; then
        echo "  ERROR: Failed to migrate $(basename "$file")"
        ERRORS=$((ERRORS + 1))
        return 1
    fi

    echo "  Migrated: $(basename "$file") ($current_status → $new_status)"
    MIGRATED=$((MIGRATED + 1))
}

echo "=== migrate-board.sh: Migrating backlog/tasks/ to B″ schema ==="
echo ""

for file in "$TASKS_DIR"/*.md; do
    [ -f "$file" ] || continue
    migrate_file "$file"
done

echo ""
echo "=== Summary: migrated=$MIGRATED skipped=$SKIPPED errors=$ERRORS ==="

if [ "$ERRORS" -gt 0 ]; then
    echo "FAIL: $ERRORS error(s) during migration"
    exit 1
fi

echo "PASS: Migration complete"
exit 0
