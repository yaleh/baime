#!/bin/bash
# Version bump script for baime
#
# Purpose: Synchronize version number in both manifest files
# Usage: ./scripts/release/bump-version.sh <version>
# Example: ./scripts/release/bump-version.sh v1.1.0
#
# Updates:
#   - plugin/.claude-plugin/plugin.json: .version field
#   - .claude-plugin/marketplace.json: .plugins[0].version field
#
# Does NOT commit to git. Use release.sh for the full release workflow.

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v1.1.0"
    exit 1
fi

# Remove 'v' prefix for the actual version value
VERSION_NUM=${VERSION#v}

# Validate version format
if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
    echo "Error: Invalid version format. Use v1.0.0 or v1.0.0-beta"
    exit 1
fi

# Check if jq is installed
if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required but not installed"
    echo "Install with: sudo apt-get install jq (Ubuntu/Debian) or brew install jq (macOS)"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PLUGIN_JSON="$REPO_ROOT/plugin/.claude-plugin/plugin.json"
MARKETPLACE_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"

# Validate files exist
if [ ! -f "$PLUGIN_JSON" ]; then
    echo "Error: File not found: plugin/.claude-plugin/plugin.json"
    exit 1
fi

if [ ! -f "$MARKETPLACE_JSON" ]; then
    echo "Error: File not found: .claude-plugin/marketplace.json"
    exit 1
fi

# Get current versions
CURRENT_PLUGIN=$(jq -r '.version' "$PLUGIN_JSON")
CURRENT_MARKET=$(jq -r '.plugins[0].version' "$MARKETPLACE_JSON")

echo "=== Version Bump: $VERSION ==="
echo ""
echo "  plugin.json:      $CURRENT_PLUGIN -> $VERSION_NUM"
echo "  marketplace.json: $CURRENT_MARKET -> $VERSION_NUM"
echo ""

# Update plugin/.claude-plugin/plugin.json
jq --arg ver "$VERSION_NUM" '.version = $ver' "$PLUGIN_JSON" > "$PLUGIN_JSON.tmp"
mv "$PLUGIN_JSON.tmp" "$PLUGIN_JSON"
echo "  DONE: plugin/.claude-plugin/plugin.json updated to $VERSION_NUM"

# Update .claude-plugin/marketplace.json
jq --arg ver "$VERSION_NUM" '.plugins[0].version = $ver' "$MARKETPLACE_JSON" > "$MARKETPLACE_JSON.tmp"
mv "$MARKETPLACE_JSON.tmp" "$MARKETPLACE_JSON"
echo "  DONE: .claude-plugin/marketplace.json updated to $VERSION_NUM"

# Verify both files are now consistent
VERIFY_PLUGIN=$(jq -r '.version' "$PLUGIN_JSON")
VERIFY_MARKET=$(jq -r '.plugins[0].version' "$MARKETPLACE_JSON")

if [ "$VERIFY_PLUGIN" = "$VERSION_NUM" ] && [ "$VERIFY_MARKET" = "$VERSION_NUM" ]; then
    echo ""
    echo "Version parity verified: both files now at $VERSION_NUM"
    echo ""
    echo "=== Version Bump Complete ==="
    echo ""
    echo "Next steps:"
    echo "  Update CHANGELOG.md with an entry for [$VERSION_NUM]"
    echo "  Run release: bash scripts/release/release.sh $VERSION"
else
    echo ""
    echo "Error: Version parity check failed after update"
    echo "  plugin.json:      $VERIFY_PLUGIN"
    echo "  marketplace.json: $VERIFY_MARKET"
    exit 1
fi
