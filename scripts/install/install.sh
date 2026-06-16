#!/bin/bash
# Install baime plugin to user scope
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SETTINGS="$HOME/.claude/settings.json"
INSTALLED_PLUGINS="$HOME/.claude/plugins/installed_plugins.json"
PLUGIN_NAME="baime"
MARKETPLACE_NAME="baime"
PLUGIN_KEY="${PLUGIN_NAME}@${MARKETPLACE_NAME}"

# Resolve plugin version
PLUGIN_VERSION="$(python3 -c "import json; d=json.load(open('$REPO_ROOT/plugin/.claude-plugin/plugin.json')); print(d['version'])" 2>/dev/null || echo "1.0.0")"

# Plugin lives in cache (consistent with other installed plugins)
INSTALL_DIR="$HOME/.claude/plugins/cache/${MARKETPLACE_NAME}/${PLUGIN_NAME}/${PLUGIN_VERSION}"
# Marketplace source dir — marketplace.json lives here, source="."
MARKETPLACE_DIR="$HOME/.local/share/baime"

echo "Installing baime plugin (v${PLUGIN_VERSION})..."
echo ""

# 1. Copy plugin/ to cache path
echo "Copying plugin files to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
rsync -a --delete "$REPO_ROOT/plugin/" "$INSTALL_DIR/"

# 2. Flatten skills and agents into commands/ inside the cache
#    This matches meta-cc's flat commands/ structure that Claude Code understands.
echo "Building commands/ from skills/ and agents/..."
mkdir -p "$INSTALL_DIR/commands"
COMMANDS_LIST=""

for skill_dir in "$INSTALL_DIR/skills"/*/; do
    skill_name="$(basename "$skill_dir")"
    src="$skill_dir/SKILL.md"
    if [ -f "$src" ]; then
        cp "$src" "$INSTALL_DIR/commands/${skill_name}.md"
        COMMANDS_LIST="${COMMANDS_LIST}    \"./commands/${skill_name}.md\","
        echo "  command (skill): ${skill_name}"
    fi
done

AGENTS_LIST=""
for agent_file in "$INSTALL_DIR/agents"/*.md; do
    [ -f "$agent_file" ] || continue
    agent_name="$(basename "$agent_file" .md)"
    cp "$agent_file" "$INSTALL_DIR/commands/${agent_name}.md"
    AGENTS_LIST="${AGENTS_LIST}    \"./agents/$(basename "$agent_file")\","
    echo "  command (agent): ${agent_name}"
done

# 3. Rewrite plugin.json in the cache with proper commands[] paths
COMMANDS_LIST="${COMMANDS_LIST%,}"   # trim trailing comma
AGENTS_LIST="${AGENTS_LIST%,}"

python3 - <<PYEOF
import json, sys

with open("$INSTALL_DIR/.claude-plugin/plugin.json") as f:
    d = json.load(f)

commands = [
    f"./commands/{p.stem}.md"
    for p in sorted(__import__('pathlib').Path("$INSTALL_DIR/commands").glob("*.md"))
    if p.stem not in [a[:-3] for a in [
        f.name for f in __import__('pathlib').Path("$INSTALL_DIR/agents").glob("*.md")
    ]]
]
agents = [
    f"./agents/{p.name}"
    for p in sorted(__import__('pathlib').Path("$INSTALL_DIR/agents").glob("*.md"))
]

d["commands"] = commands
if agents:
    d["agents"] = agents
else:
    d.pop("agents", None)
d.pop("skills", None)

with open("$INSTALL_DIR/.claude-plugin/plugin.json", "w") as f:
    json.dump(d, f, indent=2)
    f.write("\n")
print("  plugin.json updated with", len(commands), "commands,", len(agents), "agents")
PYEOF

# 4. Set up marketplace source dir — source="." so marketplace.json and plugin are co-located
mkdir -p "$MARKETPLACE_DIR/.claude-plugin"
cat > "$MARKETPLACE_DIR/.claude-plugin/marketplace.json" <<EOF
{
  "name": "$MARKETPLACE_NAME",
  "owner": {"name": "Yale Huang", "url": "https://github.com/yaleh"},
  "plugins": [{"name": "$PLUGIN_NAME", "source": "."}]
}
EOF

# Copy plugin.json into marketplace dir so source="." resolves correctly
mkdir -p "$MARKETPLACE_DIR/.claude-plugin"
cp "$INSTALL_DIR/.claude-plugin/plugin.json" "$MARKETPLACE_DIR/.claude-plugin/plugin.json"

# 5. Register extraKnownMarketplaces + enabledPlugins in ~/.claude/settings.json
mkdir -p "$HOME/.claude"
if [ ! -f "$SETTINGS" ]; then
    echo '{}' > "$SETTINGS"
fi

jq --arg marketplace "$MARKETPLACE_NAME" \
   --arg dir "$MARKETPLACE_DIR" \
   --arg key "$PLUGIN_KEY" \
   '. + {
     extraKnownMarketplaces: ((.extraKnownMarketplaces // {}) + {($marketplace): {"source": {"source": "directory", "path": $dir}}}),
     enabledPlugins: ((.enabledPlugins // {}) + {($key): true})
   }' "$SETTINGS" > /tmp/baime-settings-tmp.json \
&& mv /tmp/baime-settings-tmp.json "$SETTINGS"

# 6. Register in installed_plugins.json
mkdir -p "$HOME/.claude/plugins"
if [ ! -f "$INSTALLED_PLUGINS" ]; then
    echo '{"version": 2, "plugins": {}}' > "$INSTALLED_PLUGINS"
fi

INSTALL_DATE="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"

jq --arg key "$PLUGIN_KEY" \
   --arg installPath "$INSTALL_DIR" \
   --arg version "$PLUGIN_VERSION" \
   --arg date "$INSTALL_DATE" \
   '.plugins[$key] = [{"scope": "user", "installPath": $installPath, "version": $version, "installedAt": $date, "lastUpdated": $date, "gitCommitSha": null}]' \
   "$INSTALLED_PLUGINS" > /tmp/baime-plugins-tmp.json \
&& mv /tmp/baime-plugins-tmp.json "$INSTALLED_PLUGINS"

echo ""
echo "baime installed successfully."
echo "  Plugin cache:    $INSTALL_DIR"
echo "  Marketplace:     $MARKETPLACE_DIR"
echo "  Settings:        $SETTINGS"
echo "  Plugin registry: $INSTALLED_PLUGINS"
echo ""
echo "Restart Claude Code to activate the plugin."
