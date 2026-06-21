---
id: TASK-118
title: Implement B″ unified-board dual-state-machine architecture
status: Basic: Backlog
assignee: []
created_date: '2026-06-21 06:21'
updated_date: '2026-06-21 06:47'
labels:
  - kind:basic
  - architecture
  - epic-split-board
  - loop-backlog
  - loop-meta
dependencies: []
references:
  - docs/proposals/proposal-epic-split-board.md
  - docs/proposals/proposal-epic-capability-model.md
  - scripts/loop-backlog-daemon.js
  - backlog/config.yml
documentation:
  - docs/proposals/proposal-epic-split-board.md
priority: high
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Summary

Implement the B″ (unified-board dual-state-machine) architecture as specified in `docs/proposals/proposal-epic-split-board.md`. Replace the existing Meta-* column system and experimental Exp-K epic tasks with a production-grade two-daemon design on a single backlog board.

## Background

The current system has two problems:
1. **B档 conflict**: `status` (column) IS state; each capability also has state — two axes cannot coexist on one column namespace without type explosion.
2. **TASK-105 race condition**: Two daemons writing to the same rows on the same board.

B″ solves both by partitioning the column namespace: `Epic: *` columns for epic tasks, `Basic: *` columns for basic tasks. Each daemon exclusively writes its own subset. `kind:epic` / `kind:basic` label discriminates which state machine applies.

## 7-Phase Implementation Plan

### Phase 0 — Cleanup (prerequisite, ~1 day)
Delete all 17 experimental epic tasks:
- TASK-93, TASK-93.7, TASK-93.8, TASK-93.9, TASK-93.10
- TASK-106 through TASK-117

### Phase 1 — Board Migration (~1 day)
- Replace `backlog/config.yml` statuses (11 → 14 B″ columns):
  ```
  Epic: Proposal, Epic: Plan, Epic: Decomposing, Epic: Awaiting Children,
  Epic: Evaluating, Epic: Done, Epic: Needs Human,
  Basic: Proposal, Basic: Plan, Basic: Backlog, Basic: Ready,
  Basic: In Progress, Basic: Done, Basic: Needs Human
  ```
- `sed`-migrate all ~62 existing basic tasks: map old status → `Basic: <status>` (e.g. `Backlog` → `Basic: Backlog`, `Done` → `Basic: Done`)
- Add `kind:basic` label to all migrated tasks

### Phase 2 — Spec-Stdlib Extraction (~1 day)
- Create `docs/spec-stdlib.md §reviewLoop` with parameterized signature:
  `reviewLoop(needsHumanCol, returnTo, reviewCriteria, maxIter)`
- Remove inline `reviewLoop` copies from:
  - `plugin/skills/task-to-backlog/SKILL.md`
  - `plugin/skills/feature-to-backlog/SKILL.md`
  - `plugin/skills/loop-meta/SKILL.md`
- Replace with references to spec-stdlib

### Phase 3 — Daemon Refactor (~2 days)
- Split `scripts/loop-backlog-daemon.js` into two daemons:
  - `scripts/basic-daemon.js`: watches `basic-ready` events; processes `Basic: *` columns
  - `scripts/epic-daemon.js`: watches `epic-ready` events; processes `Epic: *` columns
- Replace Meta-status filter with `kind` label filter
- Implement dispatch logic per proposal pseudocode:
  - `basicDAG`: propose → plan → execute
  - `epicDAG`: propose → plan → decompose → evaluate
- Implement `cap:*` marker system (append-only notes for idempotency)
- Implement `notifyParentIfAny(id)` in basic-daemon
- Implement three-way reconcile in epic-daemon's `decomposeProcessor`
- Implement `evaluateProcessor` with full Escalated branch

### Phase 4 — Skills Refactor (~1 day)
- Refactor existing skills to seed-only mode (emit `cap:propose=approved` / `cap:plan=approved` and exit):
  - `epic-to-backlog` skill (new): seeds an epic task at `Epic: Proposal`
  - `task-to-backlog` skill: becomes seed-only for basic tasks
  - `feature-to-backlog` skill: becomes seed-only for basic tasks
- Daemon takes over all subsequent processing

### Phase 5 — Guardrails (~1 day)
- `scripts/verify-kind-status.sh`: assert every task has `kind:epic` or `kind:basic`, and its status is in the correct column subset
- `scripts/check-roi-gate.sh`: evaluator gate for epic evaluation phase
- Update `scripts/validate-plugin.sh` to run new guardrail scripts

### Phase 6 — Validation (~2 days)
- Rebuild Exp-K corpus: create 12 test epic tasks under B″ schema (at `Epic: Proposal`)
- Run full E2E cycle: epic-daemon and basic-daemon process corpus end-to-end
- Confirm: no column overlap violations, `parentTaskId` links correct, `notifyParentIfAny` fires correctly, human-intervention recovery works via `return-to` notes

## Key Design Decisions
- One physical board, 14 columns, non-overlapping subsets
- Two daemons (basic-daemon + epic-daemon) — future merge possible once stable
- `cap:*` markers in notes = idempotency + audit trail
- `return-to` notes = human-readable only (no machine parsing)
- `diverging(id)` = `reconcileRunCount(id) ≥ 3` → escalate to `Epic: Needs Human`
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Summary

Implement the B″ (unified-board dual-state-machine) architecture as specified in `docs/proposals/proposal-epic-split-board.md`. Replace the existing Meta-* column system and experimental Exp-K epic tasks with a production-grade dual-channel design on a single backlog board.

## Background

The current system has two problems:
1. **B档 conflict**: `status` (column) IS state; each capability also has state — two axes cannot coexist on one column namespace without type explosion.
2. **TASK-105 race condition**: two workers writing to the same rows on the same board.

B″ solves both by partitioning the column namespace: `Epic: *` columns for epic tasks, `Basic: *` columns for basic tasks. Each worker exclusively writes its own subset. A `kind:epic` / `kind:basic` label discriminates which state machine applies.

## Architecture Note (CRITICAL — corrects a common misread)

This codebase has TWO layers, and the B″ logic splits across them differently than "two daemons" suggests:

- **Poller layer (JS, ~208 lines)** — `loop-backlog-daemon.js` only watches `backlog/tasks/*.md` and emits event lines to stdout (`task-ready:TASK-N` / `meta-ready:TASK-N`). It holds NO dispatch, capability, reconcile, or evaluate logic. Its source of truth is an **embedded copy inside `plugin/skills/loop-backlog/SKILL.md`**, regenerated on each `/loop-backlog` run when the `daemon-version` tag differs. Editing the standalone `scripts/*.js` without updating the embedded copy + version tag is clobbered on next run.
- **Worker layer (agent-driven SKILL.md specs)** — `loop-backlog/SKILL.md` (basic worker) and `loop-meta/SKILL.md` (epic worker) hold the dispatch DAG, `reviewLoop`, decompose/three-way-reconcile, and `evaluateProcessor` as Haskell-style specs the Claude agent executes via `Monitor`.

Therefore B″ means: **(a)** change the poller's emit-routing from Meta-status filtering to `kind`+column routing (`basic-ready` / `epic-ready`), keeping embedded-copy + version-tag discipline; and **(b)** place the basicDAG/epicDAG dispatch, `cap:*` markers, reconcile, and evaluate logic in the **worker SKILL specs**, not in the poller JS. "Two daemons" = two event channels consumed by two worker skills.

## Goals

1. `backlog/config.yml` lists exactly 14 B″ statuses (7 `Epic:*` + 7 `Basic:*`), reformatted one-status-per-line, with zero legacy `Meta-*` or bare statuses — verified by `[ "$(grep -cE '^\s+- "(Epic|Basic):' backlog/config.yml)" -eq 14 ]` exit 0 and `! grep -qE 'Meta-|"(Backlog|Ready|In Progress)"' backlog/config.yml`.
2. All ~80 active task files carry a `kind:basic` or `kind:epic` label and a status within the matching column subset — verified by `scripts/verify-kind-status.sh` exit 0.
3. The poller emits `basic-ready:` for `kind:basic` tasks and `epic-ready:` for `kind:epic` tasks, and never the wrong channel — verified by a deterministic routing unit test `scripts/daemon-routing.test.js` exit 0. Embedded daemon copy in `loop-backlog/SKILL.md` and standalone `scripts/*.js` carry matching `daemon-version` tags.
4. `cap:*` idempotency markers (e.g. `cap:propose=approved`) are present in notes of every task past its initial column — verified by `scripts/verify-cap-markers.sh` exit 0.
5. `docs/spec-stdlib.md` holds a single canonical `reviewLoop` definition; the inline definition blocks are removed from `task-to-backlog/SKILL.md` and `feature-to-backlog/SKILL.md` (which use the basic-worker signature) and from `loop-meta/SKILL.md`, each replaced by a `see spec-stdlib § reviewLoop` reference.
6. A deterministic dry-run (`scripts/exp-k-dryrun.sh`, no worktree/Claude execution) seeds 12 `kind:epic` tasks, simulates dispatch routing through the epic state machine, and writes `logs/exp-k-e2e.log`; `grep -c 'column-overlap-violation' logs/exp-k-e2e.log` returns 0 and `grep -c 'terminal:' logs/exp-k-e2e.log` returns 12.

## Risks and Trade-offs

- **In-place migration of 80 task files**: bulk `sed` may corrupt status/label fields. Mitigation: commit a checkpoint before Phase B; run `verify-kind-status.sh` immediately after and abort on non-zero.
- **Daemon-version drift**: the embedded copy (skill body, currently `v5`) and standalone file (`v6`) already disagree. Mitigation: Phase D bumps both atomically and the routing test asserts the standalone file matches the embedded tag.
- **Hardcoded status strings in scripts**: any script matching bare `Backlog`/`Done`/etc. breaks post-migration. Mitigation: Phase B audits `scripts/` for hardcoded statuses before migrating.
- **Skill count gate**: `validate-plugin.sh` hardcodes `EXPECTED_SKILLS=25`; adding `epic-to-backlog` requires bumping it to 26 in the same phase, else every phase's first DoD fails.
- **loop-meta fate**: kept as the epic worker (renamed in concept, not deleted), so net skills = +1 (epic-to-backlog) → 26. Its decompose/evaluate spec is retained, only `reviewLoop` is extracted.

## Key Design Decisions
- One physical board, 14 columns, non-overlapping subsets; `kind` label is the discriminator.
- Two event channels (`basic-ready` / `epic-ready`) from the poller; two worker skills consume them.
- `cap:*` markers in notes = idempotency + audit trail.
- `parent_task_id` (snake_case, the real frontmatter field) drives `notifyParentIfAny`.
- `return-to` notes = human-readable only (no machine parsing).
- `diverging(id)` = `reconcileRunCount(id) ≥ 3` → escalate to `Epic: Needs Human`.

---

# Plan: Implement B″ unified-board dual-state-machine architecture

Proposal: docs/proposals/proposal-epic-split-board.md

Ordering: A → B → {C ∥ D} → E → F → G. Phase B must precede D (routing uses new columns) and F/G (guardrails verify migrated board). E must follow D (skills delegate to the new channels). Each phase ≤ 200 LOC change. Commit a checkpoint before Phase B (destructive migration).

## Phase A: Cleanup — Delete Experimental Epic Tasks
### Tests (write first)
- Test: no experimental task files remain in `backlog/tasks/` matching the Exp-K id set.
### Implementation
- Archive TASK-93, TASK-93.7–93.10 and TASK-106–117 via `backlog task archive <id>` (TASK-106–108 may already be archived — treat as no-op).
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! ls backlog/tasks/ | grep -qE 'task-93[ .]|task-1(0[6-9]|1[0-7]) '`

## Phase B: Board Migration — config.yml (multi-line) + Migrate Task Files
### Tests (write first)
- Test: `[ "$(grep -cE '^\s+- "(Epic|Basic):' backlog/config.yml)" -eq 14 ]` exit 0.
- Test: `! grep -qE 'Meta-|"(Backlog|Ready|In Progress)"' backlog/config.yml`.
- Test: `bash scripts/verify-kind-status.sh` exit 0 (script delivered in Phase F; Phase B may stub-create it, Phase F hardens it).
### Implementation
- Reformat `backlog/config.yml` `statuses:` to a one-status-per-line YAML list of the 14 B″ columns (7 `Epic:*` + 7 `Basic:*`). One-per-line is REQUIRED so the count check works (`grep -c` counts lines).
- Audit `scripts/` for hardcoded bare status strings (`grep -rnE '"(Backlog|Ready|Done|In Progress)"' scripts/`); update or note each before migrating.
- Write `scripts/migrate-board.sh` (new): for each of the ~80 files in `backlog/tasks/`, rewrite `status: <bare>` → `status: Basic: <bare>` and add `kind:basic` to the `labels:` list. Idempotent (skip files already `Basic:`/`Epic:` prefixed).
- Commit a git checkpoint, then run `bash scripts/migrate-board.sh && bash scripts/verify-kind-status.sh`.
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `[ "$(grep -cE '^\s+- "(Epic|Basic):' backlog/config.yml)" -eq 14 ]`
- [ ] `! grep -qE 'Meta-|"(Backlog|Ready|In Progress)"' backlog/config.yml`
- [ ] `bash scripts/verify-kind-status.sh`

## Phase C: Spec-Stdlib — Extract Canonical reviewLoop
### Tests (write first)
- Test: `grep -qE '^##+ .*reviewLoop|§ ?reviewLoop' docs/spec-stdlib.md` exit 0.
- Test: inline definition blocks absent from the two basic-worker skills.
### Implementation
- Add a canonical `reviewLoop` section to `docs/spec-stdlib.md` with a parameterized signature (`needsHumanCol`, `returnTo`, `reviewCriteria`, `maxIter`).
- Remove the inline `reviewLoop :: (...)` definition block from `task-to-backlog/SKILL.md`, `feature-to-backlog/SKILL.md`, and `loop-meta/SKILL.md`; replace each with a one-line `-- see spec-stdlib § reviewLoop` reference.
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -qE '^##+ .*reviewLoop|§ ?reviewLoop' docs/spec-stdlib.md`
- [ ] `! grep -qF 'reviewLoop :: (Task, Doc, MaxRounds)' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -qF 'reviewLoop :: (Task, Doc, MaxRounds)' plugin/skills/feature-to-backlog/SKILL.md`

## Phase D: Poller Routing + Worker Specs — basic/epic channels
### Tests (write first)
- Test: `scripts/daemon-routing.test.js` asserts a `kind:basic` task at a `Basic:*` status emits ONLY `basic-ready:` and a `kind:epic` task at an `Epic:*` status emits ONLY `epic-ready:` (no cross-channel emission).
- Test: standalone `scripts/basic-daemon.js` / `scripts/epic-daemon.js` exist and carry a `daemon-version` tag matching the embedded copy in `loop-backlog/SKILL.md`.
### Implementation
- Replace the poller's Meta-status filter with `kind`+column routing. Two delivery options, pick one and keep it consistent: (1) one poller emitting both channels, or (2) `scripts/basic-daemon.js` + `scripts/epic-daemon.js`. Plan adopts (2) per the accepted two-daemon decision.
- Update the EMBEDDED daemon copy inside `plugin/skills/loop-backlog/SKILL.md` and bump its `daemon-version` tag; ensure the standalone `scripts/*.js` match (resolve the existing v5/v6 drift).
- Place dispatch DAGs in the WORKER specs (not the poller JS): basicDAG (propose→plan→execute) in `loop-backlog/SKILL.md`; epicDAG (propose→plan→decompose→evaluate), three-way reconcile, `evaluateProcessor` with Escalated branch, and `diverging(id)=reconcileRunCount≥3` in `loop-meta/SKILL.md`. Routing uses `parent_task_id` (snake_case) for `notifyParentIfAny`.
- Write `scripts/daemon-routing.test.js` (new) covering the routing assertions above.
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f scripts/basic-daemon.js && test -f scripts/epic-daemon.js`
- [ ] `node scripts/daemon-routing.test.js`
- [ ] `grep -qF 'basic-ready' scripts/basic-daemon.js && grep -qF 'epic-ready' scripts/epic-daemon.js`
- [ ] `grep -qF 'parent_task_id' scripts/basic-daemon.js`

## Phase E: Skills Refactor — Seed-Only Mode + Skill-Count Gate
### Tests (write first)
- Test: `test -d plugin/skills/epic-to-backlog` and `validate-plugin.sh` skill-count gate passes (bumped to 26).
### Implementation
- Create `plugin/skills/epic-to-backlog/SKILL.md` (new): seeds an epic task at `Epic: Proposal` with `kind:epic` label, writes `cap:propose=approved`, exits. Include a `contracts:` block.
- Update `validate-plugin.sh`: `EXPECTED_SKILLS=26` (was 25) in the SAME phase that adds the skill, so the first DoD does not break.
- Update `plugin/skills/task-to-backlog/SKILL.md` and `feature-to-backlog/SKILL.md` to seed-only: write `cap:propose=approved`, exit; the basic worker takes over.
- Add the `.claude/skills/epic-to-backlog` symlink (validate-plugin.sh checks symlink consistency).
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -d plugin/skills/epic-to-backlog`
- [ ] `grep -q 'EXPECTED_SKILLS=26' scripts/validate-plugin.sh`
- [ ] `grep -q 'contracts:' plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `grep -q 'cap:propose=approved' plugin/skills/task-to-backlog/SKILL.md`

## Phase F: Guardrails — Verification Scripts
### Tests (write first)
- Test: `scripts/verify-kind-status.sh` and `scripts/verify-cap-markers.sh` exist and exit 0 on the migrated board.
- Test: `validate-plugin.sh` invokes `verify-kind-status`.
### Implementation
- Harden `scripts/verify-kind-status.sh` (new/finalized): each active task file has `kind:epic` XOR `kind:basic`, and its `status:` is within the matching column subset; exit non-zero on any violation (print `column-overlap-violation` lines).
- Write `scripts/verify-cap-markers.sh` (new): any task past its initial column has ≥1 `cap:*` line in notes; exit non-zero otherwise.
- Wire both into `scripts/validate-plugin.sh`.
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/verify-kind-status.sh`
- [ ] `bash scripts/verify-cap-markers.sh`
- [ ] `grep -q 'verify-kind-status' scripts/validate-plugin.sh`

## Phase G: Validation — Deterministic Dry-Run + One Real Epic Smoke Test
### Tests (write first)
- Test: dry-run produces `logs/exp-k-e2e.log` with 12 `terminal:` markers and 0 `column-overlap-violation` markers.
- Test: the real-epic smoke run produces `logs/exp-k-real-epic.log` with ≥1 `terminal:` marker (a real epic decomposed, a child executed, and the epic evaluated to a terminal column).
### Implementation
- **Tier 1 (deterministic, CI gate)**: Write `scripts/exp-k-dryrun.sh` (new): creates 12 `kind:epic` tasks at `Epic: Proposal` in a temp board, then drives a deterministic SIMULATION of the epic state machine (routing + column transitions + `notifyParentIfAny`, NO worktree/Claude execution), emitting one `terminal:<id>` line per epic reaching `Epic: Done`/`Epic: Needs Human` and a `column-overlap-violation` line if any write crosses subsets. Output to `logs/exp-k-e2e.log`. Creates `logs/` if absent. Cleans up the temp board.
- **Tier 2 (one real epic, manual smoke test)**: Seed ONE `kind:epic` task via `epic-to-backlog`, start both pollers (`scripts/basic-daemon.js` + `scripts/epic-daemon.js`) and the two worker sessions, and let the real path run: epic propose→plan→decompose → ≥1 basic child executes in a worktree → epic evaluate → terminal column. Capture combined output to `logs/exp-k-real-epic.log`. This is token-costly and run once by a human; its DoD passes only after that run records a `terminal:` line. Note in the run log the child id(s) and final epic column.
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/exp-k-dryrun.sh`
- [ ] `[ "$(grep -c 'column-overlap-violation' logs/exp-k-e2e.log)" -eq 0 ]`
- [ ] `[ "$(grep -c 'terminal:' logs/exp-k-e2e.log)" -eq 12 ]`
- [ ] `grep -q 'terminal:' logs/exp-k-real-epic.log`

## Constraints
- Phase A precedes B; B precedes D, F, G; C may run parallel with B/D; D precedes E.
- Commit a git checkpoint before Phase B (destructive 80-file migration).
- Do not delete `loop-meta` — it is retained as the epic worker; only its `reviewLoop` block is extracted.
- Do not force-push or amend published commits.
- Keep embedded daemon copy (in `loop-backlog/SKILL.md`) and standalone `scripts/*.js` `daemon-version` tags in sync.
- Each Phase ≤ 200 lines of code change.

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/verify-kind-status.sh`
- [ ] `bash scripts/verify-cap-markers.sh`
- [ ] `node scripts/daemon-routing.test.js`
- [ ] `[ "$(grep -c 'column-overlap-violation' logs/exp-k-e2e.log)" -eq 0 ]`
- [ ] `[ "$(grep -c 'terminal:' logs/exp-k-e2e.log)" -eq 12 ]`
- [ ] `grep -q 'terminal:' logs/exp-k-real-epic.log`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: NEEDS_REVISION — Added missing Goals section (6 numbered verifiable items) and filled in empty Acceptance Criteria. Background and feasibility passed. Revised proposal saved back to planSet.

Proposal review iteration 2: NEEDS_REVISION — two items fixed: (1) Goal 4 now cites scripts/verify-cap-markers.sh with exit 0 as the observable verification criterion; (2) added explicit Risks and Trade-offs section covering in-place migration risk, daemon split regression, column tooling compatibility, Phase 0 archival ambiguity, and Exp-K corpus cascade dependency. All other checks (Motivation, Goals 1-3/5-6, Feasibility, Consistency) passed.

Proposal review iteration 3: NEEDS_REVISION — two Goals lacked executable verification commands. Goal 1 added grep commands to verify config.yml column count. Goal 6 added log file path (logs/exp-k-e2e.log) and grep-based terminal/violation checks. All other sections passed.

Proposal review iteration 4: APPROVED

Proposal approved. Starting plan draft.

Plan review iteration 1: NEEDS_REVISION — Fixed: Acceptance Gate was missing the Goal 6 terminal-state check. Added `[ "$(grep -c 'terminal:' logs/exp-k-e2e.log)" -eq 12 ]` as the fifth Acceptance Gate item to match Goal 6's requirement that all 12 Exp-K epic tasks reach a terminal state.

Plan review iteration 2: APPROVED

Deep re-review (post-approval): found 8 substantive defects against the real codebase and corrected the plan. (1) Daemon is a pure poller (208-line event emitter); dispatch/reviewLoop/decompose/evaluate logic lives in SKILL.md worker specs, not JS — Phase D rescoped to poller-routing + worker-spec placement. (2) Daemon source-of-truth is embedded in loop-backlog/SKILL.md, regenerated via daemon-version tag (v5/v6 drift exists) — added version-sync discipline. (3) grep -c on single-line config.yml returns 1 not 14 — config now reformatted one-status-per-line and check uses grep -cE on list lines. (4) EXPECTED_SKILLS=25 hardcoded in validate-plugin.sh — Phase E bumps to 26 in same phase. (5) brittle '! grep Epic:' exclusivity checks replaced with daemon-routing.test.js. (6) parent field is parent_task_id (snake_case) not parentTaskId. (7) Phase G real-execution E2E replaced with deterministic exp-k-dryrun.sh simulation emitting terminal:/column-overlap-violation markers. (8) task count is 80 active (not 62); loop-meta retained as epic worker (not deleted). DoD set fully replaced (21 items).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 ! ls backlog/tasks/ | grep -qE 'task-93[ .]|task-1(0[6-9]|1[0-7]) '
- [ ] #3 [ "$(grep -cE '^\s+- "(Epic|Basic):' backlog/config.yml)" -eq 14 ]
- [ ] #4 ! grep -qE 'Meta-|"(Backlog|Ready|In Progress)"' backlog/config.yml
- [ ] #5 bash scripts/verify-kind-status.sh
- [ ] #6 grep -qE '^##+ .*reviewLoop|§ ?reviewLoop' docs/spec-stdlib.md
- [ ] #7 ! grep -qF 'reviewLoop :: (Task, Doc, MaxRounds)' plugin/skills/task-to-backlog/SKILL.md
- [ ] #8 ! grep -qF 'reviewLoop :: (Task, Doc, MaxRounds)' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #9 test -f scripts/basic-daemon.js && test -f scripts/epic-daemon.js
- [ ] #10 node scripts/daemon-routing.test.js
- [ ] #11 grep -qF 'basic-ready' scripts/basic-daemon.js && grep -qF 'epic-ready' scripts/epic-daemon.js
- [ ] #12 grep -qF 'parent_task_id' scripts/basic-daemon.js
- [ ] #13 test -d plugin/skills/epic-to-backlog
- [ ] #14 grep -q 'EXPECTED_SKILLS=26' scripts/validate-plugin.sh
- [ ] #15 grep -q 'contracts:' plugin/skills/epic-to-backlog/SKILL.md
- [ ] #16 grep -q 'cap:propose=approved' plugin/skills/task-to-backlog/SKILL.md
- [ ] #17 bash scripts/verify-cap-markers.sh
- [ ] #18 grep -q 'verify-kind-status' scripts/validate-plugin.sh
- [ ] #19 bash scripts/exp-k-dryrun.sh
- [ ] #20 [ "$(grep -c 'column-overlap-violation' logs/exp-k-e2e.log)" -eq 0 ]
- [ ] #21 [ "$(grep -c 'terminal:' logs/exp-k-e2e.log)" -eq 12 ]
- [ ] #22 grep -q 'terminal:' logs/exp-k-real-epic.log
<!-- DOD:END -->
