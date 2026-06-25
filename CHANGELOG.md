# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [1.5.0] - 2026-06-25

### Added
- `loop-backlog`: level-triggered pulse predicates with self-clearing — replaces unconditional heartbeat; daemon re-attaches automatically after `/clear` and stays silent when idle (TASK-197)
- `loop-backlog`: flock-based single-instance guard and simplified `stopStaleMon` — prevents duplicate daemon processes (TASK-187)
- `loop-backlog`: prefix-agnostic task ID extraction — removes hardcoded `TASK-` prefix; supports arbitrary project prefixes via path + field anchors (TASK-198)
- `loop-backlog`: Monitor lifecycle hardening — TaskStop tracking, cold-start checkpoint, heartbeat filter, Monitor contracts + smoke test (TASK-196)
- `loop-backlog`: pre-dispatch enrichment — archguard change-risk injection into worker context at claim time (TASK-183)
- `loop-backlog`: meta-cc-digest gate evidence pack injected into proposal/plan/epic-evaluate gates (TASK-182)
- `GCL`: `gcl-events.jsonl` schema + historical backfill of 13+ gate events (TASK-176.1)
- `GCL`: premise-ledger `gcl-events.jsonl` append hook on gate approval (TASK-176.2)
- `GCL`: `gcl-report.sh` reproducible analysis script (TASK-176.3)
- `GCL`: escape-rate field in `gcl-events.jsonl` (TASK-176.4)
- `GCL`: ~10% reliability sampling protocol in gate hooks (TASK-176.5)
- `GCL`: H5/H6/H7 hypothesis validation experiment (TASK-176.6)
- `GCL`: premise-ledger extension to proposal and epic-evaluate gates (TASK-176.7)
- `GCL`: scheduled GCL drift alerting in `gcl-report.sh` (TASK-176.8)
- `GCL`: posterior feedback pipeline linking git history + meta-cc session records to quantify gate escape rate and delta_H (TASK-194)
- `ADR-008`: frontmatter schema for all ADRs; migrated ADR-001–007 to new schema (TASK-192, TASK-193)
- `ADR-008`: ADR Lint Layer in `validate-plugin.sh` (TASK-192)
- `ADR-009`: pulse-predicate self-clearing architectural decision record
- `experiments/skill-quality/lib`: shared `config-builder.ts` consolidating duplicate buildConfig boilerplate across exp-h/i/j/k (TASK-199)
- `experiments/lib`: generic `runner.ts`, `timing.ts` session-log extractor, `cap:experiment` capability facet (TASK-153, TASK-154, TASK-156)
- `backlog-setup`: `initL0Config` — auto-detects project type and writes L0 Config block into CLAUDE.md (TASK-167)
- `plugin/scripts`: enrichment helpers and read-out scripts moved into plugin bundle (TASK-191)
- `declared-vs-actual-report.sh`: cross-task scope deviation script scanning all backlog tasks (TASK-190)
- `docs/loop-backlog-report.md`: BAIME loop-backlog mechanism report for AI-assisted software development (TASK-200)
- `docs/research`: gate-temporal-portfolio, H8 insight-task evaluation set, GCL synthesis and self-report analysis updates

### Changed
- `loop-backlog`: Monitor command-level heartbeat filter (not dispatch-level); cold-start EOF replay guard
- `README.md`: updated to reflect current BAIME capabilities, loop-backlog workflow, and GCL measurement
- `CLAUDE.md`: operational conventions for build, loop-backlog, experiments, and session analysis
- `docs/baime-self-reference-analysis.md`: expanded with bidirectional cross-references to grounding-infrastructure

### Fixed
- `loop-backlog`: self-clearing pulse predicates prevent stale predicate accumulation across `/clear` cycles
- `loop-backlog`: cold-start EOF replay — Monitor no longer re-dispatches events from previous sessions on restart

## [1.4.0] - 2026-06-20

### Added
- `skill-quality`: Class A (binary-gate / freshnessCheck) and Class B (invariant-check / reviewPlan) production oracle runners with P-full injection, dual accuracy reporting, and scorer-warning — TASK-55
- `skill-quality`: Class D tool-invocation compliance runner using live `claude -p --output-format stream-json` traces — TASK-48, TASK-49
- `skill-quality`: provenance gate (`check-provenance.sh`) — estimated values cannot masquerade as measured; `data_source` field required in all result artifacts — TASK-52
- `skill-quality`: fixture lint (`fixture-lint.sh`), harness injection self-check, and negative-control sanity fixtures — TASK-53
- `skill-quality`: `oracle-class-a` and `oracle-class-b` jobs added to `oracle.yml` CI; three oracle classes (A/B/C) now have full regression coverage — TASK-55
- `backlog-setup`: `contracts:` field added to SKILL.md frontmatter with 5 structural invariants — TASK-56
- `loop-backlog`: Critical Protocol section and behavioral contracts — TASK-47

### Changed
- `docs/baime-oca-process-refinements.md`: OCA convergence criteria revised — V_instance dual-track (`self_eval_accuracy` + `behavioral_accuracy`), `mechanically-passed` vs `substantively-verified` distinction, Higher Evidence Standard (HES) clause prohibiting self-exemption — TASK-54
- `knowledge-extractor`: ≤40-line constraint abolished based on Exp-F (H-ref CONFIRMED, 18pp accuracy gap); Spec ≤40 lines, Implementation unconstrained — documented in OCA process refinements
- `skill-quality`: Exp-G (TASK-45) INCONCLUSIVE — no systematic self-eval inflation; Exp-H (TASK-46) H-universal CONFIRMED — global oracle thresholds (Class A/B/C) generalize across skills (σ=0.020)

## [1.3.0] - 2026-06-18

### Added
- `loop-backlog`: parallel background agent execution — multiple tasks run concurrently in isolated git worktrees; main loop controls merge via `claimBatch` and signal protocol (TASK-21)
- `feature-to-backlog` / `task-to-backlog`: support existing task ID as input to resume from an in-progress task rather than always creating a new one

### Changed
- `feature-to-backlog` / `task-to-backlog`: finalise phase now writes proposal + plan directly into the task's Implementation Plan field via `--planSet`, eliminating external docs/ file commits; task becomes the single authoritative source (TASK-24)
- `backlog`: consolidated four draft/review columns (Proposal Draft, Proposal Review, Plan Draft, Plan Review) into two (Proposal, Plan); updated `backlog/config.yml`, `feature-to-backlog`, `task-to-backlog`, and `backlog-setup` accordingly (TASK-23)

### Fixed
- `loop-backlog`: eliminated daemon self-kill and stale-script bugs
- `feature-to-backlog` / `task-to-backlog`: plan/proposal now correctly written to planSet while preserving original task description

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
