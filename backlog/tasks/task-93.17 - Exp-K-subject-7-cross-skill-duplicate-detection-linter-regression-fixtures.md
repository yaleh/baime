---
id: TASK-93.17
title: 'Exp-K subject 7: cross-skill duplicate-detection linter + regression fixtures'
status: Backlog
assignee: []
created_date: '2026-06-20 10:50'
updated_date: '2026-06-20 10:54'
labels: []
dependencies: []
parent_task_id: TASK-93
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a cross-skill duplicate-detection linter: scan all SKILL.md files for named section implementations (e.g. reviewLoop, detectLang) that are near-identical (>80% token overlap via Jaccard similarity). Implement in scripts/skill-lint.sh with a compute_token_overlap function, a --self-test flag with unit cases, and a --scan flag that iterates all SKILL.md pairs and emits DUPLICATE: lines. Integrate into validate-plugin.sh as a non-failing [INFO] category. Add regression fixtures with two synthetic near-identical and one distinct SKILL.md to tests/fixtures/skill-dup/, with a test script asserting correct detection and non-detection.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decomposition complete: 3 sub-tasks in Backlog. Review sub-tasks, then set status → Meta-Active to start reconcile loop.
<!-- SECTION:NOTES:END -->
