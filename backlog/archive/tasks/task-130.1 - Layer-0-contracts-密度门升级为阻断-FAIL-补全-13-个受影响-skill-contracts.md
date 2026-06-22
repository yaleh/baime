---
id: TASK-130.1
title: 'Layer 0: contracts 密度门升级为阻断 FAIL + 补全 13 个受影响 skill contracts'
status: 'Basic: Backlog'
assignee: []
created_date: '2026-06-21 15:06'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-130
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background
TASK-130 targets a three-layer skill testing framework. Layer 0 currently has a contracts density check that emits only a WARNING and uses a threshold of 500 lines, meaning skills with sparse behavioral contracts are not blocked. This child upgrades that gate to a hard FAIL and lowers the threshold to 300 lines, then supplements contracts for every skill that would otherwise fail.

## Approach
Modify `scripts/validate-plugin.sh`: change the Contract Density Check threshold from 500 to 300 lines, convert the WARNING path to an ERROR counted in $ERRORS (blocking). Then for each of the 13 affected skills (agent-prompt-evolution, baseline-quality-assessment, ci-cd-optimization, cross-cutting-concerns, dependency-health, documentation-management, knowledge-transfer, methodology-bootstrapping, observability-instrumentation, rapid-convergence, task-to-backlog, technical-debt-management, testing-strategy) add ≥1 behavioral-level `contracts:` entry so the total per skill reaches ≥4.

## Phase A: Harden the density gate
### Tests (write first)
Run `bash scripts/validate-plugin.sh` against a synthetic skill stub with no contracts and confirm it exits non-zero.
### Implementation
- Edit `scripts/validate-plugin.sh`: lower threshold 500→300, change WARNING→ERROR, increment $ERRORS.
### DoD
- [ ] `bash scripts/validate-plugin.sh`

## Phase B: Supplement skill contracts
### Tests (write first)
After editing each skill's SKILL.md, run `bash scripts/validate-plugin.sh` and confirm exit 0 with 0 errors.
### Implementation
For each of the 13 affected skills under `plugin/skills/<name>/SKILL.md`, add ≥1 entry to the `contracts:` block that describes an observable behavioral guarantee.
### DoD
- [ ] `bash scripts/validate-plugin.sh`

## Constraints
- Do not reduce the number of existing contract entries in any skill.
- Keep all new contract entries behavioral (observable outputs), not implementation details.
- The validate script change must be backward-compatible with well-contracted skills.

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
<!-- DOD:END -->
