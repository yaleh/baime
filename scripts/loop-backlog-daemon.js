#!/usr/bin/env node
// daemon-version: v4
/**
 * loop-backlog-daemon.js — polls backlog tasks dir and emits task-ready events to stdout.
 *
 * Emits one line per Ready transition:      "task-ready:TASK-N"
 * Emits one line per Meta-ready transition: "meta-ready:TASK-N"
 * Meta-lane tasks (Meta-Proposal, Meta-Plan) are excluded from task-ready.
 * Stops on stop-sentinel file or SIGTERM. Does NOT self-terminate on parent PID death
 * (parent is a transient Bash shell; lifecycle is managed by sentinel and nohup/disown).
 *
 * Pure Node.js stdlib — no npm dependencies required.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

// Statuses that belong to the Meta lane (L1 territory — never emit task-ready for these)
const META_STATUSES = new Set([
  'meta-proposal', 'meta-plan', 'meta-active', 'meta-done',
]);

// Statuses within the Meta lane that signal L1 should pick up the task
const META_READY_STATUSES = new Set(['meta-proposal', 'meta-plan']);

function parseArgs(argv) {
  const args = {
    tasksDir: 'backlog/tasks',
    pidFile:  'backlog/.daemon.pid',
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
          'Usage: loop-backlog-daemon.js [options]\n' +
          '  --tasks-dir <path>  Directory of task markdown files (default: backlog/tasks)\n' +
          '  --pid-file  <path>  PID file path (default: backlog/.daemon.pid)\n' +
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
    if (/^TASK-\d+$/.test(part)) return part;
  }
  const m = base.match(/\bTASK-(\d+)\b/);
  return m ? `TASK-${m[1]}` : null;
}

// Returns the normalised status string (lowercase) from a task file, or null if unreadable.
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

function isReady(filepath) {
  const status = readStatus(filepath);
  // Exclude Meta-lane tasks from the L0 task-ready channel
  if (status === null || META_STATUSES.has(status)) return false;
  return status === 'ready';
}

function isMetaReady(filepath) {
  const status = readStatus(filepath);
  return status !== null && META_READY_STATUSES.has(status);
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

const args       = parseArgs(process.argv);
const intervalMs = Math.round(args.interval * 1000);

const pidDir = path.dirname(args.pidFile);
if (pidDir) fs.mkdirSync(pidDir, { recursive: true });
fs.writeFileSync(args.pidFile, String(process.pid));

function removePid() { try { fs.unlinkSync(args.pidFile); } catch { /* gone */ } }
process.on('exit',    removePid);
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT',  () => process.exit(0));

const notified     = new Set();
const metaNotified = new Set();

const timer = setInterval(() => {
  if (fs.existsSync(args.stopFile)) { clearInterval(timer); process.exit(0); }

  // L0 channel: task-ready (excludes Meta-lane)
  const readyIds = scanReadyIds(args.tasksDir);
  for (const id of notified) { if (!readyIds.has(id)) notified.delete(id); }
  for (const id of [...readyIds].filter(id => !notified.has(id)).sort()) {
    process.stdout.write(`task-ready:${id}\n`);
    notified.add(id);
  }

  // L1 channel: meta-ready (Meta-Proposal and Meta-Plan only)
  const metaReadyIds = scanMetaReadyIds(args.tasksDir);
  for (const id of metaNotified) { if (!metaReadyIds.has(id)) metaNotified.delete(id); }
  for (const id of [...metaReadyIds].filter(id => !metaNotified.has(id)).sort()) {
    process.stdout.write(`meta-ready:${id}\n`);
    metaNotified.add(id);
  }
}, intervalMs);
