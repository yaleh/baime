---
id: TASK-112
title: 'Add a WIP_CAP auto-tuning probe to loop-meta: after each full meta-tas'
status: Meta-Plan
assignee: []
created_date: '2026-06-20 14:12'
updated_date: '2026-06-20 14:21'
labels: []
dependencies: []
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a WIP_CAP auto-tuning probe to loop-meta: after each full meta-task lifecycle, emit a JSON record to plugin/loop-meta/data/wip-tuning.jsonl with fields {meta_id, wip_cap_used, cycle_count, elapsed_seconds} to accumulate throughput data for future WIP_CAP calibration.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Meta-Proposal: WIP_CAP Auto-Tuning Probe for loop-meta

## Background

`WIP_CAP` in `loop-meta` is a hard-coded constant set to `2` (SKILL.md line 274: `WIP_CAP = 2`). This value was described as "conservative initial value; adjustable after validation data accumulates" — but no mechanism to accumulate that data exists today. Every `setReady` call reads `WIP_CAP` directly without recording the throughput context in which it was applied.

The consequence is a calibration dead-end: operators cannot determine whether `WIP_CAP = 2` is causing under-utilisation (too few tasks in flight, long queue wait) or over-utilisation (too many tasks competing for LLM context, degraded quality) because no per-lifecycle telemetry is captured. The SKILL.md comment acknowledges future calibration as the goal but provides no data pipeline to reach it.

By emitting a small JSON record to `plugin/loop-meta/data/wip-tuning.jsonl` at the close of each meta-task lifecycle (i.e., when `evaluateAndReplan` advances status to `Meta-Done`), we create a durable, append-only log that accumulates `{meta_id, wip_cap_used, cycle_count, elapsed_seconds}` across real production runs. This dataset is the minimum viable evidence base for a future data-driven WIP_CAP calibration study.

The change is purely additive: it does not alter scheduling logic, gate semantics, or existing acceptance criteria. It is a passive observer — a probe — that writes one line per completed lifecycle without modifying any control flow.

## Goals (Observable)

1. After any meta-task transitions to `Meta-Done`, a new NDJSON line is appended to `plugin/loop-meta/data/wip-tuning.jsonl` containing exactly the four fields: `meta_id`, `wip_cap_used`, `cycle_count`, `elapsed_seconds`.
2. The JSONL file is schema-validated on write: a validator script exits non-zero if any line fails schema (wrong field names, wrong types, missing fields).
3. The SKILL.md specification is updated to document the probe and the schema, making the telemetry contract explicit and visible to future loop-meta implementers.

## Decomposition (3 Subjects)

**Subject 1 — Instrumentation**: Add the `emitWipTuningRecord` hook to `evaluateAndReplan` in the SKILL.md Implementation section. The hook fires immediately after the `Meta-Done` transition line. It reads `WIP_CAP`, counts `idempotentReconcile:` note lines as `cycle_count`, and computes `elapsed_seconds` from the task's `Created` timestamp to `now`. Writes one NDJSON line to `plugin/loop-meta/data/wip-tuning.jsonl`.

**Subject 2 — Schema Validator**: Create `scripts/validate-wip-tuning.sh` — a standalone shell script that reads `plugin/loop-meta/data/wip-tuning.jsonl` (if it exists), validates each line against the four-field schema using `jq`, and exits 0 only if every line conforms. Integrate into `scripts/validate-plugin.sh` so the CI gate covers schema correctness automatically.

**Subject 3 — Documentation**: Update `plugin/loop-meta/SKILL.md` to add a `### emitWipTuningRecord` subsection in the Implementation section documenting the probe's trigger condition, the output schema, the file path, and the calibration intent. Update the SKILL.md `WIP_CAP` Spec stanza to reference the probe as the data-collection mechanism.

## Trade-offs

| Option | Pro | Con |
|---|---|---|
| NDJSON append to file (chosen) | Simple, durable, no infra required, `jq`-queryable | Requires periodic rotation for very long-running systems |
| Emit to daemon log | Reuses existing channel | Mixed with task-ready/meta-ready events; harder to query |
| In-memory aggregation only | Zero disk I/O | Lost on session end; defeats calibration goal |
| Full metrics service | Rich querying | Over-engineered for current scale (single operator) |

NDJSON append is the right fit: it matches the existing `plugin/loop-meta/data/` pattern (structured JSON already lives there), survives session boundaries, and can be consumed by any downstream analysis tool.

---

# Meta-Plan: WIP_CAP Auto-Tuning Probe for loop-meta

## Context

`WIP_CAP = 2` is a hard-coded constant in `.claude/skills/loop-meta/SKILL.md` with no data pipeline to accumulate the throughput evidence needed to calibrate it. This plan adds a passive probe that emits one NDJSON record per completed meta-task lifecycle, a schema validator integrated into `scripts/validate-plugin.sh`, and documentation updates to SKILL.md.

## Subjects

### Subject 1: Instrumentation — emitWipTuningRecord hook

**File**: `.claude/skills/loop-meta/SKILL.md` (Implementation section: `### evaluateAndReplan`)

Add a call to `emitWipTuningRecord` immediately after the `Meta-Done` status transition block in `evaluateAndReplan`. The hook must:

- Read `WIP_CAP` from the environment or the constant (default `2`).
- Count `idempotentReconcile:` lines in the meta-task's notes as `cycle_count` (proxy for reconcile iterations).
- Compute `elapsed_seconds` as `now - task_created_timestamp` using the `Created:` field from `backlog task view --plain`.
- Append a single NDJSON line to `plugin/loop-meta/data/wip-tuning.jsonl` with fields `{meta_id, wip_cap_used, cycle_count, elapsed_seconds}`.
- All fields are required; `wip_cap_used` and `cycle_count` are integers; `elapsed_seconds` is a number; `meta_id` is a string.
- The emit must be idempotent-safe: if the JSONL file does not exist, create it; never overwrite existing lines.

Implementation shell sketch (to be embedded in SKILL.md `### emitWipTuningRecord` section):

```bash
emitWipTuningRecord() {
  local META_ID="$1"
  local WIP_CAP_USED="${WIP_CAP:-2}"
  local DATA_FILE="${REPO_ROOT}/plugin/loop-meta/data/wip-tuning.jsonl"

  TASK_VIEW=$(backlog task view "$META_ID" --plain)

  CYCLE_COUNT=$(echo "$TASK_VIEW" | grep -c "idempotentReconcile:" || true)

  CREATED_STR=$(echo "$TASK_VIEW" | grep -oP '(?<=Created: )\S+' | head -1)
  CREATED_EPOCH=$(date -u -d "$CREATED_STR" +%s 2>/dev/null || echo "0")
  NOW_EPOCH=$(date -u +%s)
  ELAPSED=$(( NOW_EPOCH - CREATED_EPOCH ))

  RECORD=$(printf '{"meta_id":"%s","wip_cap_used":%d,"cycle_count":%d,"elapsed_seconds":%d}\n' \
    "$META_ID" "$WIP_CAP_USED" "$CYCLE_COUNT" "$ELAPSED")

  mkdir -p "$(dirname "$DATA_FILE")"
  printf '%s\n' "$RECORD" >> "$DATA_FILE"
}
```

Call site in `evaluateAndReplan` — after the `Meta-Done` transition:

```bash
  if [ "$EVAL_RESULT" = "Met" ] && [ "${#PENDING_CHILDREN[@]}" -eq 0 ]; then
    backlog task edit "$META_ID" --status "Meta-Done" \
      --append-notes "completionCheck: all children Done, evaluator Met — advancing to Meta-Done"
    emitWipTuningRecord "$META_ID"   # <-- new call
    return 0
  fi
```

### Subject 2: Schema Validator — validate-wip-tuning.sh

**New file**: `scripts/validate-wip-tuning.sh`

A standalone shell script that:

- Accepts no required arguments; reads `plugin/loop-meta/data/wip-tuning.jsonl` relative to repo root.
- If the file does not exist, exits 0 (no data yet is not an error).
- For each line, uses `jq` to assert: all four required keys present (`meta_id`, `wip_cap_used`, `cycle_count`, `elapsed_seconds`); `meta_id` is a string; `wip_cap_used`, `cycle_count`, `elapsed_seconds` are numbers; no extra keys.
- Prints `PASS: wip-tuning.jsonl schema OK (N records)` on success.
- Prints `FAIL: wip-tuning.jsonl line N: <reason>` per violation and exits non-zero.

**Integration point**: `scripts/validate-plugin.sh` — add a call to `bash scripts/validate-wip-tuning.sh` in the `# ── Summary ──` section (before the final `ERRORS` tally) so schema violations surface as CI failures.

```bash
# In validate-plugin.sh — add before the Summary section:
if ! bash "${REPO_ROOT}/scripts/validate-wip-tuning.sh"; then
  ERRORS=$((ERRORS + 1))
fi
```

### Subject 3: Documentation — SKILL.md spec and implementation updates

**File**: `.claude/skills/loop-meta/SKILL.md`

Two targeted additions:

**3a. Spec stanza update** — extend the `WIP_CAP` Spec section to reference the probe:

```
-- WIP_CAP: maximum number of sub-tasks in Ready or In Progress at any time.
-- Conservative initial value; adjustable after validation data accumulates.
-- Throughput data is accumulated by emitWipTuningRecord (called on Meta-Done
-- transition in evaluateAndReplan); query plugin/loop-meta/data/wip-tuning.jsonl
-- to calibrate.
WIP_CAP :: Int
WIP_CAP = 2
```

**3b. New Implementation subsection** — add `### emitWipTuningRecord` after `### evaluateAndReplan` with:
- Trigger condition: fires only on `Meta-Done` advance, never on partial-done or NotMet paths.
- Output schema: `{meta_id: string, wip_cap_used: int, cycle_count: int, elapsed_seconds: int}`.
- File path: `plugin/loop-meta/data/wip-tuning.jsonl` (NDJSON, one record per line, append-only).
- Calibration intent: records accumulate across sessions; future study uses this dataset to determine optimal `WIP_CAP`.
- Shell implementation (same as Subject 1 sketch above).

## Acceptance Criteria

1. After a meta-task is advanced to `Meta-Done` by `evaluateAndReplan`, exactly one new NDJSON line is present in `plugin/loop-meta/data/wip-tuning.jsonl` for that `meta_id`, and `bash scripts/validate-wip-tuning.sh` exits 0.

   Gate: `bash scripts/validate-wip-tuning.sh && grep -c '"meta_id"' plugin/loop-meta/data/wip-tuning.jsonl`

2. `bash scripts/validate-plugin.sh` exits 0 with `validate-wip-tuning.sh` integrated, and exits non-zero when a deliberately malformed JSONL line is injected (missing field or wrong type).

   Gate: `bash scripts/validate-plugin.sh`

3. `.claude/skills/loop-meta/SKILL.md` contains a `### emitWipTuningRecord` subsection and the `WIP_CAP` Spec comment references `plugin/loop-meta/data/wip-tuning.jsonl`.

   Gate: `grep -c 'emitWipTuningRecord' .claude/skills/loop-meta/SKILL.md && grep -c 'wip-tuning.jsonl' .claude/skills/loop-meta/SKILL.md`

## Constraints

- No changes to `setReady`, `idempotentReconcile`, or any scheduling logic — the probe is purely additive.
- `validate-wip-tuning.sh` requires `jq`; add a `command -v jq` guard that prints a warning and exits 0 (skips validation gracefully) if `jq` is absent, so CI is not broken on minimal environments.
- The JSONL file path `plugin/loop-meta/data/wip-tuning.jsonl` is canonical; no alternatives.
- `elapsed_seconds` must be derived from the `Created:` field in task notes, not from wall-clock estimation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED — Background correctly identifies WIP_CAP = 2 as hard-coded with no data pipeline. Goals are observable and shell-verifiable. 3-subject decomposition maps cleanly to instrumentation, validation, and documentation concerns with no overlap. Trade-off table is well-reasoned. NDJSON append matches existing plugin/loop-meta/data/ pattern. Proceeding to implementation plan.

Proposal approved. Drafting implementation plan.

Plan review iteration 1: APPROVED — All 3 subjects specify exact file paths. Acceptance Criteria are shell-verifiable with explicit gate commands. No forbidden - [ ] items. emitWipTuningRecord call site correctly targets the Meta-Done branch of evaluateAndReplan only (not partial-done or NotMet). validate-wip-tuning.sh integration uses ERRORS increment pattern consistent with validate-plugin.sh conventions. jq absence guard prevents CI breakage on minimal environments. Constraints section enforces no-control-flow-change invariant. Plan is ready for decomposition.
<!-- SECTION:NOTES:END -->
