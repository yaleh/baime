#!/usr/bin/env node
// daemon-version: v6
/**
 * basic-daemon.js — polls backlog tasks dir and emits basic-ready events to stdout.
 *
 * Emits one line per Basic:Ready transition: "basic-ready:TASK-N"
 * Only tasks with kind:basic label AND status "Basic: Ready" are emitted.
 * Excludes tasks with kind:epic label (those go to epic-daemon's channel).
 * Stops on stop-sentinel file or SIGTERM.
 *
 * Pure Node.js stdlib — no npm dependencies required.
 * Reads parent_task_id from task frontmatter for notifyParentIfAny hook.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

// The status that triggers emission on the basic channel
const BASIC_READY_STATUS = 'basic: ready';

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
          'Usage: basic-daemon.js [options]\n' +
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
    const status = statusMatch ? statusMatch[1].trim().toLowerCase() : null;

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
          .map(l => l.replace(/^\s+-\s+/, '').trim())
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
  // Must have kind:basic label and NOT kind:epic, and status must be "Basic: Ready"
  return meta.hasKindBasic && !meta.hasKindEpic && meta.status === BASIC_READY_STATUS;
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

const args       = parseArgs(process.argv);
const intervalMs = Math.round(args.interval * 1000);

const pidDir = path.dirname(args.pidFile);
if (pidDir) fs.mkdirSync(pidDir, { recursive: true });
fs.writeFileSync(args.pidFile, String(process.pid));

function removePid() { try { fs.unlinkSync(args.pidFile); } catch { /* gone */ } }
process.on('exit',    removePid);
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT',  () => process.exit(0));

const notified = new Set(); // IDs we have already emitted basic-ready for

const timer = setInterval(() => {
  if (fs.existsSync(args.stopFile)) { clearInterval(timer); process.exit(0); }

  // Basic channel: emit basic-ready for kind:basic tasks at Basic: Ready
  const readyIds = scanBasicReadyIds(args.tasksDir);

  // Evict IDs that are no longer in ready state
  for (const id of notified) { if (!readyIds.has(id)) notified.delete(id); }

  // Emit new ready IDs (sorted for determinism)
  for (const id of [...readyIds].filter(id => !notified.has(id)).sort()) {
    process.stdout.write(`basic-ready:${id}\n`);
    notified.add(id);
  }
}, intervalMs);
