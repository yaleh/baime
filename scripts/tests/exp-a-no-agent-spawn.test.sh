#!/usr/bin/env bash
set -e
# Test: finalise section must NOT use agent spawn
# Scope: check only within the Phase 5 finalise block (between "### Phase 5: finalise" and "---")
awk '/^### Phase 5: finalise/,/^---/' plugin/skills/feature-to-backlog/SKILL.md \
  | grep -q 'Spawn Task agent' && { echo "FAIL: agent spawn still present in finalise"; exit 1; } || { echo "PASS: agent spawn absent"; exit 0; }
