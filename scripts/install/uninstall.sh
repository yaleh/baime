#!/bin/bash
# Uninstall baime plugin from user scope
set -e

SETTINGS="$HOME/.claude/settings.json"
INSTALLED_PLUGINS="$HOME/.claude/plugins/installed_plugins.json"
PLUGIN_NAME="baime"
MARKETPLACE_NAME="baime"
PLUGIN_KEY="${PLUGIN_NAME}@${MARKETPLACE_NAME}"
MARKETPLACE_DIR="$HOME/.local/share/baime"

echo "Uninstalling baime plugin..."
echo ""

# 1. Find current installPath from installed_plugins.json
INSTALL_DIR=""
if [ -f "$INSTALLED_PLUGINS" ]; then
    INSTALL_DIR="$(jq -r --arg key "$PLUGIN_KEY" '.plugins[$key][0].installPath // empty' "$INSTALLED_PLUGINS" 2>/dev/null || true)"
fi

# Fallback: look in cache directory
if [ -z "$INSTALL_DIR" ]; then
    INSTALL_DIR="$HOME/.claude/plugins/cache/${MARKETPLACE_NAME}/${PLUGIN_NAME}"
fi

# 2. Remove plugin cache
if [ -d "$HOME/.claude/plugins/cache/${MARKETPLACE_NAME}/${PLUGIN_NAME}" ]; then
    rm -rf "$HOME/.claude/plugins/cache/${MARKETPLACE_NAME}/${PLUGIN_NAME}"
    echo "  Removed plugin cache: $HOME/.claude/plugins/cache/${MARKETPLACE_NAME}/${PLUGIN_NAME}"
fi

# 3. Remove marketplace source dir
if [ -d "$MARKETPLACE_DIR" ]; then
    rm -rf "$MARKETPLACE_DIR"
    echo "  Removed: $MARKETPLACE_DIR"
fi

# 4. Remove entries from ~/.claude/settings.json
if [ -f "$SETTINGS" ]; then
    jq --arg marketplace "$MARKETPLACE_NAME" \
       --arg key "$PLUGIN_KEY" \
       'del(.extraKnownMarketplaces[$marketplace])
        | del(.enabledPlugins[$key])' \
       "$SETTINGS" > /tmp/baime-settings-tmp.json \
    && mv /tmp/baime-settings-tmp.json "$SETTINGS"
    echo "  Settings updated: $SETTINGS"
fi

# 5. Remove from installed_plugins.json
if [ -f "$INSTALLED_PLUGINS" ]; then
    jq --arg key "$PLUGIN_KEY" \
       'del(.plugins[$key])' \
       "$INSTALLED_PLUGINS" > /tmp/baime-plugins-tmp.json \
    && mv /tmp/baime-plugins-tmp.json "$INSTALLED_PLUGINS"
    echo "  Removed from: $INSTALLED_PLUGINS"
fi

echo ""
echo "baime uninstalled successfully."
