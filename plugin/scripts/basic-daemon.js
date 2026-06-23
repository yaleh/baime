#!/usr/bin/env node
// daemon-version: v8
/**
 * basic-daemon.js — UNIFIED B″ poller. Polls backlog tasks dir and emits FIVE
 * event channels to stdout:
 *
 *   basic-ready:TASK-N       kind:basic AND status "Basic: Ready"   → worker executes task
 *   epic-ready:TASK-N        kind:epic  AND status "Epic: Ready"    → worker auto-decomposes
 *   child-done:TASK-N        kind:basic AND status "Basic: Done" AND has parent_task_id
 *                                                                   → worker re-checks parent epic
 *   proposal-approved:TASK-N status "Basic: Plan" or "Epic: Plan" AND marker file
 *                            backlog/.ftb-awaiting-plan-TASK-N exists → worker runs plan draft
 *   plan-approved:TASK-N     status "Basic: Backlog"/"Basic: Ready"/"Epic: Backlog" AND marker
 *                            backlog/.ftb-awaiting-backlog-TASK-N exists → worker runs finalise
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const BASIC_READY_STATUS = 'basic: ready';
const EPIC_READY_STATUS  = 'epic: ready';
const BASIC_DONE_STATUS  = 'basic: done';

function parseArgs(argv) {
  const args = {
    tasksDir:          'backlog/tasks',
    pidFile:           'backlog/.basic-daemon.pid',
    stopFile:          'backlog/.loop-stop',
    interval:          0.5,
    heartbeatInterval: 60,
  };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--tasks-dir':          args.tasksDir          = argv[++i]; break;
      case '--pid-file':           args.pidFile           = argv[++i]; break;
      case '--stop-file':          args.stopFile          = argv[++i]; break;
      case '--interval':           args.interval          = parseFloat(argv[++i]); break;
      case '--heartbeat-interval': args.heartbeatInterval = parseFloat(argv[++i]); break;
    }
  }
  return args;
}

function parseTaskId(filename) {
  const base = path.basename(filename, path.extname(filename)).toUpperCase();
  for (const part of base.split(/\s+/)) {
    if (/^TASK-\d+(\.\d+)*$/.test(part)) return part;
  }
  const m = base.match(/\bTASK-(\d+(?:\.\d+)*)\b/);
  return m ? `TASK-${m[1]}` : null;
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
    } else {
      const blockMatch = fm.match(/^labels:\s*\n((?:  - .+\n?)*)/m);
      if (blockMatch) {
        labels = blockMatch[1].split('\n')
          .map(l => l.replace(/^\s+-\s+/, '').trim().replace(/['"]/g, ''))
          .filter(Boolean);
      }
    }
    const hasKindBasic = labels.includes('kind:basic');
    const hasKindEpic  = labels.includes('kind:epic');
    return { status, hasKindBasic, hasKindEpic, parent_task_id };
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
  return meta.hasKindEpic && !meta.hasKindBasic && meta.status === EPIC_READY_STATUS;
}

function isChildDone(filepath) {
  const meta = readTaskMeta(filepath);
  if (!meta) return false;
  return meta.hasKindBasic && !meta.hasKindEpic
      && meta.status === BASIC_DONE_STATUS && !!meta.parent_task_id;
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

function scanBasicReadyIds(tasksDir) { return scanIds(tasksDir, isBasicReady); }

const PROPOSAL_APPROVED_STATUSES = new Set(['basic: plan', 'epic: plan']);
const PLAN_APPROVED_STATUSES     = new Set(['basic: backlog', 'basic: ready', 'epic: backlog']);

function isProposalApproved(filepath, backlogDir) {
  const meta = readTaskMeta(filepath);
  if (!meta) return false;
  if (!PROPOSAL_APPROVED_STATUSES.has(meta.status)) return false;
  const id = parseTaskId(filepath);
  if (!id) return false;
  return fs.existsSync(path.join(backlogDir, `.ftb-awaiting-plan-${id}`))
      || fs.existsSync(path.join(backlogDir, `.etb-awaiting-plan-${id}`));
}

function isPlanApproved(filepath, backlogDir) {
  const meta = readTaskMeta(filepath);
  if (!meta) return false;
  if (!PLAN_APPROVED_STATUSES.has(meta.status)) return false;
  const id = parseTaskId(filepath);
  if (!id) return false;
  return fs.existsSync(path.join(backlogDir, `.ftb-awaiting-backlog-${id}`))
      || fs.existsSync(path.join(backlogDir, `.etb-awaiting-backlog-${id}`));
}

const args       = parseArgs(process.argv);
const intervalMs = Math.round(args.interval * 1000);
const heartbeatMs = Math.round(args.heartbeatInterval * 1000);

const pidDir = path.dirname(args.pidFile);
if (pidDir) fs.mkdirSync(pidDir, { recursive: true });
fs.writeFileSync(args.pidFile, String(process.pid));

function removePid() { try { fs.unlinkSync(args.pidFile); } catch { /* gone */ } }
process.on('exit',    removePid);
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT',  () => process.exit(0));

const backlogDir = path.dirname(args.pidFile);
const channels = [
  { prefix: 'basic-ready',       predicate: f => isBasicReady(f),                   notified: new Set() },
  { prefix: 'epic-ready',        predicate: f => isEpicReady(f),                    notified: new Set() },
  { prefix: 'child-done',        predicate: f => isChildDone(f),                    notified: new Set() },
  { prefix: 'proposal-approved', predicate: f => isProposalApproved(f, backlogDir), notified: new Set() },
  { prefix: 'plan-approved',     predicate: f => isPlanApproved(f, backlogDir),     notified: new Set() },
];

const timer = setInterval(() => {
  if (fs.existsSync(args.stopFile)) { clearInterval(timer); process.exit(0); }
  for (const ch of channels) {
    const ids = scanIds(args.tasksDir, ch.predicate);
    for (const id of ch.notified) { if (!ids.has(id)) ch.notified.delete(id); }
    for (const id of [...ids].filter(id => !ch.notified.has(id)).sort()) {
      process.stdout.write(`${ch.prefix}:${id}\n`);
      ch.notified.add(id);
    }
  }
}, intervalMs);

const heartbeatTimer = setInterval(() => {
  if (fs.existsSync(args.stopFile)) { clearInterval(heartbeatTimer); process.exit(0); }
  process.stdout.write(`heartbeat:${Date.now()}\n`);
}, heartbeatMs);
