#!/usr/bin/env bash
set -e
grep -q 'Run the following bash commands directly' plugin/skills/epic-to-backlog/SKILL.md || { echo "FAIL: etb finalise not de-agented"; exit 1; }
grep -q 'self-review' plugin/skills/epic-to-backlog/SKILL.md || { echo "FAIL: etb self-review not present"; exit 1; }
echo "PASS"
