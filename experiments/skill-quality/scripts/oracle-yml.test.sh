#!/usr/bin/env bash
# oracle-yml.test.sh — Tests for .github/workflows/oracle.yml
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ORACLE_YML="$REPO_ROOT/.github/workflows/oracle.yml"

PASS=0
FAIL=0

check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "0" ]; then
    echo "PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $name"
    FAIL=$((FAIL + 1))
  fi
}

# job a present
grep -q 'oracle-class-a:' "$ORACLE_YML"
check "job_a_present" "$?"

# job b present
grep -q 'oracle-class-b:' "$ORACLE_YML"
check "job_b_present" "$?"

# job order correct: oracle-class-c comes before oracle-class-a
LINE_C=$(grep -n 'oracle-class-c:' "$ORACLE_YML" | head -1 | cut -d: -f1)
LINE_A=$(grep -n 'oracle-class-a:' "$ORACLE_YML" | head -1 | cut -d: -f1)
[ "$LINE_C" -lt "$LINE_A" ]
check "job_order_c_before_a" "$?"

# oracle-class-a comes before oracle-class-b
LINE_B=$(grep -n 'oracle-class-b:' "$ORACLE_YML" | head -1 | cut -d: -f1)
[ "$LINE_A" -lt "$LINE_B" ]
check "job_order_a_before_b" "$?"

# trigger paths present
grep -q 'fixtures/exp-b/class-a/' "$ORACLE_YML"
check "trigger_class_a_fixtures" "$?"

grep -q 'fixtures/exp-b/class-b/' "$ORACLE_YML"
check "trigger_class_b_fixtures" "$?"

grep -q 'task-from-template/SKILL.md' "$ORACLE_YML"
check "trigger_task_from_template" "$?"

grep -q 'task-to-backlog/SKILL.md' "$ORACLE_YML"
check "trigger_task_to_backlog" "$?"

grep -q 'feature-to-backlog/SKILL.md' "$ORACLE_YML"
check "trigger_feature_to_backlog" "$?"

# invocations correct
grep -q 'run-oracle-class-a.ts --threshold 0.85 --k 5' "$ORACLE_YML"
check "invocation_class_a" "$?"

grep -q 'run-oracle-class-b.ts --threshold 0.70 --k 5' "$ORACLE_YML"
check "invocation_class_b" "$?"

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
