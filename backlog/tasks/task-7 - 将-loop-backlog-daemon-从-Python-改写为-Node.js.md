---
id: TASK-7
title: 将 loop-backlog-daemon 从 Python 改写为 Node.js
status: "Basic: Done"
assignee: []
created_date: '2026-06-17 07:10'
updated_date: '2026-06-17 07:20'
labels:
  - kind:basic
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
# Plan: 将 loop-backlog-daemon 从 Python 改写为 Node.js

## Context

Python 3 is not guaranteed on all Claude Code host environments (minimal CI images, some
macOS setups where only system Python 2 ships, Windows with no Python in PATH). Node.js,
however, is a hard runtime dependency of Claude Code itself, so it is always present.
Converting the daemon to a pure-stdlib ES module eliminates the Python dependency entirely
and makes the loop-backlog skill self-contained on any Claude Code install.

## Phase 1: 编写 Node.js 版本的测试脚本

Mirror the 6 existing tests in `scripts/test-loop-backlog-daemon.sh` as a new file
`scripts/test-loop-backlog-daemon-js.sh`. The new script is identical in structure but:
- sets `DAEMON="$REPO_ROOT/scripts/loop-backlog-daemon.js"`
- invokes the daemon with `node "$DAEMON"` instead of `python3 "$DAEMON"`

Tests to port (one-to-one mapping):
1. `test_daemon_writes_pid_file`
2. `test_daemon_emits_task_ready_line`
3. `test_daemon_debounces_repeated_ready`
4. `test_daemon_re_emits_after_status_reset`
5. `test_daemon_stops_on_sentinel`
6. `test_daemon_removes_pid_on_exit`

Write the test file first (TDD anchor). All 6 tests will fail until Phase 2 is complete.

### DoD
- [ ] `test -f scripts/test-loop-backlog-daemon-js.sh`
- [ ] `grep -q 'loop-backlog-daemon.js' scripts/test-loop-backlog-daemon-js.sh`
- [ ] `grep -q 'node "\$DAEMON"' scripts/test-loop-backlog-daemon-js.sh`
- [ ] `bash -c 'count=$(grep -c "test_daemon_" scripts/test-loop-backlog-daemon-js.sh); [ "$count" -ge 6 ]'`

## Phase 2: 实现 scripts/loop-backlog-daemon.js

Write `scripts/loop-backlog-daemon.js` as a Node.js CommonJS/ESM script runnable with
plain `node scripts/loop-backlog-daemon.js` (no extra flags). Use only Node.js built-in
modules: `fs`, `path`, `process`. Parse CLI args from `process.argv` manually.

Functional parity with the Python daemon:

| Feature | Implementation |
|---|---|
| CLI args | Parse `process.argv` manually: `--tasks-dir`, `--pid-file`, `--stop-file`, `--interval` with same defaults |
| PID file | Write `String(process.pid)` to `--pid-file` on startup; remove via `process.on('exit', ...)` |
| Poll loop | `setInterval`-based async tick at `--interval` ms |
| Ready detection | Read each `.md` file; find line matching `/^status:\s*ready/i` |
| Task ID parse | Extract `TASK-N` from filename (same logic as Python `parse_task_id`) |
| Debounce | `notified` Set — emit only on first Ready transition; remove from Set when no longer Ready |
| stdout emit | `process.stdout.write('task-ready:TASK-N\n')` |
| Stop sentinel | Check `fs.existsSync(stopFile)` each tick; call `process.exit(0)` if present |
| Parent liveness | `process.ppid`; send signal 0 via `process.kill(ppid, 0)` in try/catch; exit if throws |
| Exit cleanup | `process.on('exit', removePid)` + `SIGTERM`/`SIGINT` handlers that call `process.exit(0)` |

After writing the file, run the JS test suite. All 6 tests must pass.

### DoD
- [ ] `test -f scripts/loop-backlog-daemon.js`
- [ ] `node --check scripts/loop-backlog-daemon.js`
- [ ] `bash scripts/test-loop-backlog-daemon-js.sh`

## Phase 3: 更新 SKILL.md

File: `.claude/skills/loop-backlog/SKILL.md`

Two targeted edits:

**3a. `### ensureDaemonScript` section**
- Change `DAEMON_SCRIPT` variable to point to `loop-backlog-daemon.js`
- Replace the embedded Python heredoc (`DAEMON_EOF`) with the full contents of
  `scripts/loop-backlog-daemon.js`
- Update the `echo` confirmation line to reference `.js`

**3b. `### daemonBootstrap` section**
- Change the daemon launch line from:
  `python3 "${REPO_ROOT}/scripts/loop-backlog-daemon.py" \`
  to:
  `node "${REPO_ROOT}/scripts/loop-backlog-daemon.js" \`

**3c. `## Shutdown` section**
- Update any inline reference to `loop-backlog-daemon.py` to `loop-backlog-daemon.js`

After editing, the skill must remain valid (no broken bash syntax in the heredoc).

### DoD
- [ ] `grep -q 'loop-backlog-daemon.js' .claude/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'node.*loop-backlog-daemon.js' .claude/skills/loop-backlog/SKILL.md`
- [ ] `bash -c '! grep -q "python3.*loop-backlog-daemon" .claude/skills/loop-backlog/SKILL.md'`
- [ ] `bash scripts/validate-plugin.sh`

## Phase 4: 清理 Python 版本（可选保留）

Per the Constraints below, keep `scripts/loop-backlog-daemon.py` as a fallback — do not
delete it. Update the file's module docstring to note it is the legacy fallback and that
the canonical daemon is now `loop-backlog-daemon.js`.

Also update `scripts/test-loop-backlog-daemon.sh` header comment to clarify it tests the
Python (legacy) version, so the two test files are clearly distinguished.

### DoD
- [ ] `test -f scripts/loop-backlog-daemon.py`
- [ ] `grep -qi 'legacy' scripts/loop-backlog-daemon.py`
- [ ] `bash scripts/test-loop-backlog-daemon.sh`
- [ ] `bash scripts/validate-plugin.sh`

## Constraints

- Node.js stdlib only — no `npm install`, no `package.json` required, no third-party modules
- Must pass `bash scripts/validate-plugin.sh` after all changes
- Parent-liveness check uses `process.kill(ppid, 0)` — POSIX only; Windows PTY compatibility is out of scope
- Keep Python version as fallback — do **not** delete `scripts/loop-backlog-daemon.py`
- The `.js` daemon must be runnable with plain `node scripts/loop-backlog-daemon.js` (no extra flags)

## Acceptance Gate

- [ ] `bash scripts/test-loop-backlog-daemon-js.sh`
- [ ] `bash scripts/test-loop-backlog-daemon.sh`
- [ ] `grep -q 'loop-backlog-daemon.js' .claude/skills/loop-backlog/SKILL.md`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/test-loop-backlog-daemon-js.sh
- [ ] #2 grep -q 'loop-backlog-daemon.js' scripts/test-loop-backlog-daemon-js.sh
- [ ] #3 grep -q 'node "$DAEMON"' scripts/test-loop-backlog-daemon-js.sh
- [ ] #4 bash -c 'count=$(grep -c "test_daemon_" scripts/test-loop-backlog-daemon-js.sh); [ "$count" -ge 6 ]'
- [ ] #5 test -f scripts/loop-backlog-daemon.js
- [ ] #6 node --check scripts/loop-backlog-daemon.js
- [ ] #7 bash scripts/test-loop-backlog-daemon-js.sh
- [ ] #8 grep -q 'loop-backlog-daemon.js' .claude/skills/loop-backlog/SKILL.md
- [ ] #9 grep -q 'node.*loop-backlog-daemon.js' .claude/skills/loop-backlog/SKILL.md
- [ ] #10 bash -c '! grep -q "python3.*loop-backlog-daemon" .claude/skills/loop-backlog/SKILL.md'
- [ ] #11 bash scripts/validate-plugin.sh
- [ ] #12 test -f scripts/loop-backlog-daemon.py
- [ ] #13 grep -qi 'legacy' scripts/loop-backlog-daemon.py
- [ ] #14 bash scripts/test-loop-backlog-daemon.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

Plan committed: docs/plans/107-rewrite-loop-backlog-daemon-nodejs.md

claimed: 2026-06-17T07:15:51Z

Completed: 2026-06-17T07:20:07Z
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Execution Summary

**Result:** Done
**Commit:** 486f56803754e0aee7156e58f89a18dbedb203fd

### Execution Log
Phase 1 ✓ — scripts/test-loop-backlog-daemon-js.sh 编写完成（6 tests，先写后红）
Phase 2 ✓ — scripts/loop-backlog-daemon.js 实现完成（纯 Node.js stdlib，ES modules，6 tests 全绿）；修复了 parseTaskId 用 - 分割导致 TASK-N 无法识别的 bug
Phase 3 ✓ — SKILL.md ensureDaemonScript heredoc 更新为 .js；daemonBootstrap 改为 node 启动
Phase 4 ✓ — loop-backlog-daemon.py 保留，docstring 加 LEGACY FALLBACK 说明

所有 DoD 通过；validate-plugin.sh 全绿。
<!-- SECTION:FINAL_SUMMARY:END -->
