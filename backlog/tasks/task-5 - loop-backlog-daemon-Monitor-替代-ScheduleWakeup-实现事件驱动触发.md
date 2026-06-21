---
id: TASK-5
title: 'loop-backlog: daemon + Monitor 替代 ScheduleWakeup 实现事件驱动触发'
status: Basic: Done
assignee: []
created_date: '2026-06-17 03:58'
updated_date: '2026-06-17 04:20'
labels:
  - kind:basic
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
# Plan: loop-backlog: daemon + Monitor 替代 ScheduleWakeup 实现事件驱动触发

Proposal: docs/proposals/proposal-loop-backlog-daemon-monitor-event-driven.md

## Phase A: Create the daemon script (scripts/loop-backlog-daemon.py)

### Tests (write first)

File: `scripts/test-loop-backlog-daemon.sh`

Test cases to add (each must fail before implementation):
- `test_daemon_writes_pid_file` — spawn daemon, check `.backlog/.daemon.pid` contains a numeric PID
- `test_daemon_emits_task_ready_line` — create a fake task file with `status: Ready`, start daemon, capture stdout line matching `task-ready:TASK-`
- `test_daemon_debounces_repeated_ready` — assert daemon does NOT emit duplicate `task-ready` for same task ID without a Ready→non-Ready transition
- `test_daemon_re_emits_after_status_reset` — mark task non-Ready then Ready again, assert a second `task-ready` line is emitted
- `test_daemon_stops_on_sentinel` — write `.backlog/.loop-stop`, assert daemon process exits within 2 seconds
- `test_daemon_removes_pid_on_exit` — after daemon exits, assert `.backlog/.daemon.pid` has been removed

### Implementation

File to create: `scripts/loop-backlog-daemon.py`

Key logic:
- Parse args: `--tasks-dir` (default `.backlog/tasks`), `--pid-file` (default `.backlog/.daemon.pid`), `--stop-file` (default `.backlog/.loop-stop`), `--interval` (default `0.5`)
- On startup: write `os.getpid()` to pid-file; record `parent_pid = os.getppid()`
- Poll loop (500 ms): scan tasks dir for files containing `status: Ready`; emit `task-ready:TASK-X\n` (flushed) for any ID not in `notified` set; purge IDs from `notified` when no longer Ready
- Check stop sentinel and parent-PID liveness each cycle; exit cleanly on either
- On exit: remove pid-file via `atexit`

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `python3 scripts/loop-backlog-daemon.py --help 2>&1 | grep -q "tasks-dir"`
- [ ] `python3 -c "import ast; ast.parse(open('scripts/loop-backlog-daemon.py').read())" && echo "syntax ok"`

---

## Phase B: Daemon bootstrap in loop-backlog skill (SKILL.md — daemon startup section)

### Tests (write first)

File: `scripts/test-loop-backlog-skill-bootstrap.sh`

Test cases (must fail before implementation):
- `test_skill_md_has_daemon_bootstrap_section` — grep SKILL.md for `daemonBootstrap`; assert present
- `test_skill_md_has_monitor_in_allowed_tools` — grep SKILL.md front-matter for `Monitor`; assert present
- `test_skill_md_no_schedulewakeup_in_allowed_tools` — assert `! grep -q "ScheduleWakeup" .claude/skills/loop-backlog/SKILL.md`
- `test_skill_md_references_daemon_script` — grep SKILL.md for `loop-backlog-daemon.py`; assert present
- `test_skill_md_references_pid_file` — grep SKILL.md for `.daemon.pid`; assert present

### Implementation

File to modify: `.claude/skills/loop-backlog/SKILL.md`

Changes:
1. Front-matter `allowed-tools` line: replace `ScheduleWakeup` with `Monitor`
2. New `### daemonBootstrap` section added to `## Implementation`, before the existing `### reap` section

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "Monitor" .claude/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q "ScheduleWakeup" .claude/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "daemonBootstrap" .claude/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "loop-backlog-daemon" .claude/skills/loop-backlog/SKILL.md`

---

## Phase C: Replace ScheduleWakeup with Monitor in workerLoop (SKILL.md — scheduling section)

### Tests (write first)

File: `scripts/test-loop-backlog-skill-monitor.sh`

Test cases (must fail before implementation):
- `test_workerloop_spec_uses_monitor` — grep SKILL.md for `Monitor(` in workerLoop spec; assert present
- `test_workerloop_spec_no_schedule_call` — assert `! grep -q "schedule(" .claude/skills/loop-backlog/SKILL.md`
- `test_skill_md_references_loop_stop_sentinel` — grep SKILL.md for `loop-stop`; assert present
- `test_skill_md_has_shutdown_section` — grep SKILL.md for `## Shutdown`; assert present

### Implementation

File to modify: `.claude/skills/loop-backlog/SKILL.md`

Changes:
1. Update `workerLoop` spec — replace `schedule(...)` calls with Monitor-based event loop using `Monitor(timeout=600)`
2. Replace `## Scheduling` section with `## Shutdown` section
3. Remove `delayFor` function and scheduling table entirely

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "Monitor(timeout=600)" .claude/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q "ScheduleWakeup" .claude/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "loop-stop" .claude/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "## Shutdown" .claude/skills/loop-backlog/SKILL.md`

---

## Phase D: Wire ensureDaemonScript into skill (write daemon from embedded template if missing)

### Tests (write first)

File: `scripts/test-loop-backlog-skill-template.sh`

Test cases (must fail before implementation):
- `test_skill_md_has_ensure_daemon_script_section` — grep SKILL.md for `ensureDaemonScript`; assert present
- `test_daemon_script_exists_in_repo` — assert `test -f scripts/loop-backlog-daemon.py`
- `test_daemon_script_is_valid_python` — `python3 -c "import ast; ast.parse(open('scripts/loop-backlog-daemon.py').read())"`

### Implementation

File to modify: `.claude/skills/loop-backlog/SKILL.md`

New `### ensureDaemonScript` section added to `## Implementation` (before `### daemonBootstrap`): bash block that writes the full daemon script from an embedded heredoc if the file does not yet exist.

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "ensureDaemonScript" .claude/skills/loop-backlog/SKILL.md`
- [ ] `test -f scripts/loop-backlog-daemon.py`
- [ ] `python3 -c "import ast; ast.parse(open('scripts/loop-backlog-daemon.py').read())" && echo "syntax ok"`

---

## Constraints

- The daemon must use Python stdlib only (no pip dependencies).
- The daemon must run on Python 3.6+ (`f-strings` allowed, walrus operator not required).
- The daemon PID file path is `.backlog/.daemon.pid` (relative to repo root).
- The stop sentinel path is `.backlog/.loop-stop` (relative to repo root).
- The daemon emits exactly one `task-ready:TASK-X` line per Ready transition (debounced via an in-memory set).
- The daemon self-terminates when its parent PID is no longer alive (orphan protection).
- The Monitor timeout window is 600 seconds (10 minutes); on timeout, the skill re-checks daemon liveness and re-enters Monitor — it does not exit unless the stop sentinel is present.
- Windows PTY compatibility is out of scope.
- No external test framework is required; test scripts use plain bash with `set -e` and inline assertions.
- Each phase must leave `bash scripts/validate-plugin.sh` passing before the next phase starts.

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "Monitor" .claude/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q "ScheduleWakeup" .claude/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "loop-backlog-daemon" .claude/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "loop-stop" .claude/skills/loop-backlog/SKILL.md`
- [ ] `python3 -c "import ast; ast.parse(open('scripts/loop-backlog-daemon.py').read())" && echo "syntax ok"`
- [ ] `test -f scripts/loop-backlog-daemon.py`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 python3 scripts/loop-backlog-daemon.py --help 2>&1 | grep -q "tasks-dir"
- [ ] #3 python3 -c "import ast; ast.parse(open('scripts/loop-backlog-daemon.py').read())" && echo "syntax ok"
- [ ] #4 bash scripts/validate-plugin.sh
- [ ] #5 grep -q "Monitor" .claude/skills/loop-backlog/SKILL.md
- [ ] #6 ! grep -q "ScheduleWakeup" .claude/skills/loop-backlog/SKILL.md
- [ ] #7 grep -q "daemonBootstrap" .claude/skills/loop-backlog/SKILL.md
- [ ] #8 grep -q "loop-backlog-daemon" .claude/skills/loop-backlog/SKILL.md
- [ ] #9 bash scripts/validate-plugin.sh
- [ ] #10 grep -q "Monitor(timeout=600)" .claude/skills/loop-backlog/SKILL.md
- [ ] #11 ! grep -q "ScheduleWakeup" .claude/skills/loop-backlog/SKILL.md
- [ ] #12 grep -q "loop-stop" .claude/skills/loop-backlog/SKILL.md
- [ ] #13 grep -q "## Shutdown" .claude/skills/loop-backlog/SKILL.md
- [ ] #14 bash scripts/validate-plugin.sh
- [ ] #15 grep -q "ensureDaemonScript" .claude/skills/loop-backlog/SKILL.md
- [ ] #16 test -f scripts/loop-backlog-daemon.py
- [ ] #17 python3 -c "import ast; ast.parse(open('scripts/loop-backlog-daemon.py').read())" && echo "syntax ok"
- [ ] #18 bash scripts/validate-plugin.sh
- [ ] #19 grep -q "Monitor" .claude/skills/loop-backlog/SKILL.md
- [ ] #20 ! grep -q "ScheduleWakeup" .claude/skills/loop-backlog/SKILL.md
- [ ] #21 grep -q "loop-backlog-daemon" .claude/skills/loop-backlog/SKILL.md
- [ ] #22 grep -q "loop-stop" .claude/skills/loop-backlog/SKILL.md
- [ ] #23 python3 -c "import ast; ast.parse(open('scripts/loop-backlog-daemon.py').read())" && echo "syntax ok"
- [ ] #24 test -f scripts/loop-backlog-daemon.py
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: NEEDS_REVISION

Finding: The Proposed Approach section omitted a required skill configuration change. The loop-backlog SKILL.md allowed-tools header lists ScheduleWakeup but not Monitor; without updating this header the skill cannot call Monitor and the event-driven design cannot function. A paragraph was added to the Approach section specifying this one-line edit to the skill definition file. All other criteria (Motivation, Goals, Trade-offs, Consistency) passed.

Revised proposal written to /tmp/ftb-proposal.md.

Proposal review iteration 2: APPROVED

Proposal approved. Starting plan draft.

Plan review iteration 1: APPROVED

Docs committed: docs/proposals/proposal-loop-backlog-daemon-monitor-event-driven.md + docs/plans/105-loop-backlog-daemon-monitor-event-driven.md

claimed: 2026-06-17T04:16:21Z

Phase A ✓ 2026-06-17T04:17:00Z
Created scripts/loop-backlog-daemon.py (Python stdlib only, 6 tests all pass) and scripts/test-loop-backlog-daemon.sh. All Phase A DoDs pass.

Completed: 2026-06-17T04:20:29Z
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Execution Summary

**Result:** Done
**Commit:** 072518e6d210afa826c2f066939c5b1fbdf2b9a2

### Execution Log
Phase A ✓ 2026-06-17T04:17:00Z
Created scripts/loop-backlog-daemon.py (Python stdlib only, 6 tests all pass) and scripts/test-loop-backlog-daemon.sh.

Phase B ✓ SKILL.md updated: replaced ScheduleWakeup with Monitor in allowed-tools, added daemonBootstrap and ensureDaemonScript sections.

Phase C ✓ SKILL.md workerLoop spec updated to use Monitor(timeout=600), ## Scheduling replaced with ## Shutdown.

Phase D ✓ ensureDaemonScript section added with embedded daemon heredoc.

All 24 DoDs passed. 4 test scripts created (6 + 5 + 4 + 3 tests).
<!-- SECTION:FINAL_SUMMARY:END -->
