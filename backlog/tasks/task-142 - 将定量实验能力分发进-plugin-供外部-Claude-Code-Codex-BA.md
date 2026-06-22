---
id: TASK-142
title: 将定量实验能力分发进 plugin 供外部 Claude Code/Codex + BA
status: 'Epic: Backlog'
assignee: []
created_date: '2026-06-22 04:09'
updated_date: '2026-06-22 04:14'
labels:
  - 'kind:epic'
dependencies: []
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
将定量实验能力分发进 plugin 供外部 Claude Code/Codex + BAIME 用户复用：timing 普适可观测能力、runner 骨架+模板、独立 provenance 门
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Epic Proposal: 将定量实验能力分发进 plugin 供外部 Claude Code/Codex + BAIME 用户复用：timing 普适可观测能力、runner 骨架+模板、独立 provenance 门

## Background

TASK-141 builds the quantitative-experiment capability **inside baime** (dogfood-first): the `cap:experiment` facet, `experiments/skill-quality/lib/runner.ts` (the variant×fixture×model×k accuracy traversal engine), `experiments/skill-quality/lib/timing.ts` (the meta-cc session-log phase-timing extractor), and the standalone `scripts/verify-experiment-provenance.sh` integrity gate. TASK-141 deliberately keeps every component baime-internal and writes them project-agnostic, **explicitly deferring plugin distribution to a follow-up epic** — this one. Today an external Claude Code / Codex + BAIME user who installs the plugin (via `scripts/install/install.sh`'s `rsync -a --delete plugin/`) gets none of these: `runner.ts`/`timing.ts` live under `experiments/` (outside `plugin/`), and `run-quantitative-experiment/SKILL.md` points at `experiments/<domain>/lib/` paths that exist only in the baime repo, so the skill is non-functional in any installed instance. This epic lifts the reusable components into `plugin/` so they ship on install, following the TASK-140 precedent of **real-file copies under `plugin/` (never symlinks, because `rsync -a` preserves symlinks verbatim and leaves dangling links in the install dir) plus a copy-consistency check in `validate-plugin.sh`**. The cross-cutting problem solved: BAIME's experiment-integrity discipline is currently locked inside one repo; distribution makes "measure, don't estimate" a capability every BAIME adopter inherits.

## Goals

1. `timing.ts` ships in `plugin/` as a **universal observability capability**: after `install.sh` runs, an external Claude Code user with session logs can extract real phase-timing from their own meta-cc session data with zero baime-specific setup, verifiably (a smoke invocation against a captured session fixture produces a real-data report, never `data_source: estimated`).

2. `runner.ts` ships in `plugin/` as a **reusable skeleton + a worked template**: an external user can copy the template, supply project-specific fixtures/oracle/scoring, and run a traversal — verified by a template that runs end-to-end against an included toy fixture and produces a results JSON.

3. `verify-experiment-provenance.sh` ships in `plugin/scripts/` as an **opt-in standalone gate**: an installed user can invoke it manually against their experiment artifacts; it is **never auto-wired into their release/business pipeline** (decoupling principle inherited from TASK-141), verified by the gate being absent from any auto-run install hook and documented as manual-invocation-only.

4. A **canonical/copy consistency check** for the newly distributed components is added to `validate-plugin.sh` (extending the existing "plugin/scripts/ Copy Consistency" section), so the `plugin/` copies cannot silently drift from their canonical source — verified by `bash scripts/validate-plugin.sh` failing when a copy is stale or is a symlink.

5. `run-quantitative-experiment/SKILL.md` resolves the harness via the **distributed/plugin path** (REPO_ROOT or plugin dir), not a baime-only `experiments/` path, so the skill is invokable in installed instances — verified by the SKILL referencing the plugin-resolved location and no remaining hardcoded `experiments/skill-quality/lib/` backend path.

6. A short **external-user guide** documents how to use `timing.ts`, the `runner.ts` template, and the provenance gate in a non-baime project — verified by the doc existing under `docs/` and covering all three components with copy-paste invocation examples.

## Decomposition Sketch

- **Distribute `timing.ts` as universal observability** — Decide canonical location, place a real-file copy under `plugin/` (e.g. `plugin/lib/experiment/timing.ts`), add it to the consistency check, and provide a minimal install-resolvable invocation entry. Positioned as the broadest-appeal deliverable (every Claude Code user has session logs).
- **Distribute `runner.ts` skeleton + worked template** — Place a real-file copy of the runner library under `plugin/`, plus a worked template (config + toy fixture + oracle stub) demonstrating the copy-and-customize path for external projects.
- **Distribute `verify-experiment-provenance.sh` as opt-in gate** — Add the gate to `plugin/scripts/` as a real-file copy, extend the `validate-plugin.sh` consistency loop to cover it, and ensure it is documented as manual/opt-in only (no auto-wiring into installed users' pipelines).
- **Add canonical/copy consistency checks for the new TS/bash artifacts** — Extend `validate-plugin.sh` to verify the new `plugin/` copies are real files in sync with canonical sources; resolve the design question (canonical-in-plugin vs canonical-in-experiments with a copy) for the TS harness.
- **Repoint `run-quantitative-experiment/SKILL.md` at the distributed harness** — Replace baime-only `experiments/<domain>/lib/` backend references with a REPO_ROOT/plugin-dir-resolved path so the skill works in installed instances.
- **Write the external-user distribution guide** — A short `docs/` guide covering timing.ts, the runner template, and the opt-in gate for a non-baime project, with copy-paste examples.

## Trade-offs and Risks

**Dependency (explicit)**: This epic **depends on TASK-141 completing first**. The components (`runner.ts`, `timing.ts`, `verify-experiment-provenance.sh`, `cap:experiment`) must exist and be dogfood-validated inside baime before they can be distributed. TASK-142 must not start its implementation children until TASK-141's deliverables are merged.

**Not doing**: We are not changing `install.sh`'s mechanism — it already `rsync -a`'s all of `plugin/`, so placing artifacts under `plugin/` is sufficient and no installer code change is expected (only verification that the new paths are under `plugin/`). We are not making `runner.ts` a turnkey tool — it needs project-specific oracles/fixtures/scoring, so it ships as library + template, not a one-command experiment. We are not auto-wiring the provenance gate into any external user's release pipeline; baime's own opt-in wiring (added in TASK-141) stays a baime editorial choice and is not replicated as an install hook.

**Known risks**: (1) **TS-copy weight** — duplicating a TS harness under `plugin/` is heavier than the bash copies TASK-140 established; the copy may pull transitive deps (`env.ts`/`llm-client.ts`/`score.ts`). Whether canonical-should-live-in-`plugin/` (with baime importing from there) or canonical-in-`experiments/` with a generated copy is **a design question deferred to the plan stage**. (2) **Drift** — more real-file copies means more surfaces to keep in sync; mitigated by extending the consistency check, but the check must enumerate every distributed file. (3) **Path resolution fragility** — the SKILL must resolve the harness in both baime-dev and installed contexts; an incorrect resolution silently breaks the skill only for installed users (not caught by baime's own validation). (4) **timing.ts portability** — its universal-observability claim assumes meta-cc session-log availability/schema stability on the external user's machine; a schema mismatch degrades the headline deliverable.

**Alternatives considered**: Distributing via symlinks (rejected — `rsync -a` preserves them, leaving dangling links post-install; this is exactly why TASK-140 chose real-file copies). Shipping `runner.ts` as a turnkey CLI (rejected — accuracy experiments are irreducibly project-specific; a template is the honest abstraction). Bundling the provenance gate into the install hook (rejected — violates the TASK-141 decoupling principle that experiment integrity must never be imposed on an adopter's business pipeline).

---

# Epic Plan: 将定量实验能力分发进 plugin 供外部 Claude Code/Codex + BAIME 用户复用：timing 普适可观测能力、runner 骨架+模板、独立 provenance 门

## Background

TASK-141 builds the quantitative-experiment capability inside baime (dogfood-first): the `cap:experiment` facet, `experiments/skill-quality/lib/runner.ts` (the variant×fixture×model×k accuracy traversal engine), `experiments/skill-quality/lib/timing.ts` (the meta-cc session-log phase-timing extractor), and the standalone `scripts/verify-experiment-provenance.sh` integrity gate. TASK-141 deliberately keeps every component baime-internal and project-agnostic, explicitly deferring plugin distribution to this follow-up epic.

Today an external Claude Code / Codex + BAIME user who installs the plugin (via `scripts/install/install.sh`'s `rsync -a --delete plugin/`) gets none of these: `runner.ts`/`timing.ts` live under `experiments/` (outside `plugin/`), and `run-quantitative-experiment/SKILL.md` points at `experiments/<domain>/lib/` paths that exist only in the baime repo, so the skill is non-functional in any installed instance. This epic lifts the reusable components into `plugin/` so they ship on install, following the TASK-140 precedent of real-file copies under `plugin/` (never symlinks, because `rsync -a` preserves symlinks verbatim and leaves dangling links in the install dir) plus a copy-consistency check in `validate-plugin.sh` (the `=== plugin/scripts/ Copy Consistency ===` loop at `scripts/validate-plugin.sh:179-197`).

The cross-cutting problem solved: BAIME's experiment-integrity discipline is currently locked inside one repo; distribution makes "measure, don't estimate" a capability every BAIME adopter inherits.

Codebase findings that shape the plan:
- The TS harness has a transitive dependency chain: `runner.ts`/`timing.ts` build on `env.ts` → `llm-client.ts` → `score.ts`, and `env.ts` pulls `dotenv`. Distribution must enumerate and carry this closure, not just two files.
- `plugin/` today has no `lib/` directory; only `plugin/scripts/` holds copied bash/js artifacts (`basic-daemon.js`, `verify-subtask-dod.sh`, `skill-lint.sh`, `validate-plugin.sh`). A new `plugin/lib/experiment/` home for the TS closure must be introduced.
- `install.sh` uses a single `rsync -a --delete "$REPO_ROOT/plugin/" "$INSTALL_DIR/"` — anything placed under `plugin/` ships automatically; no installer code change is required, only verification that new paths live under `plugin/`.
- `SKILL.md` currently hardcodes baime-only paths (`experiments/skill-quality/...`) and offers `lib/ # domain-specific harness (or symlink to shared lib)` guidance that breaks for installed users.

## Goals

1. `timing.ts` ships in `plugin/` as a universal observability capability: after `install.sh`, an external user with meta-cc session logs can extract real phase-timing from their own session data with zero baime-specific setup, verifiably (a smoke invocation against a captured session fixture produces a real-data report, never `data_source: estimated`).
2. `runner.ts` ships in `plugin/` as a reusable skeleton + worked template: an external user can copy the template, supply project-specific fixtures/oracle/scoring, and run a traversal — verified by a template that runs end-to-end against an included toy fixture and produces a results JSON.
3. `verify-experiment-provenance.sh` ships in `plugin/scripts/` as an opt-in standalone gate: invokable manually against experiment artifacts, never auto-wired into an installed user's release/business pipeline — verified by absence from any auto-run install hook and documented as manual-invocation-only.
4. A canonical/copy consistency check for the newly distributed components is added to `validate-plugin.sh` (extending the existing Copy Consistency section), so `plugin/` copies cannot silently drift — verified by `bash scripts/validate-plugin.sh` failing when a copy is stale or is a symlink.
5. `run-quantitative-experiment/SKILL.md` resolves the harness via the distributed/plugin path (REPO_ROOT or plugin dir), not a baime-only `experiments/` path, so the skill is invokable in installed instances — verified by no remaining hardcoded `experiments/skill-quality/lib/` backend path.
6. A short external-user guide documents how to use `timing.ts`, the `runner.ts` template, and the provenance gate in a non-baime project — verified by the doc existing under `docs/` with copy-paste invocation examples covering all three components.

## Sub-Task Decomposition

1. **Resolve canonical layout and establish `plugin/lib/experiment/` + distribute timing.ts** — Decide canonical-in-plugin vs canonical-in-experiments-with-copy for the TS harness (the deferred design question), then realize that decision by placing the timing.ts closure as real-file copies under `plugin/lib/experiment/`, carrying its transitive deps (`env.ts`/`llm-client.ts`/`score.ts` as needed), with an install-resolvable smoke invocation against a captured session fixture proving a non-estimated report. (Goal 1; resolves the layout question all later children depend on.)
2. **Distribute runner.ts skeleton + worked template** — Place the runner library as a real-file copy under the layout chosen in child 1, plus a worked template (config + toy fixture + oracle/scoring stub) demonstrating the copy-and-customize path end-to-end against the toy fixture, producing a results JSON. (Goal 2.)
3. **Distribute verify-experiment-provenance.sh as opt-in gate** — Add the gate to `plugin/scripts/` as a real-file copy, ensuring it is documented and wired as manual/opt-in only with no entry in any auto-run install hook. (Goal 3.)
4. **Extend validate-plugin.sh consistency check for all new artifacts** — Extend the Copy Consistency loop (and/or a parallel TS-copy loop) to enumerate every newly distributed file (timing/runner/dep closure + the provenance gate), asserting each `plugin/` copy is a real file in sync with its canonical source and failing on staleness or symlinks. (Goal 4.)
5. **Repoint run-quantitative-experiment/SKILL.md at the distributed harness** — Replace baime-only `experiments/<domain>/lib/` backend references with a REPO_ROOT/plugin-dir-resolved path so the skill works in installed instances; remove the "symlink to shared lib" guidance that breaks post-install. (Goal 5.)
6. **Write the external-user distribution guide** — A short `docs/` guide covering timing.ts, the runner template, and the opt-in provenance gate for a non-baime project, with copy-paste invocation examples for all three. (Goal 6.)

## Sequencing

- **Hard external dependency**: This epic is BLOCKED on TASK-141. `runner.ts`, `timing.ts`, `verify-experiment-provenance.sh`, and `cap:experiment` do not yet exist in the repo (confirmed: `experiments/skill-quality/lib/` currently holds only `env.ts`/`llm-client.ts`/`score.ts`; the provenance script is absent). No implementation child may start until TASK-141's deliverables are merged and dogfood-validated.
- **Child 1 must go first** — it resolves the canonical-location design question and creates `plugin/lib/experiment/`. Children 2 and 4 consume the layout it establishes.
- After child 1: **child 2** (runner + template) and **child 3** (provenance gate) can proceed in parallel — they touch disjoint paths (`plugin/lib/experiment/` vs `plugin/scripts/`).
- **Child 4** (consistency check) should land after the files it must enumerate exist, i.e. after children 1–3; it can be folded incrementally as each artifact lands, but its final enumeration is gated on all three being placed.
- **Child 5** (SKILL repoint) depends on the chosen layout from child 1 but is otherwise independent; can run in parallel with 2/3/4.
- **Child 6** (guide) is last — it documents the finalized invocation paths for all three components.

## Constraints

1. Distributed copies MUST be real files, not symlinks — `rsync -a` preserves symlinks verbatim, leaving dangling links in the install dir. This follows the TASK-140 precedent exactly.
2. Canonical/copy consistency MUST be enforced by extending the `validate-plugin.sh` Copy Consistency check; every distributed file (TS closure + provenance gate) must be individually enumerated so no copy can silently drift.
3. The provenance gate ships opt-in: it MUST NOT be auto-wired into an external user's release/business pipeline or any auto-run install hook, and MUST be documented as manual-invocation-only (decoupling principle inherited from TASK-141).
4. `timing.ts` is positioned as the universal observability deliverable (broadest appeal — every Claude Code user has session logs); `runner.ts` ships as skeleton + template, NOT a turnkey one-command experiment, because accuracy experiments are irreducibly project-specific.
5. This epic is BLOCKED on TASK-141: all distributed components must exist and be dogfood-validated inside baime before distribution begins.
6. The canonical-location question (canonical-in-plugin vs canonical-in-experiments-with-copy) MUST be resolved early — within the scope of the first child — because the placement of every later TS artifact and the consistency check depend on the chosen layout.
7. No change to `install.sh`'s mechanism is expected: placing artifacts under `plugin/` is sufficient (it already `rsync -a`'s all of `plugin/`); the work is limited to verifying new paths live under `plugin/`.
8. The TS distribution MUST carry the full transitive dependency closure (`env.ts`/`llm-client.ts`/`score.ts` and the `dotenv` requirement) — distributing `runner.ts`/`timing.ts` alone would leave the harness non-functional post-install.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Epic proposal self-review: APPROVED

Epic proposal approved. Starting epic plan draft.

Epic plan review iteration 1: APPROVED

cap:propose=approved

依赖:本 epic BLOCKED on TASK-141（组件须先在 baime 内部建好,才能分发进 plugin）。计划推进顺序:先完成 TASK-141 并验证,再启动 TASK-142。
<!-- SECTION:NOTES:END -->
