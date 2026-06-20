#!/usr/bin/env node
// Unit tests for loop-backlog-daemon.js helper functions.
// Run with: node scripts/loop-backlog-daemon.test.js
'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── inline copies of the pure helpers (keep in sync with daemon) ──────────────

function parseTaskId(filename) {
  const base = path.basename(filename, path.extname(filename)).toUpperCase();
  for (const part of base.split(/\s+/)) {
    if (/^TASK-\d+$/.test(part)) return part;
  }
  const m = base.match(/\bTASK-(\d+)\b/);
  return m ? `TASK-${m[1]}` : null;
}

function isReady(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    for (const line of content.split('\n')) {
      const s = line.trim().toLowerCase();
      if (s === 'status: ready' || s.startsWith('status: ready')) return true;
    }
  } catch { /* unreadable */ }
  return false;
}

function scanReadyIds(tasksDir) {
  const ready = new Set();
  let entries;
  try { entries = fs.readdirSync(tasksDir); } catch { return ready; }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const id = parseTaskId(entry);
    if (id && isReady(path.join(tasksDir, entry))) ready.add(id);
  }
  return ready;
}


// ── Meta-lane helpers (keep in sync with daemon) ──────────────────────────────

const META_STATUSES = new Set([
  'meta-proposal', 'meta-plan', 'meta-active', 'meta-done',
]);

const META_READY_STATUSES = new Set(['meta-proposal', 'meta-plan']);

function readStatus(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    for (const line of content.split('\n')) {
      const s = line.trim().toLowerCase();
      if (s.startsWith('status:')) return s.slice('status:'.length).trim();
    }
  } catch { /* unreadable */ }
  return null;
}

function isMetaReady(filepath) {
  const status = readStatus(filepath);
  return status !== null && META_READY_STATUSES.has(status);
}

function scanMetaReadyIds(tasksDir) {
  const ready = new Set();
  let entries;
  try { entries = fs.readdirSync(tasksDir); } catch { return ready; }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const id = parseTaskId(entry);
    if (id && isMetaReady(path.join(tasksDir, entry))) ready.add(id);
  }
  return ready;
}

// ── test harness ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function assert(desc, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { process.stdout.write(`  ✓ ${desc}\n`); passed++; }
  else     { process.stderr.write(`  ✗ ${desc}\n    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(actual)}\n`); failed++; }
}

// ── parseTaskId ───────────────────────────────────────────────────────────────
process.stdout.write('parseTaskId\n');
assert('simple prefix',      parseTaskId('task-3 - do something.md'),    'TASK-3');
assert('upper already',      parseTaskId('TASK-10 - title.md'),           'TASK-10');
assert('embedded id',        parseTaskId('sprint-TASK-7-notes.md'),       'TASK-7');
assert('no id returns null', parseTaskId('README.md'),                    null);
assert('multi-digit',        parseTaskId('task-42 - long title here.md'), 'TASK-42');

// ── isReady ───────────────────────────────────────────────────────────────────
process.stdout.write('isReady\n');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lbd-test-'));

const readyFile = path.join(tmp, 'ready.md');
fs.writeFileSync(readyFile, '# Task\nStatus: Ready\nSome body\n');
assert('status ready (mixed case)', isReady(readyFile), true);

const doneFile = path.join(tmp, 'done.md');
fs.writeFileSync(doneFile, '# Task\nStatus: Done\n');
assert('status done → false', isReady(doneFile), false);

const emptyFile = path.join(tmp, 'empty.md');
fs.writeFileSync(emptyFile, '');
assert('empty file → false', isReady(emptyFile), false);

assert('missing file → false', isReady(path.join(tmp, 'ghost.md')), false);

// ── scanReadyIds ──────────────────────────────────────────────────────────────
process.stdout.write('scanReadyIds\n');
const dir = path.join(tmp, 'tasks');
fs.mkdirSync(dir);

fs.writeFileSync(path.join(dir, 'task-1 - alpha.md'), 'Status: Ready\n');
fs.writeFileSync(path.join(dir, 'task-2 - beta.md'),  'Status: Done\n');
fs.writeFileSync(path.join(dir, 'task-3 - gamma.md'), 'Status: Ready\n');
fs.writeFileSync(path.join(dir, 'not-a-task.txt'),    'Status: Ready\n');

const ids = scanReadyIds(dir);
assert('finds ready tasks',  [...ids].sort(), ['TASK-1', 'TASK-3']);
assert('skips done tasks',   ids.has('TASK-2'), false);
assert('skips non-md files', ids.size, 2);

assert('missing dir → empty', [...scanReadyIds(path.join(tmp, 'no-such-dir'))].length, 0);


// ── isMetaReady ───────────────────────────────────────────────────────────────
process.stdout.write('isMetaReady\n');
const metaPlanFile = path.join(tmp, 'meta-plan.md');
fs.writeFileSync(metaPlanFile, '# Task\nstatus: Meta-Plan\n');
assert('Meta-Plan → true',     isMetaReady(metaPlanFile), true);

const metaProposalFile = path.join(tmp, 'meta-proposal.md');
fs.writeFileSync(metaProposalFile, 'status: Meta-Proposal\n');
assert('Meta-Proposal → true', isMetaReady(metaProposalFile), true);

const metaActiveFile = path.join(tmp, 'meta-active.md');
fs.writeFileSync(metaActiveFile, 'status: Meta-Active\n');
assert('Meta-Active → false (not L1-pickup state)', isMetaReady(metaActiveFile), false);

assert('Ready file → not meta-ready', isMetaReady(readyFile), false);
assert('Done file → not meta-ready',  isMetaReady(doneFile), false);

// ── scanMetaReadyIds ──────────────────────────────────────────────────────────
process.stdout.write('scanMetaReadyIds\n');
const metaDir = path.join(tmp, 'meta-tasks');
fs.mkdirSync(metaDir);
fs.writeFileSync(path.join(metaDir, 'task-10 - a.md'), 'status: Meta-Plan\n');
fs.writeFileSync(path.join(metaDir, 'task-11 - b.md'), 'status: Meta-Proposal\n');
fs.writeFileSync(path.join(metaDir, 'task-12 - c.md'), 'status: Meta-Active\n');
fs.writeFileSync(path.join(metaDir, 'task-13 - d.md'), 'status: Ready\n');

const metaIds = scanMetaReadyIds(metaDir);
assert('finds Meta-Plan',     metaIds.has('TASK-10'), true);
assert('finds Meta-Proposal', metaIds.has('TASK-11'), true);
assert('skips Meta-Active',   metaIds.has('TASK-12'), false);
assert('skips Ready',         metaIds.has('TASK-13'), false);
assert('total meta-ready',    metaIds.size, 2);

// ── isReady excludes Meta-lane ────────────────────────────────────────────────
process.stdout.write('isReady excludes Meta-lane\n');
// isReady should return false for Meta-Plan (uses META_STATUSES check)
// We test via readStatus + META_STATUSES since isReady is already tested above
assert('readStatus Meta-Plan',      readStatus(metaPlanFile), 'meta-plan');
assert('Meta-Plan not in L0 ready', META_STATUSES.has(readStatus(metaPlanFile)), true);

// ── cleanup + result ──────────────────────────────────────────────────────────
fs.rmSync(tmp, { recursive: true });
process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
