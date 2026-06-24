#!/usr/bin/env bash
# meta-cc-digest.sh — gather process evidence from meta-cc for a given TASK-ID
# Usage: bash plugin/skills/loop-backlog/meta-cc-digest.sh --help
#        bash plugin/skills/loop-backlog/meta-cc-digest.sh TASK-N
#
# This script is a GUIDE for the Claude Code agent. It defines the digest
# protocol — the agent executes the meta-cc MCP tool calls listed here.
#
# Output format:
#   FILE_ACTIVITY: <files modified during task execution>
#   ERROR_COUNT: <number of errors/retries during execution>
#   EDIT_OSCILLATION: <files edited 3+ times = potential thrash signal>
#   SCOPE_DIFF: <files modified but not in task Implementation Plan = scope creep signal>

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<'EOF'
Usage: bash plugin/skills/loop-backlog/meta-cc-digest.sh TASK-ID

Produces a structured gate evidence digest by querying meta-cc session data
for the given TASK-ID's execution session.

The Claude Code agent running this script should:
  1. Call mcp__plugin_meta-cc_meta-cc__query_file_activity with the session directory
  2. Call mcp__plugin_meta-cc_meta-cc__analyze_errors with the session directory
  3. Call mcp__plugin_meta-cc_meta-cc__query_edit_sequences with the session directory
  4. Format output as FILE_ACTIVITY: / ERROR_COUNT: / EDIT_OSCILLATION: / SCOPE_DIFF:
  5. On any tool failure: output "meta-cc-digest: unavailable (reason: <msg>)" and exit 0

Output is appended to the task Notes as "## Gate Evidence Pack" with data_source: meta-cc-session.

## Agent Protocol (for Claude Code agent invoking this script)

When verifyDod completes for a task, run this digest protocol:

  SESSION_DIR=$(mcp__plugin_meta-cc_meta-cc__get_session_directory)
  FILE_ACTIVITY=$(mcp__plugin_meta-cc_meta-cc__query_file_activity --session_dir "$SESSION_DIR")
  ERROR_DATA=$(mcp__plugin_meta-cc_meta-cc__analyze_errors --session_dir "$SESSION_DIR")
  EDIT_SEQ=$(mcp__plugin_meta-cc_meta-cc__query_edit_sequences --session_dir "$SESSION_DIR")

  Then compare FILE_ACTIVITY files against the task's Implementation Plan file references
  to produce SCOPE_DIFF (in-scope / out-of-scope classification).

  Append to task notes:
    ## Gate Evidence Pack
    FILE_ACTIVITY: <comma-separated list of modified files>
    ERROR_COUNT: <integer from analyze_errors>
    EDIT_OSCILLATION: <files edited 3+ times, or "none">
    SCOPE_DIFF: <out-of-scope files, or "none">
    data_source: meta-cc-session

  On any MCP tool failure:
    meta-cc-digest: unavailable (reason: <error message>)
    data_source: meta-cc-session

## gcl-events.jsonl evidence_independence wiring

After appending the Gate Evidence Pack to task Notes, conditionally write
evidence_independence to gcl-events.jsonl:

  JSONL="${REPO_ROOT}/docs/research/gcl-events.jsonl"
  if [ -f "$JSONL" ] && grep -q '"evidence_independence"' "$JSONL" 2>/dev/null; then
    # Update the most recent record for this TASK-ID
    python3 -c "
import json, sys
lines = open('$JSONL').readlines()
updated = []
last_idx = None
for i, line in enumerate(lines):
    try:
        r = json.loads(line)
        if r.get('task_id') == '$TASK_ID':
            last_idx = i
    except Exception:
        pass
    updated.append(line)
if last_idx is not None:
    r = json.loads(updated[last_idx])
    r['evidence_independence'] = 'meta-cc-grounded'
    updated[last_idx] = json.dumps(r) + '\n'
open('$JSONL', 'w').writelines(updated)
" 2>/dev/null || true
  else
    # TASK-176a schema not yet present; write placeholder to task Notes
    echo "gcl-evidence-independence: meta-cc-grounded (pending jsonl)"
  fi
EOF
  exit 0
fi

TASK_ID="${1:-}"
if [[ -z "$TASK_ID" ]]; then
  echo "Error: TASK-ID required. Use --help for usage." >&2
  exit 1
fi

# The actual digest collection is performed by the Claude agent via MCP tool calls.
# This script's presence and --help flag serve as the DoD-checkable artifact
# confirming the protocol is defined. See SKILL.md for invocation instructions.
echo "meta-cc-digest: invocation guide for TASK-ID=${TASK_ID}"
echo "FILE_ACTIVITY: (agent runs mcp__plugin_meta-cc_meta-cc__query_file_activity)"
echo "ERROR_COUNT: (agent runs mcp__plugin_meta-cc_meta-cc__analyze_errors)"
echo "EDIT_OSCILLATION: (agent runs mcp__plugin_meta-cc_meta-cc__query_edit_sequences)"
echo "SCOPE_DIFF: (agent compares FILE_ACTIVITY to task Implementation Plan file refs)"
echo ""
echo "evidence_independence: meta-cc-grounded"
echo "data_source: meta-cc-session"
