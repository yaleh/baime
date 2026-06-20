---
id: TASK-93.19.2
title: Build methodology maturity scorecard from Exp-* task verdicts
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:53'
labels:
  - observability
  - Exp-K
  - scorecard
dependencies: []
parent_task_id: TASK-93.19
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scan all backlog tasks tagged Exp-*, extract Met/NotMet verdicts from task notes, apply OCA convergence criteria, and generate docs/methodology-maturity.md with an evidence-strength table and a P0 zero-evidence section.

Why: The maturity scorecard makes methodology progress visible and provides the human reviewer with an at-a-glance evidence map for P0 claims. Without it, meta-tasks produce verdicts that live only in task notes with no aggregated view.

Parent: TASK-93.19 — second observability addition (scorecard). The first (trace-log) is sibling TASK-93.19.1.

## Implementation Plan

### Phase 1: Survey existing Exp-* tasks and verdict format
List all backlog tasks with Exp-* in title or label. Read their notes sections to understand the exact Met/NotMet annotation patterns (e.g., "verdict: Met", "Met verdict", checklist items). Document the regex needed to extract verdicts reliably.

DoD:
- bash -c "find /home/yale/work/baime/backlog/tasks -name '*.md' | xargs grep -l 'Exp-' | wc -l | grep -qv '^0$'"

### Phase 2: Write scripts/build-maturity-scorecard.sh
Create a shell script that:
1. Finds all task files matching Exp-* in title (grep the filename or task title line)
2. For each task, counts Met and NotMet occurrences in notes
3. Classifies evidence strength: Strong (>=3 Met), Weak (1-2 Met), Zero (0 Met)
4. Identifies P0 claim tasks (tasks with label or title containing P0)
5. Writes docs/methodology-maturity.md with: (a) evidence-strength table (task | Met | NotMet | Strength), (b) P0 Zero-Evidence section listing any P0 tasks with zero Met verdicts

DoD:
- test -f scripts/build-maturity-scorecard.sh
- bash scripts/build-maturity-scorecard.sh
- test -f docs/methodology-maturity.md
- grep -q 'Evidence' docs/methodology-maturity.md
- grep -q 'P0' docs/methodology-maturity.md

### Phase 3: Write scripts/check-p0-evidence.sh
Create a gate script that reads docs/methodology-maturity.md (or re-scans tasks directly), finds P0 claim tasks with zero Met verdicts, and exits non-zero with a clear message if any exist. Exit 0 if all P0 claims have at least one Met verdict.

DoD:
- test -f scripts/check-p0-evidence.sh
- bash scripts/check-p0-evidence.sh
- grep -q 'P0' scripts/check-p0-evidence.sh

### Phase 4: Integrate into validate-plugin.sh
Add calls to bash scripts/build-maturity-scorecard.sh and bash scripts/check-p0-evidence.sh inside validate-plugin.sh.

DoD:
- grep -q 'check-p0-evidence' scripts/validate-plugin.sh
- bash scripts/validate-plugin.sh
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f scripts/build-maturity-scorecard.sh
- [ ] #2 bash scripts/build-maturity-scorecard.sh
- [ ] #3 test -f docs/methodology-maturity.md
- [ ] #4 grep -q 'Evidence' docs/methodology-maturity.md
- [ ] #5 test -f scripts/check-p0-evidence.sh
- [ ] #6 bash scripts/check-p0-evidence.sh
- [ ] #7 grep -q 'check-p0-evidence' scripts/validate-plugin.sh
- [ ] #8 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.19
<!-- SECTION:NOTES:END -->
