#!/usr/bin/env bash
# verify-subtask-dod.test.sh — TDD spec for verify-subtask-dod.sh
#
# The guard asserts every child sub-task of a meta-task carries a non-empty
# Definition of Done shell-gate. This is the R1 root-cause defense: sub-tasks
# created without a verifiable DoD can be rubber-stamped Done without doing the
# work (see TASK-93 post-mortem). The guard makes that mechanically detectable.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GUARD="$SCRIPT_DIR/verify-subtask-dod.sh"

PASS=0
FAIL=0
check() { # check <name> <expected_exit> <actual_exit>
  if [ "$2" -eq "$3" ]; then
    echo "  PASS: $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $1 (expected exit $2, got $3)"
    FAIL=$((FAIL + 1))
  fi
}

# ---- fixture builders ---------------------------------------------------
mk_meta() { # mk_meta <dir> <id>
  cat > "$1/task-${2#TASK-} - meta.md" <<EOF
---
id: $2
title: meta fixture
status: Meta-Active
---
## Implementation Plan
plan body
EOF
}

mk_child_with_dod() { # mk_child_with_dod <dir> <id> <parent>
  cat > "$1/task-${2#TASK-} - child-dod.md" <<EOF
---
id: $2
title: child with dod
status: Backlog
parent_task_id: $3
---
## Phase A: Work
### Tests (write first)
Test X.
### Implementation
Impl.
### DoD
- [ ] bash scripts/validate-plugin.sh

## Acceptance Gate
- [ ] bash scripts/validate-plugin.sh

## Definition of Done

- [ ] #1 test -f /tmp/whatever
- [ ] #2 grep -q foo /tmp/whatever
EOF
}

mk_child_no_dod() { # mk_child_no_dod <dir> <id> <parent>
  cat > "$1/task-${2#TASK-} - child-nodod.md" <<EOF
---
id: $2
title: rubber-stamped child
status: Done
parent_task_id: $3
---
## Implementation Notes

Result: Done
EOF
}

mk_child_empty_dod() { # mk_child_empty_dod <dir> <id> <parent>
  cat > "$1/task-${2#TASK-} - child-emptydod.md" <<EOF
---
id: $2
title: child with empty dod section
status: Backlog
parent_task_id: $3
---
## Definition of Done

## Implementation Notes
nothing checkable here
EOF
}

# ---- Test 1: all children have a DoD → exit 0 ---------------------------
T1=$(mktemp -d)
mk_meta "$T1" TASK-900
mk_child_with_dod "$T1" TASK-900.1 TASK-900
mk_child_with_dod "$T1" TASK-900.2 TASK-900
bash "$GUARD" TASK-900 --tasks-dir "$T1" >/dev/null 2>&1
check "all children have DoD → exit 0" 0 $?
rm -rf "$T1"

# ---- Test 2: one DoD-less child → exit 1 --------------------------------
T2=$(mktemp -d)
mk_meta "$T2" TASK-901
mk_child_with_dod "$T2" TASK-901.1 TASK-901
mk_child_no_dod   "$T2" TASK-901.2 TASK-901
bash "$GUARD" TASK-901 --tasks-dir "$T2" >/dev/null 2>&1
check "one rubber-stamped (no DoD) child → exit 1" 1 $?
rm -rf "$T2"

# ---- Test 3: offender id is reported on stderr --------------------------
T3=$(mktemp -d)
mk_meta "$T3" TASK-902
mk_child_no_dod "$T3" TASK-902.1 TASK-902
OUT=$(bash "$GUARD" TASK-902 --tasks-dir "$T3" 2>&1)
echo "$OUT" | grep -q "TASK-902.1"
check "offender id reported in output" 0 $?
rm -rf "$T3"

# ---- Test 4: DoD section present but empty (no - [ ] items) → exit 1 ----
T4=$(mktemp -d)
mk_meta "$T4" TASK-903
mk_child_empty_dod "$T4" TASK-903.1 TASK-903
bash "$GUARD" TASK-903 --tasks-dir "$T4" >/dev/null 2>&1
check "empty DoD section (no items) → exit 1" 1 $?
rm -rf "$T4"

# ---- Test 5: meta with no children → exit 2 (usage/empty) ---------------
T5=$(mktemp -d)
mk_meta "$T5" TASK-904
bash "$GUARD" TASK-904 --tasks-dir "$T5" >/dev/null 2>&1
check "meta with no children → exit 2" 2 $?
rm -rf "$T5"

# ---- Test 6: missing META_ID arg → exit 2 -------------------------------
bash "$GUARD" --tasks-dir /tmp >/dev/null 2>&1
check "missing META_ID arg → exit 2" 2 $?

# ---- summary ------------------------------------------------------------
echo ""
echo "verify-subtask-dod.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
