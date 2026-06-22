#!/usr/bin/env bash
set -e
test -f docs/experiments/exp-a-finalise-deagent.md || { echo "FAIL: results doc missing"; exit 1; }
grep -q 'verdict' docs/experiments/exp-a-finalise-deagent.md || { echo "FAIL: no verdict"; exit 1; }
echo "PASS"
