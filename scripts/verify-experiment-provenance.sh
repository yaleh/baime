#!/usr/bin/env bash
# verify-experiment-provenance.sh — experiment artifact provenance gate.
#
# Checks two things for artifacts under experiments/*/artifacts/:
#   1. data_source gate: any artifact with "data_source": "estimated" → FAIL
#      (only "measured" results are acceptable for shipped experiments)
#   2. Pre-registration timestamp gate: if an artifact contains first_llm_call_ts,
#      verify it is NOT earlier than the git commit time of the experiment's
#      hypotheses.md (which must have been pre-registered before data collection).
#      If no hypotheses.md exists in git history → WARN and continue (graceful skip).
#
# Usage: verify-experiment-provenance.sh [--repo-root ROOT]
#   Exit 0: no violations (or no experiment artifacts found — no-op)
#   Exit 1: one or more provenance violations found
#
# All paths derived from REPO_ROOT (git toplevel), not hard-coded.
set -uo pipefail

# ── Argument parsing ──────────────────────────────────────────────────────────
REPO_ROOT=""
while [ $# -gt 0 ]; do
    case "$1" in
        --repo-root) REPO_ROOT="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: verify-experiment-provenance.sh [--repo-root ROOT]"
            exit 0
            ;;
        *) echo "verify-experiment-provenance: unknown argument: $1" >&2; exit 1 ;;
    esac
done

# If not provided, derive from git toplevel (or script parent)
if [ -z "$REPO_ROOT" ]; then
    REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || cd "$(dirname "$0")/.." && pwd)"
fi

ARTIFACTS_GLOB="$REPO_ROOT/experiments"

# ── No-op check ───────────────────────────────────────────────────────────────
if [ ! -d "$ARTIFACTS_GLOB" ]; then
    echo "verify-experiment-provenance: no experiment artifacts found — no-op"
    exit 0
fi

# Collect all JSON files under experiments/*/artifacts/
mapfile -t ARTIFACT_FILES < <(find "$ARTIFACTS_GLOB" -path "*/artifacts/*.json" -type f 2>/dev/null | sort)

if [ "${#ARTIFACT_FILES[@]}" -eq 0 ]; then
    echo "verify-experiment-provenance: no experiment artifacts found — no-op"
    exit 0
fi

ERRORS=0
VIOLATIONS=()

# ── Gate 1: data_source must not be "estimated" ───────────────────────────────
mapfile -t ESTIMATED_FILES < <(grep -rl '"data_source":[[:space:]]*"estimated"' "$ARTIFACTS_GLOB" --include="*.json" 2>/dev/null | grep '/artifacts/' | sort || true)

if [ "${#ESTIMATED_FILES[@]}" -gt 0 ]; then
    echo "verify-experiment-provenance: FAIL — data_source:estimated found in artifact(s):"
    for f in "${ESTIMATED_FILES[@]}"; do
        echo "  - $f"
        VIOLATIONS+=("$f: data_source is estimated (only measured is acceptable)")
    done
    ERRORS=$((ERRORS + ${#ESTIMATED_FILES[@]}))
fi

# ── Gate 2: first_llm_call_ts pre-registration check ─────────────────────────
# Helper: convert ISO-8601 timestamp to epoch seconds (portable)
ts_to_epoch() {
    local ts="$1"
    # Try GNU date first, then BSD date (macOS)
    date -d "$ts" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$ts" +%s 2>/dev/null || echo "0"
}

for artifact in "${ARTIFACT_FILES[@]}"; do
    # Skip if no first_llm_call_ts field
    first_ts=$(grep -o '"first_llm_call_ts":[[:space:]]*"[^"]*"' "$artifact" 2>/dev/null | grep -o '"[^"]*"$' | tr -d '"' || true)
    [ -z "$first_ts" ] && continue

    # Determine experiment dir: experiments/<exp>/artifacts/... → experiments/<exp>
    artifact_rel="${artifact#$REPO_ROOT/}"
    # Extract exp name: experiments/<exp>/...
    exp_name=$(echo "$artifact_rel" | awk -F'/' '{print $2}')
    hypotheses_path="$REPO_ROOT/experiments/$exp_name/hypotheses.md"

    # Get git commit time for hypotheses.md
    hyp_commit_ts=$(git -C "$REPO_ROOT" log --format="%aI" -1 -- "experiments/$exp_name/hypotheses.md" 2>/dev/null | head -1 || true)

    if [ -z "$hyp_commit_ts" ]; then
        echo "  WARN: verify-experiment-provenance: no git history for experiments/$exp_name/hypotheses.md — skipping pre-reg check for $(basename "$artifact")"
        continue
    fi

    artifact_epoch=$(ts_to_epoch "$first_ts")
    hyp_epoch=$(ts_to_epoch "$hyp_commit_ts")

    if [ "$artifact_epoch" -lt "$hyp_epoch" ]; then
        msg="$(basename "$artifact"): first_llm_call_ts ($first_ts) precedes hypotheses.md commit ($hyp_commit_ts)"
        echo "  FAIL: verify-experiment-provenance: pre-registration violation — $msg"
        VIOLATIONS+=("$msg")
        ERRORS=$((ERRORS + 1))
    fi
done

# ── Result ────────────────────────────────────────────────────────────────────
if [ "$ERRORS" -eq 0 ]; then
    echo "verify-experiment-provenance: PASS — ${#ARTIFACT_FILES[@]} artifact(s) checked, no violations"
    exit 0
else
    echo "verify-experiment-provenance: FAIL — $ERRORS violation(s) found"
    exit 1
fi
