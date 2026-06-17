#!/bin/bash
# Tests for Phase B: daemon bootstrap in SKILL.md
set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
SKILL_MD="$REPO_ROOT/.claude/skills/loop-backlog/SKILL.md"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; exit 1; }

test_skill_md_has_daemon_bootstrap_section() {
    grep -q "daemonBootstrap" "$SKILL_MD" \
        || fail "test_skill_md_has_daemon_bootstrap_section"
    pass "test_skill_md_has_daemon_bootstrap_section"
}

test_skill_md_has_monitor_in_allowed_tools() {
    grep -q "Monitor" "$SKILL_MD" \
        || fail "test_skill_md_has_monitor_in_allowed_tools"
    pass "test_skill_md_has_monitor_in_allowed_tools"
}

test_skill_md_no_schedulewakeup_in_allowed_tools() {
    ! grep -q "ScheduleWakeup" "$SKILL_MD" \
        || fail "test_skill_md_no_schedulewakeup_in_allowed_tools: ScheduleWakeup still present"
    pass "test_skill_md_no_schedulewakeup_in_allowed_tools"
}

test_skill_md_references_daemon_script() {
    grep -q "loop-backlog-daemon.py" "$SKILL_MD" \
        || fail "test_skill_md_references_daemon_script"
    pass "test_skill_md_references_daemon_script"
}

test_skill_md_references_pid_file() {
    grep -q ".daemon.pid" "$SKILL_MD" \
        || fail "test_skill_md_references_pid_file"
    pass "test_skill_md_references_pid_file"
}

echo "=== loop-backlog skill bootstrap tests ==="
test_skill_md_has_daemon_bootstrap_section
test_skill_md_has_monitor_in_allowed_tools
test_skill_md_no_schedulewakeup_in_allowed_tools
test_skill_md_references_daemon_script
test_skill_md_references_pid_file
echo "=== All tests passed ==="
