---
id: TASK-93.1
title: 'G1: Confirm data dirs and the four re-execution guards are operational'
status: Backlog
assignee: []
created_date: '2026-06-20 09:46'
labels: []
dependencies: []
ordinal: 65000
---

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -d plugin/loop-meta/data/baseline && test -d plugin/loop-meta/data/task-notes
- [ ] #2 bash scripts/verify-subtask-dod.test.sh
- [ ] #3 bash scripts/verify-provenance.test.sh
- [ ] #4 bash scripts/check-roi-gate.test.sh
- [ ] #5 bash scripts/verify-provenance.sh plugin/loop-meta/data/baseline
<!-- DOD:END -->
