---
id: TASK-93.4
title: >-
  G3: Emit provenance-stamped baseline from real cycles via check-roi-gate.sh
  --emit-json
status: Backlog
assignee: []
created_date: '2026-06-20 09:47'
labels: []
dependencies: []
ordinal: 68000
---

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/check-roi-gate.sh --emit-json plugin/loop-meta/data/baseline/replan-stats.json >/dev/null 2>&1; jq -e ".generated_by == \"scripts/check-roi-gate.sh\" and .data_source == \"measured\"" plugin/loop-meta/data/baseline/replan-stats.json
- [ ] #2 bash scripts/verify-provenance.sh plugin/loop-meta/data/baseline
- [ ] #3 jq -e "(.evaluator.Met + .evaluator.NotMet) == .meta_task_cycles" plugin/loop-meta/data/baseline/replan-stats.json
<!-- DOD:END -->
