#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0
WARNINGS=0

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
EXPECTED_SKILLS=23

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

# ── .claude/skills symlink consistency (ADR-001) ─────────────────────────────

echo ""
echo "=== .claude/skills Symlink Consistency ==="

CLAUDE_SKILLS_DIR="$REPO_ROOT/.claude/skills"
for skill_dir in "$SKILLS_DIR"/*/; do
    skill="$(basename "$skill_dir")"
    link="${CLAUDE_SKILLS_DIR}/${skill}"
    expected_target="../../plugin/skills/${skill}"
    if [ -L "$link" ] && [ "$(readlink "$link")" = "$expected_target" ]; then
        pass "symlink: .claude/skills/$skill"
    elif [ -L "$link" ]; then
        fail "symlink target wrong: .claude/skills/$skill -> $(readlink "$link") (expected $expected_target)"
    elif [ -d "$link" ]; then
        fail "real dir (not symlink): .claude/skills/$skill — run scripts/install/setup-skill-symlinks.sh"
    else
        fail "missing symlink: .claude/skills/$skill"
    fi
done

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

# ── Unit Tests ────────────────────────────────────────────────────────────────

echo ""
echo "=== Unit Tests ==="

run_skill_unit_tests() {
  local test_dir="$REPO_ROOT/scripts"
  for test_file in "$test_dir"/*.test.js "$test_dir"/*.test.sh; do
    [ -f "$test_file" ] || continue
    local name
    name="$(basename "$test_file")"
    if [[ "$test_file" == *.test.js ]]; then
      if node "$test_file" >/dev/null 2>&1; then
        pass "unit test: $name"
      else
        fail "unit test: $name"
      fi
    elif [[ "$test_file" == *.test.sh ]]; then
      if bash "$test_file" >/dev/null 2>&1; then
        pass "unit test: $name"
      else
        fail "unit test: $name"
      fi
    fi
  done
}

run_skill_unit_tests

# ── Contract Tests ────────────────────────────────────────────────────────────

echo ""
echo "=== Contract Tests ==="

validate_contracts() {
  local skill_file="$1"
  python3 - "$skill_file" <<'EOF'
import sys, re, subprocess, tempfile, os

filepath = sys.argv[1]
with open(filepath, 'r') as f:
    content = f.read()

# Extract YAML frontmatter
match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)', content, re.DOTALL)
if not match:
    sys.exit(0)

frontmatter_text = match.group(1)
body_text = match.group(2)

# Try to parse contracts field using yaml
contracts = None
try:
    import yaml
    parsed = yaml.safe_load(frontmatter_text)
    if isinstance(parsed, dict):
        contracts = parsed.get('contracts')
except Exception:
    pass

if not contracts:
    sys.exit(0)

skill_name = filepath
errors = 0

# Write a temp file for self-targeting (body only, excluding frontmatter)
tmp_body = tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False)
tmp_body.write(body_text)
tmp_body.close()

try:
    for rule in contracts:
        if 'grep' in rule:
            pattern = rule['grep']
            target = rule.get('target', 'self')
            target_file = tmp_body.name if target == 'self' else target
            result = subprocess.run(['grep', '-q', pattern, target_file], capture_output=True)
            if result.returncode == 0:
                print(f"  PASS: contract grep '{pattern}' in {skill_name}")
            else:
                print(f"  FAIL: contract grep '{pattern}' not found in {skill_name}")
                errors += 1
        elif 'not-grep' in rule:
            pattern = rule['not-grep']
            target = rule.get('target', 'self')
            target_file = tmp_body.name if target == 'self' else target
            result = subprocess.run(['grep', '-q', pattern, target_file], capture_output=True)
            if result.returncode != 0:
                print(f"  PASS: contract not-grep '{pattern}' absent in {skill_name}")
            else:
                print(f"  FAIL: contract not-grep '{pattern}' found in {skill_name}")
                errors += 1
finally:
    os.unlink(tmp_body.name)

sys.exit(errors)
EOF
}

for skill_dir in "$SKILLS_DIR"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_file="$skill_dir/SKILL.md"
    [ -f "$skill_file" ] || continue
    if ! validate_contracts "$skill_file"; then
        ERRORS=$((ERRORS + 1))
    fi
done

# ── Layer 0: Internal Consistency ─────────────────────────────────────────────

echo ""
echo "=== Layer 0: Internal Consistency ==="

validate_skill_internals() {
  local skill_file="$1"
  python3 - "$skill_file" <<'EOF'
import sys, re

filepath = sys.argv[1]
skill_name = filepath.split('/')[-2] if '/' in filepath else filepath

with open(filepath, 'r') as f:
    content = f.read()

# Strip frontmatter
fm_match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)', content, re.DOTALL)
if not fm_match:
    sys.exit(0)

frontmatter_text = fm_match.group(1)
body = fm_match.group(2)

errors = 0

# Parse frontmatter fields
meta = {}
try:
    import yaml
    parsed = yaml.safe_load(frontmatter_text)
    if isinstance(parsed, dict):
        meta = parsed
except Exception:
    pass

# Regex fallback for allowed-tools and daemon-version
if 'allowed-tools' not in meta:
    m = re.search(r'^allowed-tools:\s*(.+)$', frontmatter_text, re.MULTILINE)
    if m:
        meta['allowed-tools'] = m.group(1).strip()

if 'daemon-version' not in meta:
    m = re.search(r'^daemon-version:\s*(.+)$', frontmatter_text, re.MULTILINE)
    if m:
        meta['daemon-version'] = m.group(1).strip()

# ── Sub-check 1: Function coverage ───────────────────────────────────────────
# Only when ## Implementation section exists
impl_match = re.search(r'^## Implementation\s*\n(.*?)(?=^## |\Z)', body, re.MULTILINE | re.DOTALL)
if impl_match:
    spec_match = re.search(r'^## Spec\s*\n(.*?)(?=^## |\Z)', body, re.MULTILINE | re.DOTALL)
    spec_text = spec_match.group(1) if spec_match else ''
    impl_text = impl_match.group(1)

    # Extract funcName( references from Spec
    spec_refs = set()
    for m in re.finditer(r'\b([a-z][a-zA-Z0-9]+)\(', spec_text):
        spec_refs.add(m.group(1))

    # Extract bare ### funcName headings from Implementation
    impl_headings = set()
    for m in re.finditer(r'^###\s+([a-zA-Z][a-zA-Z0-9]+)\s*$', impl_text, re.MULTILINE):
        impl_headings.add(m.group(1))

    # FAIL for impl headings not referenced anywhere in Spec
    undocumented = impl_headings - spec_refs
    for h in sorted(undocumented):
        print(f"  FAIL: [{skill_name}] impl heading '### {h}' has no Spec reference")
        errors += 1

# ── Sub-check 2: allowed-tools completeness (WARNING only) ───────────────────
known_tools = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Monitor',
               'Agent', 'Task', 'WebFetch', 'WebSearch']

declared_str = meta.get('allowed-tools', '')
declared = set(t.strip() for t in declared_str.split(',') if t.strip())

used_tools = set()
for tool in known_tools:
    if re.search(r'\b' + re.escape(tool) + r'\(', body):
        used_tools.add(tool)

undeclared = used_tools - declared
for tool in sorted(undeclared):
    print(f"  WARNING: [{skill_name}] tool '{tool}(' used in body but not in allowed-tools")

# ── Sub-check 3: daemon-version consistency ───────────────────────────────────
if 'daemon-version' in meta:
    fm_version = str(meta['daemon-version']).strip()
    # Find version comments in body like: // daemon-version: v3 or # daemon-version: v3
    body_versions = re.findall(r'(?://|#)\s*daemon-version:\s*(\S+)', body)
    for bv in body_versions:
        if bv != fm_version:
            print(f"  FAIL: [{skill_name}] daemon-version mismatch: frontmatter={fm_version} body={bv}")
            errors += 1

sys.exit(errors)
EOF
}

for skill_dir in "$SKILLS_DIR"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_file="$skill_dir/SKILL.md"
    [ -f "$skill_file" ] || continue
    if ! validate_skill_internals "$skill_file"; then
        ERRORS=$((ERRORS + 1))
    fi
done

# ── Layer 0: Trigger Overlap Detection ───────────────────────────────────────

echo ""
echo "=== Layer 0: Trigger Overlap Detection ==="

python3 - "$SKILLS_DIR" <<'PYEOF'
import sys, re, os
from itertools import combinations

# ── Configurable threshold ────────────────────────────────────────────────────
OVERLAP_THRESHOLD = 0.35   # Jaccard on character trigrams; raise to tighten

# ── Helpers ───────────────────────────────────────────────────────────────────

def trigrams(text):
    """Return a set of character trigrams from normalised text."""
    t = re.sub(r'[^a-z0-9 ]', ' ', text.lower())
    t = re.sub(r'\s+', ' ', t).strip()
    return set(t[i:i+3] for i in range(len(t) - 2))

def jaccard(a, b):
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)

def extract_description(filepath):
    """Return the description string from SKILL.md frontmatter, or None."""
    try:
        with open(filepath) as f:
            content = f.read()
    except OSError:
        return None

    fm = re.match(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
    if not fm:
        return None
    frontmatter = fm.group(1)

    # Try PyYAML first
    try:
        import yaml
        parsed = yaml.safe_load(frontmatter)
        if isinstance(parsed, dict) and parsed.get('description'):
            return str(parsed['description']).strip()
    except Exception:
        pass

    # Regex fallback: single-line and quoted variants
    m = re.search(r'^description:\s*["\']?(.*?)["\']?\s*$', frontmatter, re.MULTILINE)
    if m:
        return m.group(1).strip().strip('"\'')
    return None

# ── Gather descriptions ───────────────────────────────────────────────────────
skills_dir = sys.argv[1]
skills = {}   # skill_name -> description string

for entry in sorted(os.listdir(skills_dir)):
    skill_dir = os.path.join(skills_dir, entry)
    skill_file = os.path.join(skill_dir, 'SKILL.md')
    if not os.path.isfile(skill_file):
        continue
    desc = extract_description(skill_file)
    if desc:
        skills[entry] = desc

# ── Pairwise comparison ───────────────────────────────────────────────────────
failures = 0
for (s1, d1), (s2, d2) in combinations(skills.items(), 2):
    score = jaccard(trigrams(d1), trigrams(d2))
    if score >= OVERLAP_THRESHOLD:
        print(f"  FAIL: trigger overlap {score:.2f} >= {OVERLAP_THRESHOLD}"
              f" between '{s1}' and '{s2}'")
        failures += 1

if failures == 0:
    print(f"  PASS: no skill pairs exceed overlap threshold {OVERLAP_THRESHOLD}")
else:
    print(f"  FAIL: {failures} pair(s) exceed overlap threshold"
          f" — rewrite descriptions to be more distinct")

sys.exit(failures)
PYEOF

# Capture the Python exit code and propagate to $ERRORS
OVERLAP_EXIT=$?
if [ "$OVERLAP_EXIT" -ne 0 ]; then
  ERRORS=$((ERRORS + OVERLAP_EXIT))
fi

# ── Manifest Lint Smoke Tests ─────────────────────────────────────────────────

echo ""
echo "=== Manifest Lint Smoke Tests ==="

LINT_SCRIPT="${REPO_ROOT}/scripts/skill-lint.sh"
if [ -f "$LINT_SCRIPT" ]; then
  if bash "$LINT_SCRIPT" --manifest "${REPO_ROOT}/scripts/fixtures/manifest-valid.json" 2>/dev/null; then
    pass "skill-lint: valid manifest"
  else
    fail "skill-lint: valid manifest should exit 0"
  fi
  for bad in manifest-bad-field-description manifest-bad-missing-phase \
              manifest-bad-entry-point manifest-bad-skip-draft-mismatch; do
    if ! bash "$LINT_SCRIPT" --manifest "${REPO_ROOT}/scripts/fixtures/${bad}.json" 2>/dev/null; then
      pass "skill-lint: ${bad} rejected"
    else
      fail "skill-lint: ${bad} should exit non-zero"
    fi
  done
else
  fail "skill-lint.sh not found at $LINT_SCRIPT"
fi

# ── Layer 0: Contract Density Check ──────────────────────────────────────────

echo ""
echo "=== Layer 0: Contract Density Check ==="

set +e
python3 - "$SKILLS_DIR" <<'PYEOF'
import sys, os, re

LINE_THRESHOLD = 500
CONTRACT_THRESHOLD = 3

skills_dir = sys.argv[1]
warnings = 0

for entry in sorted(os.listdir(skills_dir)):
    skill_file = os.path.join(skills_dir, entry, 'SKILL.md')
    if not os.path.isfile(skill_file):
        continue
    with open(skill_file) as f:
        content = f.read()
    lines = content.count('\n')
    # Count contracts entries: lines starting with "  - " under contracts: block
    # Find contracts: key and count list items
    contract_count = 0
    in_contracts = False
    for line in content.split('\n'):
        if re.match(r'^contracts:\s*$', line):
            in_contracts = True
            continue
        if in_contracts:
            if re.match(r'^\s{2}-', line):
                contract_count += 1
            elif line.strip() and not re.match(r'^\s', line):
                in_contracts = False
    if lines > LINE_THRESHOLD and contract_count < CONTRACT_THRESHOLD:
        print(f"  WARNING: contracts density low: {entry} ({lines} lines, {contract_count} contracts, recommend ≥{CONTRACT_THRESHOLD})")
        warnings += 1

if warnings == 0:
    print(f"  PASS: all large skills (>{LINE_THRESHOLD} lines) have ≥{CONTRACT_THRESHOLD} contracts")
sys.exit(warnings)
PYEOF

DENSITY_WARNINGS=$?
set -e
WARNINGS=$((WARNINGS + DENSITY_WARNINGS))

# ── Layer 0: Meta-lint — Quantitative Claims ─────────────────────────────────

echo ""
echo "=== Layer 0: Meta-lint (Quantitative Claims) ==="

set +e
python3 - "$SKILLS_DIR" <<'PYEOF'
import sys, os, re

PATTERNS = [
    r'\d+[x\xd7]\s*(speedup|faster|reduction|improvement|boost)',
    r'\d+%\s*(speedup|reduction|improvement|success|accuracy|equivalence|transferab)',
    r'^transferability:\s*\d',
    r'V_\w+\s*[=:]\s*0\.\d+',
    r'\d+\s*min\b.*→',
]
EXEMPT_RE = re.compile(
    r'(?i)(\*{0,2}evidence\*{0,2}:|\w+-evidence:|\[unvalidated\])',
    re.IGNORECASE
)

skills_dir = sys.argv[1]
warnings = 0

for entry in sorted(os.listdir(skills_dir)):
    skill_file = os.path.join(skills_dir, entry, 'SKILL.md')
    if not os.path.isfile(skill_file):
        continue
    with open(skill_file) as f:
        content = f.read()

    fm_desc = ''
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            for line in parts[1].split('\n'):
                if line.startswith('description:'):
                    fm_desc = line
            body_lines = parts[2].split('\n')[:200]
        else:
            body_lines = content.split('\n')[:200]
    else:
        body_lines = content.split('\n')[:200]

    scan_lines = ([fm_desc] if fm_desc else []) + body_lines

    for i, line in enumerate(scan_lines):
        for pat in PATTERNS:
            if re.search(pat, line, re.IGNORECASE):
                context_start = max(0, i - 2)
                context_end = min(len(scan_lines), i + 3)
                context = '\n'.join(scan_lines[context_start:context_end])
                if not EXEMPT_RE.search(context):
                    print(f"  WARN: [{entry}] untagged quantitative claim: {line.strip()[:100]}")
                    warnings += 1
                break

if warnings == 0:
    print("  PASS: no untagged quantitative claims")
sys.exit(warnings)
PYEOF

META_WARNINGS=$?
set -e
WARNINGS=$((WARNINGS + META_WARNINGS))

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "=== Summary ==="
echo "Agents: $AGENT_COUNT, Skills: $SKILL_COUNT"
echo "Errors: $ERRORS, Warnings: $WARNINGS"
if [ "$ERRORS" -eq 0 ]; then
    echo ""
    echo "ALL CHECKS PASSED"
    exit 0
else
    echo ""
    echo "FAILED: $ERRORS error(s) found"
    exit 1
fi
