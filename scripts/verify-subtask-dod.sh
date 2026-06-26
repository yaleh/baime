#!/usr/bin/env bash
# verify-subtask-dod.sh — assert every child sub-task of a meta-task carries a
# non-empty Definition of Done shell-gate.
#
# R1 root-cause guard: sub-tasks created without a verifiable DoD can be
# rubber-stamped Done without doing the work (TASK-93 post-mortem). loop-meta
# runs this after decomposition/reconcile so DoD-less children are caught
# mechanically instead of being trusted.
#
# Usage: verify-subtask-dod.sh <META_ID> [--tasks-dir DIR]
#   Exit 0: every child has a Definition of Done with ≥1 checkbox item.
#   Exit 1: one or more children have no DoD (offenders listed on stdout).
#   Exit 2: usage error / meta-task arg missing / no children found.
set -uo pipefail

META_ID=""
TASKS_DIR="backlog/tasks"
ARCHIVE_DIR="backlog/archive/tasks"
while [ $# -gt 0 ]; do
  case "$1" in
    --tasks-dir) TASKS_DIR="$2"; shift 2 ;;
    -h|--help)   echo "Usage: verify-subtask-dod.sh <META_ID> [--tasks-dir DIR]"; exit 2 ;;
    *)           if [ -z "$META_ID" ]; then META_ID="$1"; fi; shift ;;
  esac
done

if [ -z "$META_ID" ]; then
  echo "verify-subtask-dod: missing META_ID argument" >&2
  exit 2
fi
META_ID="$(echo "$META_ID" | tr '[:lower:]' '[:upper:]')"

frontmatterValue() {
  local key="$1" file="$2"
  awk -v key="$key" '
    BEGIN { in_fm=0 }
    NR == 1 && $0 == "---" { in_fm=1; next }
    in_fm && $0 == "---" { exit }
    in_fm {
      split($0, parts, ":")
      field = parts[1]
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", field)
      if (tolower(field) == tolower(key)) {
        sub(/^[^:]*:[[:space:]]*/, "", $0)
        gsub(/^[[:space:]"'\''"]+|[[:space:]"'\''"]+$/, "", $0)
        print $0
        exit
      }
    }
  ' "$file"
}

# hasDod: 0 if file has a "## Definition of Done" section containing at least
# one "- [ ]" checkbox item before the next "## " heading or EOF.
hasDod() {
  awk '
    /^## Definition of Done/ { indod=1; next }
    indod && /^## /          { indod=0 }
    indod && /^- \[[ xX]\]/  { found_dod=1 }
    /^## Phase /             { phase_count++ }
    /^## Acceptance Gate/    { found_gate=1 }
    /^### Tests/             { found_tests=1 }
    END {
      if (!found_dod)   exit 1
      if (!phase_count) exit 1
      if (!found_tests) exit 1
      if (!found_gate)  exit 1
      exit 0
    }
  ' "$1"
}

children=0
offenders=()
# Scan both active and archive directories (sub-tasks may be archived after completion)
for scan_dir in "$TASKS_DIR" "$ARCHIVE_DIR"; do
  [ -d "$scan_dir" ] || continue
  for f in "$scan_dir"/*.md; do
    [ -f "$f" ] || continue
    parent="$(frontmatterValue "parent_task_id" "$f" | tr -d '[:space:]' | tr '[:lower:]' '[:upper:]')"
    [ "$parent" = "$META_ID" ] || continue
    children=$((children + 1))
    cid="$(frontmatterValue "id" "$f" | tr -d '[:space:]' | tr '[:lower:]' '[:upper:]')"
    [ -n "$cid" ] || cid="$(basename "$f")"
    if ! hasDod "$f"; then
      offenders+=("$cid")
    fi
  done
done

if [ "$children" -eq 0 ]; then
  echo "verify-subtask-dod: no children found for $META_ID in $TASKS_DIR or $ARCHIVE_DIR" >&2
  exit 2
fi

if [ "${#offenders[@]}" -gt 0 ]; then
  echo "verify-subtask-dod: FAIL — ${#offenders[@]}/${children} child sub-task(s) of $META_ID have no Definition of Done:"
  for o in "${offenders[@]}"; do echo "  - $o (no shell-gate DoD — cannot be verified, rubber-stamp risk)"; done
  exit 1
fi

echo "verify-subtask-dod: PASS — all ${children} child sub-task(s) of $META_ID carry a Definition of Done shell-gate"
exit 0
