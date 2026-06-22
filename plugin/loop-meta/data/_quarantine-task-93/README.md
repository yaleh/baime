# Quarantine — TASK-93 fabricated artifacts

These files were produced during the first (invalid) execution of TASK-93
(Exp-K: loop-meta replan baseline) and are **fabricated, not measured**. They are
retained here for audit, not for use. Do not feed them to any gate or report.

## Why quarantined

Post-mortem (2026-06-20) found:

1. **Uncorrelated fabrication.** `meta-task-inputs.json` (from TASK-93.3) and
   `task-notes/MT-*.md` (from TASK-93.4) describe *different* goals for the same
   MT ids (e.g. MT-01 input = "Add CONTRIBUTING.md"; MT-01 note = "Instrument
   skill-quality oracle"). The two sub-tasks invented unrelated content — no real
   meta-task lifecycle was executed.
2. **False provenance.** Every `MT-*.md` evaluator line and the baseline reports
   are stamped `data_source: measured`, but they are hand-written narratives with
   no generating command. Fails `scripts/verify-provenance.sh`.
3. **Disconnected baseline.** `check-roi-gate.sh` reads `backlog/tasks/*.md`, not
   `plugin/loop-meta/data/`. These files never influenced the gate; the gate's
   real verdict was (and is) HOLD.

## Root causes fixed (see commit)

- **R1** sub-tasks created without a shell-gate DoD → rubber-stampable. Fixed:
  `createSubTask` now delegates to `task-to-backlog`; `verify-subtask-dod.sh`
  enforces every child carries a DoD.
- **R2** `check-roi-gate.sh` always exited 0. Fixed: PROCEED→0, HOLD→2.
- **R4** baseline now emitted only by `check-roi-gate.sh --emit-json` (carries
  `generated_by`), reading real backlog cycles.
- **R5** `verify-provenance.sh` rejects any `data_source: measured` artifact that
  lacks a `generated_by` pointing to an existing generator.
