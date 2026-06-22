---
id: TASK-93.6
title: 'G1: Confirm TASK-93 re-execution guards are operational'
status: Done
assignee: []
created_date: '2026-06-20 09:59'
updated_date: '2026-06-20 10:19'
labels: []
dependencies: []
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Verify that the four R1–R5 guards installed during the TASK-93 post-mortem are all functional before beginning the real experiment. Guards: (1) verify-subtask-dod.sh — R1 guard ensuring every child task has a DoD shell-gate; (2) check-roi-gate.sh exit codes — R2 fix: PROCEED→0, HOLD→2; (3) check-roi-gate.sh --emit-json — R4 provenance-stamped baseline emission; (4) verify-provenance.sh — R5 guard rejecting fabricated "measured" artifacts. Also confirm the data directory structure (plugin/loop-meta/data/baseline/, plugin/loop-meta/data/task-notes/) exists and is writable. This is sub-task G1 of TASK-93 (Exp-K: loop-meta replan baseline data collection).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: G1: Confirm TASK-93 re-execution guards are operational

## Context
TASK-93 (Exp-K) suffered a post-mortem that identified five root-cause issues (R1–R5) and
installed guard scripts to prevent recurrence. Before any experimental data collection begins,
each guard must be smoke-tested to confirm it is present, correctly wired, and returns the
expected exit codes. This task covers the pre-flight check only — no experiment data is produced.

## Phase 1: Verify guard scripts exist and are executable

Confirm that all four guard scripts referenced in the TASK-93 post-mortem are present in
`scripts/` and have executable permissions.

### DoD
- [ ] `test -x scripts/verify-subtask-dod.sh`
- [ ] `test -x scripts/check-roi-gate.sh`
- [ ] `test -x scripts/verify-provenance.sh`

## Phase 2: R1 guard — verify-subtask-dod.sh CLI contract

Run `verify-subtask-dod.sh --help` to confirm the script is invocable and recognises the
META_ID argument. This validates the R1 guard is present and correctly formed without
requiring live task data.

### DoD
- [ ] `bash scripts/verify-subtask-dod.sh --help 2>&1 | grep -q 'META_ID'`

## Phase 3: R2 guard — check-roi-gate.sh exit-code contract

Inspect the script source to confirm the PROCEED→0 / HOLD→2 exit-code contract is encoded.
The pre-fix behaviour returned exit 1 for HOLD; the R2 fix changed it to 2.

### DoD
- [ ] `grep -q 'gate_exit=0' scripts/check-roi-gate.sh`
- [ ] `grep -q 'gate_exit=2' scripts/check-roi-gate.sh`

## Phase 4: R4 guard — check-roi-gate.sh --emit-json provenance stamp

Run `check-roi-gate.sh --emit-json` targeting a temp file to confirm the flag is accepted
and the output carries a `generated_by` provenance field (the R4 fix).

### DoD
- [ ] `bash scripts/check-roi-gate.sh --emit-json /tmp/g1-probe.json 2>/dev/null; test -f /tmp/g1-probe.json`
- [ ] `grep -q 'generated_by' /tmp/g1-probe.json`

## Phase 5: R5 guard — verify-provenance.sh rejects fabricated artifacts

Create a dedicated temp directory. Place a synthetic "measured" JSON file with no
`generated_by` field in it; confirm the guard exits non-zero (rejects the fabrication).
Then add a valid `generated_by` field and confirm the guard exits 0.

### DoD
- [ ] `mkdir -p /tmp/g1-prov-test && printf '{"data_source":"measured","value":42}\n' > /tmp/g1-prov-test/fake.json && ! bash scripts/verify-provenance.sh /tmp/g1-prov-test 2>/dev/null`
- [ ] `printf '{"data_source":"measured","value":42,"generated_by":"scripts/check-roi-gate.sh"}\n' > /tmp/g1-prov-test/valid.json && rm /tmp/g1-prov-test/fake.json && bash scripts/verify-provenance.sh /tmp/g1-prov-test 2>/dev/null`

## Phase 6: Data directory structure check

Confirm the two data subdirectories required by Exp-K exist and are writable by the current
process.

### DoD
- [ ] `test -d plugin/loop-meta/data/baseline`
- [ ] `test -d plugin/loop-meta/data/task-notes`
- [ ] `touch plugin/loop-meta/data/baseline/.write-check && rm plugin/loop-meta/data/baseline/.write-check`
- [ ] `touch plugin/loop-meta/data/task-notes/.write-check && rm plugin/loop-meta/data/task-notes/.write-check`

## Constraints
- This task is a pre-flight check only; no experimental data is written to the baseline directory
- Do not modify any guard scripts — only invoke and inspect them
- Do not create sub-tasks or branches
- Temp files written under /tmp/ only; clean up after use

## Acceptance Gate
- [ ] `test -x scripts/verify-subtask-dod.sh && test -x scripts/check-roi-gate.sh && test -x scripts/verify-provenance.sh`
- [ ] `grep -q 'gate_exit=0' scripts/check-roi-gate.sh && grep -q 'gate_exit=2' scripts/check-roi-gate.sh`
- [ ] `test -d plugin/loop-meta/data/baseline && test -d plugin/loop-meta/data/task-notes`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED — all phases have specific actionable instructions, all DoD items are shell commands, phase ordering is correct (scripts verified before individual guard tests, data dirs last), scope is tightly bounded to pre-flight checks only.

parentTask: TASK-93

claimed: 2026-06-20T10:15:00Z

Phase 1 ✓ 2026-06-20T00:00:00Z
All three guard scripts present and executable
DoD #1: PASS — test -x scripts/verify-subtask-dod.sh
DoD #2: PASS — test -x scripts/check-roi-gate.sh
DoD #3: PASS — test -x scripts/verify-provenance.sh

Phase 2 ✓ 2026-06-20T00:00:00Z
R1 guard verify-subtask-dod.sh CLI contract confirmed
DoD #4: PASS — bash scripts/verify-subtask-dod.sh --help 2>&1 | grep -q 'META_ID'

Phase 3 ✓ 2026-06-20T00:00:00Z
R2 guard exit-code contract confirmed in check-roi-gate.sh source
DoD #5: PASS — grep -q 'gate_exit=0' scripts/check-roi-gate.sh
DoD #6: PASS — grep -q 'gate_exit=2' scripts/check-roi-gate.sh

Phase 4 ✓ 2026-06-20T00:00:00Z
R4 guard --emit-json provenance stamp confirmed
DoD #7: PASS — bash scripts/check-roi-gate.sh --emit-json /tmp/g1-probe.json 2>/dev/null; test -f /tmp/g1-probe.json
DoD #8: PASS — grep -q 'generated_by' /tmp/g1-probe.json

Phase 5 ✓ 2026-06-20T00:00:00Z
R5 guard verify-provenance.sh correctly rejects fabricated artifacts and accepts valid ones
DoD #9: PASS — guard exited non-zero for measured JSON without generated_by
DoD #10: PASS — guard exited 0 for measured JSON with generated_by field

Phase 6 ✓ 2026-06-20T00:00:00Z
Data directory structure confirmed and writable; validate-plugin.sh passed
DoD #11: PASS — test -d plugin/loop-meta/data/baseline
DoD #12: PASS — test -d plugin/loop-meta/data/task-notes
DoD #13: PASS — touch plugin/loop-meta/data/baseline/.write-check && rm ...
DoD #14: PASS — touch plugin/loop-meta/data/task-notes/.write-check && rm ...
DoD #15: PASS — bash scripts/validate-plugin.sh (0 errors, 55 warnings)

## Execution Summary
Result: Done
Commit: no changes
1. Phase 1 PASS: All 3 guard scripts exist and are executable
2. Phase 2 PASS: verify-subtask-dod.sh --help contains META_ID
3. Phase 3 PASS: check-roi-gate.sh encodes gate_exit=0 and gate_exit=2
4. Phase 4 PASS: check-roi-gate.sh --emit-json writes /tmp/g1-probe.json with generated_by field
5. Phase 5 PASS: verify-provenance.sh rejects artifact without generated_by; accepts one with it
6. Phase 6 PASS: data/baseline and data/task-notes exist and are writable; validate-plugin.sh passes

workerLoop DoD verified: all 15 commands passed
Completed: 2026-06-20T10:20:00Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 test -x scripts/verify-subtask-dod.sh
- [x] #2 test -x scripts/check-roi-gate.sh
- [x] #3 test -x scripts/verify-provenance.sh
- [x] #4 bash scripts/verify-subtask-dod.sh --help 2>&1 | grep -q 'META_ID'
- [x] #5 grep -q 'gate_exit=0' scripts/check-roi-gate.sh
- [x] #6 grep -q 'gate_exit=2' scripts/check-roi-gate.sh
- [x] #7 bash scripts/check-roi-gate.sh --emit-json /tmp/g1-probe.json 2>/dev/null; test -f /tmp/g1-probe.json
- [x] #8 grep -q 'generated_by' /tmp/g1-probe.json
- [x] #9 mkdir -p /tmp/g1-prov-test && printf '{"data_source":"measured","value":42}\n' > /tmp/g1-prov-test/fake.json && ! bash scripts/verify-provenance.sh /tmp/g1-prov-test 2>/dev/null
- [x] #10 printf '{"data_source":"measured","value":42,"generated_by":"scripts/check-roi-gate.sh"}\n' > /tmp/g1-prov-test/valid.json && rm /tmp/g1-prov-test/fake.json && bash scripts/verify-provenance.sh /tmp/g1-prov-test 2>/dev/null
- [x] #11 test -d plugin/loop-meta/data/baseline
- [x] #12 test -d plugin/loop-meta/data/task-notes
- [x] #13 touch plugin/loop-meta/data/baseline/.write-check && rm plugin/loop-meta/data/baseline/.write-check
- [x] #14 touch plugin/loop-meta/data/task-notes/.write-check && rm plugin/loop-meta/data/task-notes/.write-check
- [x] #15 bash scripts/validate-plugin.sh
<!-- DOD:END -->
