---
id: TASK-93.11.1
title: Implement lint-severity matrix for validate-plugin.sh checks
status: Backlog
assignee: []
created_date: '2026-06-20 10:52'
updated_date: '2026-06-20 10:54'
labels: []
dependencies: []
parent_task_id: TASK-93.11
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Categorise all existing checks in scripts/validate-plugin.sh as P0 (blocker), P1 (warning), or P2 (advisory) and persist the classification to plugin/.claude-plugin/lint-severity.json. Update the script to exit non-zero only on P0 failures, emitting labelled output lines (BLOCKER / WARNING / ADVISORY) for P1 and P2 issues.

Why: Currently validate-plugin.sh treats every failing check as a hard blocker, causing false-alarm noise when minor advisory checks fail. A severity matrix makes the framework self-describing and lets CI pass on P1/P2 issues while still blocking on true P0 failures. This is part of parent task TASK-93.11 which aims to reduce false-alarm noise and make the validation framework self-describing.

Done looks like:
- plugin/.claude-plugin/lint-severity.json exists and lists every check with its severity tier
- scripts/validate-plugin.sh exits 0 when only P1/P2 failures occur and exits non-zero only when at least one P0 check fails
- All existing passing CI scenarios continue to pass
- bash scripts/validate-plugin.sh runs cleanly (exit 0) on a valid plugin
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Implement lint-severity matrix for validate-plugin.sh checks

## Context
scripts/validate-plugin.sh currently exits non-zero on any check failure, treating advisory issues the same as hard blockers. Introducing a P0/P1/P2 severity matrix persisted in plugin/.claude-plugin/lint-severity.json will make the framework self-describing, reduce false-alarm noise, and let CI pass on minor issues while still blocking on true P0 failures. This is sub-task 1 of 3 for TASK-93.11.

## Phase 1: Audit and classify existing checks

Read scripts/validate-plugin.sh and enumerate every check. For each check decide its severity:
- P0 (BLOCKER): structural failures that mean the plugin is broken or unpublishable — invalid JSON, version mismatch, missing SKILL.md, failing contract tests, failing unit tests, trigger overlap exceeding threshold.
- P1 (WARNING): quality issues that should be fixed but don't break the plugin — symlink target wrong, missing symlink, frontmatter missing fields, count assertion mismatch, daemon-version body mismatch, undocumented impl heading, skill-lint fixture rejection failure.
- P2 (ADVISORY): informational noise — allowed-tools undeclared tool warning, meta-lint quantitative claim warning, contract density low warning, no-mcp-dependency advisory.

Document the classification in /tmp/ttb-severity-audit-93111.txt with lines like "check-id: P0|P1|P2" before writing the JSON.

### DoD
- [ ] `grep -q "P0" /tmp/ttb-severity-audit-93111.txt`
- [ ] `grep -q "P1" /tmp/ttb-severity-audit-93111.txt`
- [ ] `grep -q "P2" /tmp/ttb-severity-audit-93111.txt`

## Phase 2: Create lint-severity.json

Write plugin/.claude-plugin/lint-severity.json containing an array of objects with fields:
  - "check": human-readable check id (e.g. "plugin-json-valid")
  - "severity": "P0" | "P1" | "P2"
  - "description": one-line explanation

Cover every check section in validate-plugin.sh. The file must be valid JSON parseable by `python3 -c "import json; json.load(open('plugin/.claude-plugin/lint-severity.json'))"`.

### DoD
- [ ] `test -f /home/yale/work/baime/plugin/.claude-plugin/lint-severity.json`
- [ ] `python3 -c "import json; d=json.load(open('/home/yale/work/baime/plugin/.claude-plugin/lint-severity.json')); assert len(d) >= 10"`
- [ ] `python3 -c "import json; checks=[c['severity'] for c in json.load(open('/home/yale/work/baime/plugin/.claude-plugin/lint-severity.json'))]; assert 'P0' in checks and 'P1' in checks and 'P2' in checks"`

## Phase 3: Update validate-plugin.sh to use severity tiers

Modify scripts/validate-plugin.sh:
1. Replace the global `set -e` at the top with explicit error accumulation (it already uses ERRORS counter, so remove `set -e` from top level and use `|| true` guards).
2. Add helper functions `warn()` (increments WARNINGS, prints "  WARNING: …") and `advise()` (increments a new ADVISORIES counter, prints "  ADVISORY: …").
3. Re-classify each check's action:
   - P0 checks continue calling `fail()` which increments ERRORS.
   - P1 checks call `warn()` instead of `fail()`.
   - P2 checks call `advise()` or already use WARNING/ADVISORY output.
4. In the summary section, print ADVISORIES count alongside ERRORS and WARNINGS.
5. The final exit condition remains `exit 1` only when `ERRORS > 0`; P1/P2 issues result in `exit 0`.

Ensure no existing P0 check is downgraded to P1/P2 accidentally.

### DoD
- [ ] `grep -q "warn()" /home/yale/work/baime/scripts/validate-plugin.sh`
- [ ] `grep -q "ADVISORIES" /home/yale/work/baime/scripts/validate-plugin.sh`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`

## Phase 4: Validate end-to-end

Run the full validation suite to confirm:
- The script exits 0 on the current (clean) repo.
- The summary line shows "Errors: 0".
- The lint-severity.json is itself parseable.

### DoD
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
- [ ] `python3 -c "import json; json.load(open('/home/yale/work/baime/plugin/.claude-plugin/lint-severity.json'))"`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "Errors: 0"`

## Constraints
- Do not remove any existing check; only change whether its failure increments ERRORS vs WARNINGS vs ADVISORIES.
- Do not change the P0 classification of: invalid JSON, version mismatch, missing SKILL.md, contract test failures, unit test failures.
- No new dependencies (Python, node modules) may be added.
- The lint-severity.json file lives in plugin/.claude-plugin/ alongside plugin.json.

## Acceptance Gate
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
- [ ] `python3 -c "import json; d=json.load(open('/home/yale/work/baime/plugin/.claude-plugin/lint-severity.json')); assert len(d) >= 10"`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.11

Plan review iteration 1: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q "P0" /tmp/ttb-severity-audit-93111.txt
- [ ] #2 grep -q "P1" /tmp/ttb-severity-audit-93111.txt
- [ ] #3 grep -q "P2" /tmp/ttb-severity-audit-93111.txt
- [ ] #4 test -f /home/yale/work/baime/plugin/.claude-plugin/lint-severity.json
- [ ] #5 python3 -c "import json; d=json.load(open('/home/yale/work/baime/plugin/.claude-plugin/lint-severity.json')); assert len(d) >= 10"
- [ ] #6 python3 -c "import json; checks=[c['severity'] for c in json.load(open('/home/yale/work/baime/plugin/.claude-plugin/lint-severity.json'))]; assert 'P0' in checks and 'P1' in checks and 'P2' in checks"
- [ ] #7 grep -q "warn()" /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #8 grep -q "ADVISORIES" /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #9 bash /home/yale/work/baime/scripts/validate-plugin.sh
- [ ] #10 bash /home/yale/work/baime/scripts/validate-plugin.sh 2>&1 | grep -q "Errors: 0"
<!-- DOD:END -->
