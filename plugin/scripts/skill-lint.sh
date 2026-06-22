#!/usr/bin/env bash
# skill-lint.sh — SKILL.md two-stage linter
# Usage: bash scripts/skill-lint.sh --manifest <path>
set -euo pipefail

SUBCOMMAND=""
MANIFEST_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest) MANIFEST_PATH="$2"; shift 2 ;;
    --static)   SUBCOMMAND="static"; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [ -n "$MANIFEST_PATH" ]; then
  # --manifest subcommand: validate a JSON manifest file
  python3 - "$MANIFEST_PATH" <<'PYEOF'
import sys, json

VALID_ENTRY_POINTS = {"resolveOrCreate", "createTask"}
VALID_PHASES = {
  "resolveOrCreate", "createTask", "reviewLoop", "finalise",
  "proposalLoop", "planLoop", "draftProposal", "draftPlan"
}

path = sys.argv[1]
try:
  with open(path) as f:
    manifest = json.load(f)
except (OSError, json.JSONDecodeError) as e:
  print(f"FAIL: cannot parse manifest: {e}", file=sys.stderr)
  sys.exit(1)

errors = []

# R1: field_writes[*].field != "description" (except when tool == "backlog task create")
for fw in manifest.get("field_writes", []):
  if fw.get("field") == "description" and fw.get("tool") != "backlog task create":
    errors.append(f"R1: field_writes contains field='description' with tool='{fw.get('tool')}' (only allowed for 'backlog task create')")

# R2: phases_to_execute items must be in known whitelist
for phase in manifest.get("phases_to_execute", []):
  if phase not in VALID_PHASES:
    errors.append(f"R2: unknown phase '{phase}' in phases_to_execute (valid: {sorted(VALID_PHASES)})")

# R3: entry_point must be "resolveOrCreate" or "createTask"
ep = manifest.get("entry_point", "")
if ep not in VALID_ENTRY_POINTS:
  errors.append(f"R3: invalid entry_point '{ep}' (must be one of {sorted(VALID_ENTRY_POINTS)})")

# R4: skip_draft == true iff entry_point == "resolveOrCreate"
skip_draft = manifest.get("skip_draft", False)
if ep == "resolveOrCreate" and not skip_draft:
  errors.append(f"R4: entry_point='resolveOrCreate' requires skip_draft=true (got {skip_draft})")
if ep != "resolveOrCreate" and skip_draft:
  errors.append(f"R4: skip_draft=true requires entry_point='resolveOrCreate' (got '{ep}')")

if errors:
  for e in errors:
    print(f"  FAIL: {e}")
  sys.exit(len(errors))
else:
  print(f"  PASS: manifest valid ({path})")
  sys.exit(0)
PYEOF
elif [ "$SUBCOMMAND" = "static" ]; then
  echo "static linting not yet implemented"
  exit 0
else
  echo "Usage: skill-lint.sh --manifest <path>" >&2
  exit 1
fi
