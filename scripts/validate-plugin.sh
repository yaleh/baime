#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0

# ── Helper functions ─────────────────────────────────────────────────────────

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; ERRORS=$((ERRORS + 1)); }

# ── JSON validation ──────────────────────────────────────────────────────────

echo ""
echo "=== JSON Manifest Validation ==="

PLUGIN_JSON="$REPO_ROOT/plugin/.claude-plugin/plugin.json"
MARKETPLACE_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"

if python3 -c "import json, sys; json.load(open('$PLUGIN_JSON'))" 2>/dev/null; then
    pass "plugin.json is valid JSON"
else
    fail "plugin.json is invalid JSON"
fi

if python3 -c "import json, sys; json.load(open('$MARKETPLACE_JSON'))" 2>/dev/null; then
    pass "marketplace.json is valid JSON"
else
    fail "marketplace.json is invalid JSON"
fi

# ── Version parity ────────────────────────────────────────────────────────────

PLUGIN_VERSION=$(python3 -c "import json; print(json.load(open('$PLUGIN_JSON'))['version'])")
MARKETPLACE_VERSION=$(python3 -c "import json; print(json.load(open('$MARKETPLACE_JSON'))['plugins'][0]['version'])")

if [ "$PLUGIN_VERSION" = "$MARKETPLACE_VERSION" ]; then
    pass "Version parity: plugin.json ($PLUGIN_VERSION) == marketplace.json ($MARKETPLACE_VERSION)"
else
    fail "Version mismatch: plugin.json ($PLUGIN_VERSION) != marketplace.json ($MARKETPLACE_VERSION)"
fi

# ── No mcpServers field ───────────────────────────────────────────────────────

if python3 -c "import json, sys; d=json.load(open('$PLUGIN_JSON')); sys.exit(0 if 'mcpServers' not in d else 1)" 2>/dev/null; then
    pass "plugin.json has no mcpServers field"
else
    fail "plugin.json must not contain mcpServers"
fi

# ── YAML frontmatter validation ───────────────────────────────────────────────

echo ""
echo "=== YAML Frontmatter Validation ==="

validate_frontmatter() {
    local file="$1"
    python3 - "$file" <<'EOF'
import sys, re

filepath = sys.argv[1]
with open(filepath, 'r') as f:
    content = f.read()

# Extract YAML frontmatter between --- delimiters (first occurrence)
match = re.match(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
if not match:
    print(f"  FAIL: {filepath} - no YAML frontmatter found")
    sys.exit(1)

frontmatter_text = match.group(1)

# Try strict YAML parse first; fall back to regex extraction for known-good fields
# (Some skill descriptions contain colons or special chars that defeat strict YAML)
meta = {}
try:
    import yaml
    parsed = yaml.safe_load(frontmatter_text)
    if isinstance(parsed, dict):
        meta = parsed
except Exception:
    pass

# Regex fallback: extract 'name' and detect 'description' presence
if not meta.get('name'):
    name_match = re.search(r'^name:\s*(.+)$', frontmatter_text, re.MULTILINE)
    if name_match:
        meta['name'] = name_match.group(1).strip().strip('"\'')

if 'description' not in meta:
    # Check for multiline block scalar (description: |) or inline
    if re.search(r'^description:', frontmatter_text, re.MULTILINE):
        meta['description'] = '__present__'

missing = [f for f in ('name', 'description') if not meta.get(f)]
if missing:
    print(f"  FAIL: {filepath} - missing fields: {missing}")
    sys.exit(1)
EOF
}

AGENTS_DIR="$REPO_ROOT/plugin/agents"
SKILLS_DIR="$REPO_ROOT/plugin/skills"

AGENT_COUNT=0
SKILL_COUNT=0
FRONTMATTER_ERRORS=0

for agent_file in "$AGENTS_DIR"/*.md; do
    [ -f "$agent_file" ] || continue
    if validate_frontmatter "$agent_file"; then
        pass "Agent: $(basename "$agent_file")"
    else
        ERRORS=$((ERRORS + 1))
        FRONTMATTER_ERRORS=$((FRONTMATTER_ERRORS + 1))
    fi
    AGENT_COUNT=$((AGENT_COUNT + 1))
done

for skill_dir in "$SKILLS_DIR"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_file="$skill_dir/SKILL.md"
    if [ -f "$skill_file" ]; then
        if validate_frontmatter "$skill_file"; then
            pass "Skill: $(basename "$skill_dir")"
        else
            ERRORS=$((ERRORS + 1))
            FRONTMATTER_ERRORS=$((FRONTMATTER_ERRORS + 1))
        fi
    else
        fail "Skill directory $(basename "$skill_dir") has no SKILL.md"
        ERRORS=$((ERRORS + 1))
    fi
    SKILL_COUNT=$((SKILL_COUNT + 1))
done

# ── Count assertions ──────────────────────────────────────────────────────────

echo ""
echo "=== Count Assertions ==="

EXPECTED_AGENTS=4
EXPECTED_SKILLS=17

if [ "$AGENT_COUNT" -eq "$EXPECTED_AGENTS" ]; then
    pass "Agent count: $AGENT_COUNT (expected $EXPECTED_AGENTS)"
else
    fail "Agent count: $AGENT_COUNT (expected $EXPECTED_AGENTS)"
fi

if [ "$SKILL_COUNT" -eq "$EXPECTED_SKILLS" ]; then
    pass "Skill count: $SKILL_COUNT (expected $EXPECTED_SKILLS)"
else
    fail "Skill count: $SKILL_COUNT (expected $EXPECTED_SKILLS)"
fi

# ── Forbidden agents check ────────────────────────────────────────────────────

echo ""
echo "=== Forbidden File Check ==="

for forbidden in "feature-developer.md" "phase-planner-executor.md"; do
    if [ -f "$AGENTS_DIR/$forbidden" ]; then
        fail "Forbidden agent present: $forbidden"
    else
        pass "Forbidden agent absent: $forbidden"
    fi
done

# ── no-mcp-dependency check for workflow-coach ───────────────────────────────

COACH_FILE="$AGENTS_DIR/workflow-coach.md"
if [ -f "$COACH_FILE" ]; then
    # Hard mcp_meta_cc calls are those NOT inside an optional section
    # Strategy: strip the optional section then check for mcp_meta_cc
    UNCONDITIONAL=$(python3 - "$COACH_FILE" <<'EOF'
import sys, re

with open(sys.argv[1]) as f:
    content = f.read()

# Remove optional enrichment blocks (lines after "## Optional" until next "##" or EOF)
optional_stripped = re.sub(
    r'(?m)^##\s+Optional.*?(?=^##|\Z)',
    '',
    content,
    flags=re.DOTALL | re.MULTILINE
)

matches = re.findall(r'mcp_meta_cc\.\w+\s*\(', optional_stripped)
print(len(matches))
EOF
)
    if [ "$UNCONDITIONAL" -eq 0 ]; then
        pass "workflow-coach.md has no unconditional mcp_meta_cc calls"
    else
        fail "workflow-coach.md has $UNCONDITIONAL unconditional mcp_meta_cc call(s)"
    fi
fi

# ── next-step-generation: no mcp_ calls ──────────────────────────────────────

NSG="$SKILLS_DIR/next-step-generation/SKILL.md"
if [ -f "$NSG" ]; then
    MCP_REFS=$(grep -c 'mcp_' "$NSG" || true)
    if [ "$MCP_REFS" -eq 0 ]; then
        pass "next-step-generation/SKILL.md has no mcp_ references"
    else
        fail "next-step-generation/SKILL.md has $MCP_REFS mcp_ reference(s)"
    fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "=== Summary ==="
echo "Agents: $AGENT_COUNT, Skills: $SKILL_COUNT"
if [ "$ERRORS" -eq 0 ]; then
    echo ""
    echo "ALL CHECKS PASSED"
    exit 0
else
    echo ""
    echo "FAILED: $ERRORS error(s) found"
    exit 1
fi
