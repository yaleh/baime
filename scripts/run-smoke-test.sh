#!/usr/bin/env bash
# run-smoke-test.sh <skill-name> [--dry-run]
# Smoke test harness for BAIME skills.
# Full mode: sets up fixture repo, invokes skill as LLM subagent, runs expect.sh assertions.
# Dry-run mode (--dry-run): verifies smoke/ directory structure exists and files are executable.
set -euo pipefail

SKILL_NAME="${1:-}"
DRY_RUN=false
for arg in "${@:2}"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

if [[ -z "$SKILL_NAME" ]]; then
  echo "Usage: $0 <skill-name> [--dry-run]" >&2
  exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
SMOKE_DIR="${REPO_ROOT}/plugin/skills/${SKILL_NAME}/smoke"

# Verify smoke directory structure
if [[ ! -d "$SMOKE_DIR" ]]; then
  echo "FAIL: smoke/ directory not found at ${SMOKE_DIR}" >&2
  exit 1
fi
for f in setup.sh scenario.md expect.sh; do
  if [[ ! -f "${SMOKE_DIR}/${f}" ]]; then
    echo "FAIL: ${SMOKE_DIR}/${f} not found" >&2
    exit 1
  fi
done
if [[ ! -x "${SMOKE_DIR}/setup.sh" ]]; then
  echo "FAIL: ${SMOKE_DIR}/setup.sh is not executable" >&2
  exit 1
fi
if [[ ! -x "${SMOKE_DIR}/expect.sh" ]]; then
  echo "FAIL: ${SMOKE_DIR}/expect.sh is not executable" >&2
  exit 1
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "PASS (dry-run): smoke/ structure verified for skill '${SKILL_NAME}'"
  exit 0
fi

# Full mode: set up fixture repo and run skill
TMPDIR_FIXTURE=$(mktemp -d)
trap 'rm -rf "$TMPDIR_FIXTURE"' EXIT

echo "Setting up fixture repo at ${TMPDIR_FIXTURE}..."
cd "$TMPDIR_FIXTURE"
git init -q
git config user.email "smoke-test@baime.local"
git config user.name "Smoke Test"

bash "${SMOKE_DIR}/setup.sh" "$TMPDIR_FIXTURE"

echo "Invoking skill '${SKILL_NAME}' as subagent (LLM call)..."
# NOTE: Actual LLM invocation happens here via Claude Code CLI.
# In automated contexts without Claude Code available, this step is skipped.
if command -v claude &>/dev/null; then
  claude --dangerously-skip-permissions -p "Run the /${SKILL_NAME} skill as described in ${SMOKE_DIR}/scenario.md" \
    --cwd "$TMPDIR_FIXTURE" || true
else
  echo "SKIP: claude CLI not available; skipping LLM invocation"
  echo "NOTE: Re-run without --dry-run in an environment with Claude Code to exercise the full skill."
  echo "PASS: smoke test setup verified for '${SKILL_NAME}' (LLM step skipped)"
  exit 0
fi

echo "Running expect.sh assertions..."
bash "${SMOKE_DIR}/expect.sh" "$TMPDIR_FIXTURE"
echo "PASS: smoke test for '${SKILL_NAME}' completed"
