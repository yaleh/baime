#!/usr/bin/env bash
# TDD test: loop-backlog/SKILL.md must reference basic-daemon.js and basic-ready:
set -euo pipefail
SKILL="plugin/skills/loop-backlog/SKILL.md"
FAIL=0

# Test 1: must reference basic-daemon.js
if ! grep -q 'basic-daemon' "$SKILL"; then
  echo "FAIL Test 1: no reference to basic-daemon in $SKILL"
  FAIL=1
else
  echo "PASS Test 1: basic-daemon referenced"
fi

# Test 2: must reference basic-ready:
if ! grep -q 'basic-ready' "$SKILL"; then
  echo "FAIL Test 2: no reference to basic-ready in $SKILL"
  FAIL=1
else
  echo "PASS Test 2: basic-ready referenced"
fi

# Test 3: daemon-version tag must be present
if ! grep -qE 'daemon-version.*v[0-9]+' "$SKILL"; then
  echo "FAIL Test 3: no daemon-version tag in $SKILL"
  FAIL=1
else
  echo "PASS Test 3: daemon-version tag present"
fi

# Test 4: embedded daemon version tag must match scripts/basic-daemon.js version
SKILL_VER=$(grep -oP 'daemon-version:\s*v\K[0-9]+' "$SKILL" | head -1 || echo "")
DAEMON_VER=$(grep -oP 'daemon-version:\s*v\K[0-9]+' scripts/basic-daemon.js | head -1 || echo "")
if [ "$SKILL_VER" != "$DAEMON_VER" ]; then
  echo "FAIL Test 4: version mismatch — SKILL has v${SKILL_VER}, basic-daemon.js has v${DAEMON_VER}"
  FAIL=1
else
  echo "PASS Test 4: daemon-version tags match (v${SKILL_VER})"
fi

# Test 5: must reference basicDAG or basic worker state machine
if ! grep -qiE 'basicDAG|basic.*worker|Basic: Ready|Basic: In Progress' "$SKILL"; then
  echo "FAIL Test 5: no basicDAG or Basic:* status references in $SKILL"
  FAIL=1
else
  echo "PASS Test 5: basicDAG/Basic statuses referenced"
fi

# Test 6: must reference cap:* idempotency markers
if ! grep -q 'cap:' "$SKILL"; then
  echo "FAIL Test 6: no cap:* marker references in $SKILL"
  FAIL=1
else
  echo "PASS Test 6: cap:* markers referenced"
fi

# Test 7: must reference parent_task_id (snake_case) for notifyParentIfAny
if ! grep -q 'parent_task_id' "$SKILL"; then
  echo "FAIL Test 7: no parent_task_id reference in $SKILL"
  FAIL=1
else
  echo "PASS Test 7: parent_task_id referenced"
fi

if [ "$FAIL" -eq 0 ]; then
  echo "ALL TESTS PASSED"
  exit 0
else
  echo "TESTS FAILED"
  exit 1
fi
