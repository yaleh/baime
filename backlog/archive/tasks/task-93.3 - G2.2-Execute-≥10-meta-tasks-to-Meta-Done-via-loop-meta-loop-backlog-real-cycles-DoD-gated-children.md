---
id: TASK-93.3
title: >-
  G2.2: Execute ≥10 meta-tasks to Meta-Done via loop-meta/loop-backlog (real
  cycles, DoD-gated children)
status: Backlog
assignee: []
created_date: '2026-06-20 09:47'
labels: []
dependencies: []
ordinal: 67000
---

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 [ "$(bash scripts/check-roi-gate.sh 2>/dev/null | grep -oP "Meta-task cycles detected:\s*\K\d+")" -ge 10 ]
- [ ] #2 bash scripts/check-roi-gate.sh >/dev/null 2>&1 || [ $? -eq 2 ]
<!-- DOD:END -->
