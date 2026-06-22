---
id: TASK-158
title: >-
  TASK-141-F: Refactor `run-quantitative-experiment` SKILL to thin orchestration
  layer
status: 'Basic: Done'
assignee: []
created_date: '2026-06-22 11:59'
updated_date: '2026-06-22 12:24'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-141
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update plugin/skills/run-quantitative-experiment/SKILL.md to reference runner.ts as the executable backend; replace hand-coded lifecycle with shared library API; update contracts. Parent: TASK-141.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Refactor `run-quantitative-experiment` SKILL to thin orchestration layer

## Background

The `run-quantitative-experiment` SKILL (`plugin/skills/run-quantitative-experiment/SKILL.md`, 174 lines) specifies the correct epistemic protocol for quantitative experiments but has never been successfully invoked as a skill because it describes a hand-coded lifecycle — Phase 1 through Phase 5 — with no executable backend. The actual experiment execution has always been done by hand-writing `run-exp-X.ts` scripts from scratch, ignoring the SKILL entirely. After TASK-141-B builds `runner.ts` and TASK-141-C proves the API is viable via the Exp-H port, the SKILL must be updated to reference `runner.ts` as the executable backend. Without this update, the SKILL remains a specification document rather than an invokable skill, and experimenters will continue bypassing it. The update also requires adding a `cap:experiment` reference (from TASK-141-A) to the SKILL's contracts block, ensuring the skill's output vocabulary matches the new backlog marker system.

## Goals

1. `plugin/skills/run-quantitative-experiment/SKILL.md` Phase 3 (Execute) section references `experiments/skill-quality/lib/runner.ts` as the executable backend, with the `runExperiment(config: ExperimentConfig)` API call replacing the hand-coded traversal description.
2. The `contracts:` block in the SKILL frontmatter is updated to add a contract verifying that `runner.ts` integration is present: `grep: "runExperiment"` targeting self.
3. The `cap:experiment` facet (values: `CONFIRMED|NULL|REJECTED|UNDERPOWERED`) is referenced in the SKILL's verdict/write-back section, linking the SKILL output to the backlog marker vocabulary introduced by TASK-141-A.
4. `validate-plugin.sh` passes after the update (all existing contracts still satisfied, no new contract violations).

## Proposed Approach

Edit `plugin/skills/run-quantitative-experiment/SKILL.md` in two targeted changes: (1) in the `## lifecycle` section under Phase 3 — Execute, replace the hand-written traversal description with a reference to `runExperiment(config)` from `experiments/skill-quality/lib/runner.ts`, noting the config fields (variants, modelList, k, outDir, buildPrompt, sanityDir); (2) add a new contract `grep: "runExperiment"` to the `contracts:` block in frontmatter; (3) in the Phase 5 — Write-back section or the `## integration` section, add a note that the experiment completion marker `cap:experiment=<verdict>` should be set on the backlog task after write-back. The `[measured]/[soft]` annotation rules and all five existing contracts remain unchanged.

## Trade-offs and Risks

Not doing: We are not rewriting the entire SKILL from scratch. We are not changing the `λ spec` section or the epistemic contracts (hypotheses, CONFIRMED, [measured], evidence_pointer). We are not making `cap:experiment` mandatory for all experiments run before this task lands. Risk: if TASK-141-C reveals the `runner.ts` API needs revision, this task must be blocked until the API stabilizes — this is documented in TASK-141-C as the usability gate. Risk: adding a new `contracts: grep: "runExperiment"` contract will cause `validate-plugin.sh` to fail until the SKILL body actually references `runExperiment` — so the contract and the body reference must be added in the same commit.

---

# Plan: Refactor `run-quantitative-experiment` SKILL to thin orchestration layer

Proposal: docs/proposals/proposal-epic-capability-model.md

## Phase A: Update Phase 3 body to reference runner.ts API and add runExperiment contract

### Tests (write first)
- Verify current state (tests that should FAIL before implementation, PASS after):
  1. `! grep -q 'runExperiment' plugin/skills/run-quantitative-experiment/SKILL.md` — currently passes (no reference); after implementation should FAIL (reference exists)
  2. `grep -q 'runExperiment' plugin/skills/run-quantitative-experiment/SKILL.md` — currently fails; after implementation should PASS
  3. `bash scripts/validate-plugin.sh` — must pass after the change (new contract satisfied)

### Implementation
- `plugin/skills/run-quantitative-experiment/SKILL.md`:
  - In `## lifecycle` Phase 3 — Execute: add a subsection "### Executable backend" referencing `experiments/skill-quality/lib/runner.ts` and `runExperiment(config: ExperimentConfig)` with a description of the config fields
  - In `contracts:` frontmatter block: add `- grep: "runExperiment"` entry (after existing contracts)

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'runExperiment' plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q 'contracts:' plugin/skills/run-quantitative-experiment/SKILL.md`

## Phase B: Add cap:experiment reference to write-back section

### Tests (write first)
- 1. `grep -q 'cap:experiment' plugin/skills/run-quantitative-experiment/SKILL.md` — currently fails; after implementation should PASS
- 2. `bash scripts/validate-plugin.sh` — must still pass after this addition

### Implementation
- `plugin/skills/run-quantitative-experiment/SKILL.md`:
  - In `## lifecycle` Phase 5 — Write-back (or integration section): add a step "Set `cap:experiment=<verdict>` on the backlog task (where `<verdict>` is one of `CONFIRMED|NULL|REJECTED|UNDERPOWERED`) after the `evidence_pointer` write-back is complete"
  - This links the SKILL output vocabulary to the `cap:experiment` facet defined in TASK-141-A

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'cap:experiment' plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q 'CONFIRMED\|NULL\|REJECTED\|UNDERPOWERED' plugin/skills/run-quantitative-experiment/SKILL.md`

## Constraints
- TASK-141-A (cap:experiment facet) must be merged before Phase B
- TASK-141-C (Exp-H port as usability gate) must be merged before Phase A — runner.ts API must be stable
- All five existing contracts (`hypotheses`, `CONFIRMED`, `[measured]`, `evidence_pointer`, `not-grep V_instance`) must remain in the SKILL and continue passing
- The `runExperiment` contract and the body reference must be added atomically (same commit) to prevent validate-plugin.sh failure windows

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'runExperiment' plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q 'cap:experiment' plugin/skills/run-quantitative-experiment/SKILL.md`
- [ ] `grep -q 'ExperimentConfig' plugin/skills/run-quantitative-experiment/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal self-review: APPROVED
Plan review iteration 1: APPROVED
premise-ledger:
[E] goal coverage: goal 1 (runner.ts reference) in Phase A; goal 2 (runExperiment contract) in Phase A; goal 3 (cap:experiment reference) in Phase B; goal 4 (validate-plugin passes) in both phases' DoD
[E] TDD structure: both phases have Tests (write first — grep assertions that verify pre/post state) + Implementation + DoD sections
[E] DoD executability: all DoD items are shell commands
[E] acceptance gate: first item is bash scripts/validate-plugin.sh matching CFG_TEST_ALL
[C] file paths: plugin/skills/run-quantitative-experiment/SKILL.md confirmed to exist (174 lines, read above)
[E] phase ordering: Phase A (runner.ts + contract) before Phase B (cap:experiment) — correct; Phase B depends on TASK-141-A which is a different task (documented in Constraints)
[H] DoD sufficiency: grep-based checks are strong for a SKILL.md update; no compiled code so no compilation check needed
GCL-self-report: E=5 C=1 H=1

claimed: 2026-06-22T12:21:08Z

## Execution Summary
Result: Done
Commit: 5a3796c

Completed: 2026-06-22T12:24:42Z
## Execution Summary
Result: Done
Commit: 8a66a32844c0e8197fb7f1b64519ae1da1d64192
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'runExperiment' plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #3 grep -q 'cap:experiment' plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #4 grep -q 'ExperimentConfig' plugin/skills/run-quantitative-experiment/SKILL.md
<!-- DOD:END -->
