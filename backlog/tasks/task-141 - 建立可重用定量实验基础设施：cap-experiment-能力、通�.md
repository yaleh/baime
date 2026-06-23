---
id: TASK-141
title: '建立可重用定量实验基础设施：cap:experiment 能力、通�'
status: 'Epic: Done'
assignee: []
created_date: '2026-06-22 03:13'
updated_date: '2026-06-23 06:24'
labels:
  - 'kind:epic'
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
建立可重用定量实验基础设施：cap:experiment 能力、通用 runner/timing harness、发行门集成
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Epic Proposal: 建立可重用定量实验基础设施：cap:experiment 能力、通用 runner/timing harness、发行门集成

## Background

The project has conducted eight LLM accuracy experiments (Exp-A through Exp-H) and at least one pipeline timing experiment (TASK-134 type). Every experiment was implemented as a hand-written `run-exp-X.ts` script — each script re-implements the same traversal loop, checkpoint/resume logic, fixture loading, scoring, and JSON write-back from scratch. The `run-quantitative-experiment` SKILL exists and specifies the correct epistemic protocol (pre-registration, k=5 multi-model, `[measured]/[soft]` annotation), but was never invoked because it provides no executable backend more convenient than hand-coding. For pipeline timing experiments, phase durations were derived by manual estimation from memory (noted explicitly in `docs/experiments/ftb-phase-timing-baseline.md`: "TASK-132 planLoop total is estimated", "TASK-134 finalise end time is estimated from contextual evidence"). No automated harness exists to extract timestamps from meta-cc session logs. The gap has two compounding effects: (1) each new experiment costs 2–4 days of harness scaffolding instead of fixture design; (2) timing claims carry only `[soft]` confidence because there is no structural barrier to estimation. This epic eliminates both problems by building shared infrastructure that makes the correct path the easy path.

## Goals

1. A `cap:experiment` frontmatter facet is defined, documented, and recognized by `verify-cap-markers.sh`, so that any `kind:basic` experiment task in the backlog carries a machine-readable completion marker (`cap:experiment=CONFIRMED|NULL|REJECTED|UNDERPOWERED`) verifiable by `validate-plugin.sh`.

2. `experiments/lib/runner.ts` exists and is used by at least one refactored experiment script, implementing the full variant×fixture×model×k traversal with checkpoint/resume, so that a new experiment requires only fixture JSON files and a config object — not a new `run-exp-X.ts` boilerplate file.

3. `experiments/lib/timing.ts` exists and produces a phase-timing report by querying meta-cc `query_timestamps`/`query_tools` data, replacing manual estimation for all future pipeline timing experiments (the structural constraint: the module cannot produce `data_source: estimated` output).

4. A **standalone, opt-in** experiment-integrity gate `scripts/verify-experiment-provenance.sh` exists and enforces two checks on experiment artifacts only: (a) a pre-registration timestamp check (experiment `hypotheses.md` git commit is earlier than first LLM call timestamp in artifacts); (b) a `data_source: estimated` FAIL gate that blocks results files carrying estimated rather than session-log-derived data. The gate is a **no-op when no experiment artifacts/`cap:experiment` tasks exist** (so it imposes zero cost on non-experiment projects). `validate-plugin.sh` becomes merely **one opt-in caller** of this gate — baime's own editorial choice to make experiment integrity a release precondition — not logic baked into the release gate itself.

5. The `run-quantitative-experiment` SKILL.md is updated to be a thin orchestration layer over `runner.ts`, with its contracts updated to reference the shared backend, so that the SKILL is actually invokable as intended.

## Decomposition Sketch

- **TASK-141-A: Define `cap:experiment` capability facet** — Add `cap:experiment` to the capability vocabulary: specify allowed values (`CONFIRMED|NULL|REJECTED|UNDERPOWERED`), update `verify-cap-markers.sh` to recognize and validate it, and document the assignment rules in the existing cap-markers docs.

- **TASK-141-B: Build `experiments/lib/runner.ts` generic experiment runner** — Implement the shared variant×fixture×model×k traversal engine with checkpoint/resume; expose a typed `runExperiment(config)` API; include unit tests covering checkpoint logic and fixture loading edge cases.

- **TASK-141-C: Refactor at least one existing `run-exp-X.ts` onto `runner.ts`** — Port `run-exp-h.ts` (the most recent and largest script, 22 KB) to use `runner.ts` as a proof-of-concept, verifying the API is sufficient and the output is byte-identical to the prior run.

- **TASK-141-D: Build `experiments/lib/timing.ts` session-log timing extractor** — Implement the meta-cc `query_timestamps`/`query_tools` query pipeline that extracts real phase boundaries; add a structural assertion that prevents `data_source: estimated` in any output file; add unit tests against a captured session fixture.

- **TASK-141-E: Build standalone `verify-experiment-provenance.sh` gate + wire it into validate-plugin.sh** — Create `scripts/verify-experiment-provenance.sh` as a self-contained, scoped gate: (a) pre-registration timestamp check comparing `hypotheses.md` git commit timestamp vs earliest artifact timestamp, (b) `data_source: estimated` FAIL gate for files under `experiments/*/artifacts/`. The gate exits 0 (no-op) when no experiment artifacts exist. Then add a single line to `scripts/validate-plugin.sh` that invokes it (baime's opt-in choice), keeping `plugin/scripts/validate-plugin.sh` copy in sync.

- **TASK-141-F: Refactor `run-quantitative-experiment` SKILL to thin orchestration layer** — Update SKILL.md to describe `runner.ts` as the executable backend, replace the hand-coded lifecycle prose with references to the shared library API, and update SKILL contracts to verify the backend integration.

## Trade-offs and Risks

**Not doing**: We are not building a new daemon, new task status, or new review loop. We are not replacing the existing `kind:basic` workflow for experiment tasks — `cap:experiment` is an additional capability marker, not a new task type. We are not automatically migrating all existing `run-exp-A.ts` through `run-exp-G.ts` scripts (only Exp-H is ported as proof-of-concept; older scripts remain usable). **We are not distributing the harness (`runner.ts`/`timing.ts`) into `plugin/` in this epic** — the capability is built and dogfooded inside baime first (BAIME's "prove it on yourself before exporting" philosophy); plugin-distribution for external Claude Code / Codex + BAIME users is a deliberate follow-up epic. **We are not coupling experiments to anyone's business/release pipeline by default** — the integrity gate is standalone and opt-in; baime wiring it into its own release gate is baime's editorial choice, not a pattern imposed on BAIME adopters.

**Known risks**: (1) `runner.ts` API must be genuinely simpler than hand-coding — if the generic API adds more ceremony than it saves, experimenters will continue hand-coding. The Exp-H port in TASK-141-C serves as the usability gate. (2) `timing.ts` depends on meta-cc session log availability and schema stability; if the meta-cc MCP tool changes its output format, timing extraction breaks silently. This should be mitigated with a schema version check. (3) The pre-registration timestamp gate in validate-plugin.sh requires that experiment artifact timestamps are reliably set by the experiment runner, not by git — this needs explicit documentation in runner.ts.

**Alternatives considered**: Adding a new `kind:experiment` task type was rejected (meta task lesson: don't create new types for new behaviors). Using a separate experiment daemon was rejected (same reason). Keeping estimation in timing reports was rejected because the structural constraint (timing.ts cannot produce estimates) is the entire epistemic value of the module.

---

# Epic Plan: 建立可重用定量实验基础设施：cap:experiment 能力、通用 runner/timing harness、发行门集成

## Background

The project has conducted eight LLM accuracy experiments (Exp-A through Exp-H) and at least one pipeline timing experiment. Every experiment was implemented as a hand-written `run-exp-X.ts` script — each re-implements the same traversal loop, checkpoint/resume logic, fixture loading, scoring, and JSON write-back from scratch. The `experiments/skill-quality/lib/` directory currently contains three shared modules (`env.ts`, `llm-client.ts`, `score.ts`) but no generic runner or timing extractor. The `run-quantitative-experiment` skill (at `plugin/skills/run-quantitative-experiment/SKILL.md`) specifies the correct epistemic protocol but has no executable backend more convenient than hand-coding. For pipeline timing experiments, phase durations have been derived by manual estimation, as documented in `docs/experiments/ftb-phase-timing-baseline.md`. The `cap:experiment` facet does not exist in the current `verify-cap-markers.sh` vocabulary; existing cap: markers cover process-level facets (`cap:propose`, `cap:plan`, `cap:decompose`, `cap:execute`, `cap:evaluate`) but nothing experiment-domain-specific.

This epic eliminates both the per-experiment scaffolding cost and the estimation-in-timing-reports problem by building shared infrastructure that makes the correct epistemic path the easy path.

## Goals

1. A `cap:experiment` frontmatter facet is defined, documented, and recognized by `verify-cap-markers.sh`, so that any `kind:basic` experiment task carries a machine-readable completion marker (`cap:experiment=CONFIRMED|NULL|REJECTED|UNDERPOWERED`) verifiable by `validate-plugin.sh`.

2. `experiments/lib/runner.ts` exists and is used by at least one refactored experiment script, implementing the full variant×fixture×model×k traversal with checkpoint/resume, so that a new experiment requires only fixture JSON files and a config object — not a new `run-exp-X.ts` boilerplate file.

3. `experiments/lib/timing.ts` exists and produces a phase-timing report by querying meta-cc `query_timestamps`/`query_tools` data, replacing manual estimation for all future pipeline timing experiments (structural constraint: the module cannot produce `data_source: estimated` output).

4. A **standalone, opt-in** gate `scripts/verify-experiment-provenance.sh` enforces two checks scoped to experiment artifacts only: (a) a pre-registration timestamp check (experiment `hypotheses.md` git commit earlier than first LLM call timestamp in artifacts); (b) a `data_source: estimated` FAIL gate blocking results files with estimated rather than session-log-derived data. The gate is a **no-op when no experiment artifacts exist**. `validate-plugin.sh` becomes **one opt-in caller** of this gate (baime's editorial choice), not the home of the logic — so the experiment-integrity concern stays decoupled from the release/business pipeline for BAIME adopters.

5. The `run-quantitative-experiment` SKILL.md is updated to be a thin orchestration layer over `runner.ts`, with its contracts updated to reference the shared backend, so that the SKILL is actually invokable as intended.

## Sub-Task Decomposition

1. **TASK-141-A: Define `cap:experiment` capability facet** — Add `cap:experiment` to the cap: vocabulary with allowed values `CONFIRMED|NULL|REJECTED|UNDERPOWERED`; update `scripts/verify-cap-markers.sh` to validate the facet's presence and value on experiment tasks; add assignment-rules documentation to the existing cap-markers docs.

2. **TASK-141-B: Build `experiments/lib/runner.ts` generic experiment runner** — Implement the shared variant×fixture×model×k traversal engine with checkpoint/resume in `experiments/skill-quality/lib/runner.ts` (co-located with existing `env.ts`/`llm-client.ts`/`score.ts`); expose a typed `runExperiment(config)` API; include unit tests covering checkpoint logic and fixture-loading edge cases.

3. **TASK-141-C: Port `run-exp-h.ts` onto `runner.ts` as proof-of-concept** — Refactor `experiments/skill-quality/exp-h/run-exp-h.ts` (609 lines) to delegate traversal/checkpoint/scoring to `runner.ts`, verifying the API is sufficient and that output is byte-identical to the prior run; this serves as the usability gate for the shared backend.

4. **TASK-141-D: Build `experiments/lib/timing.ts` session-log timing extractor** — Implement the meta-cc `query_timestamps`/`query_tools` query pipeline that extracts real phase boundaries; add a structural assertion that raises an error (rather than emitting `data_source: estimated`) when session data is unavailable; add unit tests against a captured session fixture.

5. **TASK-141-E: Build standalone `verify-experiment-provenance.sh` gate + wire it into validate-plugin.sh** — Create `scripts/verify-experiment-provenance.sh` as a self-contained, scoped gate: (a) pre-registration timestamp check comparing `hypotheses.md` git commit timestamp vs earliest artifact timestamp under `experiments/*/artifacts/`; (b) FAIL gate rejecting any results file under `experiments/*/artifacts/` containing `data_source: estimated`. The gate exits 0 (no-op) when no experiment artifacts are present, so it imposes zero cost on non-experiment use. Then add a single invocation line to `scripts/validate-plugin.sh` (and keep `plugin/scripts/validate-plugin.sh` copy in sync) — validate-plugin is a *caller*, not the owner, of the experiment-integrity logic. Include a unit test for the gate's no-op and FAIL paths under `scripts/tests/`.

6. **TASK-141-F: Refactor `run-quantitative-experiment` SKILL to thin orchestration layer** — Update `plugin/skills/run-quantitative-experiment/SKILL.md` to describe `runner.ts` as the executable backend, replace the hand-coded lifecycle prose with references to the shared library API, and update the skill's `contracts:` block to verify backend integration points.

## Sequencing

**TASK-141-A** (cap:experiment facet) is independent of all implementation children and can proceed in parallel with any other child. It only touches `scripts/verify-cap-markers.sh` and docs.

**TASK-141-B** (runner.ts) must land before **TASK-141-C** (exp-h port), since the port depends on the runner API being stable. TASK-141-B can proceed in parallel with TASK-141-A and TASK-141-D.

**TASK-141-C** (exp-h port) must follow TASK-141-B. It serves as the integration test for runner.ts and should be merged before TASK-141-F updates the SKILL to reference the backend.

**TASK-141-D** (timing.ts) is independent of the runner.ts chain. It can proceed in parallel with TASK-141-B and TASK-141-C. TASK-141-D does not block TASK-141-E (the gate can be added before timing.ts is complete), but the gate is only meaningful once timing.ts enforces the constraint structurally — so TASK-141-D should land before or alongside TASK-141-E.

**TASK-141-E** (standalone provenance gate + validate-plugin wiring) can begin once the structural constraint is understood from TASK-141-D's design. It can land in parallel with TASK-141-D but after its schema is known. Because the gate is standalone, its core logic does not depend on validate-plugin internals — only the final one-line wiring does.

**TASK-141-F** (SKILL refactor) must follow TASK-141-C (to have a working backend to reference) and should follow TASK-141-A (to correctly reference the cap:experiment facet in the updated contracts).

Recommended execution order:
- Parallel batch 1: TASK-141-A, TASK-141-B, TASK-141-D
- Parallel batch 2: TASK-141-C (after B), TASK-141-E (after D's schema is known)
- Final: TASK-141-F (after A and C)

## Constraints

1. No new task `kind` or daemon event channel is introduced. `cap:experiment` is an additional capability marker facet on existing `kind:basic` tasks, not a new task type.

2. `experiments/lib/timing.ts` must structurally prevent `data_source: estimated` output — this is enforced by raising an error, not by a lint check. The structural constraint is the epistemic value of the module.

3. The pre-registration gate in TASK-141-E must rely on artifact timestamps set by `runner.ts`, not by git checkout time. `runner.ts` must document this explicitly.

4. Only `run-exp-h.ts` is ported in this epic (TASK-141-C). Scripts `run-exp-a.ts` through `run-exp-g.ts` remain usable as-is; no forced migration.

5. Both `scripts/validate-plugin.sh` and `plugin/scripts/validate-plugin.sh` must be kept in sync whenever either is modified (existing convention in the codebase).

6. The `runner.ts` API usability gate: if the Exp-H port (TASK-141-C) reveals that the generic API adds more ceremony than it saves, TASK-141-F must not proceed until the API is fixed. TASK-141-C is the explicit usability checkpoint.

7. **Decoupling principle (experiment integrity ≠ release/business pipeline)**: the experiment-integrity gate (TASK-141-E) validates *experiments*, not *releases*. It MUST be standalone (`verify-experiment-provenance.sh`), scoped to experiment artifacts, and a no-op when none exist. A project MAY choose to make passing experiments a release precondition (baime does, via one wiring line in validate-plugin.sh), but the capability MUST NOT assume or impose that on BAIME adopters. No experiment logic is to be inlined into validate-plugin.sh.

8. **Reusability as design constraint; distribution as follow-up**: `runner.ts`, `timing.ts`, and `verify-experiment-provenance.sh` MUST be written to be project-agnostic (no baime-specific paths hard-coded beyond configurable roots), so a later epic can lift them into `plugin/` for external Claude Code / Codex + BAIME users with minimal change. Actual `plugin/` distribution (and any canonical/copy consistency like the TASK-140 `plugin/scripts/` pattern) is **out of scope** for this epic — it is dogfood-first. `timing.ts` (meta-cc session-log timing) is the most broadly reusable component and should be kept cleanest for that future lift.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Epic proposal self-review: APPROVED

Epic proposal approved. Starting epic plan draft.

Epic plan review iteration 1: APPROVED

cap:propose=approved

2026-06-22 设计修订（讨论驱动，决策:先自举+解耦）:
- Goal 4 / TASK-141-E 从「写进 validate-plugin」改为「独立 opt-in 门 verify-experiment-provenance.sh + validate-plugin 仅作单行调用方」。实验完整性门校验实验、不校验发行;无实验产物时为 no-op,对非实验项目零成本。
- 新增约束 7（解耦原则）:实验完整性 ≠ 发行/业务管道;baime 把它接进自己发行门是编辑选择,不强加给 BAIME 采纳者。
- 新增约束 8（可重用性为设计约束、分发为后续 epic）:runner/timing/gate 写成项目无关,plugin 分发(及 canonical/copy 一致性)留作 dogfood 后的后续 epic;timing.ts 因普适性最高,保持最干净以便未来 lift。

cap:decompose=started 2026-06-22T11:50:00Z

cap:decompose=done
epicDecompose: 6 children created at Basic: Backlog. Promote chosen children → Basic: Ready to execute.

Sub-task TASK-153 completed: 2026-06-22T12:03:49Z

onChildDone: 1/6 children done

Sub-task TASK-156 completed: 2026-06-22T12:11:05Z

onChildDone: 2/6 children done

Sub-task TASK-154 completed: 2026-06-22T12:12:55Z

onChildDone: 3/6 children done

Sub-task TASK-157 reached terminal status: 2026-06-22T12:20:53Z

Sub-task TASK-158 reached terminal status: 2026-06-22T12:24:43Z

Sub-task TASK-155 reached terminal status: 2026-06-22T12:27:35Z

cap:evaluate=recommendation:FINISH | done=6 needsHuman=0 | all children Basic: Done with DoD pass | data_source: measured

RECOMMENDATION: FINISH.
To finish: set status → Epic: Done.
To iterate: set status → Epic: Proposal or Epic: Plan and re-run /epic-to-backlog.

2026-06-23 手动关闭：全部 6 个子任务 Basic: Done，evaluator 输出 RECOMMENDATION: FINISH。
<!-- SECTION:NOTES:END -->
