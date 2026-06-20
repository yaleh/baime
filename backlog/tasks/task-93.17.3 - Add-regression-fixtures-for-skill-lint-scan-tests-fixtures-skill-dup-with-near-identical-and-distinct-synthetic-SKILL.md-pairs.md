---
id: TASK-93.17.3
title: >-
  Add regression fixtures for skill-lint --scan: tests/fixtures/skill-dup/ with
  near-identical and distinct synthetic SKILL.md pairs
status: Backlog
assignee: []
created_date: '2026-06-20 10:53'
updated_date: '2026-06-20 10:54'
labels: []
dependencies:
  - TASK-93.17.1
parent_task_id: TASK-93.17
ordinal: 103000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create tests/fixtures/skill-dup/ directory with synthetic SKILL.md fixtures and a test script that asserts correct duplicate detection and non-detection behaviour of skill-lint.sh --scan.

WHY: Regression fixtures are required by TASK-93.17 to lock in the linter's detection behaviour and prevent silent regressions when the script is modified. Without fixtures, the --scan logic can break undetected.

WHAT:
1. Create tests/fixtures/skill-dup/ directory.
2. Add skill-dup-alpha/SKILL.md — a minimal valid SKILL.md (with required frontmatter: name, description) containing a ### reviewLoop section with a substantial implementation body (~30 tokens).
3. Add skill-dup-beta/SKILL.md — same structure; its ### reviewLoop section body is >80% token-overlap with alpha's (near-identical, just minor wording tweaks). This pair MUST trigger a DUPLICATE: line.
4. Add skill-dup-gamma/SKILL.md — same structure; its ### reviewLoop section body is clearly distinct (<20% token overlap with alpha). This must NOT trigger a DUPLICATE: line.
5. Add tests/fixtures/skill-dup/run-test.sh — a test script that:
   - Runs `bash scripts/skill-lint.sh --scan-dir tests/fixtures/skill-dup/` (or passes the fixture dir as an argument to --scan if supported, otherwise temporarily invokes the detection logic directly)
   - Asserts that a DUPLICATE: line appears for alpha+beta
   - Asserts that no DUPLICATE: line appears for alpha+gamma or beta+gamma
   - Exits 0 only if both assertions pass

HOW IT FITS TASK-93.17: This is the regression-test deliverable. Depends on TASK-93.17.1 (the linter itself). Validates the integration path and locks in the expected detection threshold.

DONE LOOKS LIKE: tests/fixtures/skill-dup/ directory exists with 3 SKILL.md files and run-test.sh; bash tests/fixtures/skill-dup/run-test.sh exits 0; the fixture SKILL.md files are valid enough for skill-lint --scan to parse.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f /home/yale/work/baime/tests/fixtures/skill-dup/skill-dup-alpha/SKILL.md
- [ ] #2 test -f /home/yale/work/baime/tests/fixtures/skill-dup/skill-dup-beta/SKILL.md
- [ ] #3 test -f /home/yale/work/baime/tests/fixtures/skill-dup/skill-dup-gamma/SKILL.md
- [ ] #4 test -f /home/yale/work/baime/tests/fixtures/skill-dup/run-test.sh
- [ ] #5 bash /home/yale/work/baime/tests/fixtures/skill-dup/run-test.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.17
<!-- SECTION:NOTES:END -->
