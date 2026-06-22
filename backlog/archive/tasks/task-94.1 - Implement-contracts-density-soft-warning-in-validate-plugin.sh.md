---
id: TASK-94.1
title: Implement contracts-density soft-warning in validate-plugin.sh
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:37'
labels: []
dependencies: []
parent_task_id: TASK-94
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend scripts/validate-plugin.sh with a per-SKILL.md contracts-density check. For each SKILL.md under plugin/skills/, count the total spec lines (non-blank lines in the body after frontmatter) and the number of contracts entries (list items under the `contracts:` YAML key). If contract_count * 50 < spec_line_count (i.e., fewer than 1 contract per 50 spec lines), emit a WARNING to stderr: "WARNING: &lt;skill-path&gt; contracts density low (&lt;N&gt; contracts / &lt;M&gt; spec lines)". The warning is non-blocking: the script must still exit 0 when only soft warnings are triggered. Increment the WARNINGS counter so the summary section reflects the warning count accurately.

Parent task: TASK-94. This is the core implementation sub-task; the companion regression-test sub-task depends on this being merged first.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Implement contracts-density soft-warning in validate-plugin.sh

## Context
validate-plugin.sh already has a contracts-count path and a Layer 0 Contract Density Check section using a fixed threshold (>500 lines, <3 contracts). TASK-94 adds a finer-grained density heuristic: warn when any SKILL.md has fewer than 1 contract per 50 spec lines, regardless of absolute size. This catches under-specified skills early in CI before they accumulate debt.

## Phase 1: Read and understand existing density check

Read scripts/validate-plugin.sh and locate the existing "Layer 0: Contract Density Check" section. Note the current thresholds (LINE_THRESHOLD=500, CONTRACT_THRESHOLD=3) and the Python block structure so the new check can be inserted coherently — either extending the existing block or adding a new named section.

### DoD
- `grep -q "CONTRACT_THRESHOLD" /home/yale/work/baime/scripts/validate-plugin.sh`

## Phase 2: Implement the per-file density warning

Add a new shell+Python block in validate-plugin.sh, after the existing Contract Density Check section, titled:

```
=== Layer 0: Contract Density per-50-lines Warning ===
```

The Python inline script should:
1. Iterate over every SKILL.md under plugin/skills/
2. Strip YAML frontmatter (between `---` delimiters) to isolate the body
3. Count `spec_lines` = non-blank lines in the body
4. Count `contract_count` = list items under `contracts:` key in frontmatter (lines matching `^\s{2}-`)
5. If `contract_count * 50 < spec_lines`, print to stderr and stdout: `  WARNING: <skill-name> contracts density low (<contract_count> contracts / <spec_lines> spec lines)`; increment a warnings counter
6. Exit with the warnings count (non-zero) so the outer `WARNINGS` variable can be incremented

Wrap the python call with `set +e` / `set -e` and capture exit code into `DENSITY_RATE_WARNINGS`, then `WARNINGS=$((WARNINGS + DENSITY_RATE_WARNINGS))`.

The overall script must still `exit 0` when `ERRORS` is 0 (warnings do not block).

### DoD
- `grep -q "Contract Density per-50-lines Warning" /home/yale/work/baime/scripts/validate-plugin.sh`
- `grep -q "contract_count \* 50 < spec_lines" /home/yale/work/baime/scripts/validate-plugin.sh`
- `bash /home/yale/work/baime/scripts/validate-plugin.sh`

## Phase 3: Manual spot-check

Verify the warning fires correctly by creating a temporary SKILL.md fixture with 100 spec lines and 0 contracts, running validate-plugin.sh, confirming a WARNING line appears, then removing the fixture. Also verify that a SKILL.md with 50 spec lines and 2 contracts does NOT trigger a warning.

### DoD
- `bash /home/yale/work/baime/scripts/validate-plugin.sh`

## Constraints
- The check is a soft warning only — script must exit 0 when ERRORS=0
- Do not modify the existing LINE_THRESHOLD / CONTRACT_THRESHOLD block; add a new section
- No new files other than modifications to validate-plugin.sh
- The fix must not break any existing passing tests

## Acceptance Gate
- `bash /home/yale/work/baime/scripts/validate-plugin.sh`
- `grep -q "Contract Density per-50-lines Warning" /home/yale/work/baime/scripts/validate-plugin.sh`
- `grep -q "contract_count \* 50 < spec_lines" /home/yale/work/baime/scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-94

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q "CONTRACT_THRESHOLD" /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #2 grep -q "Contract Density per-50-lines Warning" /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #3 grep -q "contract_count \* 50 < spec_lines" /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #4 bash /home/yale/work/baime/scripts/validate-plugin.sh
<!-- DOD:END -->
