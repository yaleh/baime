---
id: TASK-93.17.2
title: >-
  validate-plugin.sh: integrate skill-lint --scan as non-failing [INFO]
  duplicate-detection category
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:54'
labels: []
dependencies:
  - TASK-93.17.1
parent_task_id: TASK-93.17
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a new section to scripts/validate-plugin.sh that calls `bash scripts/skill-lint.sh --scan` and reports any DUPLICATE: lines as [INFO] warnings without incrementing the ERRORS counter.

WHY: The parent task (TASK-93.17) requires the duplicate-detection linter to be surfaced during every validate-plugin.sh run so developers get visibility into cross-skill section duplication as part of the standard CI gate — but without blocking the build, since duplicates may be intentional or in-progress refactors.

WHAT:
1. Add a new section "=== Layer 0: Cross-Skill Duplicate Detection ===" to validate-plugin.sh after the existing Manifest Lint Smoke Tests section.
2. Call `bash scripts/skill-lint.sh --scan 2>/dev/null` and capture output.
3. If any DUPLICATE: lines are emitted, print them prefixed with [INFO] and increment WARNINGS (not ERRORS).
4. If no DUPLICATE: lines, print "  PASS: no cross-skill duplicate sections detected".
5. The section must be guarded: if skill-lint.sh does not support --scan (e.g. old version), print a warning and skip gracefully.

HOW IT FITS TASK-93.17: This is the integration deliverable. The core linter (TASK-93.17.1) must exist first. The fixtures sub-task (TASK-93.17.3) validates the integration path end-to-end.

DONE LOOKS LIKE: validate-plugin.sh contains the new section header; running it prints either PASS or [INFO] DUPLICATE lines; ERRORS count is unchanged by duplicate findings; bash scripts/validate-plugin.sh exits 0 on a clean plugin/.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'Cross-Skill Duplicate Detection' /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #2 grep -q 'skill-lint.sh --scan' /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #3 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.17
<!-- SECTION:NOTES:END -->
