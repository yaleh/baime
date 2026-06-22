#!/usr/bin/env bash
# check-roi-gate.sh — ROI gate measurement report for loop-meta P3→P4 decision.
#
# Scans backlog task notes for evaluator slice conclusions and replan trigger events.
# All measurements are data_source: measured (no estimates).
#
# Exit code reflects the gate DECISION (R2 — exit 0 must mean "gate unlocked",
# not merely "report produced"; see TASK-93 post-mortem):
#   PROCEED → exit 0   (P4 automation warranted)
#   HOLD    → exit 2   (runaway | unstable | no data | quality)
# The report body is always printed regardless of exit code.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASKS_DIR="$REPO_ROOT/backlog/tasks"
ARCHIVE_DIR="$REPO_ROOT/backlog/archive/tasks"
EMIT_JSON=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tasks-dir) TASKS_DIR="$2"; shift 2 ;;
    --emit-json) EMIT_JSON="$2"; shift 2 ;;
    *) shift ;;
  esac
done
BASELINE_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

replan_events=0
evaluator_met=0
evaluator_not_met=0
total_tasks=0
meta_task_cycles=0

# Scan both active tasks and archive (cycles may have been archived after Meta-Done)
for f in "$TASKS_DIR"/*.md "$ARCHIVE_DIR"/*.md; do
  [ -f "$f" ] || continue
  total_tasks=$((total_tasks + 1))

  # is_cycle: frontmatter status=Meta-Done (first 20 lines) AND evaluator line present anywhere
  is_cycle=0
  if awk 'NR<=20 && /^status: Meta-Done/{found=1} END{exit !found}' "$f" 2>/dev/null \
     && grep -q 'evaluator: Met\|evaluator: NotMet' "$f" 2>/dev/null; then
    meta_task_cycles=$((meta_task_cycles + 1))
    is_cycle=1
  fi

  while IFS= read -r line; do
    case "$line" in
      *"replan: "*" — "*)
        [ "$is_cycle" -eq 1 ] && replan_events=$((replan_events + 1)) ;;
      *"evaluator: Met"*)
        [ "$is_cycle" -eq 1 ] && evaluator_met=$((evaluator_met + 1)) ;;
      *"evaluator: NotMet"*)
        [ "$is_cycle" -eq 1 ] && evaluator_not_met=$((evaluator_not_met + 1)) ;;
    esac
  done < "$f"
done

evaluator_total=$((evaluator_met + evaluator_not_met))

echo "============================================================"
echo " ROI Gate Measurement Report"
echo " Generated: ${BASELINE_TS}"
echo " data_source: measured"
echo "============================================================"
echo ""
echo " Task corpus"
echo "   Total tasks scanned:        ${total_tasks}"
echo "   Meta-task cycles detected:  ${meta_task_cycles}"
echo ""
echo " Evaluator slice results"
echo "   Met:     ${evaluator_met}"
echo "   NotMet:  ${evaluator_not_met}"
echo "   Total:   ${evaluator_total}"
if [ "$evaluator_total" -gt 0 ]; then
  pct=$(( evaluator_met * 100 / evaluator_total ))
  echo "   Met rate: ${pct}%"
else
  pct=0
  echo "   Met rate: N/A (no slices recorded yet)"
fi
echo ""
echo " Replan trigger events"
echo "   Total replan events:        ${replan_events}"
rate_x10=0
[ "$meta_task_cycles" -gt 0 ] && rate_x10=$(( replan_events * 10 / meta_task_cycles ))
if [ "$meta_task_cycles" -gt 0 ]; then
  echo "   Rate (per 10 cycles):       ${rate_x10}"
else
  echo "   Rate (per 10 cycles):       N/A (no meta-task cycles yet)"
fi
echo ""

# P4 gate decision — anomaly upper-bounds then quality gates
GATE_RESULT=""
GATE_REASON=""
GATE_ACTION=""
gate_decision_reason=""
gate_exit=2

if [ "$meta_task_cycles" -ge 20 ]; then
  GATE_RESULT="HOLD"
  GATE_REASON="Runaway — cycle count ${meta_task_cycles} exceeds upper bound (20); meta-loop may be stuck"
  GATE_ACTION="Inspect and archive stale meta-task cycles, then re-run gate"
  gate_decision_reason="runaway"
  gate_exit=2
elif [ "$evaluator_total" -gt 0 ] && [ "$rate_x10" -gt 5 ]; then
  GATE_RESULT="HOLD"
  GATE_REASON="Unstable — replan rate ${rate_x10}/10 exceeds threshold (5/10); system is not converging"
  GATE_ACTION="Investigate replan triggers; improve sub-task quality before enabling P4"
  gate_decision_reason="unstable"
  gate_exit=2
elif [ "$evaluator_total" -eq 0 ]; then
  GATE_RESULT="HOLD"
  GATE_REASON="No data — no evaluator slices recorded yet"
  GATE_ACTION="Run meta-task cycles through evaluateAndReplan, then re-run gate"
  gate_decision_reason="no_data"
  gate_exit=2
elif [ "$pct" -lt 70 ]; then
  GATE_RESULT="HOLD"
  GATE_REASON="Quality — evaluator slice agreement ${pct}% < 70%; reliability insufficient"
  GATE_ACTION="Improve evaluator slice quality before enabling P4 automation"
  gate_decision_reason="quality"
  gate_exit=2
else
  GATE_RESULT="PROCEED"
  GATE_REASON="Evaluator reliable (${pct}% Met), no anomalies detected — P4 automation is warranted"
  gate_decision_reason="ok"
  gate_exit=0
fi

echo " P4 Gate Decision"
echo "   Result: $GATE_RESULT"
echo "   Reason: $GATE_REASON"
[ -n "${GATE_ACTION:-}" ] && echo "   Action: $GATE_ACTION"
echo ""
echo " Baseline note: PROCEED requires evaluator data (>0 slices), Met%>=70%,"
echo "   cycle count<20, and replan rate<=5/10. Zero events = pre-P3 baseline."
echo "============================================================"

# R4: emit a provenance-stamped baseline JSON. This is the ONLY sanctioned way to
# produce replan-stats.json — it carries generated_by so verify-provenance.sh can
# trace it. A hand-written baseline (TASK-93) has no generated_by and fails the gate.
if [ -n "$EMIT_JSON" ]; then
  mkdir -p "$(dirname "$EMIT_JSON")"
  cat > "$EMIT_JSON" <<JSON
{
  "data_source": "measured",
  "generated_by": "scripts/check-roi-gate.sh",
  "generated_at": "${BASELINE_TS}",
  "tasks_dir": "${TASKS_DIR}",
  "meta_task_cycles": ${meta_task_cycles},
  "replan_total": ${replan_events},
  "evaluator": { "Met": ${evaluator_met}, "NotMet": ${evaluator_not_met} },
  "decision": "${GATE_RESULT:-HOLD}",
  "decision_reason": "${gate_decision_reason:-no_data}"
}
JSON
  echo " Baseline JSON written to ${EMIT_JSON} (data_source: measured, generated_by: check-roi-gate.sh)"
fi

# R2: exit code reflects the gate decision (PROCEED→0 / HOLD→2)
exit "${gate_exit}"
