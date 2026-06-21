#!/usr/bin/env bash
set -e
test -f docs/experiments/exp-b-self-review.md || { echo "FAIL: results doc missing"; exit 1; }
grep -q 'verdict' docs/experiments/exp-b-self-review.md || { echo "FAIL: no verdict"; exit 1; }
grep -q 'planLoop' docs/experiments/exp-b-self-review.md || { echo "FAIL: no planLoop reference"; exit 1; }
echo "PASS"
