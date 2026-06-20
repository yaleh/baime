---
id: TASK-93.14.1
title: Implement --replicate mode for run-quantitative-experiment skill
status: Backlog
assignee: []
created_date: '2026-06-20 10:52'
updated_date: '2026-06-20 10:52'
labels:
  - experiment
  - skill-extension
  - Exp-K
dependencies: []
parent_task_id: TASK-93.14
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a --replicate flag to the run-quantitative-experiment skill. When invoked with `--replicate &lt;config.json&gt;`, the skill reads an existing experiment config JSON (fixture definitions + original parameters), re-runs all fixtures using the same inputs, and writes output to `results-replicated.json` alongside the existing `results.json` in the same experiment directory.

**Why:** Reproducibility is a core requirement for any quantitative methodology claim. The replicate mode lets OCA (and humans) verify that results are stable across independent re-runs, providing the foundation for the --compare flag in the sibling task.

**Parent goal (TASK-93.14):** Extend run-quantitative-experiment to support replication and comparison, enabling OCA convergence checking for methodology claims.

## Implementation Plan

### Phase 1: Understand existing skill structure
Read plugin/skills/run-quantitative-experiment/ to understand the current CLI interface, config JSON schema, results.json schema, and fixture execution flow.

DoD:
- `test -d plugin/skills/run-quantitative-experiment`
- `grep -qr "results" plugin/skills/run-quantitative-experiment/SKILL.md`

### Phase 2: Implement --replicate flag
Add --replicate &lt;config.json&gt; argument parsing to the skill entry point. When invoked, load the config JSON, iterate over all fixtures, re-run each using the same inputs as the original run, and write output to results-replicated.json in the same directory as the config.

DoD:
- `grep -q "\-\-replicate" plugin/skills/run-quantitative-experiment/SKILL.md`
- `grep -ql "results-replicated" plugin/skills/run-quantitative-experiment/SKILL.md`

### Phase 3: Write regression smoke fixture and run end-to-end
Create a minimal fixture config. Run --replicate on it and verify results-replicated.json is produced with the same schema as results.json.

DoD:
- `find plugin/skills/run-quantitative-experiment -name "*smoke*replicate*" -o -name "*replicate*smoke*" | grep -q .`
- `bash scripts/validate-plugin.sh`

## Constraints
- results-replicated.json must have the same top-level schema as results.json
- --replicate must be additive; existing single-run mode must remain unchanged
- No external network calls during fixture re-runs
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q "\-\-replicate" plugin/skills/run-quantitative-experiment/SKILL.md
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parentTask: TASK-93.14
<!-- SECTION:NOTES:END -->
