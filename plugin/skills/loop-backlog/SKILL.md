---
name: loop-backlog
description: "Autonomous L0 Worker for the backlog.md task queue. Each task runs in an isolated git worktree, then merges back to master on success. Starts an event-driven daemon that emits task-ready events; uses Monitor to react instantly. Invoke /loop-backlog once to start the worker loop; it keeps running until the backlog/.loop-stop sentinel is written."
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Monitor, Agent
contracts:
  - grep: "Monitor(persistent=true"
    target: self
  - not-grep: "schedule("
    target: self
  - grep: "loop-stop"
    target: self
  - grep: "## Shutdown"
    target: self
  - grep: "daemonBootstrap"
    target: self
  - not-grep: "ScheduleWakeup"
    target: self
  - grep: "loop-backlog-daemon"
    target: self
  - grep: ".daemon.pid"
    target: self
  - grep: "Agent(run_in_background=true"
    target: self
  - grep: "\"In Progress\""
    target: self
  - grep: ".agent-done-"
    target: self
  - grep: "executePrompt"
    target: self
  - grep: '"DoD #.*: PASS"'
    target: self
  - grep: '"DoD #.*: FAIL"'
    target: self
---

λ() → workerLoop()

## Spec

Config :: {
  symlinks    : [Path]   -- dirs to symlink into worktree ([] = none)
  maxParallel : Int      -- max concurrent background agents (default 2)
}

loadConfig :: () → Config  -- see spec-stdlib § loadConfig
loadConfig() =
  | fromClaudeMd()   -- explicit: "## L0 Config" section in CLAUDE.md
                     -- reads: worktree-symlinks, max-parallel (default 2)
  | autoDetect()     -- implicit: probe package.json, go.mod, Cargo.toml, etc.

autoDetect :: () → Config
autoDetect() = -- see spec-stdlib § loadConfig

detectLang :: () → Lang  -- see spec-stdlib § detectLang
-- see spec-stdlib § detectLang

data Outcome = Done CommitHash | NeedsHuman Reason | Idle | Stopped

ensureDaemonTest :: () → ()
-- Write scripts/loop-backlog-daemon.test.js if it doesn't exist or is outdated.
-- Runs node on the test file to verify the daemon helpers are correct.

workerLoop :: () → Outcome
workerLoop() = {
  cfg:    loadConfig(),
  _:      ensureDaemonScript(),
  _:      ensureDaemonTest(),
  _:      daemonBootstrap(),
  _:      reap(inProgressTasks()),
  tasks:  claimBatch(cfg.maxParallel),

  if (stopSentinel()):
    return: Stopped,

  if (empty(tasks)):
    -- No task yet; block persistently until daemon emits a task-ready line
    event: Monitor(persistent=true),
    if (event matches "task-ready:TASK-*"):
      return: workerLoop(),
    if (stopSentinel()):
      return: Stopped,

  -- Parallel: create worktrees and spawn one background agent per task
  worktrees: ∀t ∈ tasks: withWorktree(t, cfg),
  _:         ∀(t, wt) ∈ zip(tasks, worktrees): spawnAgent(t, wt),

  -- Wait for all agents to signal completion
  results: waitForAgents(tasks),

  -- Serial: merge each branch in order; read signal file to decide merge vs. escalate
  ∀t ∈ tasks: {
    sig: results[t],
    _:   deleteSignalFile("backlog/.agent-done-" + t.id),
    if (sig == "done"):
      verifyDod(t),
      merge(t, t.branch)
    else:
      escalate(t, stripPrefix("needs-human: ", sig))
  },

  return: Done
}

reap :: [Task] → ()
reap(tasks) = ∀t ∈ tasks
  where claimAge(t) > 30min ∨ ¬hasClaimed(t): {
    reset(t, "Ready"),
    appendNote(t, "Requeued by reaper: in-progress timeout."),
    removeWorktree(t)
  }

claimBatch :: Int → [Task]
claimBatch(n) = {
  tasks: take(n, readyTasks()),
  if (empty(tasks)): return [],
  ∀t ∈ tasks: atomically: {
    setStatus(t, "In Progress"),
    appendNote(t, "claimed: " + now())
  },
  return: tasks        -- actual list; may be fewer than n if fewer Ready tasks exist
}

-- spawnAgent: launch a background agent for a single task in its worktree.
-- The agent works only inside wt, commits if changed, then writes a signal file.
-- Agent's allowed-tools explicitly excludes Agent to prevent recursive spawn.
spawnAgent :: (Task, Worktree) → ()
spawnAgent(T, wt) =
  Agent(run_in_background=true, prompt=executePrompt(T, wt))

-- waitForAgents: poll signal files until all agents in the batch have reported.
-- Signal file path: backlog/.agent-done-TASK-N
-- Content: "done" | "needs-human: <reason>"
-- Polls every 5 seconds; no external dependencies beyond bash.
waitForAgents :: [Task] → Map Task SignalContent
waitForAgents(tasks) = {
  remaining: tasks,
  results:   {},
  loop while (nonEmpty(remaining)): {
    sleep(5),
    ∀t ∈ remaining:
      if (exists("backlog/.agent-done-" + t.id)):
        content: read("backlog/.agent-done-" + t.id),
        results[t]: content,
        remaining:  remaining \ {t}
  },
  return: results
}

withWorktree :: Task → Config → (Task → a) → a
withWorktree(T, cfg, f) = {
  wt:  createWorktree(T),
  _:   ∀s ∈ cfg.symlinks: symlink(repoRoot + "/" + s, wt + "/" + s),
  cd:  wt,
  return: f(T)
}

-- execute is task-type-agnostic: T.description is the sole authority on what to do
-- If re-claimed after a Needs Human cycle, human reply in Notes takes precedence.
execute :: Task → Outcome
execute(T) = {
  ctx:    readHumanReply(T),       -- extract human's answer if re-claimed after escalation
  _:      followDescription(T.description, ctx),
  _:      ∀(n, cmd) ∈ enumerate(T.dodCommands): verifyDod(T, n, cmd),
  hash:   conditionalCommit(T),
  _:      appendSummary(T, hash),
  return: merge(T, hash)
} | cannotProceed(reason) → escalate(T, reason)

-- appendCheckpoint: record completion of a phase in the task's Implementation Notes.
-- Called after each ## Phase section in the task Description completes.
appendCheckpoint :: (Task, PhaseIndex, Summary) → ()
appendCheckpoint(T, x, summary) =
  appendNote(T, "Phase " + x + " ✓ " + now() + "\n" + summary)

-- appendDodNote: record pass/fail result of a DoD command.
-- Called once per DoD item; on failure includes up to 5 lines of error output.
appendDodNote :: (Task, Int, ShellCmd, Result) → ()
appendDodNote(T, n, cmd, Pass)       = appendNote(T, "DoD #" + n + ": PASS — " + cmd)
appendDodNote(T, n, cmd, Fail(out))  = appendNote(T, "DoD #" + n + ": FAIL — " + cmd
                                                     + "\n" + take(5, lines(out)))

-- appendSummary: write the final Execution Summary before the signal file is written.
-- Must be called after all phases and DoD checks have completed.
appendSummary :: (Task, Maybe CommitHash) → ()
appendSummary(T, hash) =
  appendNote(T, "## Execution Summary\n"
               + "Result: " + outcomeLabel(T) + "\n"
               + "Commit: " + fromMaybe("no changes", hash) + "\n"
               + executionLog(T))

-- readHumanReply: scan Notes for a human reply written after the last "Escalated:" entry.
-- Returns a context map that followDescription uses to resolve open questions.
readHumanReply :: Task → Context
readHumanReply(T) =
  | hasEscalatedNote(T) →
      reply: textAfterLastEscalated(T.notes),
      if (nonEmpty(reply)): return parseContext(reply)   -- treat reply as free-form; extract decisions
  | otherwise → emptyContext

-- escalate: only exit when the worker cannot continue without human input.
-- Never ask the user a question while a task is In Progress; call escalate() instead.
-- Write a clear "Human, please answer:" question so the user can reply directly in Notes.
escalate :: (Task, Reason) → Outcome
escalate(T, r) = {
  setStatus(T, "Needs Human"),
  appendNote(T, "Escalated: " + r
               + "\nTo continue: answer in Implementation Notes, then set status → Ready."),
  return: NeedsHuman(r)
}

verifyDod :: (Task, Int, ShellCmd) → ()
verifyDod(T, n, cmd) =
  | eval(cmd).exitCode == 0 → checkDod(T, n)
  | attempts(n) < 3         → fix(); verifyDod(T, n, cmd)
  | otherwise               → raise Stuck(n, cmd)

conditionalCommit :: Task → Maybe CommitHash
conditionalCommit(T) =
  | hasChanges() → git add -A; commit(T); return Just(HEAD)
  | otherwise    → return Nothing

merge :: (Task, Maybe CommitHash) → Outcome
merge(T, hash) =
  | mergeNoFF(T.branch) succeeds → markDone(T, hash); removeWorktree(T); Done(hash)
  | otherwise                    → markNeedsHuman(T, "merge conflict"); NeedsHuman("merge conflict")

## Critical Protocol (MUST NOT deviate)

When a `task-ready:TASK-XX` event arrives, the worker MUST execute these steps in order:

**Step 1 — Claim (set In Progress BEFORE any other work):**
```bash
backlog task edit TASK-XX --status "In Progress" \
  --append-notes "claimed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

**Step 2 — Spawn implementation agent (NEVER do implementation inline):**
```
Agent(run_in_background=true, prompt=executePrompt(TASK-XX, worktree, branch, signal_file))
```
The `allowed-tools` passed to the agent explicitly excludes `Agent` to prevent recursive spawn.

**Step 3 — Wait for signal file:**
```bash
# Poll until backlog/.agent-done-TASK-XX exists
```

**Step 4 — Merge and mark Done:**
```bash
git merge --no-ff <branch>
backlog task edit TASK-XX --status "Done" \
  --append-notes "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

**Prohibited shortcut**: doing implementation directly in the worker agent (without `Agent(run_in_background=true, ...)`) violates Step 2 and causes Step 1 to be silently skipped in practice. The task will jump from `Ready` → `Done` without ever entering `In Progress`.

---

## Implementation

### loadConfig

Read `CLAUDE.md` for an `## L0 Config` section. If not found, auto-detect from project files.

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)

# --- fromClaudeMd ---
L0_SECTION=$(awk '/^## L0 Config/{found=1; next} found && /^## /{exit} found{print}' \
  "${REPO_ROOT}/CLAUDE.md" 2>/dev/null)

parse_cfg() { echo "$L0_SECTION" | grep -oP "(?<=^$1:\s)\S.*" | head -1 | xargs; }

CFG_SYMLINKS=$(parse_cfg "worktree-symlinks")
CFG_MAX_PARALLEL=$(parse_cfg "max-parallel")
CFG_MAX_PARALLEL=${CFG_MAX_PARALLEL:-2}

# --- autoDetect fallback ---
if [ -z "$L0_SECTION" ]; then
  if   [ -f "${REPO_ROOT}/package.json" ]; then CFG_SYMLINKS="${CFG_SYMLINKS:-node_modules}"
  else                                          CFG_SYMLINKS="${CFG_SYMLINKS:-}"
  fi
  echo "L0 auto-detected config: symlinks=${CFG_SYMLINKS:-none}"
else
  echo "L0 config loaded from CLAUDE.md: symlinks=${CFG_SYMLINKS:-none}"
fi

# Normalise "none" → empty
[ "$CFG_SYMLINKS" = "none" ] && CFG_SYMLINKS=""
```

### ensureDaemonScript

Write the daemon script to `scripts/loop-backlog-daemon.js`, overwriting if the version tag
does not match. Node.js is guaranteed available on every Claude Code install; no runtime
dependency needed.

```bash
DAEMON_SCRIPT="${REPO_ROOT}/scripts/loop-backlog-daemon.js"
DAEMON_VERSION="v4"

NEED_WRITE=true
if [ -f "$DAEMON_SCRIPT" ]; then
  FILE_VER=$(head -3 "$DAEMON_SCRIPT" | grep -oP '(?<=daemon-version: )v\d+' || true)
  [ "$FILE_VER" = "$DAEMON_VERSION" ] && NEED_WRITE=false
fi

if [ "$NEED_WRITE" = "true" ]; then
  mkdir -p "${REPO_ROOT}/scripts"
  cat > "$DAEMON_SCRIPT" << 'DAEMON_EOF'
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

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    tasksDir: 'backlog/tasks',
    pidFile: 'backlog/.daemon.pid',
    stopFile: 'backlog/.loop-stop',
    interval: 0.5,
  };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--tasks-dir':  args.tasksDir  = argv[++i]; break;
      case '--pid-file':   args.pidFile   = argv[++i]; break;
      case '--stop-file':  args.stopFile  = argv[++i]; break;
      case '--interval':   args.interval  = parseFloat(argv[++i]); break;
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

function isReady(filepath) {
  const status = readStatus(filepath);
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

const args = parseArgs(process.argv);
const intervalMs = Math.round(args.interval * 1000);

const pidDir = path.dirname(args.pidFile);
if (pidDir) fs.mkdirSync(pidDir, { recursive: true });
fs.writeFileSync(args.pidFile, String(process.pid));

function removePid() { try { fs.unlinkSync(args.pidFile); } catch { /* gone */ } }
process.on('exit', removePid);
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT',  () => process.exit(0));

const notified     = new Set();
const metaNotified = new Set();

const timer = setInterval(() => {
  if (fs.existsSync(args.stopFile)) { clearInterval(timer); process.exit(0); }

  const readyIds = scanReadyIds(args.tasksDir);
  for (const id of notified) { if (!readyIds.has(id)) notified.delete(id); }
  for (const id of [...readyIds].filter(id => !notified.has(id)).sort()) {
    process.stdout.write(`task-ready:${id}\n`);
    notified.add(id);
  }

  const metaReadyIds = scanMetaReadyIds(args.tasksDir);
  for (const id of metaNotified) { if (!metaReadyIds.has(id)) metaNotified.delete(id); }
  for (const id of [...metaReadyIds].filter(id => !metaNotified.has(id)).sort()) {
    process.stdout.write(`meta-ready:${id}\n`);
    metaNotified.add(id);
  }
}, intervalMs);
DAEMON_EOF
  echo "ensureDaemonScript: wrote $DAEMON_SCRIPT (${DAEMON_VERSION})"
fi
```

### ensureDaemonTest

Write the unit-test file `scripts/loop-backlog-daemon.test.js` if it does not exist,
then run it. Tests cover the three pure helper functions. Run this immediately after
`ensureDaemonScript` so a broken daemon is caught before the daemon is launched.

```bash
TEST_SCRIPT="${REPO_ROOT}/scripts/loop-backlog-daemon.test.js"

if [ ! -f "$TEST_SCRIPT" ]; then
  cat > "$TEST_SCRIPT" << 'TEST_EOF'
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

// ── test harness ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function assert(desc, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { process.stdout.write(`  ✓ ${desc}\n`); passed++; }
  else     { process.stderr.write(`  ✗ ${desc}\n    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(actual)}\n`); failed++; }
}

// ── parseTaskId ───────────────────────────────────────────────────────────────
process.stdout.write('parseTaskId\n');
assert('simple prefix',       parseTaskId('task-3 - do something.md'),             'TASK-3');
assert('upper already',       parseTaskId('TASK-10 - title.md'),                   'TASK-10');
assert('embedded id',         parseTaskId('sprint-TASK-7-notes.md'),               'TASK-7');
assert('no id returns null',  parseTaskId('README.md'),                            null);
assert('multi-digit',         parseTaskId('task-42 - long title here.md'),         'TASK-42');

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
fs.writeFileSync(path.join(dir, 'not-a-task.txt'),    'Status: Ready\n');  // ignored

const ids = scanReadyIds(dir);
assert('finds ready tasks',   [...ids].sort(), ['TASK-1', 'TASK-3']);
assert('skips done tasks',    ids.has('TASK-2'), false);
assert('skips non-md files',  ids.size, 2);

assert('missing dir → empty', [...scanReadyIds(path.join(tmp, 'no-such-dir'))].length, 0);

// ── cleanup + result ──────────────────────────────────────────────────────────
fs.rmSync(tmp, { recursive: true });
process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
TEST_EOF
  echo "ensureDaemonTest: wrote $TEST_SCRIPT"
fi

node "$TEST_SCRIPT"
```

### daemonBootstrap

Start the task-watcher daemon if not already running. The daemon polls `backlog/tasks/`
and writes `task-ready:TASK-N` lines to stdout, which Monitor picks up as events.

```bash
BACKLOG_DIR="${REPO_ROOT}/backlog"
PID_FILE="${BACKLOG_DIR}/.daemon.pid"
STOP_FILE="${BACKLOG_DIR}/.loop-stop"
TASKS_DIR="${BACKLOG_DIR}/tasks"
DAEMON_LOG="${BACKLOG_DIR}/.daemon.log"

# Remove stale stop sentinel from a previous run
rm -f "$STOP_FILE"

# Start daemon only if not already running
DAEMON_RUNNING=false
if [ -f "$PID_FILE" ]; then
  DPID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$DPID" ] && kill -0 "$DPID" 2>/dev/null; then
    DAEMON_RUNNING=true
    echo "daemonBootstrap: daemon already running (pid $DPID)"
  fi
fi

if [ "$DAEMON_RUNNING" = "false" ]; then
  nohup node "${REPO_ROOT}/scripts/loop-backlog-daemon.js" \
    --tasks-dir "$TASKS_DIR" \
    --pid-file  "$PID_FILE"  \
    --stop-file "$STOP_FILE" \
    --interval  0.5 \
    >> "$DAEMON_LOG" 2>/dev/null & disown
  # Poll for PID file instead of fixed sleep (handles slow Node cold-starts)
  for i in $(seq 1 25); do [ -f "$PID_FILE" ] && break; sleep 0.2; done
  DPID=$(cat "$PID_FILE" 2>/dev/null || true)
  echo "daemonBootstrap: started daemon (pid ${DPID:-unknown})"
fi
```

### reap

```bash
backlog task list --status "In Progress" --plain \
  | grep -oP 'TASK-\d+' \
  | while read TASK_ID; do
    VIEW=$(backlog task view "$TASK_ID" --plain)
    CLAIMED=$(echo "$VIEW" | grep -oP '(?<=claimed: )\S+' | tail -1)
    AGE=9999
    if [ -n "$CLAIMED" ]; then
      AGE=$(( $(date -u +%s) - $(date -u -d "$CLAIMED" +%s 2>/dev/null || echo 0) ))
    fi
    if [ $AGE -gt 1800 ]; then
      backlog task edit "$TASK_ID" --status "Ready" \
        --append-notes "Requeued by reaper: in-progress timeout exceeded 30 minutes."
      PROJECT_NAME=$(basename "$REPO_ROOT")
      WORKTREE="${REPO_ROOT}/../${PROJECT_NAME}-${TASK_ID}"
      [ -d "$WORKTREE" ] && git worktree remove "$WORKTREE" --force 2>/dev/null || true
      git branch -D "task/${TASK_ID}" 2>/dev/null || true
    fi
  done
```

### claimBatch

Claim up to `CFG_MAX_PARALLEL` Ready tasks atomically. Returns the list of claimed task IDs
in `CLAIMED_TASK_IDS` (space-separated). If fewer Ready tasks exist, claims only those.

```bash
CLAIMED_TASK_IDS=""
CLAIM_COUNT=0
while IFS= read -r CANDIDATE_ID; do
  [ -z "$CANDIDATE_ID" ] && continue
  [ "$CLAIM_COUNT" -ge "$CFG_MAX_PARALLEL" ] && break
  backlog task edit "$CANDIDATE_ID" --status "In Progress" \
    --append-notes "claimed: $(date -u +%Y-%m-%dT%H:%M:%SZ)" 2>/dev/null || continue
  CLAIMED_TASK_IDS="${CLAIMED_TASK_IDS} ${CANDIDATE_ID}"
  CLAIM_COUNT=$((CLAIM_COUNT + 1))
done < <(backlog task list --status "Ready" --plain | grep -oP 'TASK-\d+')
CLAIMED_TASK_IDS=$(echo "$CLAIMED_TASK_IDS" | xargs)  # trim whitespace
```

If `CLAIMED_TASK_IDS` is empty and no stop sentinel: use Monitor (persistent) to wait for
the next `task-ready` event. The daemon writes `task-ready:TASK-N` lines to `$DAEMON_LOG`;
Monitor tails that file:

```bash
# Foreground tail — Monitor reads its stdout as the event stream.
Monitor(persistent=true, command="tail -f \"$DAEMON_LOG\"")
```

Any output line matching `task-ready:TASK-*` is the wake-up signal; re-enter `workerLoop()`.

### waitForAgents

Poll `backlog/.agent-done-TASK-N` signal files for every task in `CLAIMED_TASK_IDS`.
Loops with `sleep 5` until all signal files are present.

```bash
# $1: space-separated list of TASK-IDs to wait for
waitForAgents() {
  local REMAINING="$1"
  local ALL_DONE=false
  while [ "$ALL_DONE" = "false" ]; do
    ALL_DONE=true
    local STILL_WAITING=""
    for TID in $REMAINING; do
      SIGNAL_FILE="${REPO_ROOT}/backlog/.agent-done-${TID}"
      if [ ! -f "$SIGNAL_FILE" ]; then
        ALL_DONE=false
        STILL_WAITING="${STILL_WAITING} ${TID}"
      fi
    done
    REMAINING=$(echo "$STILL_WAITING" | xargs)
    if [ "$ALL_DONE" = "false" ]; then
      echo "waitForAgents: still waiting for:${REMAINING}"
      sleep 5
    fi
  done
  echo "waitForAgents: all agents done"
}
```

### executePrompt

Build a self-contained prompt string for a background agent executing one task.
The prompt must not depend on external bash variables at call time — all values
are interpolated into the string before passing to the Agent tool.
The agent's allowed-tools list explicitly excludes `Agent` to prevent recursive spawn.

```bash
# Usage: PROMPT=$(buildExecutePrompt "$TASK_ID" "$TASK_TITLE" "$TASK_DESC" "$WORKTREE" "$BRANCH" "$SIGNAL_FILE")
buildExecutePrompt() {
  local TID="$1"
  local TTITLE="$2"
  local TDESC="$3"
  local TWT="$4"
  local TBRANCH="$5"
  local TSIGNAL="$6"

  cat <<PROMPT_EOF
You are a background task agent. Your only job is to execute the task described below.

## Task
ID: ${TID}
Title: ${TTITLE}
Branch: ${TBRANCH}
Worktree: ${TWT}
Signal file: ${TSIGNAL}

## Description
${TDESC}

## Constraints
- Work exclusively inside the worktree at: ${TWT}
- Do NOT run git merge or git push
- Do NOT spawn sub-agents (Agent tool is not available to you)
- After all work is complete, run git add -A && git commit if there are changes
- Write the signal file as the LAST action before exiting

## Completing the task
When done (success):
  Write file ${TSIGNAL} with content: done

If you cannot continue without human input (escalation):
  Write file ${TSIGNAL} with content: needs-human: <one-line reason>

## Execution Protocol

**Phase checkpoints**: After completing each ## Phase section described in the task Description, run:
  backlog task edit ${TID} --append-notes "Phase X ✓ $(date -u +%Y-%m-%dT%H:%M:%SZ)
  <one-line summary of what was done>"

**DoD verification notes**: For each DoD command run, append:
  backlog task edit ${TID} --append-notes "DoD #N: PASS|FAIL — <cmd>
  <up to 5 lines of output on failure>"

**Execution Summary**: Before writing the signal file, append:
  backlog task edit ${TID} --append-notes "## Execution Summary
  Result: Done|Needs Human
  Commit: <hash or 'no changes'>
  <ordered list of Phase and DoD outcomes>"

allowed-tools: Bash, Read, Write, Edit, Glob, Grep
PROMPT_EOF
}
```

### withWorktree

```bash
BRANCH="task/${TASK_ID}"
PROJECT_NAME=$(basename "$REPO_ROOT")
WORKTREE="${REPO_ROOT}/../${PROJECT_NAME}-${TASK_ID}"
git worktree add "$WORKTREE" -b "$BRANCH"

# Symlink configured dirs (e.g. node_modules) to avoid reinstall
for SYM in $CFG_SYMLINKS; do
  [ -e "${REPO_ROOT}/${SYM}" ] && \
    ln -sf "${REPO_ROOT}/${SYM}" "${WORKTREE}/${SYM}"
done

cd "$WORKTREE"
```

### execute → readHumanReply

Before reading the Description, check whether this task was previously escalated.

```bash
TASK_VIEW=$(backlog task view "$TASK_ID" --plain)
NOTES_SECTION=$(echo "$TASK_VIEW" | awk '/^Implementation Notes:/,0' | tail -n +2)
LAST_ESCALATED_LINE=$(echo "$NOTES_SECTION" | grep -n "^Escalated:" | tail -1 | cut -d: -f1)
```

If `LAST_ESCALATED_LINE` is non-empty, extract everything after it as the human reply:

```bash
HUMAN_REPLY=""
if [ -n "$LAST_ESCALATED_LINE" ]; then
  HUMAN_REPLY=$(echo "$NOTES_SECTION" | tail -n +$((LAST_ESCALATED_LINE + 1)))
fi
```

If `HUMAN_REPLY` is non-empty, read it carefully before proceeding. It is a free-form
natural-language answer from the user. Extract any decisions, version numbers, file paths,
or other context it provides. Use this information throughout execution — it supersedes
any open questions left by the previous escalation. Log what you understood:

```bash
if [ -n "$HUMAN_REPLY" ]; then
  backlog task edit "$TASK_ID" --append-notes \
    "Human reply received — interpreted context:
$(echo "$HUMAN_REPLY" | head -10)"
fi
```

### execute → followDescription

```bash
TITLE=$(echo "$TASK_VIEW" | grep -oP '(?<=Task TASK-\d+ - ).+' | head -1)

# Accumulator for final-summary
EXECUTION_LOG=""
log_exec() { EXECUTION_LOG="${EXECUTION_LOG}$1\n"; }
```

Read the task Description in full. The Description is the primary authority on what to
do. If a human reply was extracted above, it takes precedence for any open questions
(e.g. version numbers, file paths, decisions) — apply it before executing phases.
Follow the Description's `## Phase` sections in order. After each phase completes,
append a structured checkpoint that includes the key outputs or decisions from that phase:

```bash
PHASE_NOTE="Phase <X> ✓ $(date -u +%Y-%m-%dT%H:%M:%SZ)
<one-line summary of what was done or found>"
backlog task edit "$TASK_ID" --append-notes "$PHASE_NOTE"
log_exec "$PHASE_NOTE"
```

If a phase produced notable command output (e.g. test results, validation output, key
tool responses), include the relevant excerpt (truncated to ~20 lines) in the note.

Do not invent steps beyond what the Description specifies. Do not assume a task type.

### verifyDod

```bash
DOD_COUNT=$(echo "$TASK_VIEW" | grep -cP '^\- \[.\] #\d+')

for N in $(seq 0 $((DOD_COUNT - 1))); do
  CMD=$(echo "$TASK_VIEW" | grep -P "^\- \[.\] #${N} " | sed "s/^- \[.\] #${N} //")
  ATTEMPTS=0
  while true; do
    if eval "$CMD"; then
      backlog task edit "$TASK_ID" --check-dod $N
      DOD_PASS_NOTE="DoD #${N}: PASS"
      backlog task edit "$TASK_ID" --append-notes "${DOD_PASS_NOTE} — ${CMD}"
      log_exec "DoD #${N} ✓: ${CMD}"
      break
    fi
    ATTEMPTS=$((ATTEMPTS + 1))
    LAST_ERROR="$(eval "$CMD" 2>&1 || true)"
    if [ $ATTEMPTS -ge 3 ]; then
      STUCK_INDEX=$N
      STUCK_CMD="$CMD"
      DOD_FAIL_NOTE="DoD #${N}: FAIL"
      backlog task edit "$TASK_ID" --append-notes "${DOD_FAIL_NOTE} — ${STUCK_CMD}
$(echo "$LAST_ERROR" | head -5)"
      log_exec "DoD #${N} ✗ STUCK after 3 attempts: ${CMD}
Last error:
${LAST_ERROR}"
      break 2   # → Failure path
    fi
    # Log the failure and what fix is being attempted
    FIX_NOTE="DoD #${N} ✗ attempt ${ATTEMPTS}: ${CMD}
Error: $(echo "$LAST_ERROR" | head -5)
→ applying fix..."
    backlog task edit "$TASK_ID" --append-notes "$FIX_NOTE"
    log_exec "$FIX_NOTE"
    # Fix the issue causing the failure, then retry
  done
done
```

### conditionalCommit

```bash
git add -A
if ! git diff --cached --quiet; then
  git commit -m "${TITLE} (${TASK_ID})"
  COMMIT_HASH=$(git rev-parse HEAD)
else
  COMMIT_HASH="(no file changes)"
fi
```

### merge

> **Precondition:** merge is only reached after workerLoop's independent DoD verification has passed.
> The workerLoop serial merge loop runs `verifyDodInWorkerLoop` before calling `git merge`; a
> failing DoD command redirects control to escalation instead.

```bash
cd "$REPO_ROOT"
if git merge --no-ff "$BRANCH" -m "merge: ${TITLE} (${TASK_ID})"; then
  FINAL_SUMMARY="## Execution Summary

**Result:** Done  
**Commit:** ${COMMIT_HASH}

### Execution Log
$(echo -e "$EXECUTION_LOG")"
  backlog task edit "$TASK_ID" \
    --status "Done" \
    --append-notes "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --final-summary "$FINAL_SUMMARY"
  git worktree remove "$WORKTREE"
  git branch -d "$BRANCH"
  WORK_DONE=true
else
  FINAL_SUMMARY="## Execution Summary

**Result:** Needs Human — merge conflict  
**Branch:** ${BRANCH}  
**Worktree:** ${WORKTREE}

### Execution Log
$(echo -e "$EXECUTION_LOG")

### Resolution Steps
\`\`\`
cd ${REPO_ROOT}
git mergetool
git commit
git worktree remove ${WORKTREE}
git branch -d ${BRANCH}
\`\`\`"
  backlog task edit "$TASK_ID" \
    --status "Needs Human" \
    --append-notes "Merge conflict: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --final-summary "$FINAL_SUMMARY"
  echo "⚠️  Merge conflict: $TASK_ID — worktree preserved at $WORKTREE"
  WORK_DONE=false
fi
```

### workerLoop (parallel)

The top-level orchestration using claimBatch, background Agent spawning, and serial merge.

```bash
# After loadConfig, ensureDaemonScript, daemonBootstrap, and reap have run:

# 1. Claim a batch of up to CFG_MAX_PARALLEL Ready tasks
# (claimBatch sets CLAIMED_TASK_IDS)

if [ -z "$CLAIMED_TASK_IDS" ]; then
  # No ready tasks — block on daemon event
  # Monitor(persistent=true, command="tail -f \"$DAEMON_LOG\"")
  # On task-ready event: re-enter workerLoop
  exit 0
fi

# 2. Create worktrees and spawn one background agent per task
declare -A TASK_WORKTREES
declare -A TASK_BRANCHES
for TASK_ID in $CLAIMED_TASK_IDS; do
  BRANCH="task/${TASK_ID}"
  PROJECT_NAME=$(basename "$REPO_ROOT")
  WORKTREE="${REPO_ROOT}/../${PROJECT_NAME}-${TASK_ID}"
  git worktree add "$WORKTREE" -b "$BRANCH"
  for SYM in $CFG_SYMLINKS; do
    [ -e "${REPO_ROOT}/${SYM}" ] && ln -sf "${REPO_ROOT}/${SYM}" "${WORKTREE}/${SYM}"
  done
  TASK_WORKTREES[$TASK_ID]="$WORKTREE"
  TASK_BRANCHES[$TASK_ID]="$BRANCH"

  TASK_VIEW=$(backlog task view "$TASK_ID" --plain)
  TASK_TITLE=$(echo "$TASK_VIEW" | grep -oP '(?<=Task TASK-\d+ - ).+' | head -1)
  TASK_DESC=$(echo "$TASK_VIEW" | awk '/^Description:/,/^(Status|Assignee|Labels|Priority|Due|Created|Updated|Notes):/' | tail -n +2)
  SIGNAL_FILE="${REPO_ROOT}/backlog/.agent-done-${TASK_ID}"

  AGENT_PROMPT=$(buildExecutePrompt \
    "$TASK_ID" "$TASK_TITLE" "$TASK_DESC" "$WORKTREE" "$BRANCH" "$SIGNAL_FILE")

  # Spawn background agent — run_in_background=true
  Agent(run_in_background=true, prompt="$AGENT_PROMPT")
done

# 3. Wait for all agents to write their signal files
waitForAgents "$CLAIMED_TASK_IDS"

# 4. Serial merge: read signal, merge or escalate, delete signal file
for TASK_ID in $CLAIMED_TASK_IDS; do
  SIGNAL_FILE="${REPO_ROOT}/backlog/.agent-done-${TASK_ID}"
  SIGNAL_CONTENT=$(cat "$SIGNAL_FILE" 2>/dev/null || echo "needs-human: signal file missing")
  rm -f "$SIGNAL_FILE"

  BRANCH="${TASK_BRANCHES[$TASK_ID]}"
  WORKTREE="${TASK_WORKTREES[$TASK_ID]}"
  TASK_VIEW=$(backlog task view "$TASK_ID" --plain)
  TITLE=$(echo "$TASK_VIEW" | grep -oP '(?<=Task TASK-\d+ - ).+' | head -1)

  # pre-merge DoD verification (independent of agent signal)
  if [ "$SIGNAL_CONTENT" = "done" ] && [ -d "$WORKTREE" ]; then
    PRE_MERGE_DOD_PASS=true
    PRE_MERGE_FAIL_MSG=""
    DOD_N=0
    while IFS= read -r DOD_CMD; do
      DOD_CMD=$(echo "$DOD_CMD" | sed 's/^- \[.\] #[0-9]* //')
      cd "$WORKTREE"
      DOD_OUT=$(eval "$DOD_CMD" 2>&1)
      DOD_EXIT=$?
      cd "$REPO_ROOT"
      if [ $DOD_EXIT -ne 0 ]; then
        PRE_MERGE_DOD_PASS=false
        PRE_MERGE_FAIL_MSG="workerLoop DoD #${DOD_N} failed: ${DOD_CMD}\n$(echo "$DOD_OUT" | head -5)"
        backlog task edit "$TASK_ID" --append-notes "workerLoop pre-merge DoD #${DOD_N} FAIL: ${DOD_CMD}"
        break
      fi
      DOD_N=$((DOD_N + 1))
    done < <(backlog task view "$TASK_ID" --plain | grep -oP '^- \[.\] #\d+ .+')

    if [ "$PRE_MERGE_DOD_PASS" = "true" ]; then
      backlog task edit "$TASK_ID" --append-notes "workerLoop DoD verified: all ${DOD_N} commands passed"
    else
      SIGNAL_CONTENT="needs-human: ${PRE_MERGE_FAIL_MSG}"
    fi
  fi

  cd "$REPO_ROOT"
  if [ "$SIGNAL_CONTENT" = "done" ]; then
    # Standard merge path (same as existing merge section)
    if git merge --no-ff "$BRANCH" -m "merge: ${TITLE} (${TASK_ID})"; then
      backlog task edit "$TASK_ID" \
        --status "Done" \
        --append-notes "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      git worktree remove "$WORKTREE"
      git branch -d "$BRANCH"
    else
      backlog task edit "$TASK_ID" \
        --status "Needs Human" \
        --append-notes "Merge conflict: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    fi
  else
    REASON=$(echo "$SIGNAL_CONTENT" | sed 's/^needs-human: //')
    backlog task edit "$TASK_ID" \
      --status "Needs Human" \
      --append-notes "Escalated: ${REASON}
To continue: answer in Implementation Notes, then set status → Ready."
  fi
done
```

### verifyDodInWorkerLoop

Independent DoD verification executed by the workerLoop serial merge loop before each `git merge`.
This is distinct from the agent's own `verifyDod` loop: it re-runs every DoD command from the
worktree as a second, independent check. If any command fails, the merge is skipped and the task
is escalated with a `needs-human: workerLoop DoD` signal.

Key properties:
- Runs in the worktree (`cd "$WORKTREE"`) so paths resolve correctly.
- Only runs when the agent signalled `"done"` and the worktree directory still exists.
- On failure, overwrites `SIGNAL_CONTENT` with `"needs-human: workerLoop DoD #N failed: …"`,
  causing the standard escalation branch below to fire.
- On success, appends `"workerLoop DoD verified: all N commands passed"` to the task notes.

### Failure path (Stuck)

```bash
cd "$REPO_ROOT"
FINAL_SUMMARY="## Execution Summary

**Result:** Needs Human — stuck on DoD #${STUCK_INDEX}  
**Branch:** ${BRANCH}  
**Worktree:** ${WORKTREE}

### Failing Command
\`\`\`
${STUCK_CMD}
\`\`\`

### Last Error
\`\`\`
${LAST_ERROR}
\`\`\`

### Execution Log
$(echo -e "$EXECUTION_LOG")

### Cleanup
\`\`\`
git worktree remove ${WORKTREE} --force
git branch -D ${BRANCH}
\`\`\`"
backlog task edit "$TASK_ID" \
  --status "Needs Human" \
  --append-notes "Stuck on DoD #${STUCK_INDEX}: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --final-summary "$FINAL_SUMMARY"
echo "❌ Stuck: $TASK_ID (DoD #$STUCK_INDEX)"
echo "Task moved to Needs Human. Worktree preserved at $WORKTREE"
WORK_DONE=false
```

## Shutdown

To stop the worker loop, write the stop sentinel:

```bash
touch "${REPO_ROOT}/backlog/.loop-stop"
```

The daemon (`loop-backlog-daemon.js`) detects `backlog/.loop-stop` and exits.
The skill also checks for this file at the top of each iteration and returns `Stopped`
without re-entering Monitor.

To restart after a shutdown:

```bash
rm -f "${REPO_ROOT}/backlog/.loop-stop"
# then invoke /loop-backlog
```

The `daemonBootstrap` section will restart the daemon automatically on the next
`/loop-backlog` invocation. The PID file (`backlog/.daemon.pid`) is managed
by the daemon itself and removed on exit.

Use `Monitor(persistent=true, command="tail -f \"$DAEMON_LOG\"")` to wait for task-ready
events. The daemon appends `task-ready:TASK-N` lines to `backlog/.daemon.log`; `tail -f`
runs in the foreground so Monitor receives each line as an event immediately.
The daemon subprocess exits only when `backlog/.loop-stop` is written (or the parent process dies).

To stop the Monitor from outside the skill, call `TaskStop <monitor-task-id>`.
