#!/usr/bin/env bash
# verify-provenance.sh — provenance gate for "measured" artifacts.
#
# R5 guard (TASK-93 post-mortem): any artifact that labels itself
# `data_source: measured` (or "data_source": "measured") MUST also carry a
# `generated_by:` field naming a generator script that exists in the repo.
# Hand-written files claiming "measured" with no traceable generator are
# fabrication masquerading as measurement — this gate rejects them.
#
# Usage: verify-provenance.sh <DIR> [--repo-root ROOT]
#   Exit 0: every measured artifact has a generated_by pointing to an existing file.
#   Exit 1: one or more measured artifacts lack valid provenance (offenders listed).
#   Exit 2: usage error (no DIR).
set -uo pipefail

DIR=""
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
while [ $# -gt 0 ]; do
  case "$1" in
    --repo-root) REPO_ROOT="$2"; shift 2 ;;
    -h|--help)   echo "Usage: verify-provenance.sh <DIR> [--repo-root ROOT]"; exit 2 ;;
    *)           if [ -z "$DIR" ]; then DIR="$1"; fi; shift ;;
  esac
done

if [ -z "$DIR" ]; then
  echo "verify-provenance: missing DIR argument" >&2
  exit 2
fi
if [ ! -d "$DIR" ]; then
  echo "verify-provenance: not a directory: $DIR" >&2
  exit 2
fi

offenders=()
measured=0

while IFS= read -r f; do
  # measured iff a data_source line/field says "measured"
  grep -qiE 'data_source["[:space:]]*[:=]["[:space:]]*measured' "$f" || continue
  measured=$((measured + 1))
  gen="$(grep -oiP 'generated_by["\s]*[:=]["\s]*\K[^",}\s]+' "$f" 2>/dev/null | head -1)"
  if [ -z "$gen" ]; then
    offenders+=("$(basename "$f") — no generated_by field")
    continue
  fi
  # Resolve generator relative to repo root (absolute paths accepted as-is)
  case "$gen" in
    /*) gpath="$gen" ;;
    *)  gpath="$REPO_ROOT/$gen" ;;
  esac
  if [ ! -e "$gpath" ]; then
    offenders+=("$(basename "$f") — generated_by points to missing generator: $gen")
  fi
done < <(find "$DIR" -type f \( -name '*.json' -o -name '*.md' \) 2>/dev/null)

if [ "${#offenders[@]}" -gt 0 ]; then
  echo "verify-provenance: FAIL — ${#offenders[@]} measured artifact(s) lack valid provenance:"
  for o in "${offenders[@]}"; do echo "  - $o"; done
  exit 1
fi

echo "verify-provenance: PASS — ${measured} measured artifact(s) all carry a valid generated_by"
exit 0
