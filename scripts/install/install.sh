#!/bin/bash
# Install baime plugin to user scope
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

INSTALL_DIR="$HOME/.local/share/baime"
SETTINGS="$HOME/.claude/settings.json"
PLUGIN_NAME="baime"
MARKETPLACE_NAME="baime"

echo "Installing baime plugin..."
echo ""

# 1. Copy plugin/ to ~/.local/share/baime/
echo "Copying plugin files to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
rsync -a --delete "$REPO_ROOT/plugin/" "$INSTALL_DIR/"

# 2. Write ~/.local/share/baime/.claude-plugin/marketplace.json (source: ".")
mkdir -p "$INSTALL_DIR/.claude-plugin"
cat > "$INSTALL_DIR/.claude-plugin/marketplace.json" <<EOF
{
  "name": "$MARKETPLACE_NAME",
  "owner": {"name": "Yale Huang", "url": "https://github.com/yaleh"},
  "plugins": [{"name": "$PLUGIN_NAME", "source": "."}]
}
EOF

# 3. Register extraKnownMarketplaces + enabledPlugins in ~/.claude/settings.json
mkdir -p "$HOME/.claude"
if [ ! -f "$SETTINGS" ]; then
    echo '{}' > "$SETTINGS"
fi

PLUGIN_KEY="${PLUGIN_NAME}@${MARKETPLACE_NAME}"

jq --arg marketplace "$MARKETPLACE_NAME" \
   --arg dir "$INSTALL_DIR" \
   --arg key "$PLUGIN_KEY" \
   '. + {
     extraKnownMarketplaces: ((.extraKnownMarketplaces // {}) + {($marketplace): {"source": {"source": "directory", "path": $dir}}}),
     enabledPlugins: ((.enabledPlugins // {}) + {($key): true})
   }' "$SETTINGS" > /tmp/baime-settings-tmp.json \
&& mv /tmp/baime-settings-tmp.json "$SETTINGS"

# 4. Clear plugin cache
rm -rf "$HOME/.claude/plugins/cache/${MARKETPLACE_NAME}/${PLUGIN_NAME}/"

echo ""
echo "baime installed successfully."
echo "  Plugin files: $INSTALL_DIR"
echo "  Settings updated: $SETTINGS"
echo ""
echo "Restart Claude Code to activate the plugin."
