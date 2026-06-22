---
id: TASK-130
title: Skill 分层测试框架（Layer 0 缺口 + Layer 1 + Layer 3）
status: 'Epic: Done'
assignee: []
created_date: '2026-06-21 13:50'
updated_date: '2026-06-22 07:52'
labels:
  - 'kind:epic'
dependencies: []
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Skill 分层测试框架（Layer 0 缺口 + Layer 1 + Layer 3）
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Epic Proposal: Skill Testing Infrastructure — Layer 0 Density Gate + Layer 1 Coverage + Layer 3 Smoke Tests

## Background

BAIME's core delivery assets are SKILL.md files that serve simultaneously as specification documents and executable artifacts. The current `validate-plugin.sh` provides Layer 0 structural checks (`validate_skill_internals`: function coverage, `allowed-tools` completeness, `daemon-version` consistency), Layer 2 contract execution (`validate_contracts`: grep/not-grep assertions), and Layer 1 infrastructure (`run_skill_unit_tests`: auto-discovers `scripts/*.test.js` and `scripts/*.test.sh`). Three quality gaps remain open, each allowing undetected regressions in different skill categories.

**Why these gaps hurt**: When a skill is modified and no automated check fails, the only signal of breakage is a failed human execution. Given that skills like `epic-to-backlog` and `feature-to-backlog` govern the project's task intake pipeline, a silent regression in their approval-round logic or decomposer routing can corrupt the backlog board state in ways that are expensive to diagnose and reverse.

**Layer 0 gap — contracts density check is non-blocking**: `validate-plugin.sh` currently issues a WARNING (not a FAIL) when a skill exceeds 500 lines but has fewer than 3 `contracts:` entries. Of the 25 skills, 4 already trigger this warning (cross-cutting-concerns at 613 lines, documentation-management at 589, methodology-bootstrapping at 654, technical-debt-management at 545 — each with exactly 3 contracts). Beyond those, 13 additional skills between 300–500 lines carry only 3 contracts apiece. Because the check is advisory, adding new large skills with minimal contracts never blocks the pipeline. Upgrading to a blocking FAIL at a lower line threshold (300 lines, ≥4 contracts) closes this gap.

**Layer 1 gap — core skill business logic has no unit tests**: The `run_skill_unit_tests` infrastructure is in place; 12 test files exist (`scripts/` contains 4 daemon-related: `basic-daemon.test.js`, `daemon-routing.test.js`, `daemon-routing-skill.test.sh`, `loop-backlog-daemon.test.js`; and 8 utility tests: `check-roi-gate.test.sh`, `dod-eval.test.sh`, `merge-guard.test.sh`, `review-loop-bg.test.sh`, `skill-lint.test.sh`, `verify-provenance.test.sh`, `verify-subtask-dod.test.sh`, `worker-taskfile-merge.test.sh`). None of these test the branching logic of `epic-to-backlog` (decomposer routing, child-creation gating) or `feature-to-backlog` (approval-round counting, APPROVED-state detection). Both skills have `## Implementation` sections with extractable pure functions, making them the natural candidates for Layer 1 test coverage.

**Layer 3 gap — no behavioral smoke tests exist**: The `scripts/run-smoke-test.sh` script does not exist; no skill has a `smoke/` directory. For high-risk skills that interact with the backlog CLI and git state (`loop-backlog`, `feature-to-backlog`), every major version change is validated entirely by manual execution. A minimal smoke-test harness — fixture repo setup, LLM-free `expect.sh` assertions on observable file/status changes — would provide a repeatable acceptance gate without CI integration.

Together, these three gaps mean that only `loop-backlog` currently receives end-to-end quality gating; the other 24 skills pass validation by satisfying shallow structural and grep-based checks only.

## Goals

1. **[Layer 0 density gate]** `validate-plugin.sh` exits non-zero when any skill exceeds 300 lines and has fewer than 4 `contracts:` entries. The density check is promoted from `WARNINGS` to `ERRORS`. All skills that would fail this upgraded check have their `contracts:` counts brought to ≥4 behavioral assertions in the same child task. Verifiable: `bash scripts/validate-plugin.sh` exits 0 with a skill body >300 lines having exactly 3 contracts removed from the check-skip zone and a dummy "empty-contracts" skill stub exits non-zero.

2. **[Layer 1 skill unit tests]** `epic-to-backlog` and `feature-to-backlog` each have a corresponding `scripts/*.test.sh` (or `.test.js`) covering their key branching logic (decomposer routing for epic-to-backlog; approval-round counting and APPROVED-state detection for feature-to-backlog). `run_skill_unit_tests` discovers and executes both files automatically. Verifiable: `bash scripts/validate-plugin.sh | grep -c "unit test:.*PASS"` returns ≥14 (current 12 + 2 new).

3. **[Layer 3 smoke test harness]** `scripts/run-smoke-test.sh <skill-name>` exists and executes; `loop-backlog` has a `smoke/` directory with `setup.sh`, `scenario.md`, and `expect.sh`; `expect.sh` uses pure shell assertions on observable state changes (git log, backlog task status) in a fixture repo, with no LLM invocation required for the assertions themselves. Verifiable: `bash scripts/run-smoke-test.sh loop-backlog` exits 0 on a clean git repo when fixture state matches expected conditions.

## Decomposition Sketch

- **TASK-A: Layer 0 — promote contracts density check from WARNING to FAIL, lower line threshold to 300, and bring affected skills to ≥4 contracts** — Modify the `validate-plugin.sh` Contract Density Check: change `LINE_THRESHOLD` from 500 to 300, raise `CONTRACT_THRESHOLD` from 3 to 4, and change `sys.exit(warnings)` to contribute to `ERRORS` (not `WARNINGS`). In the same commit, add ≥1 behavioral `contracts:` entry to each of the ~13 skills currently between 300–500 lines with only 3 contracts (e.g., `cross-cutting-concerns`, `documentation-management`, `methodology-bootstrapping`, `technical-debt-management`, `agent-prompt-evolution`, `baseline-quality-assessment`, and peers). This task is independent of TASK-B and TASK-C.

- **TASK-B: Layer 1 — write unit tests for epic-to-backlog and feature-to-backlog branching logic** — Extract the decomposer-routing logic from `epic-to-backlog/SKILL.md` and the approval-round-counting logic from `feature-to-backlog/SKILL.md` into testable shell functions or Node modules; write `scripts/epic-to-backlog.test.sh` and `scripts/feature-to-backlog.test.sh` covering main path and at least one boundary case each. Both files are auto-discovered by `run_skill_unit_tests`. This task is independent of TASK-A and TASK-C.

- **TASK-C: Layer 3 — implement run-smoke-test.sh harness and loop-backlog smoke test** — Create `scripts/run-smoke-test.sh` (sets up a temporary git repo, runs `setup.sh`, invokes the skill as a subagent, runs `expect.sh`); create `plugin/skills/loop-backlog/smoke/` with `setup.sh` (fixture backlog board state), `scenario.md` (one "basic-ready → Basic: Done" scenario), and `expect.sh` (shell assertions: task status equals "Basic: Done", git commit exists). TASK-D depends on this task.

- **TASK-D: Layer 3 — feature-to-backlog smoke test** — Create `plugin/skills/feature-to-backlog/smoke/` with `setup.sh`, `scenario.md`, and `expect.sh` covering the "proposal → APPROVED → plan → APPROVED" two-round convergence scenario. Depends on TASK-C's harness.

## Trade-offs and Risks

**Scope boundary**: This epic does not add new Layer 2 (`contracts:` mechanism) capabilities — that mechanism is fully implemented. It does not add `## Implementation` sections to skills that lack them; the 17 skills without `## Implementation` are out of scope. No new DSL or YAML syntax is introduced.

**Layer 0 threshold risk**: Promoting the density check to a blocking FAIL means the TASK-A child must remediate all affected skills atomically — the validate gate will block merging any partial fix. The implementation plan in TASK-A must complete all skill remediations in the same branch and validate locally before merging.

**Layer 1 extractability risk**: `epic-to-backlog` and `feature-to-backlog` express branching logic in natural-language Markdown, not executable code. The test author must either (a) extract a thin shell-script adapter that calls the real skill in dry-run mode, or (b) write tests against a simplified re-implementation of the logic. Option (b) risks test drift from the actual skill; option (a) requires the skill to expose a testable entry point. The child task must decide and document the chosen approach.

**Layer 3 LLM dependency**: Smoke tests that invoke skills as subagents are inherently non-deterministic and slow (minutes per run). `run-smoke-test.sh` is explicitly NOT integrated into `validate-plugin.sh`; it remains a separately invoked maintenance tool. The `expect.sh` assertions must target observable side-effects (file state, backlog board status) rather than LLM output content.

**Non-goals**: CI automation for smoke tests; mocking the LLM for unit tests; converting any of the 12 existing test files to a different framework.

---

# Epic Plan: Skill 分层测试框架（Layer 0 缺口 + Layer 1 + Layer 3）

## Background

BAIME's SKILL.md files serve as both specification documents and executable artifacts. The existing `validate-plugin.sh` provides Layer 0 structural checks, Layer 2 contract execution, and Layer 1 unit-test infrastructure — but three quality gaps remain open. First, the contracts-density check is advisory (WARNING, not FAIL) and uses a 500-line threshold, so large skills with sparse contracts never block the pipeline. Second, `run_skill_unit_tests` auto-discovers `scripts/*.test.{js,sh}` and already runs 12 test files, but none cover the branching logic of `epic-to-backlog` or `feature-to-backlog` — the two skills that govern task intake. Third, no smoke-test harness (`scripts/run-smoke-test.sh`) or per-skill `smoke/` directories exist, so every major change to high-risk skills is validated only by manual execution. This epic closes all three gaps without introducing new DSL, CI pipelines, or framework dependencies.

## Goals

1. **[Layer 0 density gate]** `validate-plugin.sh` exits non-zero when any skill exceeds 300 lines and has fewer than 4 `contracts:` entries. The density check is promoted from `WARNINGS` to `ERRORS`. All 13 skills currently between 300–654 lines with only 3 contracts are brought to ≥4 behavioral assertions in the same child task.

2. **[Layer 1 skill unit tests]** `epic-to-backlog` and `feature-to-backlog` each gain a `scripts/*.test.sh` covering their key branching logic. `run_skill_unit_tests` auto-discovers both. `bash scripts/validate-plugin.sh | grep -c "unit test:.*PASS"` returns ≥14 (current 12 + 2 new).

3. **[Layer 3 smoke test harness]** `scripts/run-smoke-test.sh <skill-name>` exists and executes; `loop-backlog` has `smoke/setup.sh`, `smoke/scenario.md`, and `smoke/expect.sh` with pure-shell assertions on observable state (git log, backlog task status), no LLM invocation in assertions. `feature-to-backlog` gains an equivalent smoke suite covering the two-round APPROVED convergence scenario.

## Sub-Task Decomposition

1. **Layer 0: promote contracts-density check to blocking FAIL and remediate all affected skills** — Modify `scripts/validate-plugin.sh`: lower `LINE_THRESHOLD` from 500 to 300, raise `CONTRACT_THRESHOLD` from 3 to 4, route density failures to `ERRORS` instead of `WARNINGS`. In the same commit, add ≥1 behavioral `contracts:` entry to each of the 13 affected skills (methodology-bootstrapping 654 lines, cross-cutting-concerns 613, documentation-management 589, technical-debt-management 545, baseline-quality-assessment 473, rapid-convergence 433, agent-prompt-evolution 411, dependency-health 403, knowledge-transfer 383, observability-instrumentation 365, task-to-backlog 358, ci-cd-optimization 348, testing-strategy 324) so `bash scripts/validate-plugin.sh` exits 0 post-change. Sync `plugin/scripts/validate-plugin.sh` copy. DoD: `bash scripts/validate-plugin.sh` exits 0; a temporary stub skill with >300 lines and 3 contracts exits non-zero.

2. **Layer 1: write unit tests for epic-to-backlog and feature-to-backlog branching logic** — Write `scripts/epic-to-backlog.test.sh` exercising decomposer-routing decisions (child-creation gating, phase transitions) and `scripts/feature-to-backlog.test.sh` exercising approval-round counting and APPROVED-state detection; each covers the main path and at least one boundary case. Both are auto-discovered by `run_skill_unit_tests`. The approach (thin dry-run adapter vs. re-implementation) must be decided and documented in the test file header. DoD: `bash scripts/validate-plugin.sh | grep -c "unit test:.*PASS"` returns ≥14.

3. **Layer 3: implement run-smoke-test.sh harness and loop-backlog smoke test** — Create `scripts/run-smoke-test.sh` that accepts a skill name, sets up a temporary git repo, sources `plugin/skills/<skill>/smoke/setup.sh`, invokes the skill as a subagent (LLM call), then runs `plugin/skills/<skill>/smoke/expect.sh`. Create `plugin/skills/loop-backlog/smoke/` with: `setup.sh` (initializes a fixture backlog board with one Basic: Ready task), `scenario.md` (one "basic-ready → Basic: Done" scenario description), and `expect.sh` (shell assertions: task status equals "Basic: Done", at least one new git commit exists). `run-smoke-test.sh` must NOT be wired into `validate-plugin.sh`. DoD: `bash scripts/run-smoke-test.sh loop-backlog` exits 0 on a clean repo with matching fixture state; `bash scripts/validate-plugin.sh` exits 0 (smoke harness not integrated).

4. **Layer 3: feature-to-backlog smoke test** — Create `plugin/skills/feature-to-backlog/smoke/` with `setup.sh` (fixture that places a task at Basic: Proposal), `scenario.md` (two-round "proposal APPROVED → plan APPROVED" convergence scenario), and `expect.sh` (assertions: task reaches Basic: Backlog status, plan field populated). Depends on child 3's harness being merged first. DoD: `bash scripts/run-smoke-test.sh feature-to-backlog` exits 0; `bash scripts/validate-plugin.sh` exits 0.

## Sequencing

- **Children 1 and 2 are fully independent** and may run in parallel in separate worktrees. Neither touches `run-smoke-test.sh` or smoke directories.
- **Children 1, 2, and 3 may all run in parallel** with each other.
- **Child 4 must follow Child 3** — it reuses the `run-smoke-test.sh` harness created in Child 3. Starting Child 4 before the harness is merged would require re-implementing or mocking the entry point.

Recommended execution order:
- Parallel batch 1: Child 1, Child 2, Child 3
- Sequential: Child 4 (after Child 3 merges)

## Constraints

- Every child's DoD must include `bash scripts/validate-plugin.sh` exiting 0 — including Children 3 and 4, which must NOT wire `run-smoke-test.sh` into `validate-plugin.sh`.
- `scripts/run-smoke-test.sh` (Layer 3) must remain a separately invoked tool. It invokes LLM subagents and is non-deterministic. It must never appear in the `run_skill_unit_tests` discovery loop (auto-discovery matches `*.test.js` / `*.test.sh`, not `run-smoke-test.sh`) or any other section of `validate-plugin.sh`.
- Child 1 must remediate all 13 affected skills atomically in a single branch. Partial fixes will block `validate-plugin.sh` from exiting 0 and cannot be merged independently.
- Layer 1 tests (Child 2) must not invoke LLM APIs. If a dry-run adapter approach is chosen, the adapter must be callable without network access and documented in the test file header.
- After each child merges, `plugin/scripts/validate-plugin.sh` must be kept in sync with `scripts/validate-plugin.sh` (copy, not symlink — enforced by the existing plugin/scripts copy-consistency check in `validate-plugin.sh`).
- Scope excludes: adding `## Implementation` sections to skills that lack them; modifying the Layer 2 `contracts:` grep/not-grep mechanism; CI integration of smoke tests; mocking LLMs for unit tests; converting existing test files to a new framework.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Epic proposal review iteration 2: APPROVED

Epic proposal approved. Starting epic plan draft.

Epic plan review iteration 1: APPROVED

cap:propose=approved

epicDecompose: started 2026-06-21T15:05:33Z

cap:decompose=done
epicDecompose: 4 children created at Basic: Backlog. Promote chosen children → Basic: Ready to execute.
Children: TASK-130.1 (Layer 0), TASK-130.2 (Layer 1), TASK-130.3 (Layer 3 framework), TASK-130.4 (Layer 3 ftb smoke, depends 130.3)

退回 Epic: Proposal：原子任务分解已归档，提案需重新评审。

Epic proposal self-review: APPROVED (revision round 1)

Epic proposal approved. Starting epic plan draft.

Epic plan review iteration 1: APPROVED

cap:propose=approved

epicDecompose: started 2026-06-22T04:57:16Z

cap:decompose=done
epicDecompose: 4 children created at Basic: Backlog. Promote chosen children → Basic: Ready to execute.
Children: TASK-143 (Layer 0), TASK-144 (Layer 1), TASK-145 (Layer 3 harness), TASK-146 (Layer 3 ftb smoke, depends TASK-145)

Sub-task TASK-143 reached terminal status: 2026-06-22T05:10:13Z

onChildDone: 1/4 children done (TASK-143). Awaiting TASK-144, TASK-145, TASK-146.

Sub-task TASK-145 reached terminal status: 2026-06-22T05:19:56Z

Sub-task TASK-144 reached terminal status: 2026-06-22T05:22:52Z

Sub-task TASK-146 completed: 2026-06-22T07:42:06Z

cap:evaluate=recommendation:ITERATE | done=4/4 needsHuman=0 dod_pass=false | data_source: measured

RECOMMENDATION: ITERATE.
To finish: set status → Epic: Done.
To iterate: set status → Epic: Proposal or Epic: Plan and re-run /epic-to-backlog.

epicEvaluate diagnosis: R1 guard FAIL is retroactive.
Active children TASK-143~146 are all Basic: Done (executed successfully).
R1 FAIL reason: (1) TASK-143~146 were created before TASK-147 upgraded hasDod() to require ## Phase/### Tests/## Acceptance Gate — they lack that structure. (2) Archived TASK-130.1~4 also scanned (no Phase structure).
Functional outcome: all 4 active children completed their work correctly.
Human decision needed: Epic: Done (accept legacy plan-depth on these tasks) or Epic: Needs Human to investigate.
<!-- SECTION:NOTES:END -->
