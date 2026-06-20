---
id: TASK-93.14.3
title: >-
  Update run-quantitative-experiment SKILL.md contract and add end-to-end
  integration test for replicate+compare pipeline
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:53'
labels:
  - experiment
  - skill-extension
  - Exp-K
  - testing
dependencies:
  - TASK-93.14.1
  - TASK-93.14.2
parent_task_id: TASK-93.14
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the SKILL.md contract for run-quantitative-experiment to document the --replicate and --compare flags, their input/output schemas, and the results-replicated.json / results-comparison.md artifacts. Add an end-to-end integration test that exercises the full replicate+compare pipeline: run an experiment, replicate it, compare results, and assert the comparison report contains a convergence summary with STABLE/DIVERGED verdicts. Validate with bash scripts/validate-plugin.sh.

**Why:** SKILL.md is the authoritative contract that loop-backlog and loop-meta use to understand skill capabilities. Without documenting the new flags, the skill is invisible to automation. The integration test ensures the pipeline works end-to-end and guards against regressions.

**Parent goal (TASK-93.14):** This sub-task closes the loop: the skill is only complete when its contract is documented and the full pipeline is tested. It depends on TASK-93.14.1 (--replicate) and TASK-93.14.2 (--compare) being implemented.

**Depends on:** TASK-93.14.1, TASK-93.14.2

## Implementation Plan

### Phase 1: Update SKILL.md contract
Add sections to plugin/skills/run-quantitative-experiment/SKILL.md documenting: (a) --replicate flag syntax, inputs, outputs, and error cases; (b) --compare flag syntax, inputs, outputs (results-comparison.md schema), and error cases; (c) the full pipeline invocation example (run → replicate → compare).

DoD:
- `grep -q "\-\-replicate" plugin/skills/run-quantitative-experiment/SKILL.md`
- `grep -q "\-\-compare" plugin/skills/run-quantitative-experiment/SKILL.md`
- `grep -q "results-comparison" plugin/skills/run-quantitative-experiment/SKILL.md`
- `grep -q "convergence" plugin/skills/run-quantitative-experiment/SKILL.md`

### Phase 2: Write end-to-end integration test
Create a test script (e.g., plugin/skills/run-quantitative-experiment/tests/test-replicate-compare-e2e.sh) that: (1) runs the skill on a minimal fixture config to produce results.json, (2) runs --replicate to produce results-replicated.json, (3) runs --compare to produce results-comparison.md, (4) asserts results-comparison.md exists and contains a STABLE/DIVERGED verdict and a convergence summary.

DoD:
- `test -f plugin/skills/run-quantitative-experiment/tests/test-replicate-compare-e2e.sh`
- `bash plugin/skills/run-quantitative-experiment/tests/test-replicate-compare-e2e.sh`

### Phase 3: Validate full plugin
Run the project validation gate to confirm all contracts and tests pass.

DoD:
- `bash scripts/validate-plugin.sh`

## Constraints
- SKILL.md must remain the single source of truth for skill interface; no duplicate docs
- Integration test must be self-contained and idempotent (clean up temp files on exit)
- Test must not require network access
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q "convergence" plugin/skills/run-quantitative-experiment/SKILL.md
- [ ] #3 test -f plugin/skills/run-quantitative-experiment/tests/test-replicate-compare-e2e.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.14
<!-- SECTION:NOTES:END -->
