#!/usr/bin/env bash
# scripts/test-daemon-scan.sh — verify daemon isBasicReady contract for kind:basic label
set -euo pipefail
TMPD=$(mktemp -d)
trap 'rm -rf "$TMPD"' EXIT

# Task WITH label — must be detected as basic-ready
cat > "$TMPD/task-WITH-LABEL.md" <<'TASKEOF'
---
id: TASK-WITH-LABEL
title: Task with label
status: Basic: Ready
labels:
  - kind:basic
---
Body.
TASKEOF

# Task WITHOUT label — must NOT be detected as basic-ready
cat > "$TMPD/task-NO-LABEL.md" <<'TASKEOF'
---
id: TASK-NO-LABEL
title: Task without label
status: Basic: Ready
---
Body.
TASKEOF

node - "$TMPD" <<'JSEOF'
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];

function readMeta(fp) {
  const src = fs.readFileSync(fp, 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1];
  const statusM = fm.match(/^status:\s*(.+)$/m);
  const status = statusM ? statusM[1].trim().toLowerCase() : '';
  let labels = [];
  const inline = fm.match(/^labels:\s*\[([^\]]*)\]/m);
  if (inline) {
    labels = inline[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  } else {
    const block = fm.match(/^labels:\s*\n((?:  - .+\n?)*)/m);
    if (block) {
      labels = block[1].split('\n')
        .map(l => l.replace(/^\s+-\s+/, '').trim().replace(/['"]/g, ''))
        .filter(Boolean);
    }
  }
  return { status, hasKindBasic: labels.includes('kind:basic'), hasKindEpic: labels.includes('kind:epic') };
}

function isBasicReady(fp) {
  const m = readMeta(fp);
  return m && m.hasKindBasic && !m.hasKindEpic && m.status === 'basic: ready';
}

const entries = fs.readdirSync(dir).filter(e => e.endsWith('.md'));
const ready = entries.filter(e => isBasicReady(path.join(dir, e)));
const notReady = entries.filter(e => !isBasicReady(path.join(dir, e)));

let failed = 0;
if (!ready.some(e => e.includes('WITH-LABEL'))) {
  console.error('FAIL: WITH-LABEL task not detected as basic-ready');
  failed++;
} else {
  console.log('PASS: WITH-LABEL task correctly detected as basic-ready');
}
if (notReady.some(e => e.includes('NO-LABEL'))) {
  console.log('PASS: NO-LABEL task correctly excluded from basic-ready');
} else {
  console.error('FAIL: NO-LABEL task was incorrectly detected as basic-ready');
  failed++;
}
process.exit(failed);
JSEOF
