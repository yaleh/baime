---
id: TASK-102
title: >-
  Build a cross-skill duplicate-detection linter: scan all SKILL.md files for
  reviewLoop and detectLang implementations that are near-identical (>80% token
  overlap), and report them in validate-plugin.sh output
status: Meta-Plan
assignee: []
created_date: '2026-06-20 10:26'
updated_date: '2026-06-20 10:41'
labels: []
dependencies: []
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a cross-skill duplicate-detection linter: scan all SKILL.md files for reviewLoop and detectLang implementations that are near-identical (>80% token overlap), and report them in validate-plugin.sh output so they can be extracted to a shared spec.

Rationale: Four sub-tasks: (1) implement token-overlap similarity function in skill-lint.sh, (2) build cross-file comparison loop, (3) integrate into validate-plugin.sh as a new check category, (4) add regression tests with known-duplicate fixtures. Replan is expected: the similarity threshold (80%) is ambiguous — initial decomposer output will likely propose a fixed threshold that proves too loose or tight once tested against real SKILL.md pairs, causing the evaluator to return NotMet and triggering replanner root-cause 'sub-plan' (threshold refinement required).

This meta-task is part of TASK-93 Exp-K experiment corpus (input MT-08).
Source: plugin/loop-meta/data/task-notes/meta-task-inputs.json
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 4 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.
<!-- SECTION:NOTES:END -->
