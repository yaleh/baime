#!/bin/bash
# Uninstall baime plugin from user scope
set -e

INSTALL_DIR="$HOME/.local/share/baime"
SETTINGS="$HOME/.claude/settings.json"
PLUGIN_NAME="baime"
MARKETPLACE_NAME="baime"

echo "Uninstalling baime plugin..."
echo ""

# 1. Remove install directory
if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo "  Removed: $INSTALL_DIR"
else
    echo "  Not found (already removed): $INSTALL_DIR"
fi

# 2. Remove entries from ~/.claude/settings.json
if [ -f "$SETTINGS" ]; then
    PLUGIN_KEY="${PLUGIN_NAME}@${MARKETPLACE_NAME}"
    jq --arg marketplace "$MARKETPLACE_NAME" \
       --arg key "$PLUGIN_KEY" \
       'del(.extraKnownMarketplaces[$marketplace])
        | del(.enabledPlugins[$key])' \
       "$SETTINGS" > /tmp/baime-settings-tmp.json \
    && mv /tmp/baime-settings-tmp.json "$SETTINGS"
    echo "  Settings updated: $SETTINGS"
else
    echo "  No settings file found at $SETTINGS"
fi

# 3. Clear plugin cache
rm -rf "$HOME/.claude/plugins/cache/${MARKETPLACE_NAME}/${PLUGIN_NAME}/"
echo "  Plugin cache cleared."

echo ""
echo "baime uninstalled successfully."
