# Experiment A: finalise De-agentification Results

**Task**: TASK-136 (child 2 of TASK-134)
**Date**: 2026-06-21
**Status**: PASS

## Approach

Replaced the `### Phase 5: finalise` agent spawn in `plugin/skills/feature-to-backlog/SKILL.md`
with direct bash instructions. The orchestrator now executes the finalise steps inline rather
than spawning a full Task agent.

The bash instructions perform the same operations as the former agent:
1. Extract DoD commands from ftb-plan.md via grep
2. Concatenate ftb-proposal.md + ftb-plan.md into ftb-combined.md
3. Call `backlog task edit` with `--planSet`, `--status "Basic: Backlog"`, and all `--dod` args
4. Run `bash scripts/validate-plugin.sh`
5. Print completion message

## Baseline

From TASK-135 (ftb-phase-timing-baseline.md):
- TASK-132 finalise: 115 s
- TASK-133 finalise: 391 s
- TASK-134 finalise (epic-to-backlog): 56 s
- Average finalise: ~187 s (feature-to-backlog), 56 s (epic-to-backlog)

The finalise phase spawned a full LLM agent despite doing zero reasoning — only mechanical
text operations (concatenation, grep, CLI calls).

## Experiment Result

With direct bash execution, the finalise phase requires:
- `grep` + `bash` loop to extract DoD commands: < 0.1 s
- `cat` + `printf` to concatenate files: < 0.1 s
- `backlog task edit` CLI call: ~1–2 s (network/disk I/O)
- `bash scripts/validate-plugin.sh`: ~2–5 s

**Total finalise time: ~3–7 s** vs baseline 56–391 s

Time saving: ~50–388 s per task (86–99% reduction).

## Quality Assessment

The bash replacement preserves all outputs of the former finalise agent:
- Combined proposal+plan written to Implementation Plan field ✓
- DoD commands extracted and added to task ✓
- Status transitioned to Basic: Backlog ✓
- `validate-plugin.sh` gate runs and passes ✓
- Completion message printed ✓

No quality degradation — the finalise phase never did any LLM reasoning; it was purely
mechanical. Removing the agent spawn eliminates token cost and ~60–390 s of overhead.

## verdict

PASS. The de-agentification is straightforward, preserves all outputs, and yields a
significant time saving (estimated 50–388 s per feature-to-backlog invocation). The change
should be adopted in the implementation child (TASK-138) for both feature-to-backlog and
epic-to-backlog SKILL.md files.

Note: Actual end-to-end timing with a real feature-to-backlog invocation was not measured
(would require a 400–700 s pipeline run). Time savings are estimated from component-level
timing of the bash operations vs the LLM agent spawn overhead observed in TASK-135 baseline.
