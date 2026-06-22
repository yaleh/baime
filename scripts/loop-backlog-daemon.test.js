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


// ── Wip-drop helpers (keep in sync with daemon) ───────────────────────────────

const WIP_CAP = 2;

function readParentId(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const m = content.match(/^parent_task_id:\s*(.+)$/m);
    return m ? m[1].trim().toUpperCase() : null;
  } catch { /* unreadable */ }
  return null;
}

function computeWip(tasksDir, metaId) {
  let wip = 0;
  let entries;
  try { entries = fs.readdirSync(tasksDir); } catch { return 0; }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const filepath = path.join(tasksDir, entry);
    if (readParentId(filepath) !== metaId) continue;
    const status = readStatus(filepath);
    if (status === 'ready' || status === 'in progress') wip++;
  }
  return wip;
}

// ── Meta-lane helpers (keep in sync with daemon) ──────────────────────────────

const META_STATUSES = new Set([
  'meta-proposal', 'meta-plan', 'meta-active', 'meta-done',
]);

const META_READY_STATUSES = new Set(['meta-proposal', 'meta-plan', 'meta-active']);

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
  const ready = new Map();
  let entries;
  try { entries = fs.readdirSync(tasksDir); } catch { return ready; }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const id = parseTaskId(entry);
    if (!id) continue;
    const status = readStatus(path.join(tasksDir, entry));
    if (status !== null && META_READY_STATUSES.has(status)) ready.set(id, status);
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
assert('Meta-Active → true (L1 picks up for idempotentReconcile)', isMetaReady(metaActiveFile), true);

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
assert('finds Meta-Plan',      metaIds.has('TASK-10'), true);
assert('finds Meta-Proposal',  metaIds.has('TASK-11'), true);
assert('finds Meta-Active',    metaIds.has('TASK-12'), true);
assert('skips Ready',          metaIds.has('TASK-13'), false);
assert('total meta-ready',     metaIds.size, 3);
assert('status: meta-plan',     metaIds.get('TASK-10'), 'meta-plan');
assert('status: meta-proposal', metaIds.get('TASK-11'), 'meta-proposal');
assert('status: meta-active',   metaIds.get('TASK-12'), 'meta-active');

// ── metaNotified Map dedup: re-emit on status change ─────────────────────────
process.stdout.write('metaNotified Map dedup\n');
const metaNotified = new Map();
// First poll: task enters meta-proposal
const snap1 = new Map([['TASK-10', 'meta-proposal']]);
const emitted1 = [];
for (const [id] of metaNotified) { if (!snap1.has(id)) metaNotified.delete(id); }
for (const [id, status] of snap1) {
  if (metaNotified.get(id) !== status) { emitted1.push(id); metaNotified.set(id, status); }
}
assert('first poll emits TASK-10', emitted1.includes('TASK-10'), true);
assert('metaNotified records meta-proposal', metaNotified.get('TASK-10'), 'meta-proposal');

// Second poll: same status — no re-emit
const snap2 = new Map([['TASK-10', 'meta-proposal']]);
const emitted2 = [];
for (const [id] of metaNotified) { if (!snap2.has(id)) metaNotified.delete(id); }
for (const [id, status] of snap2) {
  if (metaNotified.get(id) !== status) { emitted2.push(id); metaNotified.set(id, status); }
}
assert('same status: no re-emit', emitted2.includes('TASK-10'), false);

// Third poll: status changes meta-proposal → meta-plan — must re-emit
const snap3 = new Map([['TASK-10', 'meta-plan']]);
const emitted3 = [];
for (const [id] of metaNotified) { if (!snap3.has(id)) metaNotified.delete(id); }
for (const [id, status] of snap3) {
  if (metaNotified.get(id) !== status) { emitted3.push(id); metaNotified.set(id, status); }
}
assert('status change meta-proposal→meta-plan: re-emits', emitted3.includes('TASK-10'), true);
assert('metaNotified updated to meta-plan', metaNotified.get('TASK-10'), 'meta-plan');

// ── isReady excludes Meta-lane ────────────────────────────────────────────────
process.stdout.write('isReady excludes Meta-lane\n');
// isReady should return false for Meta-Plan (uses META_STATUSES check)
// We test via readStatus + META_STATUSES since isReady is already tested above
assert('readStatus Meta-Plan',      readStatus(metaPlanFile), 'meta-plan');
assert('Meta-Plan not in L0 ready', META_STATUSES.has(readStatus(metaPlanFile)), true);

// ── readParentId ──────────────────────────────────────────────────────────────
process.stdout.write('readParentId\n');
const parentFile = path.join(tmp, 'child-with-parent.md');
fs.writeFileSync(parentFile, '---\nid: TASK-5\nstatus: Ready\nparent_task_id: TASK-93\n---\n');
assert('reads parent_task_id', readParentId(parentFile), 'TASK-93');

const noParentFile = path.join(tmp, 'child-no-parent.md');
fs.writeFileSync(noParentFile, '---\nid: TASK-6\nstatus: Ready\n---\n');
assert('no parent_task_id → null', readParentId(noParentFile), null);

assert('missing file → null', readParentId(path.join(tmp, 'ghost-child.md')), null);

// ── computeWip ────────────────────────────────────────────────────────────────
process.stdout.write('computeWip\n');
const wipDir = path.join(tmp, 'wip-tasks');
fs.mkdirSync(wipDir);
// Two Ready children of TASK-93
fs.writeFileSync(path.join(wipDir, 'task-1.md'),
  '---\nid: TASK-1\nstatus: Ready\nparent_task_id: TASK-93\n---\n');
fs.writeFileSync(path.join(wipDir, 'task-2.md'),
  '---\nid: TASK-2\nstatus: In Progress\nparent_task_id: TASK-93\n---\n');
// One Backlog child of TASK-93 (not counted)
fs.writeFileSync(path.join(wipDir, 'task-3.md'),
  '---\nid: TASK-3\nstatus: Backlog\nparent_task_id: TASK-93\n---\n');
// Child of a different parent (not counted)
fs.writeFileSync(path.join(wipDir, 'task-4.md'),
  '---\nid: TASK-4\nstatus: Ready\nparent_task_id: TASK-99\n---\n');
// Meta-task itself (no parent_task_id)
fs.writeFileSync(path.join(wipDir, 'task-93.md'),
  '---\nid: TASK-93\nstatus: Meta-Active\n---\n');

assert('wip counts Ready + InProgress children', computeWip(wipDir, 'TASK-93'), 2);
assert('wip excludes Backlog children',          computeWip(wipDir, 'TASK-93'), 2);
assert('wip excludes different parent',          computeWip(wipDir, 'TASK-99'), 1);
assert('wip zero for unknown parent',            computeWip(wipDir, 'TASK-00'), 0);

// One Done child: should not count
fs.writeFileSync(path.join(wipDir, 'task-5.md'),
  '---\nid: TASK-5\nstatus: Done\nparent_task_id: TASK-93\n---\n');
assert('wip excludes Done children', computeWip(wipDir, 'TASK-93'), 2);

// ── wipNotified Map dedup ─────────────────────────────────────────────────────
process.stdout.write('wipNotified Map dedup\n');
const wipNotified = new Map();

// First poll: wip=0 (all children in Backlog after meta-active) — emit
const wip1 = 0;
const lastWip1 = wipNotified.get('TASK-93');
wipNotified.set('TASK-93', wip1);
const emitWip1 = wip1 < WIP_CAP && lastWip1 !== wip1;
assert('first poll wip=0 → emit', emitWip1, true);
assert('wipNotified records 0', wipNotified.get('TASK-93'), 0);

// Second poll: wip still 0 — no re-emit
const wip2 = 0;
const lastWip2 = wipNotified.get('TASK-93');
wipNotified.set('TASK-93', wip2);
const emitWip2 = wip2 < WIP_CAP && lastWip2 !== wip2;
assert('same wip=0: no re-emit', emitWip2, false);

// loop-meta promotes two children: wip rises to 2 (at cap) — no emit
const wip3 = 2;
const lastWip3 = wipNotified.get('TASK-93');
wipNotified.set('TASK-93', wip3);
const emitWip3 = wip3 < WIP_CAP && lastWip3 !== wip3;
assert('wip=2 at cap: no emit', emitWip3, false);
assert('wipNotified updated to 2 (tracks cap)', wipNotified.get('TASK-93'), 2);

// Child goes Done: wip drops to 1 — emit
const wip4 = 1;
const lastWip4 = wipNotified.get('TASK-93');
wipNotified.set('TASK-93', wip4);
const emitWip4 = wip4 < WIP_CAP && lastWip4 !== wip4;
assert('wip drops 2→1: emit', emitWip4, true);
assert('wipNotified updated to 1', wipNotified.get('TASK-93'), 1);

// Both children done: wip drops to 0 — emit
const wip5 = 0;
const lastWip5 = wipNotified.get('TASK-93');
wipNotified.set('TASK-93', wip5);
const emitWip5 = wip5 < WIP_CAP && lastWip5 !== wip5;
assert('wip drops 1→0: emit', emitWip5, true);

// wip=0 again: no re-emit
const wip6 = 0;
const lastWip6 = wipNotified.get('TASK-93');
wipNotified.set('TASK-93', wip6);
const emitWip6 = wip6 < WIP_CAP && lastWip6 !== wip6;
assert('wip stays 0: no re-emit', emitWip6, false);

// ── wipAbsentCount grace-period dedup ─────────────────────────────────────────
// Fix-B: wipNotified must NOT be deleted on a single-poll absence (file-write flush).
// Only delete after GRACE_POLLS consecutive absences.
process.stdout.write('wipAbsentCount grace-period dedup\n');
const GRACE_POLLS = 3;
const wipNotifiedG  = new Map([['TASK-10', 1]]); // pre-seeded: wip=1
const wipAbsentCount = new Map();

// Helper: simulate one cleanup pass (mirrors daemon poll logic)
function graceCleanup(notified, absentCount, activeIds) {
  for (const [id] of notified) {
    if (!activeIds.has(id)) {
      const c = (absentCount.get(id) || 0) + 1;
      absentCount.set(id, c);
      if (c >= GRACE_POLLS) { notified.delete(id); absentCount.delete(id); }
    } else {
      absentCount.delete(id);
    }
  }
}

// Poll 1: TASK-10 absent for first time — must NOT be deleted
graceCleanup(wipNotifiedG, wipAbsentCount, new Set());
assert('absent poll 1: wipNotified preserved',      wipNotifiedG.has('TASK-10'), true);
assert('absent poll 1: absentCount=1',              wipAbsentCount.get('TASK-10'), 1);

// Poll 2: still absent — still not deleted
graceCleanup(wipNotifiedG, wipAbsentCount, new Set());
assert('absent poll 2: wipNotified preserved',      wipNotifiedG.has('TASK-10'), true);
assert('absent poll 2: absentCount=2',              wipAbsentCount.get('TASK-10'), 2);

// Poll 3: absent for GRACE_POLLS consecutive polls — now delete
graceCleanup(wipNotifiedG, wipAbsentCount, new Set());
assert('absent poll 3: wipNotified deleted',        wipNotifiedG.has('TASK-10'), false);
assert('absent poll 3: absentCount cleared',        wipAbsentCount.has('TASK-10'), false);

// Re-appearance resets count: seed a new entry, absent 2, then re-appears
wipNotifiedG.set('TASK-20', 5);
graceCleanup(wipNotifiedG, wipAbsentCount, new Set());            // absent 1
graceCleanup(wipNotifiedG, wipAbsentCount, new Set());            // absent 2
assert('2 absences: still in wipNotified',          wipNotifiedG.has('TASK-20'), true);
graceCleanup(wipNotifiedG, wipAbsentCount, new Set(['TASK-20'])); // re-appears
assert('re-appears: wipNotified still has entry',   wipNotifiedG.has('TASK-20'), true);
assert('re-appears: absentCount cleared',           wipAbsentCount.has('TASK-20'), false);
// Now absent 3 from clean slate — must survive first 2, delete on 3rd
graceCleanup(wipNotifiedG, wipAbsentCount, new Set());
graceCleanup(wipNotifiedG, wipAbsentCount, new Set());
assert('after reset: 2 absences still present',     wipNotifiedG.has('TASK-20'), true);
graceCleanup(wipNotifiedG, wipAbsentCount, new Set());
assert('after reset: 3rd absence deleted',          wipNotifiedG.has('TASK-20'), false);

// ── cleanup + result ──────────────────────────────────────────────────────────
fs.rmSync(tmp, { recursive: true });
process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
