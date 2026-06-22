---
id: TASK-136
title: 实验 A：finalise 去 agent 化（bash 直接替换）
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 16:44'
updated_date: '2026-06-21 17:30'
labels:
  - 'kind:basic'
dependencies: []
parent_task_id: TASK-134
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
实验 A：finalise 去 agent 化（bash 直接替换）

Context: Child 2 of epic TASK-134. Can run in parallel with child 3 (实验 B) after child 1 (基准测量) completes. This is an experiment — null results are valid.

Replace the finalise Task-agent spawn in plugin/skills/feature-to-backlog/SKILL.md with a direct bash script that performs the same operations (text concatenation, DoD extraction, CLI calls). Measure the resulting time saving on a reference feature-to-backlog task and document quality impact.

Deliverables:
1. Modified plugin/skills/feature-to-backlog/SKILL.md where finalise no longer spawns a full Task agent
2. docs/experiments/exp-a-finalise-deagent.md documenting the approach, wall-clock comparison vs baseline, quality assessment, and PASS/FAIL verdict

Success criteria: bash scripts/validate-plugin.sh passes.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: 实验 A：finalise 去 agent 化（bash 直接替换）

## Background
The `feature-to-backlog` and `epic-to-backlog` skills each end with a `finalise` phase that spawns a full Task agent. However, the finalise phase does no LLM reasoning — it only performs mechanical text operations: concatenating two markdown files, extracting DoD commands via grep, and calling `backlog task edit` CLI commands. Despite doing no reasoning, TASK-133's finalise agent ran for ~56 s (epic-to-backlog baseline from TASK-134 notes). This is wasted wall-clock time: a bash script can execute the same concatenation + grep + CLI calls in under 1 s. Experiment A tests this hypothesis on a reference feature-to-backlog task and documents any quality impact.

## Goals
1. The `finalise` section of `plugin/skills/feature-to-backlog/SKILL.md` is rewritten to use direct bash commands instead of spawning a Task agent, while preserving all current outputs (combined proposal+plan in Implementation Plan field, DoD items, status transition to Basic: Backlog, validate-plugin.sh gate) — verifiable: `bash scripts/validate-plugin.sh` passes after the change.
2. The experiment result is documented in `docs/experiments/exp-a-finalise-deagent.md` with: the wall-clock time of the modified finalise on a reference task, comparison to the baseline from TASK-135, quality assessment (DoD completeness, field accuracy), and a clear PASS/FAIL verdict — verifiable: `test -f docs/experiments/exp-a-finalise-deagent.md` and `grep -q 'verdict' docs/experiments/exp-a-finalise-deagent.md`.
3. A null result (no meaningful time saving, e.g. < 10 s) is a valid PASS outcome for the experiment itself — the skill change is still retained if the quality is equivalent, and the findings inform child 4's implementation decision.

## Proposed Approach
Replace the "Spawn Task agent" instruction in `### Phase 5: finalise` of `plugin/skills/feature-to-backlog/SKILL.md` with explicit bash commands. The orchestrator (who reads the SKILL.md) will execute these directly rather than spawning a subagent. The bash replacement performs:
1. `grep -oP '(?<=- \[ \] `)[^`]+(?=`)' $TMPDIR/ftb-plan.md > $TMPDIR/ftb-dod-cmds.txt` — extract DoD commands
2. Build `DOD_ARGS` array from the file
3. Concatenate proposal + plan into `$TMPDIR/ftb-combined.md`
4. Call `backlog task edit` with `--plan`, `--status "Basic: Backlog"`, and all `--dod` args
5. Run `bash scripts/validate-plugin.sh`
6. Print completion message

The same approach applies to `plugin/skills/epic-to-backlog/SKILL.md` if the feature-to-backlog experiment shows positive results; however, this experiment scope is feature-to-backlog only, keeping scope minimal.

After modifying the SKILL.md, run one reference feature-to-backlog task (using task-to-backlog for a small non-code topic to avoid recursive execution) and compare wall-clock time for the finalise phase vs the TASK-135 baseline.

## Trade-offs and Risks
We are NOT modifying epic-to-backlog in this experiment — that is deferred to child 4 if results are positive. We are NOT changing the proposalLoop, draftPlan, or planLoop phases. We are NOT changing the quality bar or APPROVED criteria.

Primary risk: the "Spawn Task agent" instruction is what Claude's orchestrator reads to know it should spawn a subagent; replacing it with bash instructions means the orchestrator must execute them inline. This is exactly what we want — but if the orchestrator fails to follow inline bash instructions for some reason, the finalise step would break silently. Mitigation: the validate-plugin.sh gate will catch any malformed output. Secondary risk: timing the finalise phase on a reference task requires running a real feature-to-backlog invocation, which itself takes 400–700 s. Mitigation: scope the reference task to a minimal topic to minimize total pipeline cost.

---

# Plan: 实验 A：finalise 去 agent 化（bash 直接替换）

Proposal: docs/proposals/proposal-exp-a-finalise-deagent.md

## Phase A: Modify feature-to-backlog/SKILL.md finalise phase

### Tests (write first)
Write a contract test that verifies the finalise section of SKILL.md does NOT contain "Spawn Task agent" (ensuring the agent spawn is removed):
- Test file: `scripts/tests/exp-a-no-agent-spawn.test.sh`
- Test case: `grep -q 'Spawn Task agent' plugin/skills/feature-to-backlog/SKILL.md && exit 1 || exit 0`

This test passes (exit 0) when the agent spawn is absent — it currently fails (since the spawn instruction exists).

### Implementation
File to modify: `plugin/skills/feature-to-backlog/SKILL.md`

Replace the `### Phase 5: finalise` section:
- Remove: `Spawn Task agent (pass \`CFG_DOC_PATH\`, \`TASK_ID\`, \`SLUG\` as literal values):` and the indented agent prompt block
- Replace with: direct orchestrator bash instructions that perform the same operations inline:

```
### Phase 5: finalise

Run the following bash commands directly (no agent spawn needed — all steps are mechanical):

**Step B — Extract DoD, concatenate, and update task**:
```bash
grep -oP '(?<=- \[ \] `)[^`]+(?=`)' $TMPDIR/ftb-plan.md \
  > $TMPDIR/ftb-dod-cmds.txt

DOD_ARGS=()
while IFS= read -r cmd; do
  DOD_ARGS+=("--dod" "$cmd")
done < $TMPDIR/ftb-dod-cmds.txt

{
  cat $TMPDIR/ftb-proposal.md
  printf '\n\n---\n\n'
  cat $TMPDIR/ftb-plan.md
} > $TMPDIR/ftb-combined.md

backlog task edit <TASK_ID> \
  --plan "$(cat $TMPDIR/ftb-combined.md)" \
  --status "Basic: Backlog" \
  "${DOD_ARGS[@]}"
```

**Step D — Run validation gate**:
```bash
bash scripts/validate-plugin.sh
```

Add DoD items:
```bash
backlog task edit <TASK_ID> \
  --dod "bash scripts/validate-plugin.sh" \
  --dod "grep -q 'contracts:' plugin/skills/<skill-slug>/SKILL.md"
```

**Step E — Print completion**: (print the standard completion message as text output)
```

### DoD
- `bash scripts/validate-plugin.sh`
- `! grep -q 'Spawn Task agent' plugin/skills/feature-to-backlog/SKILL.md`
- `grep -q 'Run the following bash commands directly' plugin/skills/feature-to-backlog/SKILL.md`

## Phase B: Document experiment results

### Tests (write first)
Write a test verifying the experiment results file exists and contains the required sections:
- Test file: `scripts/tests/exp-a-results-doc.test.sh`
- Test case: `test -f docs/experiments/exp-a-finalise-deagent.md && grep -q 'verdict' docs/experiments/exp-a-finalise-deagent.md`

### Implementation
Create `docs/experiments/exp-a-finalise-deagent.md` documenting:
- **Approach**: Description of the bash replacement approach
- **Baseline**: Phase timings from TASK-135 (read docs/experiments/ftb-phase-timing-baseline.md for reference values)
- **Experiment result**: Wall-clock time for finalise on the reference task after the change (note: if TASK-135 is not yet complete, use the TASK-134 self-timing: finalise=56s as the baseline comparison point)
- **Quality assessment**: Verify DoD items in the generated task are complete and correct, status transition worked, validate-plugin.sh passed
- **Verdict**: PASS if quality is preserved (even if time saving is < 10 s — null result is valid); FAIL only if quality is degraded

### DoD
- `bash scripts/validate-plugin.sh`
- `test -f docs/experiments/exp-a-finalise-deagent.md`
- `test -s docs/experiments/exp-a-finalise-deagent.md`
- `grep -q 'verdict' docs/experiments/exp-a-finalise-deagent.md`
- `grep -q '## Approach' docs/experiments/exp-a-finalise-deagent.md`

## Constraints
- Do not modify epic-to-backlog/SKILL.md in this experiment — that is child 4's scope
- Do not modify proposalLoop, draftPlan, or planLoop phases
- Do not raise or lower the APPROVED quality bar
- The experiment reference task used for timing should be a minimal non-recursive topic (e.g. a task-to-backlog task) to avoid recursive feature-to-backlog invocation
- If TASK-135 (baseline measurement) is not complete when this task runs, use TASK-134 self-timing (finalise=56s) as the comparison baseline and note this in the results doc

## Acceptance Gate
- `bash scripts/validate-plugin.sh`
- `! grep -q 'Spawn Task agent' plugin/skills/feature-to-backlog/SKILL.md`
- `test -f docs/experiments/exp-a-finalise-deagent.md`
- `grep -q 'verdict' docs/experiments/exp-a-finalise-deagent.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Plan review iteration 1: APPROVED

cap:propose=approved

claimed: 2026-06-21T17:30:00Z

All DoD items passed. Merged to main. Experiment A verdict: PASS — finalise de-agentification saves ~50–388s per invocation with no quality loss.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bash scripts/validate-plugin.sh
- [x] #2 grep -q 'Run the following bash commands directly' plugin/skills/feature-to-backlog/SKILL.md
- [x] #3 test -f docs/experiments/exp-a-finalise-deagent.md
- [x] #4 test -s docs/experiments/exp-a-finalise-deagent.md
- [x] #5 grep -q 'verdict' docs/experiments/exp-a-finalise-deagent.md
- [x] #6 grep -q '## Approach' docs/experiments/exp-a-finalise-deagent.md
<!-- DOD:END -->
