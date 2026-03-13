#!/bin/bash
# Automated release script for baime
#
# Purpose: Create and publish a new release with full validation
# Usage: ./scripts/release/release.sh <version> [--dry-run] [--skip-checks]
# Example: ./scripts/release/release.sh v1.1.0
# Example: ./scripts/release/release.sh v1.1.0 --dry-run
# Example: ./scripts/release/release.sh v1.1.0 --skip-checks
#
# Steps:
#   1. Run pre-release-check.sh (skippable with --skip-checks)
#   2. Run bump-version.sh to update both manifests
#   3. Verify/prompt CHANGELOG.md entry for target version
#   4. git add manifests + CHANGELOG.md, git commit "chore: release vX.Y.Z"
#   5. git tag -a vX.Y.Z, git push origin <branch>, git push origin vX.Y.Z

set -e

VERSION=$1
VERSION_NUM=${VERSION#v}  # Remove 'v' prefix
SKIP_CHECKS=""
DRY_RUN=""

# Parse optional flags
shift || true
while [ $# -gt 0 ]; do
    case "$1" in
        --skip-checks)
            SKIP_CHECKS="yes"
            ;;
        --dry-run)
            DRY_RUN="yes"
            ;;
        *)
            echo "Error: Unknown option: $1"
            echo "Usage: $0 v1.0.0 [--dry-run] [--skip-checks]"
            exit 1
            ;;
    esac
    shift
done

if [ -z "$VERSION" ]; then
    echo "Error: Version required"
    echo "Usage: $0 v1.0.0 [--dry-run] [--skip-checks]"
    exit 1
fi

# Validate version format
if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
    echo "Error: Invalid version format. Use v1.0.0 or v1.0.0-beta"
    exit 1
fi

# Check jq dependency
if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required but not installed"
    echo "Install with: sudo apt-get install jq (Ubuntu/Debian) or brew install jq (macOS)"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PLUGIN_JSON="$REPO_ROOT/plugin/.claude-plugin/plugin.json"
MARKETPLACE_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"
CHANGELOG="$REPO_ROOT/CHANGELOG.md"

if [ -n "$DRY_RUN" ]; then
    echo "========================================"
    echo "DRY RUN MODE - No changes will be made"
    echo "========================================"
    echo ""
fi

echo "=== Release $VERSION ==="
echo ""

# Get current branch
BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)

# ==================================================================
# STEP 1: Pre-Release Validation
# ==================================================================

echo "Step 1: Pre-release validation"
echo "------------------------------"

if [ -n "$SKIP_CHECKS" ]; then
    echo "  SKIPPED (--skip-checks flag used)"
    echo ""
else
    PRE_CHECK_SCRIPT="$SCRIPT_DIR/pre-release-check.sh"
    if [ ! -f "$PRE_CHECK_SCRIPT" ]; then
        echo "Error: pre-release-check.sh not found at $PRE_CHECK_SCRIPT"
        exit 1
    fi

    if [ -n "$DRY_RUN" ]; then
        echo "  [DRY RUN] Would run: bash scripts/release/pre-release-check.sh $VERSION"
        echo ""
    else
        if bash "$PRE_CHECK_SCRIPT" "$VERSION"; then
            echo ""
            echo "  PASS: Pre-release validation passed"
            echo ""
        else
            echo ""
            echo "  FAIL: Pre-release validation failed"
            echo ""
            echo "  Fix the issues above or run with --skip-checks to bypass (not recommended)"
            exit 1
        fi
    fi
fi

# ==================================================================
# STEP 2: Bump Version in Manifests
# ==================================================================

echo "Step 2: Bump version in manifests"
echo "----------------------------------"

CURRENT_VERSION=$(jq -r '.plugins[0].version' "$MARKETPLACE_JSON" 2>/dev/null || echo "unknown")

if [ -n "$DRY_RUN" ]; then
    echo "  [DRY RUN] Would run: bash scripts/release/bump-version.sh $VERSION"
    echo "  [DRY RUN] plugin/.claude-plugin/plugin.json: $CURRENT_VERSION -> $VERSION_NUM"
    echo "  [DRY RUN] .claude-plugin/marketplace.json:   $CURRENT_VERSION -> $VERSION_NUM"
    echo ""
else
    BUMP_SCRIPT="$SCRIPT_DIR/bump-version.sh"
    if [ ! -f "$BUMP_SCRIPT" ]; then
        echo "Error: bump-version.sh not found at $BUMP_SCRIPT"
        exit 1
    fi
    bash "$BUMP_SCRIPT" "$VERSION"
    echo ""
fi

# ==================================================================
# STEP 3: Verify CHANGELOG.md
# ==================================================================

echo "Step 3: Verify CHANGELOG.md"
echo "---------------------------"

if [ -n "$DRY_RUN" ]; then
    if [ -f "$CHANGELOG" ] && grep -q "\[$VERSION_NUM\]" "$CHANGELOG"; then
        echo "  [DRY RUN] CHANGELOG.md already contains entry for [$VERSION_NUM]"
    else
        echo "  [DRY RUN] CHANGELOG.md does not yet contain entry for [$VERSION_NUM]"
        echo "  [DRY RUN] Would prompt user to add entry before continuing"
    fi
    echo ""
else
    if [ ! -f "$CHANGELOG" ]; then
        echo "  CHANGELOG.md not found. Please create it with an entry for [$VERSION_NUM]."
        echo "  Press Enter after adding the entry, or Ctrl+C to abort..."
        read -r
    fi

    if ! grep -q "\[$VERSION_NUM\]" "$CHANGELOG"; then
        echo "  CHANGELOG.md does not contain an entry for [$VERSION_NUM]."
        echo ""
        echo "  Please add a ## [$VERSION_NUM] section to CHANGELOG.md,"
        echo "  then press Enter to continue (or Ctrl+C to abort)..."
        read -r

        # Verify after user has had a chance to update
        if ! grep -q "\[$VERSION_NUM\]" "$CHANGELOG"; then
            echo ""
            echo "  Error: CHANGELOG.md still does not contain entry for [$VERSION_NUM]"
            echo "  Release aborted - CHANGELOG entry is required"
            exit 1
        fi
    fi

    echo "  PASS: CHANGELOG.md contains entry for [$VERSION_NUM]"
    echo ""
fi

# ==================================================================
# STEP 4: Git Commit
# ==================================================================

echo "Step 4: Git commit"
echo "------------------"

if [ -n "$DRY_RUN" ]; then
    echo "  [DRY RUN] Would run: git add plugin/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md"
    echo "  [DRY RUN] Would commit: chore: release $VERSION"
    echo ""
else
    git -C "$REPO_ROOT" add \
        plugin/.claude-plugin/plugin.json \
        .claude-plugin/marketplace.json \
        CHANGELOG.md
    git -C "$REPO_ROOT" commit -m "chore: release $VERSION"
    echo "  DONE: Committed version updates for $VERSION"
    echo ""
fi

# ==================================================================
# STEP 5: Tag and Push
# ==================================================================

echo "Step 5: Tag and push"
echo "--------------------"

if [ -n "$DRY_RUN" ]; then
    echo "  [DRY RUN] Would run: git tag -a $VERSION -m \"Release $VERSION\""
    echo "  [DRY RUN] Would run: git push origin $BRANCH"
    echo "  [DRY RUN] Would run: git push origin $VERSION"
    echo ""
else
    git -C "$REPO_ROOT" tag -a "$VERSION" -m "Release $VERSION"
    echo "  DONE: Tag $VERSION created"

    git -C "$REPO_ROOT" push origin "$BRANCH"
    echo "  DONE: Pushed commits to origin/$BRANCH"

    git -C "$REPO_ROOT" push origin "$VERSION"
    echo "  DONE: Pushed tag $VERSION to origin"
    echo ""
fi

# ==================================================================
# COMPLETE
# ==================================================================

if [ -n "$DRY_RUN" ]; then
    echo "========================================"
    echo "DRY RUN COMPLETE - No changes were made"
    echo "========================================"
    echo ""
    echo "To perform the actual release, run:"
    echo "  bash scripts/release/release.sh $VERSION"
    echo ""
    echo "Summary of what would happen:"
    echo "  Step 1: Run pre-release-check.sh $VERSION"
    echo "  Step 2: bump-version.sh: manifests -> $VERSION_NUM"
    echo "  Step 3: Verify CHANGELOG.md entry for [$VERSION_NUM]"
    echo "  Step 4: git add manifests + CHANGELOG.md && git commit 'chore: release $VERSION'"
    echo "  Step 5: git tag -a $VERSION && git push origin $BRANCH && git push origin $VERSION"
    echo ""
else
    echo "========================================"
    echo "Release $VERSION Complete"
    echo "========================================"
    echo ""
    echo "Monitor GitHub Actions:"
    echo "  https://github.com/yaleh/baime/actions"
    echo ""
    echo "Release URL (once workflow completes):"
    echo "  https://github.com/yaleh/baime/releases/tag/$VERSION"
    echo ""
fi
