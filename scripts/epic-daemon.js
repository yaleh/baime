#!/usr/bin/env node
// daemon-version: v6
/**
 * epic-daemon.js — polls backlog tasks dir and emits epic-ready events to stdout.
 *
 * Emits one line per epic state transition: "epic-ready:TASK-N"
 * Only tasks with kind:epic label AND status in the active Epic:* subset are emitted.
 * Active Epic:* statuses: Proposal, Plan, Decomposing, Awaiting Children, Evaluating.
 * Terminal statuses (Epic: Done, Epic: Needs Human) are NOT emitted.
 * Re-emits whenever status changes within the active subset (e.g. Proposal→Plan).
 * Stops on stop-sentinel file or SIGTERM.
 *
 * Pure Node.js stdlib — no npm dependencies required.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

// Active Epic statuses that trigger epic-ready emission
const EPIC_READY_STATUSES = new Set([
  'epic: proposal',
  'epic: plan',
  'epic: decomposing',
  'epic: awaiting children',
  'epic: evaluating',
]);

function parseArgs(argv) {
  const args = {
    tasksDir: 'backlog/tasks',
    pidFile:  'backlog/.epic-daemon.pid',
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
          'Usage: epic-daemon.js [options]\n' +
          '  --tasks-dir <path>  Directory of task markdown files (default: backlog/tasks)\n' +
          '  --pid-file  <path>  PID file path (default: backlog/.epic-daemon.pid)\n' +
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

// Returns { status, hasKindEpic, hasKindBasic } from a task file.
function readTaskMeta(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const m = content.match(/^---\n([\s\S]*?)^---/m);
    if (!m) return null;
    const fm = m[1];

    const statusMatch = fm.match(/^status:\s*(.+)$/m);
    const status = statusMatch ? statusMatch[1].trim().toLowerCase() : null;

    // Parse labels — support both inline [] and block list formats
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

    const hasKindEpic  = labels.includes('kind:epic');
    const hasKindBasic = labels.includes('kind:basic');

    return { status, hasKindEpic, hasKindBasic };
  } catch { /* unreadable */ }
  return null;
}

function scanEpicReadyIds(tasksDir) {
  const ready = new Map(); // id → current status
  let entries;
  try { entries = fs.readdirSync(tasksDir); } catch { return ready; }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const id = parseTaskId(entry);
    if (!id) continue;
    const meta = readTaskMeta(path.join(tasksDir, entry));
    if (!meta) continue;
    if (meta.hasKindEpic && !meta.hasKindBasic && EPIC_READY_STATUSES.has(meta.status)) {
      ready.set(id, meta.status);
    }
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

// epicNotified: id → lastSeenStatus (re-emit when status changes within active subset)
const epicNotified = new Map();

const timer = setInterval(() => {
  if (fs.existsSync(args.stopFile)) { clearInterval(timer); process.exit(0); }

  // Epic channel: emit epic-ready for kind:epic tasks in active Epic:* statuses
  const readyIds = scanEpicReadyIds(args.tasksDir);

  // Evict IDs no longer active
  for (const [id] of epicNotified) { if (!readyIds.has(id)) epicNotified.delete(id); }

  // Emit IDs that are new or whose status has changed (sorted for determinism)
  for (const [id, status] of [...readyIds].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (epicNotified.get(id) !== status) {
      process.stdout.write(`epic-ready:${id}\n`);
      epicNotified.set(id, status);
    }
  }
}, intervalMs);
