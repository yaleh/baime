---
name: backlog-setup
description: "One-time initializer for the backlog task board. Checks that the backlog CLI is installed, initializes a backlog project if none exists, and verifies that all columns required by loop-backlog and feature-to-backlog are present. Idempotent — safe to run multiple times."
allowed-tools: Bash, Read, Write
---

λ() → backlogSetup()

## Spec

-- Columns required by each skill

FEATURE_TO_BACKLOG_COLUMNS := [
  "Proposal Draft", "Proposal Review",
  "Plan Draft",     "Plan Review",
  "Backlog"
]

LOOP_BACKLOG_COLUMNS := [
  "Ready", "In Progress", "Done", "Needs Human"
]

REQUIRED_COLUMNS := FEATURE_TO_BACKLOG_COLUMNS ∪ LOOP_BACKLOG_COLUMNS

backlogSetup :: () → SetupResult
backlogSetup() = {
  _:       checkCli(),
  _:       initProject(),
  missing: verifyColumns(REQUIRED_COLUMNS),
  _:       addColumns(missing),
  _:       printSummary()
}

checkCli :: () → ()
checkCli() =
  | which("backlog") succeeds → continue
  | otherwise                 → print(installInstructions); halt

initProject :: () → ()
initProject() =
  | exists("backlog/") → skip   -- already initialised
  | otherwise          → backlog init

verifyColumns :: [String] → [String]
verifyColumns(required) = required ∖ existingColumns()

addColumns :: [String] → ()
addColumns(cols) = ∀col ∈ cols: backlog column add col

## Implementation

### checkCli

```bash
if ! command -v backlog &>/dev/null; then
  echo "❌ 'backlog' CLI not found."
  echo ""
  echo "Install instructions:"
  echo "  npm install -g @backlog-md/cli"
  echo "  # or: pip install backlog-md"
  echo "  # or: see https://github.com/backlog-md/backlog"
  echo ""
  echo "After installing, re-run /backlog-setup."
  exit 1
fi
echo "✓ backlog CLI found: $(backlog --version 2>/dev/null || echo 'version unknown')"
```

### initProject

```bash
if [ ! -d "backlog" ]; then
  echo "Initialising backlog project..."
  backlog init
  echo "✓ backlog project initialised"
else
  echo "✓ backlog project already exists"
fi
```

### verifyColumns + addColumns

`backlog column add` does not exist in backlog CLI v1.45+. Statuses must be set by
editing `backlog/config.yml` directly. Use Python to parse and rewrite the YAML line
in-place, preserving all other fields.

```bash
REQUIRED_COLUMNS=(
  "Proposal Draft" "Proposal Review"
  "Plan Draft"     "Plan Review"
  "Backlog"
  "Ready"          "In Progress"
  "Done"           "Needs Human"
)

# Read existing statuses and compute missing ones via Python
python3 - <<'PYEOF'
import re, sys

CONFIG = "backlog/config.yml"
REQUIRED = [
  "Proposal Draft", "Proposal Review",
  "Plan Draft",     "Plan Review",
  "Backlog",
  "Ready",          "In Progress",
  "Done",           "Needs Human",
]

with open(CONFIG) as f:
    content = f.read()

# Extract existing statuses from the YAML array on the statuses line
m = re.search(r'^statuses:\s*\[([^\]]*)\]', content, re.MULTILINE)
existing = []
if m:
    existing = [s.strip().strip('"') for s in m.group(1).split(',') if s.strip()]

missing = [c for c in REQUIRED if c not in existing]

# Always write exactly REQUIRED (authoritative); discard unrelated defaults like "To Do"
new_statuses = ', '.join(f'"{c}"' for c in REQUIRED)
content = re.sub(
    r'^statuses:\s*\[.*?\]',
    f'statuses: [{new_statuses}]',
    content, flags=re.MULTILINE
)

# Ensure default_status is "Proposal Draft"
content = re.sub(
    r'^default_status:\s*"[^"]*"',
    'default_status: "Proposal Draft"',
    content, flags=re.MULTILINE
)

with open(CONFIG, 'w') as f:
    f.write(content)

if missing:
    print("Added: " + ", ".join(missing))
else:
    print("All required columns already present.")
PYEOF
```

### printSummary

```bash
echo ""
echo "═══════════════════════════════════════"
echo "  backlog-setup complete"
echo "═══════════════════════════════════════"
echo ""

if [ ${#EXISTING[@]} -gt 0 ]; then
  echo "Already present:"
  for COL in "${EXISTING[@]}"; do echo "  ✓ $COL"; done
fi

if [ ${#ADDED[@]} -gt 0 ]; then
  echo "Added:"
  for COL in "${ADDED[@]}"; do echo "  + $COL"; done
fi

echo ""
echo "All required columns are ready."
echo ""
echo "Next steps:"
echo "  1. Add an '## L0 Config' section to CLAUDE.md (optional — skip to auto-detect):"
echo ""
echo "     ## L0 Config"
echo "     test-cmd: <per-phase test runner, e.g. pytest -k>"
echo "     test-all: <full suite, e.g. pytest>"
echo "     worktree-symlinks: <dirs to symlink, e.g. node_modules, or: none>"
echo "     doc-path: docs"
echo ""
echo "  2. Create your first task:"
echo "     /feature-to-backlog <feature description>"
echo ""
echo "  3. Move the task to Ready, then start the worker:"
echo "     /loop-backlog"
```

## Notes

- Statuses are managed by direct edit of `backlog/config.yml` (Python regex rewrite);
  `backlog column add` was removed in CLI v1.45+.
- The script is idempotent: running it multiple times only adds truly missing columns.
- The `## L0 Config` section in CLAUDE.md is optional. Without it, `feature-to-backlog`
  and `loop-backlog` auto-detect the project language and choose sensible defaults.
