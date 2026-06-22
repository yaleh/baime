#!/usr/bin/env node
// Unit tests for basic-daemon.js helper functions (v8).
// Run with: node scripts/basic-daemon.test.js
'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

function parseTaskId(filename) {
  const base = path.basename(filename, path.extname(filename)).toUpperCase();
  for (const part of base.split(/\s+/)) {
    if (/^TASK-\d+(\.\d+)*$/.test(part)) return part;
  }
  const m = base.match(/\bTASK-(\d+(?:\.\d+)*)\b/);
  return m ? `TASK-${m[1]}` : null;
}

function isBasicReady(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const m = content.match(/^---\n([\s\S]*?)^---/m);
    if (!m) return false;
    const fm = m[1];
    const statusMatch = fm.match(/^status:\s*(.+)$/m);
    const status = statusMatch ? statusMatch[1].trim().toLowerCase() : null;
    if (status !== 'basic: ready') return false;
    const inlineLabels = fm.match(/^labels:\s*\[([^\]]*)\]/m);
    if (inlineLabels) {
      const labels = inlineLabels[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
      return labels.includes('kind:basic') && !labels.includes('kind:epic');
    }
  } catch { /* unreadable */ }
  return false;
}

function scanBasicReadyIds(tasksDir) {
  const ready = new Set();
  let entries;
  try { entries = fs.readdirSync(tasksDir); } catch { return ready; }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const id = parseTaskId(entry);
    if (id && isBasicReady(path.join(tasksDir, entry))) ready.add(id);
  }
  return ready;
}

function scanIds(tasksDir, predicate) {
  const out = new Set();
  let entries;
  try { entries = fs.readdirSync(tasksDir); } catch { return out; }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const id = parseTaskId(entry);
    if (id && predicate(path.join(tasksDir, entry))) out.add(id);
  }
  return out;
}

function readTaskMeta(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const m = content.match(/^---\n([\s\S]*?)^---/m);
    if (!m) return null;
    const fm = m[1];
    const statusMatch = fm.match(/^status:\s*(.+)$/m);
    const status = statusMatch ? statusMatch[1].trim().replace(/['"]/g, '').toLowerCase() : null;
    const parentMatch = content.match(/^parent_task_id:\s*(.+)$/m);
    const parent_task_id = parentMatch ? parentMatch[1].trim().toUpperCase() : null;
    let labels = [];
    const inlineLabels = fm.match(/^labels:\s*\[([^\]]*)\]/m);
    if (inlineLabels) {
      labels = inlineLabels[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    }
    const hasKindBasic = labels.includes('kind:basic');
    const hasKindEpic  = labels.includes('kind:epic');
    return { status, hasKindBasic, hasKindEpic, parent_task_id };
  } catch { /* unreadable */ }
  return null;
}

function backlogDir(tasksDir) {
  return path.dirname(tasksDir);
}

function isProposalApproved(tasksDir) {
  return function(filepath) {
    const meta = readTaskMeta(filepath);
    if (!meta) return false;
    const id = parseTaskId(path.basename(filepath));
    if (!id) return false;
    const bd = backlogDir(tasksDir);
    const etbMarker = path.join(bd, `.etb-awaiting-plan-${id}`);
    const ftbMarker = path.join(bd, `.ftb-awaiting-plan-${id}`);
    const hasEtbMarker = fs.existsSync(etbMarker);
    const hasFtbMarker = fs.existsSync(ftbMarker);
    if (hasEtbMarker && meta.status === 'epic: plan') return true;
    if (hasFtbMarker && meta.status === 'basic: plan') return true;
    return false;
  };
}

function isPlanApproved(tasksDir) {
  return function(filepath) {
    const meta = readTaskMeta(filepath);
    if (!meta) return false;
    const id = parseTaskId(path.basename(filepath));
    if (!id) return false;
    const bd = backlogDir(tasksDir);
    const etbMarker = path.join(bd, `.etb-awaiting-backlog-${id}`);
    const ftbMarker = path.join(bd, `.ftb-awaiting-backlog-${id}`);
    const hasEtbMarker = fs.existsSync(etbMarker);
    const hasFtbMarker = fs.existsSync(ftbMarker);
    if (hasEtbMarker && meta.status === 'epic: backlog') return true;
    if (hasFtbMarker && meta.status === 'basic: ready') return true;
    return false;
  };
}

let passed = 0, failed = 0;
function assert(desc, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { process.stdout.write(`  ✓ ${desc}\n`); passed++; }
  else     { process.stderr.write(`  ✗ ${desc}\n    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(actual)}\n`); failed++; }
}

process.stdout.write('parseTaskId\n');
assert('simple prefix',       parseTaskId('task-3 - do something.md'),             'TASK-3');
assert('upper already',       parseTaskId('TASK-10 - title.md'),                   'TASK-10');
assert('embedded id',         parseTaskId('sprint-TASK-7-notes.md'),               'TASK-7');
assert('no id returns null',  parseTaskId('README.md'),                            null);
assert('multi-digit',         parseTaskId('task-42 - long title here.md'),         'TASK-42');

process.stdout.write('isBasicReady\n');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-test-'));
const basicReadyFile = path.join(tmp, 'ready.md');
fs.writeFileSync(basicReadyFile, '---\nstatus: Basic: Ready\nlabels: [kind:basic]\n---\n# Task\n');
assert('basic ready with kind:basic', isBasicReady(basicReadyFile), true);
const epicFile = path.join(tmp, 'epic.md');
fs.writeFileSync(epicFile, '---\nstatus: Basic: Ready\nlabels: [kind:basic, kind:epic]\n---\n# Task\n');
assert('kind:epic excluded', isBasicReady(epicFile), false);
const doneFile = path.join(tmp, 'done.md');
fs.writeFileSync(doneFile, '---\nstatus: Basic: Done\nlabels: [kind:basic]\n---\n# Task\n');
assert('basic done → false', isBasicReady(doneFile), false);

process.stdout.write('scanBasicReadyIds\n');
const dir = path.join(tmp, 'tasks');
fs.mkdirSync(dir);
fs.writeFileSync(path.join(dir, 'task-1 - alpha.md'), '---\nstatus: Basic: Ready\nlabels: [kind:basic]\n---\n');
fs.writeFileSync(path.join(dir, 'task-2 - beta.md'),  '---\nstatus: Basic: Done\nlabels: [kind:basic]\n---\n');
fs.writeFileSync(path.join(dir, 'task-3 - gamma.md'), '---\nstatus: Basic: Ready\nlabels: [kind:basic]\n---\n');
fs.writeFileSync(path.join(dir, 'not-a-task.txt'),    '---\nstatus: Basic: Ready\nlabels: [kind:basic]\n---\n');
const ids = scanBasicReadyIds(dir);
assert('finds basic ready tasks', [...ids].sort(), ['TASK-1', 'TASK-3']);
assert('skips done tasks',        ids.has('TASK-2'), false);
assert('skips non-md files',      ids.size, 2);
assert('missing dir → empty', [...scanBasicReadyIds(path.join(tmp, 'no-such-dir'))].length, 0);

// ─── isProposalApproved tests ───────────────────────────────────────────────
process.stdout.write('isProposalApproved\n');
const paDir = path.join(tmp, 'pa-tasks');
fs.mkdirSync(paDir, { recursive: true });
const paBacklog = path.join(tmp, 'pa-backlog');
fs.mkdirSync(paBacklog, { recursive: true });
const paTasksDir = path.join(paBacklog, 'tasks');
fs.mkdirSync(paTasksDir);

// ETB: marker exists + status "Epic: Plan" → true
fs.writeFileSync(path.join(paTasksDir, 'task-5 - etb task.md'), '---\nstatus: Epic: Plan\nlabels: [kind:epic]\n---\n');
fs.writeFileSync(path.join(paBacklog, '.etb-awaiting-plan-TASK-5'), '');
assert('ETB: marker + Epic: Plan → true', isProposalApproved(paTasksDir)(path.join(paTasksDir, 'task-5 - etb task.md')), true);

// ETB: marker exists but status NOT "Epic: Plan" → false
fs.writeFileSync(path.join(paTasksDir, 'task-6 - etb task2.md'), '---\nstatus: Epic: Proposal\nlabels: [kind:epic]\n---\n');
fs.writeFileSync(path.join(paBacklog, '.etb-awaiting-plan-TASK-6'), '');
assert('ETB: marker + wrong status → false', isProposalApproved(paTasksDir)(path.join(paTasksDir, 'task-6 - etb task2.md')), false);

// ETB: status "Epic: Plan" but NO marker → false
fs.writeFileSync(path.join(paTasksDir, 'task-8 - etb no-marker.md'), '---\nstatus: Epic: Plan\nlabels: [kind:epic]\n---\n');
assert('ETB: Epic: Plan no marker → false', isProposalApproved(paTasksDir)(path.join(paTasksDir, 'task-8 - etb no-marker.md')), false);

// FTB: marker exists + status "Basic: Plan" → true
fs.writeFileSync(path.join(paTasksDir, 'task-9 - ftb task.md'), '---\nstatus: Basic: Plan\nlabels: [kind:basic]\n---\n');
fs.writeFileSync(path.join(paBacklog, '.ftb-awaiting-plan-TASK-9'), '');
assert('FTB: marker + Basic: Plan → true', isProposalApproved(paTasksDir)(path.join(paTasksDir, 'task-9 - ftb task.md')), true);

// scanIds proposal-approved: finds TASK-5 but not TASK-6 (wrong status) or TASK-8 (no marker)
const proposalApprovedIds = scanIds(paTasksDir, isProposalApproved(paTasksDir));
assert('scanIds proposal-approved finds TASK-5', proposalApprovedIds.has('TASK-5'), true);
assert('scanIds proposal-approved finds TASK-9', proposalApprovedIds.has('TASK-9'), true);
assert('scanIds proposal-approved skips TASK-6 (wrong status)', proposalApprovedIds.has('TASK-6'), false);
assert('scanIds proposal-approved skips TASK-8 (no marker)', proposalApprovedIds.has('TASK-8'), false);

// ─── isPlanApproved tests ─────────────────────────────────────────────────────
process.stdout.write('isPlanApproved\n');

// ETB: marker + status "Epic: Backlog" → true
fs.writeFileSync(path.join(paTasksDir, 'task-7 - etb-plan-approved.md'), '---\nstatus: Epic: Backlog\nlabels: [kind:epic]\n---\n');
fs.writeFileSync(path.join(paBacklog, '.etb-awaiting-backlog-TASK-7'), '');
assert('ETB: awaiting-backlog + Epic: Backlog → true', isPlanApproved(paTasksDir)(path.join(paTasksDir, 'task-7 - etb-plan-approved.md')), true);

// FTB: marker + status "Basic: Ready" → true
fs.writeFileSync(path.join(paTasksDir, 'task-10 - ftb-plan-approved.md'), '---\nstatus: Basic: Ready\nlabels: [kind:basic]\n---\n');
fs.writeFileSync(path.join(paBacklog, '.ftb-awaiting-backlog-TASK-10'), '');
assert('FTB: awaiting-backlog + Basic: Ready → true', isPlanApproved(paTasksDir)(path.join(paTasksDir, 'task-10 - ftb-plan-approved.md')), true);

// No marker → false
fs.writeFileSync(path.join(paTasksDir, 'task-11 - no-marker.md'), '---\nstatus: Epic: Backlog\nlabels: [kind:epic]\n---\n');
assert('isPlanApproved: no marker → false', isPlanApproved(paTasksDir)(path.join(paTasksDir, 'task-11 - no-marker.md')), false);

// scanIds plan-approved
const planApprovedIds = scanIds(paTasksDir, isPlanApproved(paTasksDir));
assert('scanIds plan-approved finds TASK-7', planApprovedIds.has('TASK-7'), true);
assert('scanIds plan-approved finds TASK-10 (FTB)', planApprovedIds.has('TASK-10'), true);
assert('scanIds plan-approved skips TASK-11 (no marker)', planApprovedIds.has('TASK-11'), false);

fs.rmSync(tmp, { recursive: true });
process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
