#!/bin/bash
# Tests for Phase D: ensureDaemonScript in SKILL.md
set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
SKILL_MD="$REPO_ROOT/.claude/skills/loop-backlog/SKILL.md"
DAEMON_SCRIPT="$REPO_ROOT/scripts/loop-backlog-daemon.py"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; exit 1; }

test_skill_md_has_ensure_daemon_script_section() {
    grep -q "ensureDaemonScript" "$SKILL_MD" \
        || fail "test_skill_md_has_ensure_daemon_script_section"
    pass "test_skill_md_has_ensure_daemon_script_section"
}

test_daemon_script_exists_in_repo() {
    test -f "$DAEMON_SCRIPT" \
        || fail "test_daemon_script_exists_in_repo: $DAEMON_SCRIPT not found"
    pass "test_daemon_script_exists_in_repo"
}

test_daemon_script_is_valid_python() {
    python3 -c "import ast; ast.parse(open('$DAEMON_SCRIPT').read())" \
        || fail "test_daemon_script_is_valid_python"
    pass "test_daemon_script_is_valid_python"
}

echo "=== loop-backlog skill template tests ==="
test_skill_md_has_ensure_daemon_script_section
test_daemon_script_exists_in_repo
test_daemon_script_is_valid_python
echo "=== All tests passed ==="
