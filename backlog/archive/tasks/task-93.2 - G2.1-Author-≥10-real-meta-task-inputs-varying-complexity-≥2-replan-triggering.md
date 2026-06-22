---
id: TASK-93.2
title: >-
  G2.1: Author ≥10 real meta-task inputs (varying complexity, ≥2
  replan-triggering)
status: Backlog
assignee: []
created_date: '2026-06-20 09:47'
labels: []
dependencies: []
ordinal: 66000
---

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 jq -e "length >= 10" plugin/loop-meta/data/meta-task-inputs.json
- [ ] #2 jq -e "all(.[]; has(\"goal\") and has(\"complexity\"))" plugin/loop-meta/data/meta-task-inputs.json
- [ ] #3 jq -e "[.[] | select(.expected_replan == true)] | length >= 2" plugin/loop-meta/data/meta-task-inputs.json
<!-- DOD:END -->
