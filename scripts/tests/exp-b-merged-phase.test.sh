#!/usr/bin/env bash
set -e
grep -q 'self-review' plugin/skills/feature-to-backlog/SKILL.md || { echo "FAIL: self-review not found"; exit 1; }
! grep -q 'Phase 2: reviewLoop(proposal)' plugin/skills/feature-to-backlog/SKILL.md || { echo "FAIL: old Phase 2 header still present"; exit 1; }
echo "PASS"
