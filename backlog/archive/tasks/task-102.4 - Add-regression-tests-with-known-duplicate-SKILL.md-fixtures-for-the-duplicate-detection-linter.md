---
id: TASK-102.4
title: >-
  Add regression tests with known-duplicate SKILL.md fixtures for the
  duplicate-detection linter
status: Backlog
assignee: []
created_date: '2026-06-20 10:40'
updated_date: '2026-06-20 10:49'
labels: []
dependencies: []
parent_task_id: TASK-102
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a regression test suite that verifies the full duplicate-detection pipeline (TASK-102.1 through TASK-102.3) end-to-end using synthetic SKILL.md fixture files with known token-overlap characteristics.

The test suite must:
1. Create a `tests/fixtures/skill-dup/` directory containing at least 3 synthetic SKILL.md files:
   - `skill-a.md` and `skill-b.md`: near-identical `reviewLoop` sections (>80% token overlap) — should trigger a DUPLICATE finding.
   - `skill-c.md`: a `reviewLoop` section with <40% overlap vs A and B — should NOT trigger a finding.
2. Add a `tests/test-skill-dup.sh` test script that:
   - Runs `bash scripts/skill-lint.sh --scan` with `plugin/` replaced by (or augmented with) the fixture directory.
   - Asserts that A+B produce exactly 1 `DUPLICATE: reviewLoop` line.
   - Asserts that C produces 0 `DUPLICATE` lines when compared to A.
3. Ensure `bash scripts/validate-plugin.sh` still exits 0 after the fixtures are added.
4. Wire `bash tests/test-skill-dup.sh` into the validate-plugin.sh test runner if a test runner hook exists; otherwise run it standalone.

This depends on TASK-102.1, TASK-102.2, and TASK-102.3. This is part of TASK-102: Build a cross-skill duplicate-detection linter.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Add regression tests with known-duplicate SKILL.md fixtures for the duplicate-detection linter

## Context
The duplicate-detection linter (TASK-102.1–102.3) needs regression tests that confirm it fires on known-duplicate pairs and stays silent on clearly distinct pairs. Without fixtures, threshold mis-calibration (the replan risk flagged in TASK-102) would only be caught on real production SKILL.md files, which may change over time.

## Phase 1: Create fixture SKILL.md files

Create directory `tests/fixtures/skill-dup/` and write three fixture files:

**skill-a.md** — contains a `## reviewLoop` section with 10–15 sentences about iteration, convergence, and approval gates.

**skill-b.md** — near-identical `## reviewLoop` section: copy skill-a's text, change at most 2–3 words (to keep overlap ≥ 0.85).

**skill-c.md** — completely different `## reviewLoop` section: write about an unrelated domain (e.g. filesystem scanning, network retries) so token overlap with A/B is < 0.30.

Each file must have a minimal valid SKILL.md structure (at minimum: a `# Title` and the `## reviewLoop` section).

### DoD
- `test -f tests/fixtures/skill-dup/skill-a.md`
- `test -f tests/fixtures/skill-dup/skill-b.md`
- `test -f tests/fixtures/skill-dup/skill-c.md`
- `grep -q '## reviewLoop' tests/fixtures/skill-dup/skill-a.md`
- `grep -q '## reviewLoop' tests/fixtures/skill-dup/skill-c.md`

## Phase 2: Write tests/test-skill-dup.sh

Create `tests/test-skill-dup.sh` with `#!/usr/bin/env bash` and `set -euo pipefail`. The script must:

1. Source or call `scripts/skill-lint.sh` functions directly, or invoke via `SKILL_SCAN_DIR=tests/fixtures/skill-dup bash scripts/skill-lint.sh --scan` (requires skill-lint.sh to respect a `SKILL_SCAN_DIR` env var override, or the test invokes `compute_token_overlap` and `extract_section` directly).

2. Test case 1 — A vs B should produce DUPLICATE:
   ```bash
   SCORE=$(compute_token_overlap "$(grep -A9999 '## reviewLoop' tests/fixtures/skill-dup/skill-a.md)" \
                                 "$(grep -A9999 '## reviewLoop' tests/fixtures/skill-dup/skill-b.md)")
   [ "$(echo "$SCORE >= 0.80" | bc)" = "1" ] && echo "PASS: A-B overlap >= 0.80" || { echo "FAIL: A-B overlap $SCORE"; exit 1; }
   ```

3. Test case 2 — A vs C should NOT produce DUPLICATE:
   ```bash
   SCORE=$(compute_token_overlap "$(grep -A9999 '## reviewLoop' tests/fixtures/skill-dup/skill-a.md)" \
                                 "$(grep -A9999 '## reviewLoop' tests/fixtures/skill-dup/skill-c.md)")
   [ "$(echo "$SCORE < 0.80" | bc)" = "1" ] && echo "PASS: A-C overlap < 0.80" || { echo "FAIL: A-C overlap $SCORE"; exit 1; }
   ```

4. Exit 0 if all cases pass; exit 1 on any failure with a descriptive message.

### DoD
- `test -f tests/test-skill-dup.sh`
- `grep -q 'PASS.*A-B' tests/test-skill-dup.sh`
- `grep -q 'PASS.*A-C' tests/test-skill-dup.sh`

## Phase 3: Run tests and full validator

```bash
source scripts/skill-lint.sh
bash tests/test-skill-dup.sh
bash scripts/validate-plugin.sh
```

### DoD
- `bash tests/test-skill-dup.sh`
- `bash scripts/validate-plugin.sh`

## Constraints
- Fixtures must be synthetic (no copy of real production SKILL.md content)
- Do not modify validate-plugin.sh exit-code behavior — fixtures must not cause it to fail
- test-skill-dup.sh must be runnable standalone without arguments

## Acceptance Gate
- `bash tests/test-skill-dup.sh`
- `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

parentTask: TASK-102
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f tests/fixtures/skill-dup/skill-a.md
- [ ] #2 test -f tests/fixtures/skill-dup/skill-b.md
- [ ] #3 test -f tests/fixtures/skill-dup/skill-c.md
- [ ] #4 grep -q '## reviewLoop' tests/fixtures/skill-dup/skill-a.md
- [ ] #5 grep -q '## reviewLoop' tests/fixtures/skill-dup/skill-c.md
- [ ] #6 test -f tests/test-skill-dup.sh
- [ ] #7 grep -q 'PASS.*A-B' tests/test-skill-dup.sh
- [ ] #8 grep -q 'PASS.*A-C' tests/test-skill-dup.sh
- [ ] #9 bash tests/test-skill-dup.sh
- [ ] #10 bash scripts/validate-plugin.sh
<!-- DOD:END -->
