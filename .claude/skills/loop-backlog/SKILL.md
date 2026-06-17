---
name: loop-backlog
description: "Autonomous L0 Worker for the backlog.md task queue. Each task runs in an isolated git worktree, then merges back to master on success. Starts an event-driven daemon that emits task-ready events; uses Monitor to react instantly. Invoke /loop-backlog once to start the worker loop; it keeps running until the .backlog/.loop-stop sentinel is written."
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Monitor
---

λ() → workerLoop()

## Spec

Config :: {
  symlinks : [Path]   -- dirs to symlink into worktree ([] = none)
}

loadConfig :: () → Config
loadConfig() =
  | fromClaudeMd()   -- explicit: "## L0 Config" section in CLAUDE.md
  | autoDetect()     -- implicit: probe package.json, go.mod, Cargo.toml, etc.

autoDetect :: () → Config
autoDetect() = case detectLang() of
  | Node    → { symlinks: ["node_modules"] }
  | _       → { symlinks: [] }

detectLang :: () → Lang
detectLang() =
  | exists("package.json") → Node
  | exists("go.mod")       → Go
  | exists("Cargo.toml")   → Rust
  | exists("pyproject.toml") ∨ exists("setup.py") → Python
  | otherwise              → Unknown

data Outcome = Done CommitHash | NeedsHuman Reason | Idle | Stopped

workerLoop :: () → Outcome
workerLoop() = {
  cfg:    loadConfig(),
  _:      ensureDaemonScript(),
  _:      daemonBootstrap(),
  _:      reap(inProgressTasks()),
  task:   claim(),

  if (stopSentinel()):
    return: Stopped,

  if (empty(task)):
    -- No task yet; block until daemon emits a task-ready line (or timeout)
    event: Monitor(timeout=600),
    if (event matches "task-ready:TASK-*"):
      return: workerLoop(),      -- re-enter to claim the announced task
    if (timeout ∨ stopSentinel()):
      return: Stopped,
    return: Idle,

  result: withWorktree(task, cfg, execute),
  return: result
}

reap :: [Task] → ()
reap(tasks) = ∀t ∈ tasks
  where claimAge(t) > 30min ∨ ¬hasClaimed(t): {
    reset(t, "Ready"),
    appendNote(t, "Requeued by reaper: in-progress timeout."),
    removeWorktree(t)
  }

claim :: () → Maybe Task
claim() = {
  t: head(readyTasks()),
  if (empty(t)): return Nothing,
  atomically: {
    setStatus(t, "In Progress"),
    appendNote(t, "claimed: " + now())
  },
  return: Just(t)
}

withWorktree :: Task → Config → (Task → a) → a
withWorktree(T, cfg, f) = {
  wt:  createWorktree(T),
  _:   ∀s ∈ cfg.symlinks: symlink(repoRoot + "/" + s, wt + "/" + s),
  cd:  wt,
  return: f(T)
}

-- execute is task-type-agnostic: T.description is the sole authority on what to do
execute :: Task → Outcome
execute(T) = {
  _:      followDescription(T.description),
  _:      ∀(n, cmd) ∈ enumerate(T.dodCommands): verifyDod(T, n, cmd),
  hash:   conditionalCommit(T),
  return: merge(T, hash)
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

Write the daemon script to `scripts/loop-backlog-daemon.py` if it does not already exist.
This section embeds the canonical daemon source so the skill is self-contained.

```bash
DAEMON_SCRIPT="${REPO_ROOT}/scripts/loop-backlog-daemon.py"

if [ ! -f "$DAEMON_SCRIPT" ]; then
  mkdir -p "${REPO_ROOT}/scripts"
  cat > "$DAEMON_SCRIPT" << 'DAEMON_EOF'
#!/usr/bin/env python3
"""
loop-backlog-daemon: polls backlog tasks dir and emits task-ready events to stdout.

Emits one line per Ready transition: "task-ready:TASK-N"
Stops when parent process dies or stop-sentinel file appears.
"""

import argparse
import atexit
import os
import sys
import time


def parse_task_id(filename):
    base = os.path.splitext(os.path.basename(filename))[0]
    upper = base.upper()
    for part in upper.split():
        if part.startswith("TASK-") and part[5:].isdigit():
            return "TASK-" + part[5:]
    return None


def is_ready(filepath):
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                stripped = line.strip().lower()
                if stripped == "status: ready" or stripped.startswith("status: ready"):
                    return True
    except OSError:
        pass
    return False


def scan_ready_ids(tasks_dir):
    ready = set()
    try:
        entries = os.listdir(tasks_dir)
    except OSError:
        return ready
    for entry in entries:
        if not entry.endswith(".md"):
            continue
        task_id = parse_task_id(entry)
        if task_id is None:
            continue
        fpath = os.path.join(tasks_dir, entry)
        if is_ready(fpath):
            ready.add(task_id)
    return ready


def main():
    parser = argparse.ArgumentParser(
        description="Poll backlog tasks directory and emit task-ready events."
    )
    parser.add_argument(
        "--tasks-dir",
        default=".backlog/tasks",
        help="Directory containing task markdown files (default: .backlog/tasks)",
    )
    parser.add_argument(
        "--pid-file",
        default=".backlog/.daemon.pid",
        help="Path to write the daemon PID (default: .backlog/.daemon.pid)",
    )
    parser.add_argument(
        "--stop-file",
        default=".backlog/.loop-stop",
        help="Sentinel file whose presence causes daemon to exit (default: .backlog/.loop-stop)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=0.5,
        help="Poll interval in seconds (default: 0.5)",
    )
    args = parser.parse_args()

    pid_file = args.pid_file
    pid_dir = os.path.dirname(pid_file)
    if pid_dir:
        os.makedirs(pid_dir, exist_ok=True)
    with open(pid_file, "w") as f:
        f.write(str(os.getpid()))

    def remove_pid():
        try:
            os.remove(pid_file)
        except OSError:
            pass

    atexit.register(remove_pid)

    parent_pid = os.getppid()
    notified = set()

    while True:
        if os.path.exists(args.stop_file):
            break

        try:
            os.kill(parent_pid, 0)
        except OSError:
            break

        ready_ids = scan_ready_ids(args.tasks_dir)

        no_longer_ready = notified - ready_ids
        notified -= no_longer_ready

        for task_id in sorted(ready_ids - notified):
            sys.stdout.write("task-ready:{}\n".format(task_id))
            sys.stdout.flush()
            notified.add(task_id)

        time.sleep(args.interval)


if __name__ == "__main__":
    main()
DAEMON_EOF
  echo "ensureDaemonScript: wrote $DAEMON_SCRIPT"
fi
```

### daemonBootstrap

Start the task-watcher daemon if not already running. The daemon polls `.backlog/tasks/`
and writes `task-ready:TASK-N` lines to stdout, which Monitor picks up as events.

```bash
BACKLOG_DIR="${REPO_ROOT}/.backlog"
PID_FILE="${BACKLOG_DIR}/.daemon.pid"
STOP_FILE="${BACKLOG_DIR}/.loop-stop"
TASKS_DIR="${BACKLOG_DIR}/tasks"

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
  python3 "${REPO_ROOT}/scripts/loop-backlog-daemon.py" \
    --tasks-dir "$TASKS_DIR" \
    --pid-file  "$PID_FILE"  \
    --stop-file "$STOP_FILE" \
    --interval  0.5 &
  sleep 0.6
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

### claim

```bash
TASK_ID=$(backlog task list --status "Ready" --plain | grep -oP 'TASK-\d+' | head -1)
```

If empty and no stop sentinel: use Monitor to wait for the next `task-ready` event.

```bash
backlog task edit "$TASK_ID" --status "In Progress" \
  --append-notes "claimed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
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

### execute → followDescription

```bash
TASK_VIEW=$(backlog task view "$TASK_ID" --plain)
TITLE=$(echo "$TASK_VIEW" | grep -oP '(?<=Task TASK-\d+ - ).+' | head -1)

# Accumulator for final-summary
EXECUTION_LOG=""
log_exec() { EXECUTION_LOG="${EXECUTION_LOG}$1\n"; }
```

Read the task Description in full. The Description is the sole authority on what to
do — it may call for code changes, documentation, experiments, or analysis. Follow its
`## Phase` sections in order. After each phase completes, append a structured checkpoint
that includes the key outputs or decisions from that phase:

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
      log_exec "DoD #${N} ✓: ${CMD}"
      break
    fi
    ATTEMPTS=$((ATTEMPTS + 1))
    LAST_ERROR="$(eval "$CMD" 2>&1 || true)"
    if [ $ATTEMPTS -ge 3 ]; then
      STUCK_INDEX=$N
      STUCK_CMD="$CMD"
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
touch "${REPO_ROOT}/.backlog/.loop-stop"
```

The daemon (`loop-backlog-daemon.py`) detects `.backlog/.loop-stop` and exits.
The skill also checks for this file at the top of each iteration and returns `Stopped`
without re-entering Monitor.

To restart after a shutdown:

```bash
rm -f "${REPO_ROOT}/.backlog/.loop-stop"
# then invoke /loop-backlog
```

The `daemonBootstrap` section will restart the daemon automatically on the next
`/loop-backlog` invocation. The PID file (`.backlog/.daemon.pid`) is managed
by the daemon itself and removed on exit.

Use `Monitor(timeout=600)` to wait for the next event. On timeout (10 minutes with no
activity), verify daemon liveness: if the PID file is gone, re-run `daemonBootstrap`,
then re-enter `Monitor`. If the stop sentinel is present, exit.
