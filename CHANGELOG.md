# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [1.2.2] - 2026-06-17

### Added
- `.gitignore`: added backlog daemon log and PID files (`backlog/.daemon.log`, `backlog/.daemon.pid`) to prevent accidental commits of runtime artifacts

## [1.2.1] - 2026-06-17

### Added
- `loop-backlog`: human-reply continuation — when a task is escalated to Needs Human, the worker now reads free-form natural-language replies written in Implementation Notes after the last "Escalated:" entry; user unblocks a task by replying in Notes and resetting status to Ready, without editing the Description
- `task-from-template`: pre-approved template mechanism for repetitive tasks — skip full review cycle for known task patterns (TASK-9)
- `backlog-setup`: seed examples phase and web UI guidance

### Fixed
- `loop-backlog`: escalate message now includes "answer in Notes, then set status → Ready" prompt so users know exactly how to respond
- `loop-backlog`: corrected `.backlog/` → `backlog/` path in daemon and SKILL.md
- `task-from-template`: narrowed freshness check to direct invocations only
- `templates`: removed internal script details from git-push-release Phase 3

### Changed
- ADR-001: established `plugin/skills/` as single source of truth; migrated to backlog decision tracking

## [1.2.0] - 2026-06-17

### Changed
- `loop-backlog`: worker is now event-driven — uses a persistent daemon (`scripts/loop-backlog-daemon.js`) watching `backlog/tasks/` and Monitor instead of polling every 120 s via ScheduleWakeup; triggers instantly when a task becomes Ready
- `loop-backlog`: Monitor runs in persistent mode (no 10-minute re-arm cycle); stops only when `backlog/.loop-stop` sentinel is written or `TaskStop` is called
- `README.md`: updated Step 3 description to reflect event-driven model and document `touch backlog/.loop-stop` stop instruction; fixed validation output count (4 agents, 22 skills)
- `scripts/loop-backlog-daemon.py`: downgraded to legacy fallback; canonical implementation is now the Node.js version

### Fixed
- `loop-backlog`: daemon tasks-dir corrected from `.backlog/tasks` to `backlog/tasks` (daemon was watching an empty directory, causing Monitor to never fire)

### Added
- `scripts/loop-backlog-daemon.js`: Node.js stdlib daemon (canonical) — zero npm deps, pure `fs`/`path`/`process`; replaces Python version as default
- `scripts/loop-backlog-daemon.py`: Python stdlib daemon (legacy fallback) — use only if Node.js is unavailable
- `scripts/test-loop-backlog-daemon.sh`: 6 tests for Python daemon (PID file, event emission, debounce, re-emit after reset, sentinel stop, PID cleanup)
- `scripts/test-loop-backlog-daemon-js.sh`: 6 tests for Node.js daemon (same coverage)

## [1.1.3] - 2026-06-17

### Added
- `docs/guides/cloudflare-tunnel.md`: Guide for exposing local web services using Cloudflare Tunnel and Access

## [1.1.2] - 2026-06-16

### Added
- `README.md`: New `## Backlog + Loop Workflow` section documenting the full 4-step autonomous pipeline (Initialize → Create Tasks → Run Worker → Monitor Progress), based on real session history analysis via meta-cc

## [1.1.1] - 2026-06-16

### Changed
- `loop-backlog`: Idle poll interval reduced from 270s to 120s for faster task pickup
- `loop-backlog`: Execution records now include structured phase checkpoints (via `--append-notes`),
  DoD failure details with error output, and a full `--final-summary` on completion or escalation

## [1.1.0] - 2026-06-16

### Added
- 5 new skills: backlog-setup, feature-to-backlog, task-to-backlog,
  loop-backlog, feature-developer — enabling autonomous L0 task queue
  and full feature development lifecycle
- CLAUDE.md with L0 Config enabling autonomous backlog/loop workflow
  for baime's own feature development
- project-local .claude/skills/ for baime's development tooling

### Fixed
- Removed invalid plugin/.claude-plugin/marketplace.json with
  non-standard source type
- Fixed loop-backlog SKILL.md: replaced hardcoded archguard worktree
  path with dynamic PROJECT_NAME=$(basename "$REPO_ROOT")
- Normalized skill name fields to kebab-case
- Refactored install.sh to use Claude Code plugin cache path structure

## [1.0.0] - 2026-03-13

### Added
- Initial release: 19 validated skills covering methodology, testing, CI/CD,
  error recovery, documentation, API design, and more
- 6 specialized agents: project-planner, stage-executor, iteration-executor,
  iteration-prompt-designer, knowledge-extractor, workflow-coach
- Standard Claude Code plugin structure (plugin/ directory)
- Self-hosted marketplace via .claude-plugin/marketplace.json
- install.sh / uninstall.sh for user-scope installation
