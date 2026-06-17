#!/bin/bash
# Tests for Phase C: Monitor-based workerLoop in SKILL.md
set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
SKILL_MD="$REPO_ROOT/.claude/skills/loop-backlog/SKILL.md"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; exit 1; }

test_workerloop_spec_uses_monitor() {
    grep -q "Monitor(timeout=600)" "$SKILL_MD" \
        || fail "test_workerloop_spec_uses_monitor"
    pass "test_workerloop_spec_uses_monitor"
}

test_workerloop_spec_no_schedule_call() {
    ! grep -q "schedule(" "$SKILL_MD" \
        || fail "test_workerloop_spec_no_schedule_call: schedule( still present"
    pass "test_workerloop_spec_no_schedule_call"
}

test_skill_md_references_loop_stop_sentinel() {
    grep -q "loop-stop" "$SKILL_MD" \
        || fail "test_skill_md_references_loop_stop_sentinel"
    pass "test_skill_md_references_loop_stop_sentinel"
}

test_skill_md_has_shutdown_section() {
    grep -q "## Shutdown" "$SKILL_MD" \
        || fail "test_skill_md_has_shutdown_section"
    pass "test_skill_md_has_shutdown_section"
}

echo "=== loop-backlog skill monitor tests ==="
test_workerloop_spec_uses_monitor
test_workerloop_spec_no_schedule_call
test_skill_md_references_loop_stop_sentinel
test_skill_md_has_shutdown_section
echo "=== All tests passed ==="
