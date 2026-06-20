---
id: TASK-93.17.1
title: >-
  skill-lint.sh: add compute_token_overlap, --self-test, and --scan flags for
  cross-skill duplicate detection
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:54'
labels: []
dependencies: []
parent_task_id: TASK-93.17
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend scripts/skill-lint.sh with a Jaccard-based token-overlap function and two new CLI flags so that cross-skill duplicate section detection is possible.

WHY: The existing skill-lint.sh only validates JSON manifests. TASK-93.17 requires it to also detect near-identical named-section implementations (e.g. reviewLoop, detectLang) across SKILL.md files.

WHAT:
1. Add compute_token_overlap function — tokenises two text inputs by whitespace/punctuation, computes Jaccard similarity (|intersection| / |union| of token sets), prints a decimal score 0.00–1.00.
2. Add --self-test flag — runs >=3 built-in unit assertions (identical=1.00, near-identical>0.80, distinct<0.20). Exits 0 on all pass.
3. Add --scan flag — iterates all plugin/skills/*/SKILL.md files, extracts named ### section headings and their body text, computes pairwise token overlap for matching section names across all skill pairs, emits DUPLICATE: <skill1> <skill2> <section> <score> lines for score > 0.80. Exits 0 always (non-failing, informational).

HOW IT FITS TASK-93.17: This is the core linter implementation the parent task requires. The validate-plugin integration and regression fixtures sub-tasks depend on this.

DONE LOOKS LIKE: bash scripts/skill-lint.sh --self-test exits 0; --scan runs without error on the plugin/ directory; existing --manifest tests still pass; bash scripts/validate-plugin.sh passes.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'compute_token_overlap' /home/yale/work/baime/scripts/skill-lint.sh
- [ ] #2 grep -q -- '--self-test' /home/yale/work/baime/scripts/skill-lint.sh
- [ ] #3 grep -q -- '--scan' /home/yale/work/baime/scripts/skill-lint.sh
- [ ] #4 bash /home/yale/work/baime/scripts/skill-lint.sh --self-test
- [ ] #5 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.17
<!-- SECTION:NOTES:END -->
