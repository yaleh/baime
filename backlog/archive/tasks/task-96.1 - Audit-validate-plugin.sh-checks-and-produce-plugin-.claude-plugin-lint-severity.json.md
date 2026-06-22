---
id: TASK-96.1
title: >-
  Audit validate-plugin.sh checks and produce
  plugin/.claude-plugin/lint-severity.json
status: Backlog
assignee: []
created_date: '2026-06-20 10:37'
updated_date: '2026-06-20 10:38'
labels: []
dependencies: []
parent_task_id: TASK-96
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Read scripts/validate-plugin.sh and enumerate every distinct check type it performs. For each check, assign a severity level — P0 (blocker, CI must fail), P1 (warning, CI passes but noteworthy), or P2 (advisory, informational only) — and write the authoritative mapping to plugin/.claude-plugin/lint-severity.json.

This is sub-task 1 of 2 for TASK-96 "Build a skill-lint severity matrix". Before validate-plugin.sh can gate CI on only P0 checks, we need an explicit mapping of every existing check to its severity tier. Sub-task 2 will read this file to determine CI exit behaviour.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f plugin/.claude-plugin/lint-severity.json
- [ ] #2 python3 -c "import json; d=json.load(open('plugin/.claude-plugin/lint-severity.json')); assert len(d) >= 18; assert all(v['severity'] in ('P0','P1','P2') for v in d.values()); assert all(v.get('description') for v in d.values()); print('PASS')"
- [ ] #3 bash scripts/validate-plugin.sh
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
# Plan: Audit validate-plugin.sh checks and produce lint-severity.json

## Context
TASK-96 wants CI to exit non-zero only on P0 (blocker) failures, while P1/P2 issues produce
visible output but do not fail the build. This requires an authoritative data file mapping
every existing check in validate-plugin.sh to a severity tier. This task produces that file.

## Phase 1: Enumerate all checks in validate-plugin.sh

Read scripts/validate-plugin.sh in full. For each distinct check (pass/fail/warning branch),
record:
- A canonical snake_case check ID (e.g. "json-manifest-valid", "version-parity")
- The section it appears in (e.g. "JSON Manifest Validation", "YAML Frontmatter Validation")
- Whether it currently calls `fail()` (hard error) or just prints WARNING

Produce a working list of at least these check IDs:
  json-manifest-valid, version-parity, no-mcp-servers-field,
  yaml-frontmatter, missing-skill-md, agent-count, skill-count,
  symlink-consistency, forbidden-agents, workflow-coach-no-mcp,
  nsg-no-mcp, unit-tests, contract-tests, function-coverage,
  allowed-tools-completeness, daemon-version-consistency,
  trigger-overlap, skill-lint-smoke, contract-density, quantitative-claims

### DoD
- [ ] `[ $(grep -c 'fail\|WARNING\|warn' scripts/validate-plugin.sh) -ge 10 ]`

## Phase 2: Assign severity tiers and write lint-severity.json

For each check ID, assign:
- P0: structural/correctness defects that block CI (invalid JSON, version mismatch, missing
  required frontmatter, missing SKILL.md, forbidden agents present, wrong/missing symlinks,
  failed unit tests, failed contract tests, function-coverage failures, trigger-overlap,
  skill-lint smoke failures)
- P1: quality degradation that should not block CI (allowed-tools completeness warnings,
  daemon-version inline mismatches, agent/skill count mismatches)
- P2: informational nudges (contract-density warnings, untagged quantitative claims)

Write plugin/.claude-plugin/lint-severity.json as a JSON object where keys are canonical
check IDs and values are {"severity": "P0|P1|P2", "description": "..."}.

### DoD
- [ ] `test -f plugin/.claude-plugin/lint-severity.json`
- [ ] `python3 -c "import json; d=json.load(open('plugin/.claude-plugin/lint-severity.json')); assert len(d) >= 18; assert all(v['severity'] in ('P0','P1','P2') for v in d.values()); assert all(v.get('description') for v in d.values()); print('PASS')"`

## Constraints
- Do not modify validate-plugin.sh in this task (that is sub-task 2's scope)
- Every check currently performed by validate-plugin.sh must have an entry
- Severity assignments must be defensible: P0 = CI-blocking defect, P1 = quality warning, P2 = advisory

## Acceptance Gate
- [ ] `python3 -c "import json; d=json.load(open('plugin/.claude-plugin/lint-severity.json')); assert len(d) >= 18; assert all(v['severity'] in ('P0','P1','P2') for v in d.values()); assert all(v.get('description') for v in d.values()); print('PASS')"`
- [ ] `bash scripts/validate-plugin.sh`

parentTask: TASK-96
<!-- SECTION:NOTES:END -->
