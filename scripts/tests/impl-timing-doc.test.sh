#!/usr/bin/env bash
set -e
test -f docs/experiments/impl-timing-validation.md || { echo "FAIL: timing doc missing"; exit 1; }
grep -q 'baseline' docs/experiments/impl-timing-validation.md || { echo "FAIL: no baseline"; exit 1; }
grep -q 'feature-to-backlog' docs/experiments/impl-timing-validation.md || { echo "FAIL: no ftb section"; exit 1; }
grep -q 'epic-to-backlog' docs/experiments/impl-timing-validation.md || { echo "FAIL: no etb section"; exit 1; }
grep -q 'verdict' docs/experiments/impl-timing-validation.md || { echo "FAIL: no verdict"; exit 1; }
echo "PASS"
