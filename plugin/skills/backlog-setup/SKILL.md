---
name: backlog-setup
description: "One-time initializer for the backlog task board. Checks that the backlog CLI is installed, initializes a backlog project if none exists, and verifies that all columns required by loop-backlog and feature-to-backlog are present. Idempotent — safe to run multiple times."
allowed-tools: Bash, Read, Write
contracts:
  - grep: "backlogSetup"
    target: self
    description: "Main entry function backlogSetup() must remain defined"
  - grep: "verifyColumns"
    target: self
    description: "Column verification step must not be removed"
  - grep: "seedExamples"
    target: self
    description: "Seed examples step must remain present"
  - grep: "initProject"
    target: self
    description: "Project init step must remain present"
  - grep: "config.yml"
    target: self
    description: "Implementation must edit config.yml directly (backlog column add removed in CLI v1.45+)"
  - grep: "initL0Config"
    target: self
    description: "L0 Config initialisation step must remain present"
---

λ() → backlogSetup()

## Spec

-- Columns required by each skill

REQUIRED_COLUMNS := [
  "Epic: Proposal", "Epic: Plan", "Epic: Backlog", "Epic: Ready",
  "Epic: Decomposing", "Epic: Awaiting Children", "Epic: Evaluating",
  "Epic: Done", "Epic: Needs Human",
  "Basic: Proposal", "Basic: Plan", "Basic: Backlog", "Basic: Ready",
  "Basic: In Progress", "Basic: Done", "Basic: Needs Human"
]

backlogSetup :: () → SetupResult
backlogSetup() = {
  _:       checkCli(),
  _:       initProject(),
  missing: verifyColumns(REQUIRED_COLUMNS),
  _:       addColumns(missing),
  _:       initL0Config(),
  _:       seedExamples(),
  _:       printSummary()
}

-- Only seeds when backlog/docs/ and backlog/decisions/ are both empty
-- (i.e. first-time init). Idempotent: skips if any file already exists.
seedExamples :: () → ()
seedExamples() =
  | ¬empty(backlog/docs/) ∨ ¬empty(backlog/decisions/) → skip
  | otherwise → {
      backlog document create <onboardingDocTitle> --type guide,
      backlog decision create  <templateDecisionTitle> --status "Accepted"
    }

checkCli :: () → ()
checkCli() =
  | which("backlog") succeeds → continue
  | otherwise                 → print(installInstructions); halt

initProject :: () → ()
initProject() =
  | exists("backlog/") → skip   -- already initialised
  | otherwise          → backlog init <projectName> --defaults --agent-instructions none

verifyColumns :: [String] → [String]
verifyColumns(required) = required ∖ existingColumns()

addColumns :: [String] → ()
addColumns(cols) = ∀col ∈ cols: backlog column add col

-- Detects project type from marker files and appends ## L0 Config to CLAUDE.md.
-- Idempotent: skips if ## L0 Config already present.
-- Pauses for human confirmation before writing.
initL0Config :: () → ()
initL0Config() =
  | grep -q "## L0 Config" CLAUDE.md → skip
  | otherwise → {
      type:  detectProjectType(),
      block: renderL0Block(type),
      _:     printProposed(block),
      _:     awaitConfirmation(),
      _:     appendOrCreateClaudeMd(block)
    }

detectProjectType :: () → ProjectType
detectProjectType() =
  | exists("scripts/validate-plugin.sh") → baime
  | exists("package.json")               → node
  | exists("go.mod")                     → go
  | exists("Cargo.toml")                 → rust
  | exists("pyproject.toml")             → python
  | exists("Makefile")                   → make
  | otherwise                            → unknown

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
  PROJECT_NAME=$(basename "$PWD")
  backlog init "$PROJECT_NAME" --defaults --agent-instructions none
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
  "Epic: Proposal" "Epic: Plan" "Epic: Backlog" "Epic: Ready"
  "Epic: Decomposing" "Epic: Awaiting Children" "Epic: Evaluating"
  "Epic: Done" "Epic: Needs Human"
  "Basic: Proposal" "Basic: Plan" "Basic: Backlog" "Basic: Ready"
  "Basic: In Progress" "Basic: Done" "Basic: Needs Human"
)

# Read existing statuses and compute missing ones via Python
python3 - <<'PYEOF'
import re, sys

CONFIG = "backlog/config.yml"
REQUIRED = [
  "Epic: Proposal", "Epic: Plan", "Epic: Backlog", "Epic: Ready",
  "Epic: Decomposing", "Epic: Awaiting Children", "Epic: Evaluating",
  "Epic: Done", "Epic: Needs Human",
  "Basic: Proposal", "Basic: Plan", "Basic: Backlog", "Basic: Ready",
  "Basic: In Progress", "Basic: Done", "Basic: Needs Human",
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

# Ensure default_status is "Proposal"
content = re.sub(
    r'^default_status:\s*"[^"]*"',
    'default_status: "Basic: Proposal"',
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

### initL0Config

```bash
# Idempotency guard: skip if ## L0 Config already present
if grep -q "## L0 Config" CLAUDE.md 2>/dev/null; then
  echo "✓ CLAUDE.md already contains ## L0 Config — skipping"
else
  # Detection: probe marker files in priority order
  if [ -f "scripts/validate-plugin.sh" ]; then
    PROJECT_TYPE="baime"
    TEST_CMD="bash scripts/validate-plugin.sh"
    TEST_ALL="bash scripts/validate-plugin.sh"
    DOC_PATH="docs"
    WORKTREE_SYMLINKS=""
  elif [ -f "package.json" ]; then
    PROJECT_TYPE="node"
    TEST_CMD="npm test"
    TEST_ALL="npm test"
    DOC_PATH="docs"
    WORKTREE_SYMLINKS="node_modules"
  elif [ -f "go.mod" ]; then
    PROJECT_TYPE="go"
    TEST_CMD="go test ./..."
    TEST_ALL="go test ./..."
    DOC_PATH="docs"
    WORKTREE_SYMLINKS=""
  elif [ -f "Cargo.toml" ]; then
    PROJECT_TYPE="rust"
    TEST_CMD="cargo test"
    TEST_ALL="cargo test"
    DOC_PATH="docs"
    WORKTREE_SYMLINKS=""
  elif [ -f "pyproject.toml" ]; then
    PROJECT_TYPE="python"
    TEST_CMD="pytest"
    TEST_ALL="pytest"
    DOC_PATH="docs"
    WORKTREE_SYMLINKS=""
  elif [ -f "Makefile" ]; then
    PROJECT_TYPE="make"
    TEST_CMD="make test"
    TEST_ALL="make test"
    DOC_PATH="docs"
    WORKTREE_SYMLINKS=""
  else
    PROJECT_TYPE="unknown"
    TEST_CMD="<fill in>"
    TEST_ALL="<fill in>"
    DOC_PATH="docs"
    WORKTREE_SYMLINKS=""
  fi

  # Render proposed block
  L0_BLOCK="## L0 Config

test-cmd: ${TEST_CMD}
test-all: ${TEST_ALL}
doc-path: ${DOC_PATH}
worktree-symlinks: ${WORKTREE_SYMLINKS}"

  echo ""
  echo "Detected project type: ${PROJECT_TYPE}"
  echo ""
  echo "Proposed ## L0 Config block to append to CLAUDE.md:"
  echo "────────────────────────────────────────"
  echo "${L0_BLOCK}"
  echo "────────────────────────────────────────"
  echo ""
  printf "Write this block to CLAUDE.md? [y/N] "
  read -r CONFIRM
  if [ "${CONFIRM}" = "y" ] || [ "${CONFIRM}" = "Y" ]; then
    if [ ! -f "CLAUDE.md" ]; then
      printf "%s\n" "${L0_BLOCK}" > CLAUDE.md
      echo "✓ Created CLAUDE.md with ## L0 Config"
    else
      printf "\n%s\n" "${L0_BLOCK}" >> CLAUDE.md
      echo "✓ Appended ## L0 Config to CLAUDE.md"
    fi
  else
    echo "Skipped — edit CLAUDE.md manually to add ## L0 Config"
  fi
fi
```

### seedExamples

Run only when both `backlog/docs/` and `backlog/decisions/` are empty (first-time init).

```bash
DOCS_EMPTY=true
DECISIONS_EMPTY=true
[ -d backlog/docs ] && [ -n "$(ls -A backlog/docs 2>/dev/null)" ] && DOCS_EMPTY=false
[ -d backlog/decisions ] && [ -n "$(ls -A backlog/decisions 2>/dev/null)" ] && DECISIONS_EMPTY=false

if $DOCS_EMPTY && $DECISIONS_EMPTY; then
  # --- Example document ---
  backlog document create "Backlog Web UI 快速参考" --type guide --tags "onboarding,howto" <<'EOF'
## 三个内容区域

`backlog browser` 打开 web UI，顶部导航有三个区域：

| 区域 | CLI 命令 | 存储路径 | 用途 |
|---|---|---|---|
| **TASKS** | `backlog task create` | `backlog/tasks/` | 功能、缺陷、任务 |
| **DOCUMENTS** | `backlog document create` | `backlog/docs/` | 指南、规范、参考文档 |
| **DECISIONS** | `backlog decision create` | `backlog/decisions/` | 架构决策记录（ADR） |

## 注意事项

- 手动在 `backlog/docs/` 或 `backlog/decisions/` 创建的 `.md` 文件，**若没有 backlog frontmatter 则不可见**。
- 请始终通过 CLI 命令创建，或在文件头加上 `id`/`title`/`date`/`status` 等 frontmatter。
- Documents 支持 `--type`（readme/guide/specification/other）和 `--tags`。
- Decisions 支持 `--status`（Proposed/Accepted/Deprecated/Superseded）。
EOF

  # --- Example decision ---
  backlog decision create "示例：架构决策记录模板" --status "Proposed"
  # Then write template body into the created file:
  DECISION_FILE=$(ls backlog/decisions/decision-* 2>/dev/null | head -1)
  if [ -n "$DECISION_FILE" ]; then
    python3 - "$DECISION_FILE" <<'PYEOF'
import re, sys
path = sys.argv[1]
with open(path) as f:
    content = f.read()
body = """
## Context

（描述导致需要做此决策的背景、约束或问题。包含已考虑的备选方案。）

## Decision

（清晰陈述所做的决定。）

## Consequences

**正面：**
- （此决策带来的好处）

**负面 / 约束：**
- （权衡、限制、或需要注意的事项）
"""
# Replace empty section bodies
content = re.sub(r'(## Context\n)\n(## Decision)', r'\1（描述背景）\n\n\2', content)
# Just append the template body after the frontmatter block
parts = content.split('---', 2)
if len(parts) == 3:
    content = '---'.join(parts[:2]) + '---' + body
    with open(path, 'w') as f:
        f.write(content)
PYEOF
  fi

  echo "✓ seeded example document and decision"
else
  echo "✓ docs/decisions not empty — skipping seed"
fi
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
echo "  1. Create your first task:"
echo "     /feature-to-backlog <feature description>"
echo ""
echo "  2. Move the task to Ready, then start the worker:"
echo "     /loop-backlog"
echo ""
echo "─── Web UI ────────────────────────────────"
echo "  backlog browser"
echo ""
echo "  TASKS      — tasks created by /feature-to-backlog, /task-to-backlog"
echo "  DOCUMENTS  — guides & specs:  backlog document create <title> --type guide"
echo "  DECISIONS  — ADRs:            backlog decision create <title> --status Accepted"
echo ""
echo "  ⚠  Files placed manually in backlog/docs/ or backlog/decisions/"
echo "     are invisible in the web UI unless they have backlog frontmatter."
echo "     Always use the CLI commands above."
```

## Notes

- Statuses are managed by direct edit of `backlog/config.yml` (Python regex rewrite);
  `backlog column add` was removed in CLI v1.45+.
- The script is idempotent: running it multiple times only adds truly missing columns.
  The seed step is also idempotent: skipped if `backlog/docs/` or `backlog/decisions/`
  already contain any files.
- `backlog-setup` auto-detects the project type and appends a `## L0 Config` block to
  CLAUDE.md (with human confirmation). The step is idempotent — it skips if the block
  already exists.
- Web UI content areas and their CLI commands:
  - TASKS     → `backlog task create`
  - DOCUMENTS → `backlog document create` (stores in `backlog/docs/`)
  - DECISIONS → `backlog decision create` (stores in `backlog/decisions/`)
  - Manual `.md` files without backlog frontmatter are invisible in the web UI.
