#!/bin/bash
# Pre-release validation script for baime
#
# Purpose: Validate all release requirements locally BEFORE creating git tag
# Usage: ./scripts/release/pre-release-check.sh <version>
# Example: ./scripts/release/pre-release-check.sh v1.0.0
#
# 7 checks:
#   1. git working directory is clean (no uncommitted changes)
#   2. current branch is main (warning, not blocking)
#   3. target tag does not already exist
#   4. plugin/.claude-plugin/plugin.json and .claude-plugin/marketplace.json
#      versions are consistent
#   5. bash scripts/validate-plugin.sh passes
#   6. CHANGELOG.md contains entry for target version
#   7. jq is available

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v1.0.0"
    exit 1
fi

# Remove 'v' prefix for version comparison
VERSION_NUM=${VERSION#v}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "========================================="
echo "Pre-Release Validation"
echo "========================================="
echo "Target version: $VERSION ($VERSION_NUM)"
echo ""

# ==================================================================
# VALIDATION TRACKING
# ==================================================================

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=()
WARNINGS=()

check_result() {
    local check_name="$1"
    local result="$2"
    local error_msg="$3"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    if [ "$result" = "pass" ]; then
        echo "  PASS: $check_name"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    elif [ "$result" = "warn" ]; then
        echo "  WARN: $check_name"
        WARNINGS+=("$check_name: $error_msg")
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo "  FAIL: $check_name"
        if [ -n "$error_msg" ]; then
            echo "        $error_msg"
        fi
        FAILED_CHECKS+=("$check_name: $error_msg")
    fi
}

# ==================================================================
# CHECK 1: jq available
# ==================================================================

echo "Check 1: Tool Dependencies"
echo "--------------------------"

if command -v jq >/dev/null 2>&1; then
    check_result "jq is available" "pass"
else
    check_result "jq is available" "fail" "jq not found. Install: sudo apt-get install jq"
fi

echo ""

# ==================================================================
# CHECK 2: Git Repository Status
# ==================================================================

echo "Check 2: Git Repository Status"
echo "-------------------------------"

# Check 2.1: Working directory is clean
if [ -z "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
    check_result "Working directory is clean" "pass"
else
    check_result "Working directory is clean" "fail" "Uncommitted changes detected. Run 'git status'"
fi

# Check 2.2: On main branch (warning only)
BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ]; then
    check_result "On main branch" "pass"
else
    check_result "On main branch" "warn" "Current branch: $BRANCH (releases are usually from main)"
fi

# Check 2.3: Tag doesn't already exist
if git -C "$REPO_ROOT" rev-parse "$VERSION" >/dev/null 2>&1; then
    check_result "Tag does not already exist" "fail" "Tag $VERSION already exists. Delete with: git tag -d $VERSION"
else
    check_result "Tag does not already exist" "pass"
fi

echo ""

# ==================================================================
# CHECK 3: Version Consistency
# ==================================================================

echo "Check 3: Version Consistency"
echo "----------------------------"

PLUGIN_JSON="$REPO_ROOT/plugin/.claude-plugin/plugin.json"
MARKETPLACE_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"

# Check 3.1: plugin.json version matches target
if [ -f "$PLUGIN_JSON" ]; then
    PLUGIN_VERSION=$(jq -r '.version' "$PLUGIN_JSON" 2>/dev/null || echo "UNKNOWN")
    if [ "$PLUGIN_VERSION" = "$VERSION_NUM" ]; then
        check_result "plugin.json version matches ($VERSION_NUM)" "pass"
    else
        check_result "plugin.json version matches" "fail" \
            "plugin.json has '$PLUGIN_VERSION' but target is '$VERSION_NUM'. Run: bash scripts/release/bump-version.sh $VERSION"
    fi
else
    check_result "plugin.json exists" "fail" "File not found: plugin/.claude-plugin/plugin.json"
    PLUGIN_VERSION="MISSING"
fi

# Check 3.2: marketplace.json version matches target
if [ -f "$MARKETPLACE_JSON" ]; then
    MARKETPLACE_VERSION=$(jq -r '.plugins[0].version' "$MARKETPLACE_JSON" 2>/dev/null || echo "UNKNOWN")
    if [ "$MARKETPLACE_VERSION" = "$VERSION_NUM" ]; then
        check_result "marketplace.json version matches ($VERSION_NUM)" "pass"
    else
        check_result "marketplace.json version matches" "fail" \
            "marketplace.json has '$MARKETPLACE_VERSION' but target is '$VERSION_NUM'. Run: bash scripts/release/bump-version.sh $VERSION"
    fi
else
    check_result "marketplace.json exists" "fail" "File not found: .claude-plugin/marketplace.json"
    MARKETPLACE_VERSION="MISSING"
fi

# Check 3.3: Both versions agree with each other
if [ "$PLUGIN_VERSION" != "MISSING" ] && [ "$MARKETPLACE_VERSION" != "MISSING" ]; then
    if [ "$PLUGIN_VERSION" = "$MARKETPLACE_VERSION" ]; then
        check_result "plugin.json and marketplace.json versions are consistent ($PLUGIN_VERSION)" "pass"
    else
        check_result "plugin.json and marketplace.json versions are consistent" "fail" \
            "plugin.json=$PLUGIN_VERSION, marketplace.json=$MARKETPLACE_VERSION"
    fi
fi

echo ""

# ==================================================================
# CHECK 4: Plugin Validation
# ==================================================================

echo "Check 4: Plugin Validation (validate-plugin.sh)"
echo "------------------------------------------------"

VALIDATE_SCRIPT="$REPO_ROOT/scripts/validate-plugin.sh"
if [ -f "$VALIDATE_SCRIPT" ]; then
    if bash "$VALIDATE_SCRIPT" >/dev/null 2>&1; then
        check_result "validate-plugin.sh passes (JSON + YAML frontmatter + counts)" "pass"
    else
        VALIDATE_OUTPUT=$(bash "$VALIDATE_SCRIPT" 2>&1 | tail -5)
        check_result "validate-plugin.sh passes" "fail" \
            "Run 'bash scripts/validate-plugin.sh' for details"
    fi
else
    check_result "validate-plugin.sh exists" "fail" "Script not found: scripts/validate-plugin.sh"
fi

echo ""

# ==================================================================
# CHECK 5: CHANGELOG
# ==================================================================

echo "Check 5: CHANGELOG.md"
echo "---------------------"

CHANGELOG="$REPO_ROOT/CHANGELOG.md"
if [ -f "$CHANGELOG" ]; then
    if grep -q "\[$VERSION_NUM\]" "$CHANGELOG"; then
        check_result "CHANGELOG.md contains entry for [$VERSION_NUM]" "pass"
    else
        check_result "CHANGELOG.md contains entry for [$VERSION_NUM]" "fail" \
            "No entry for [$VERSION_NUM] in CHANGELOG.md. Please add a release entry."
    fi
else
    check_result "CHANGELOG.md exists" "fail" "File not found: CHANGELOG.md"
fi

echo ""

# ==================================================================
# RESULTS SUMMARY
# ==================================================================

echo "========================================="
echo "Pre-Release Validation Results"
echo "========================================="
echo "Total checks:  $TOTAL_CHECKS"
echo "Passed:        $PASSED_CHECKS"
echo "Failed:        $((TOTAL_CHECKS - PASSED_CHECKS))"
echo ""

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "Warnings:"
    for warning in "${WARNINGS[@]}"; do
        echo "  WARN: $warning"
    done
    echo ""
fi

if [ ${#FAILED_CHECKS[@]} -gt 0 ]; then
    echo "Failed Checks:"
    for failure in "${FAILED_CHECKS[@]}"; do
        echo "  FAIL: $failure"
    done
    echo ""
    echo "PRE-RELEASE VALIDATION FAILED"
    echo ""
    echo "Action Required:"
    echo "  1. Fix the issues listed above"
    echo "  2. Re-run this script: $0 $VERSION"
    echo "  3. Once all checks pass, proceed with release"
    exit 1
else
    echo "ALL PRE-RELEASE CHECKS PASSED"
    echo ""
    echo "Next steps:"
    echo "  Run the release script: bash scripts/release/release.sh $VERSION"
    exit 0
fi
