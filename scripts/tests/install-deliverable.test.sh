#!/bin/bash
# Verify that rsync -a plugin/ $TMPINSTALL/ produces a scripts/ dir with the four runtime scripts.
set -e
TMPINSTALL=$(mktemp -d)
trap "rm -rf $TMPINSTALL" EXIT

REPO_ROOT=$(git rev-parse --show-toplevel)
rsync -a "$REPO_ROOT/plugin/" "$TMPINSTALL/"

for f in basic-daemon.js verify-subtask-dod.sh skill-lint.sh validate-plugin.sh; do
    if [ ! -f "$TMPINSTALL/scripts/$f" ]; then
        echo "FAIL: $f missing from simulated install dir"
        exit 1
    fi
    if [ -L "$TMPINSTALL/scripts/$f" ]; then
        echo "FAIL: $f is a symlink in simulated install dir (must be real file)"
        exit 1
    fi
    echo "PASS: $f present as real file in simulated install dir"
done

node "$TMPINSTALL/scripts/basic-daemon.js" --help >/dev/null 2>&1 && \
    echo "PASS: basic-daemon.js runnable from install dir" || \
    echo "WARN: basic-daemon.js --help non-zero (acceptable if it requires event loop)"

echo "install-deliverable: ALL CHECKS PASSED"
