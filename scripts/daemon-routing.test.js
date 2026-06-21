#!/usr/bin/env node
/**
 * daemon-routing.test.js — Deterministic routing unit tests for basic-daemon.js and epic-daemon.js.
 *
 * Creates temp task files with various kind/status combinations and verifies:
 * 1. kind:basic + Basic: Ready → basic-ready only (no epic-ready)
 * 2. kind:epic + Epic: Proposal → epic-ready only (no basic-ready)
 * 3. No cross-channel emission
 * 4. parent_task_id is readable from task frontmatter
 * 5. daemon-version: v6 in both daemon files
 *
 * Exits 0 on all pass, non-zero on fail.
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Routing logic (inlined from daemons to allow deterministic test without running processes) ──

const BASIC_READY_STATUS = 'basic: ready';
const EPIC_READY_STATUSES = new Set([
  'epic: proposal', 'epic: plan', 'epic: decomposing',
  'epic: awaiting children', 'epic: evaluating',
]);

function parseLabels(fm) {
  let labels = [];
  const inlineLabels = fm.match(/^labels:\s*\[([^\]]*)\]/m);
  if (inlineLabels) {
    labels = inlineLabels[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  } else {
    const blockMatch = fm.match(/^labels:\s*\n((?:  - .+\n?)*)/m);
    if (blockMatch) {
      labels = blockMatch[1].split('\n')
        .map(l => l.replace(/^\s+-\s+/, '').trim())
        .filter(Boolean);
    }
  }
  return labels;
}

function readTaskMeta(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const m = content.match(/^---\n([\s\S]*?)^---/m);
    if (!m) return null;
    const fm = m[1];
    const statusMatch = fm.match(/^status:\s*(.+)$/m);
    const status = statusMatch ? statusMatch[1].trim().toLowerCase() : null;
    const parentMatch = content.match(/^parent_task_id:\s*(.+)$/m);
    const parent_task_id = parentMatch ? parentMatch[1].trim().toUpperCase() : null;
    const labels = parseLabels(fm);
    return {
      status,
      hasKindBasic: labels.includes('kind:basic'),
      hasKindEpic:  labels.includes('kind:epic'),
      parent_task_id,
    };
  } catch { /* unreadable */ }
  return null;
}

function isBasicReady(filepath) {
  const meta = readTaskMeta(filepath);
  if (!meta) return false;
  return meta.hasKindBasic && !meta.hasKindEpic && meta.status === BASIC_READY_STATUS;
}

function isEpicReady(filepath) {
  const meta = readTaskMeta(filepath);
  if (!meta) return false;
  return meta.hasKindEpic && !meta.hasKindBasic && EPIC_READY_STATUSES.has(meta.status);
}

// ── Test helpers ──

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.log(`  FAIL: ${message}`);
    failed++;
  }
}

function makeTaskFile(dir, id, status, labels, parentId = null) {
  const labelsYaml = labels.length === 0
    ? 'labels: []'
    : `labels:\n${labels.map(l => `  - ${l}`).join('\n')}`;
  const parentLine = parentId ? `parent_task_id: ${parentId}\n` : '';
  const content = `---\nid: ${id}\ntitle: Test task ${id}\nstatus: ${status}\nassignee: []\ncreated_date: '2026-06-21'\nupdated_date: '2026-06-21'\n${labelsYaml}\ndependencies: []\n${parentLine}ordinal: 1000\n---\n\n## Description\n\nTest task.\n`;
  const filename = `${id.toLowerCase().replace('-', '-')} - Test-task-${id}.md`;
  fs.writeFileSync(path.join(dir, filename), content);
  return path.join(dir, filename);
}

// ── Tests ──

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daemon-routing-test-'));

try {
  console.log('\n=== daemon-routing.test.js ===\n');

  // Test 1: kind:basic + Basic: Ready → basic-ready channel only
  {
    const filepath = makeTaskFile(tmpDir, 'TASK-1', 'Basic: Ready', ['kind:basic'], 'TASK-99');
    assert(isBasicReady(filepath) === true,  'Test 1a: kind:basic + Basic: Ready → isBasicReady = true');
    assert(isEpicReady(filepath)  === false, 'Test 1b: kind:basic + Basic: Ready → isEpicReady = false (no cross-channel)');
  }

  // Test 2: kind:epic + Epic: Proposal → epic-ready channel only
  {
    const filepath = makeTaskFile(tmpDir, 'TASK-2', 'Epic: Proposal', ['kind:epic']);
    assert(isEpicReady(filepath)  === true,  'Test 2a: kind:epic + Epic: Proposal → isEpicReady = true');
    assert(isBasicReady(filepath) === false, 'Test 2b: kind:epic + Epic: Proposal → isBasicReady = false (no cross-channel)');
  }

  // Test 3: kind:epic + all other active Epic:* statuses emit epic-ready
  {
    const epicStatuses = [
      'Epic: Plan', 'Epic: Decomposing', 'Epic: Awaiting Children', 'Epic: Evaluating'
    ];
    for (const status of epicStatuses) {
      const id = `TASK-3-${status.replace(/[^A-Za-z]/g, '')}`;
      const filepath = makeTaskFile(tmpDir, id, status, ['kind:epic']);
      assert(isEpicReady(filepath) === true, `Test 3: kind:epic + "${status}" → isEpicReady = true`);
      assert(isBasicReady(filepath) === false, `Test 3: kind:epic + "${status}" → isBasicReady = false`);
    }
  }

  // Test 4: kind:epic + terminal statuses do NOT emit
  {
    for (const status of ['Epic: Done', 'Epic: Needs Human']) {
      const id = `TASK-4-${status.replace(/[^A-Za-z]/g, '')}`;
      const filepath = makeTaskFile(tmpDir, id, status, ['kind:epic']);
      assert(isEpicReady(filepath) === false,  `Test 4: kind:epic + "${status}" → terminal, no epic-ready`);
      assert(isBasicReady(filepath) === false,  `Test 4: kind:epic + "${status}" → terminal, no basic-ready`);
    }
  }

  // Test 5: kind:basic + non-Ready statuses do NOT emit
  {
    for (const status of ['Basic: Backlog', 'Basic: Proposal', 'Basic: Done', 'Basic: In Progress']) {
      const id = `TASK-5-${status.replace(/[^A-Za-z]/g, '')}`;
      const filepath = makeTaskFile(tmpDir, id, status, ['kind:basic']);
      assert(isBasicReady(filepath) === false, `Test 5: kind:basic + "${status}" → not ready, no basic-ready`);
      assert(isEpicReady(filepath)  === false, `Test 5: kind:basic + "${status}" → no epic-ready`);
    }
  }

  // Test 6: task with both kind:basic AND kind:epic → neither channel (XOR violation)
  {
    const filepath = makeTaskFile(tmpDir, 'TASK-6', 'Basic: Ready', ['kind:basic', 'kind:epic']);
    assert(isBasicReady(filepath) === false, 'Test 6: both kind:basic+kind:epic → no basic-ready (XOR violation)');
    assert(isEpicReady(filepath)  === false, 'Test 6: both kind:basic+kind:epic → no epic-ready (XOR violation)');
  }

  // Test 7: task with no kind label → neither channel
  {
    const filepath = makeTaskFile(tmpDir, 'TASK-7', 'Basic: Ready', []);
    assert(isBasicReady(filepath) === false, 'Test 7: no kind label → no basic-ready');
    assert(isEpicReady(filepath)  === false, 'Test 7: no kind label → no epic-ready');
  }

  // Test 8: parent_task_id is parseable from task frontmatter
  {
    const filepath = makeTaskFile(tmpDir, 'TASK-8', 'Basic: Ready', ['kind:basic'], 'TASK-42');
    const meta = readTaskMeta(filepath);
    assert(meta !== null, 'Test 8a: readTaskMeta succeeds for task with parent_task_id');
    assert(meta.parent_task_id === 'TASK-42', 'Test 8b: parent_task_id reads correctly');
  }

  // Test 9: daemon files exist with daemon-version: v6
  {
    const scriptDir = path.join(__dirname);
    const basicDaemon = path.join(scriptDir, 'basic-daemon.js');
    const epicDaemon  = path.join(scriptDir, 'epic-daemon.js');

    assert(fs.existsSync(basicDaemon), 'Test 9a: scripts/basic-daemon.js exists');
    assert(fs.existsSync(epicDaemon),  'Test 9b: scripts/epic-daemon.js exists');

    if (fs.existsSync(basicDaemon)) {
      const head = fs.readFileSync(basicDaemon, 'utf8').slice(0, 200);
      assert(head.includes('daemon-version: v6'), 'Test 9c: basic-daemon.js has daemon-version: v6');
    }
    if (fs.existsSync(epicDaemon)) {
      const head = fs.readFileSync(epicDaemon, 'utf8').slice(0, 200);
      assert(head.includes('daemon-version: v6'), 'Test 9d: epic-daemon.js has daemon-version: v6');
    }
  }

  // Test 10: basic-daemon.js contains 'basic-ready' and 'parent_task_id'
  {
    const basicDaemon = path.join(__dirname, 'basic-daemon.js');
    if (fs.existsSync(basicDaemon)) {
      const content = fs.readFileSync(basicDaemon, 'utf8');
      assert(content.includes('basic-ready'), 'Test 10a: basic-daemon.js emits basic-ready');
      assert(content.includes('parent_task_id'), 'Test 10b: basic-daemon.js reads parent_task_id');
    }
  }

  // Test 11: epic-daemon.js contains 'epic-ready'
  {
    const epicDaemon = path.join(__dirname, 'epic-daemon.js');
    if (fs.existsSync(epicDaemon)) {
      const content = fs.readFileSync(epicDaemon, 'utf8');
      assert(content.includes('epic-ready'), 'Test 11: epic-daemon.js emits epic-ready');
    }
  }

  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`);

  if (failed > 0) {
    process.exit(1);
  }

} finally {
  // Cleanup temp dir
  try {
    for (const f of fs.readdirSync(tmpDir)) {
      fs.unlinkSync(path.join(tmpDir, f));
    }
    fs.rmdirSync(tmpDir);
  } catch { /* ignore cleanup errors */ }
}

process.exit(0);
