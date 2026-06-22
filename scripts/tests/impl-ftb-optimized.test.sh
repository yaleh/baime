#!/usr/bin/env bash
set -e
grep -q 'Run the following bash commands directly' plugin/skills/feature-to-backlog/SKILL.md || { echo "FAIL: ftb finalise not de-agented"; exit 1; }
grep -q 'self-review' plugin/skills/feature-to-backlog/SKILL.md || { echo "FAIL: ftb self-review not present"; exit 1; }
echo "PASS"
