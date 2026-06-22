---
id: TASK-101.3
title: Document WIP_CAP auto-tuning probe in plugin/loop-meta/data/README.md
status: Backlog
assignee: []
created_date: '2026-06-20 10:38'
updated_date: '2026-06-20 10:39'
labels: []
dependencies: []
parent_task_id: TASK-101
priority: medium
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create or update plugin/loop-meta/data/README.md to document the wip-tuning.jsonl probe introduced by TASK-101. The README must explain: (1) what wip-tuning.jsonl is, (2) the schema for each record (meta_id, wip_cap_used, cycle_count, elapsed_seconds with field types and semantics), (3) how to validate the file using scripts/validate-wip-tuning.sh, and (4) how the data can be used for future WIP_CAP calibration analysis.

This is sub-task 3 of 3 for TASK-101 (WIP_CAP auto-tuning probe). The instrumentation (TASK-101.1) and validator (TASK-101.2) are only operable by a human or downstream tool if the data format and usage are clearly documented. Without this README, the probe output is a mystery file with no context.

parentTask: TASK-101
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Document WIP_CAP auto-tuning probe in plugin/loop-meta/data/README.md

## Context
TASK-101 adds a WIP_CAP auto-tuning probe to loop-meta. Sub-tasks 1 and 2 (TASK-101.1, TASK-101.2) implement the instrumentation and schema validator respectively. This sub-task (3 of 3) documents the probe so that any developer or downstream analysis tool can understand the data format, how records are generated, and how to analyse them for WIP_CAP calibration.

## Phase 1: Draft plugin/loop-meta/data/README.md

Create plugin/loop-meta/data/README.md with the following sections:
1. **Overview** — what the data directory contains and why it exists
2. **wip-tuning.jsonl** — schema table with field name, type, and semantics for all four fields (meta_id, wip_cap_used, cycle_count, elapsed_seconds); example record; note about append-only semantics
3. **Validation** — how to run scripts/validate-wip-tuning.sh; expected output on pass and fail
4. **Usage for WIP_CAP calibration** — brief explanation of how to correlate wip_cap_used vs cycle_count/elapsed_seconds to inform future WIP_CAP tuning decisions; one example python3 one-liner that reads the file and prints average elapsed_seconds per wip_cap_used value

### DoD
- [ ] `test -f plugin/loop-meta/data/README.md`
- [ ] `grep -q 'wip-tuning.jsonl' plugin/loop-meta/data/README.md`
- [ ] `grep -q 'wip_cap_used' plugin/loop-meta/data/README.md`
- [ ] `grep -q 'validate-wip-tuning.sh' plugin/loop-meta/data/README.md`
- [ ] `grep -q 'calibration\|WIP_CAP' plugin/loop-meta/data/README.md`

## Phase 2: Cross-reference README from skill.md

Add a one-line reference in plugin/loop-meta/skill.md near the emitWipTuningRecord call pointing to plugin/loop-meta/data/README.md for schema details. This ensures anyone reading the skill implementation can locate the documentation.

### DoD
- [ ] `grep -q 'loop-meta/data/README' plugin/loop-meta/skill.md`

## Constraints
- README must be factual — only document what actually exists after TASK-101.1 and TASK-101.2 are done
- Do not promise future features or analysis capabilities that are not yet implemented
- README should be concise (target: under 80 lines)

## Acceptance Gate
- [ ] `test -s plugin/loop-meta/data/README.md`
- [ ] `grep -q 'wip_cap_used' plugin/loop-meta/data/README.md`
- [ ] `grep -q 'validate-wip-tuning.sh' plugin/loop-meta/data/README.md`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-101
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f plugin/loop-meta/data/README.md
- [ ] #2 grep -q 'wip-tuning.jsonl' plugin/loop-meta/data/README.md
- [ ] #3 grep -q 'wip_cap_used' plugin/loop-meta/data/README.md
- [ ] #4 grep -q 'validate-wip-tuning.sh' plugin/loop-meta/data/README.md
- [ ] #5 grep -q 'calibration\|WIP_CAP' plugin/loop-meta/data/README.md
- [ ] #6 grep -q 'loop-meta/data/README' plugin/loop-meta/skill.md
- [ ] #7 test -s plugin/loop-meta/data/README.md
- [ ] #8 bash scripts/validate-plugin.sh
<!-- DOD:END -->
