#!/usr/bin/env node
// daemon-version: v8
/**
 * basic-daemon.js — UNIFIED B″ poller. Polls backlog tasks dir and emits five
 * event channels to stdout:
 *
 *   basic-ready:TASK-N       kind:basic AND status "Basic: Ready"   → worker executes task
 *   epic-ready:TASK-N        kind:epic  AND status "Epic: Ready"    → worker auto-decomposes
 *   child-done:TASK-N        kind:basic AND status "Basic: Done" AND has parent_task_id
 *                                                                   → worker re-checks parent epic
 *   proposal-approved:TASK-N marker file backlog/.etb-awaiting-plan-$id OR
 *                            backlog/.ftb-awaiting-plan-$id exists AND task status is
 *                            "Epic: Plan" or "Basic: Plan" respectively
 *                                                                   → worker triggers plan drafting
 *   plan-approved:TASK-N     marker file backlog/.etb-awaiting-backlog-$id OR
 *                            backlog/.ftb-awaiting-backlog-$id exists AND task status is
 *                            "Epic: Backlog" or "Basic: Ready" respectively
 *                                                                   → worker triggers finalise
 *
 * One daemon, one log; the loop-backlog worker dispatches by event prefix. Replaces the
 * former separate basic-daemon/epic-daemon split. Note: epic-ready fires ONLY for
 * "Epic: Ready" (the human-authorized state) — Epic: Proposal/Plan are handled by the
 * interactive epic-to-backlog skill, and Decomposing/Awaiting Children/Evaluating are
 * driven by the worker (via epic-ready then child-done), not by polling.
 *
 * proposal-approved and plan-approved use marker files written by the review orchestrator
 * (epic-to-backlog / feature-to-backlog) on APPROVED. The daemon deletes the marker on
 * first dispatch (idempotent; prevents re-fire on restart).
 *
 * Stops on stop-sentinel file or SIGTERM. Pure Node.js stdlib — no npm dependencies.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const BASIC_READY_STATUS   = 'basic: ready';
const EPIC_READY_STATUS    = 'epic: ready';
const BASIC_DONE_STATUS    = 'basic: done';
const EPIC_PLAN_STATUS     = 'epic: plan';
const BASIC_PLAN_STATUS    = 'basic: plan';
const EPIC_BACKLOG_STATUS  = 'epic: backlog';

function parseArgs(argv) {
  const args = {
    tasksDir: 'backlog/tasks',
    pidFile:  'backlog/.basic-daemon.pid',
    stopFile: 'backlog/.loop-stop',
    interval: 0.5,
  };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--tasks-dir':  args.tasksDir = argv[++i]; break;
      case '--pid-file':   args.pidFile  = argv[++i]; break;
      case '--stop-file':  args.stopFile = argv[++i]; break;
      case '--interval':   args.interval = parseFloat(argv[++i]); break;
      case '--help': case '-h':
        process.stdout.write(
          'Usage: basic-daemon.js [options]  (unified B″ poller)\n' +
          '  --tasks-dir <path>  Directory of task markdown files (default: backlog/tasks)\n' +
          '  --pid-file  <path>  PID file path (default: backlog/.basic-daemon.pid)\n' +
          '  --stop-file <path>  Stop sentinel path (default: backlog/.loop-stop)\n' +
          '  --interval  <secs> Poll interval in seconds (default: 0.5)\n'
        );
        process.exit(0);
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

// Returns { status, hasKindBasic, hasKindEpic, parent_task_id } from a task file.
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

    // Parse labels — support both inline [] and block list formats
    let labels = [];
    const inlineLabels = fm.match(/^labels:\s*\[([^\]]*)\]/m);
    if (inlineLabels) {
      labels = inlineLabels[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    } else {
      // Block list: lines after "labels:" that start with "  - "
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

// Returns the backlog dir (one level up from tasksDir, e.g. "backlog/tasks" → "backlog").
function backlogDir(tasksDir) {
  return path.dirname(tasksDir);
}

// isProposalApproved: returns true when a pipeline marker file
// (backlog/.etb-awaiting-plan-$id OR backlog/.ftb-awaiting-plan-$id) exists AND
// task status is "epic: plan" (for ETB) or "basic: plan" (for FTB).
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
    if (hasEtbMarker && meta.status === EPIC_PLAN_STATUS) return true;
    if (hasFtbMarker && meta.status === BASIC_PLAN_STATUS) return true;
    return false;
  };
}

// isPlanApproved: returns true when a pipeline marker file
// (backlog/.etb-awaiting-backlog-$id OR backlog/.ftb-awaiting-backlog-$id) exists AND
// task status is "epic: backlog" (for ETB) or "basic: ready" (for FTB).
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
    if (hasEtbMarker && meta.status === EPIC_BACKLOG_STATUS) return true;
    if (hasFtbMarker && meta.status === BASIC_READY_STATUS) return true;
    return false;
  };
}

// Scan tasksDir, returning a Set of IDs for which predicate(filepath) is true.
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

// Backward-compatible alias used by the embedded self-test.
function scanBasicReadyIds(tasksDir) { return scanIds(tasksDir, isBasicReady); }

const args       = parseArgs(process.argv);
const intervalMs = Math.round(args.interval * 1000);

const pidDir = path.dirname(args.pidFile);
if (pidDir) fs.mkdirSync(pidDir, { recursive: true });
fs.writeFileSync(args.pidFile, String(process.pid));

function removePid() { try { fs.unlinkSync(args.pidFile); } catch { /* gone */ } }
process.on('exit',    removePid);
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT',  () => process.exit(0));

// One notified set per channel; emit a given id once until it leaves the trigger state.
// proposal-approved and plan-approved delete their marker files on first emit (idempotent).
const channels = [
  { prefix: 'basic-ready',       predicate: isBasicReady,              notified: new Set(), onEmit: null },
  { prefix: 'epic-ready',        predicate: isEpicReady,               notified: new Set(), onEmit: null },
  { prefix: 'child-done',        predicate: isChildDone,               notified: new Set(), onEmit: null },
  { prefix: 'proposal-approved', predicate: isProposalApproved(args.tasksDir), notified: new Set(),
    onEmit: (id) => {
      const bd = backlogDir(args.tasksDir);
      for (const stem of [`.etb-awaiting-plan-${id}`, `.ftb-awaiting-plan-${id}`]) {
        try { fs.unlinkSync(path.join(bd, stem)); } catch { /* already gone */ }
      }
    }
  },
  { prefix: 'plan-approved',     predicate: isPlanApproved(args.tasksDir),     notified: new Set(),
    onEmit: (id) => {
      const bd = backlogDir(args.tasksDir);
      for (const stem of [`.etb-awaiting-backlog-${id}`, `.ftb-awaiting-backlog-${id}`]) {
        try { fs.unlinkSync(path.join(bd, stem)); } catch { /* already gone */ }
      }
    }
  },
];

const timer = setInterval(() => {
  if (fs.existsSync(args.stopFile)) { clearInterval(timer); process.exit(0); }

  for (const ch of channels) {
    const ids = scanIds(args.tasksDir, ch.predicate);
    // Evict IDs no longer in the trigger state (allows re-emit on a future re-entry)
    for (const id of ch.notified) { if (!ids.has(id)) ch.notified.delete(id); }
    // Emit new IDs (sorted for determinism)
    for (const id of [...ids].filter(id => !ch.notified.has(id)).sort()) {
      process.stdout.write(`${ch.prefix}:${id}\n`);
      ch.notified.add(id);
      if (ch.onEmit) ch.onEmit(id);
    }
  }
}, intervalMs);
