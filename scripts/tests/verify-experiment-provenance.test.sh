#!/usr/bin/env bash
# verify-experiment-provenance.test.sh — TDD spec for verify-experiment-provenance.sh
#
# Tests: no-op (no artifacts), data_source:estimated FAIL, data_source:measured PASS,
# pre-registration timestamp PASS/FAIL/SKIP.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS_DIR="$(dirname "$SCRIPT_DIR")"
GUARD="$SCRIPTS_DIR/verify-experiment-provenance.sh"

PASS=0
FAIL=0
check() {
    if [ "$2" -eq "$3" ]; then
        echo "  PASS: $1"
        PASS=$((PASS+1))
    else
        echo "  FAIL: $1 (expected exit $2, got $3)"
        FAIL=$((FAIL+1))
    fi
}

# ── Phase A Tests ─────────────────────────────────────────────────────────────

# Test 1: no-op — no experiments/*/artifacts/ at all → exit 0
TMPROOT=$(mktemp -d)
bash "$GUARD" --repo-root "$TMPROOT" >/dev/null 2>&1
check "no-op: no experiments/artifacts → exit 0" 0 $?
rm -rf "$TMPROOT"

# Test 2: FAIL — data_source: estimated in artifact → exit non-zero
TMPROOT=$(mktemp -d)
mkdir -p "$TMPROOT/experiments/exp-test/artifacts"
cat > "$TMPROOT/experiments/exp-test/artifacts/results.json" <<'EOF'
{
  "data_source": "estimated",
  "value": 42
}
EOF
bash "$GUARD" --repo-root "$TMPROOT" >/dev/null 2>&1
check "estimated data_source → exit non-zero" 1 $?
rm -rf "$TMPROOT"

# Test 3: PASS — data_source: measured in artifact → exit 0
TMPROOT=$(mktemp -d)
mkdir -p "$TMPROOT/experiments/exp-test/artifacts"
cat > "$TMPROOT/experiments/exp-test/artifacts/results.json" <<'EOF'
{
  "data_source": "measured",
  "value": 42
}
EOF
bash "$GUARD" --repo-root "$TMPROOT" >/dev/null 2>&1
check "measured data_source → exit 0" 0 $?
rm -rf "$TMPROOT"

# ── Phase B Tests ─────────────────────────────────────────────────────────────

# Test 4: pre-reg PASS — first_llm_call_ts AFTER hypotheses.md git commit → exit 0
# We fake this by using a real git repo with a hypotheses.md that was committed long
# ago, and an artifact whose first_llm_call_ts is in the future (year 2099).
TMPROOT=$(mktemp -d)
mkdir -p "$TMPROOT/experiments/exp-ts/artifacts"
# Create a minimal git repo so git log works
git -C "$TMPROOT" init -q
git -C "$TMPROOT" config user.email "test@test.com"
git -C "$TMPROOT" config user.name "Test"
mkdir -p "$TMPROOT/experiments/exp-ts"
echo "# hypotheses" > "$TMPROOT/experiments/exp-ts/hypotheses.md"
git -C "$TMPROOT" add "$TMPROOT/experiments/exp-ts/hypotheses.md"
GIT_AUTHOR_DATE="2020-01-01T00:00:00Z" GIT_COMMITTER_DATE="2020-01-01T00:00:00Z" \
    git -C "$TMPROOT" commit -q -m "add hypotheses"
cat > "$TMPROOT/experiments/exp-ts/artifacts/results.json" <<'EOF'
{
  "data_source": "measured",
  "first_llm_call_ts": "2099-01-01T00:00:00Z"
}
EOF
bash "$GUARD" --repo-root "$TMPROOT" >/dev/null 2>&1
check "pre-reg PASS: artifact ts after hypotheses commit → exit 0" 0 $?
rm -rf "$TMPROOT"

# Test 5: pre-reg FAIL — first_llm_call_ts BEFORE hypotheses.md git commit → exit non-zero
TMPROOT=$(mktemp -d)
mkdir -p "$TMPROOT/experiments/exp-ts/artifacts"
git -C "$TMPROOT" init -q
git -C "$TMPROOT" config user.email "test@test.com"
git -C "$TMPROOT" config user.name "Test"
mkdir -p "$TMPROOT/experiments/exp-ts"
echo "# hypotheses" > "$TMPROOT/experiments/exp-ts/hypotheses.md"
git -C "$TMPROOT" add "$TMPROOT/experiments/exp-ts/hypotheses.md"
GIT_AUTHOR_DATE="2099-01-01T00:00:00Z" GIT_COMMITTER_DATE="2099-01-01T00:00:00Z" \
    git -C "$TMPROOT" commit -q -m "add hypotheses"
cat > "$TMPROOT/experiments/exp-ts/artifacts/results.json" <<'EOF'
{
  "data_source": "measured",
  "first_llm_call_ts": "2020-01-01T00:00:00Z"
}
EOF
bash "$GUARD" --repo-root "$TMPROOT" >/dev/null 2>&1
check "pre-reg FAIL: artifact ts before hypotheses commit → exit non-zero" 1 $?
rm -rf "$TMPROOT"

# Test 6: pre-reg SKIP — artifact has first_llm_call_ts but no hypotheses.md → exit 0
TMPROOT=$(mktemp -d)
mkdir -p "$TMPROOT/experiments/exp-ts/artifacts"
git -C "$TMPROOT" init -q
git -C "$TMPROOT" config user.email "test@test.com"
git -C "$TMPROOT" config user.name "Test"
# No hypotheses.md committed
cat > "$TMPROOT/experiments/exp-ts/artifacts/results.json" <<'EOF'
{
  "data_source": "measured",
  "first_llm_call_ts": "2020-01-01T00:00:00Z"
}
EOF
bash "$GUARD" --repo-root "$TMPROOT" >/dev/null 2>&1
check "pre-reg SKIP: no hypotheses.md exists → exit 0" 0 $?
rm -rf "$TMPROOT"

# ── Phase C Tests ─────────────────────────────────────────────────────────────

# Test 7: validate-plugin.sh references verify-experiment-provenance
VALIDATE_SH="$SCRIPTS_DIR/validate-plugin.sh"
grep -q 'verify-experiment-provenance' "$VALIDATE_SH" >/dev/null 2>&1
check "validate-plugin.sh references verify-experiment-provenance" 0 $?

echo ""
echo "verify-experiment-provenance.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
