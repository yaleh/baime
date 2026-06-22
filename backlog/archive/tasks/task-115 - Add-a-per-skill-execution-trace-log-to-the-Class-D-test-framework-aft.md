---
id: TASK-115
title: 'Add a per-skill execution-trace log to the Class-D test framework: aft'
status: Meta-Plan
assignee: []
created_date: '2026-06-20 14:12'
updated_date: '2026-06-20 14:24'
labels: []
dependencies: []
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a per-skill execution-trace log to the Class-D test framework: after each fixture run, append a structured trace record to experiments/skill-quality/artifacts/trace-log.jsonl with fields {fixture_id, skill, tool_calls, verdict, timestamp} for use by the evaluator trace_replay slice.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
PROPOSAL

# TASK-115 Proposal: Per-Skill Execution-Trace Log for Class-D Test Framework

## Background (Why)

The Class-D runner (`experiments/skill-quality/scripts/run-class-d.ts`) currently executes
fixture runs and writes a single aggregate JSON report to
`artifacts/analysis/exp-class-d-results.json`. Each fixture run extracts a live tool-call
trace from `claude -p --output-format stream-json`, validates compliance, and discards the raw
trace after writing the verdict to the report.

This means the trace data — the ordered sequence of tool calls produced by the skill during
each fixture run — is lost after each execution. The evaluator's **trace_replay slice** (a
planned analysis mode that re-runs compliance checks against logged traces rather than live
claude invocations) cannot operate without a persistent, structured record of those traces.

Without a trace log:
- Each evaluation requires a fresh live claude call (slow, non-deterministic, costs tokens).
- Regression analysis (did a skill regress between runs?) is impossible — there is no
  historical trace to compare against.
- Auditing which tool calls led to a particular verdict requires re-running the full fixture.

## Goals (Observable Outcomes)

1. After each fixture run, a structured record is appended to
   `experiments/skill-quality/artifacts/trace-log.jsonl`.
2. Each record contains the fields:
   `{ fixture_id, skill, tool_calls, verdict, timestamp }`.
3. The JSONL file is machine-readable line-by-line (one JSON object per line, no trailing
   commas, valid JSON on each line).
4. The runner does not break existing behaviour: `exp-class-d-results.json` continues to be
   written with the same schema.
5. A schema-validation script confirms every record in `trace-log.jsonl` conforms to the
   required field set.

## Proposed Decomposition (3 Subjects)

### Subject 1 — Extend the Class-D Runner to Emit Trace Records
Modify `run-class-d.ts` to append a JSONL record to
`artifacts/trace-log.jsonl` after each fixture run. The record includes
`fixture_id`, `skill`, `tool_calls` (array of `{tool_name, tool_input, position}`),
`verdict` (`"pass"` | `"fail"`), and `timestamp` (ISO 8601).

### Subject 2 — Schema Validator for trace-log.jsonl
Write `scripts/validate-trace-log.ts` (or `.sh`) that reads
`artifacts/trace-log.jsonl` line by line and asserts each record contains
all required fields with correct types. Exits non-zero on any violation.
Integrate into `scripts/validate-plugin.sh` or the test suite.

### Subject 3 — Update Evaluator Documentation
Update or create `docs/trace-replay-slice.md` describing how the evaluator
trace_replay slice consumes `artifacts/trace-log.jsonl`: record schema,
field semantics, recommended replay query patterns, and how to run the
validator.

## Trade-offs

| Option | Pro | Con |
|--------|-----|-----|
| Append to JSONL in runner | Zero new dependencies; simple | File grows unboundedly; need rotation policy later |
| Separate sidecar process | Decoupled | More infrastructure; overkill for current scale |
| Embed traces in existing results JSON | One file | Breaks existing schema consumers; not streamable |

**Decision:** JSONL append in-runner is the lowest-friction path. File rotation (by date or
run-id) can be addressed in a follow-up task once the evaluator slice is implemented.

---

IMPLEMENTATION PLAN

# TASK-115 Implementation Plan: Per-Skill Execution-Trace Log for Class-D Framework

## Overview

Three focused subjects implement trace logging end-to-end: the runner emits records,
a validator guards schema integrity, and documentation enables the trace_replay slice.

---

## Subject 1: Extend run-class-d.ts to Emit JSONL Trace Records

**File:** `experiments/skill-quality/scripts/run-class-d.ts`
**Output file:** `experiments/skill-quality/artifacts/trace-log.jsonl`

### What to build

After the `checkCompliance` call inside the per-run loop (line ~282), call a new
`appendTraceRecord` function that constructs and appends one JSON line to
`artifacts/trace-log.jsonl`.

**Record schema:**
```ts
interface TraceRecord {
  fixture_id: string;       // e.g. "lb-claim-before-spawn-01"
  skill: string;            // from fixture.skill, e.g. "loop-backlog"
  tool_calls: ToolBlock[];  // the full trace array from runFixtureAndExtractTrace
  verdict: "pass" | "fail"; // "pass" if compliant, "fail" otherwise
  timestamp: string;        // new Date().toISOString()
}
```

**Implementation notes:**
- Use `appendFileSync` from `node:fs` (synchronous append avoids interleaving between
  runs; K is small).
- In `--dry-run` mode, skip the append (no live trace exists).
- Create the `artifacts/` directory with `mkdirSync` if it doesn't exist (already done
  for `analysisDir`; reuse or guard with `recursive: true`).
- The append call must happen inside the `for (let run = 0; run < K; run++)` loop,
  after the `checkCompliance` result is known but outside the try/finally (so cleanup
  of the test task is not blocked by an I/O error in the trace append).

**Acceptance Criteria:**
- Running `npx tsx scripts/run-class-d.ts --dry-run` does NOT create or modify
  `artifacts/trace-log.jsonl`.
- Running `npx tsx scripts/run-class-d.ts --k 1` appends exactly one line per fixture
  to `artifacts/trace-log.jsonl`, each line being valid JSON containing
  `fixture_id`, `skill`, `tool_calls`, `verdict`, and `timestamp`.
- `artifacts/analysis/exp-class-d-results.json` is still written with its existing
  schema (no fields removed or renamed).

---

## Subject 2: Schema Validator for trace-log.jsonl

**File:** `experiments/skill-quality/scripts/validate-trace-log.sh`
**Reads:** `experiments/skill-quality/artifacts/trace-log.jsonl`

### What to build

A bash script that reads `artifacts/trace-log.jsonl` line by line and validates each
record. Choose bash + `jq` (already available, used elsewhere in the repo) over a
TypeScript script to keep it dependency-light and runnable without `tsx`.

**Validation rules per line:**
1. Line is valid JSON (jq parse does not error).
2. Fields present: `fixture_id` (string, non-empty), `skill` (string, non-empty),
   `tool_calls` (array), `verdict` (string, one of `"pass"` or `"fail"`),
   `timestamp` (string matching ISO 8601 prefix `^\d{4}-\d{2}-\d{2}T`).
3. Each element of `tool_calls` has `tool_name` (string) and `tool_input` (object).

**Exit behaviour:**
- Exit 0 if all records pass.
- Exit 1 and print a human-readable error (line number + field + actual value) on
  the first violation.
- Exit 0 with message "trace-log.jsonl not found — skipping" if the file does not exist
  (graceful: file is only created after a live run).

**Integration:**
Add an invocation of `validate-trace-log.sh` to `scripts/validate-plugin.sh` under
a guard: `if [ -f experiments/skill-quality/artifacts/trace-log.jsonl ]; then ...`.
This keeps CI green on fresh checkouts where no trace log has been generated yet.

**Acceptance Criteria:**
- `bash scripts/validate-trace-log.sh` exits 0 on a well-formed `trace-log.jsonl`.
- `bash scripts/validate-trace-log.sh` exits 1 and prints a descriptive error when a
  record is missing the `verdict` field or contains an invalid value.
- `bash scripts/validate-plugin.sh` passes on a clean checkout (file-not-found guard
  works).

---

## Subject 3: Evaluator Documentation — trace-replay-slice.md

**File:** `experiments/skill-quality/docs/trace-replay-slice.md`
  (create `docs/` under `experiments/skill-quality/` if it does not exist)

### What to build

A concise reference document (not a tutorial) that enables the evaluator trace_replay
slice to consume `artifacts/trace-log.jsonl` without requiring knowledge of the runner
source code.

**Required sections:**

1. **Purpose** — one paragraph: what the trace log is, why it exists, and what the
   trace_replay slice does with it.

2. **Record Schema** — a table or fenced JSON block defining every field:

   | Field | Type | Description |
   |---|---|---|
   | `fixture_id` | string | ID of the Class-D fixture (matches filename stem in `fixtures/class-d/`) |
   | `skill` | string | Skill under test (e.g. `"loop-backlog"`) |
   | `tool_calls` | array of ToolBlock | Ordered list of tool invocations extracted from the claude stream-json output |
   | `verdict` | `"pass"` or `"fail"` | Compliance outcome for this run |
   | `timestamp` | ISO 8601 string | UTC wall-clock time the record was appended |

   ToolBlock sub-fields: `tool_name` (string), `tool_input` (object), `position` (integer, 0-based).

3. **Replay Query Patterns** — three concrete `jq` one-liners:
   - Filter all `"fail"` records: `jq 'select(.verdict == "fail")' trace-log.jsonl`
   - List tool_call sequences for a specific fixture:
     `jq 'select(.fixture_id == "lb-claim-before-spawn-01") | .tool_calls[].tool_name' trace-log.jsonl`
   - Count passes per skill:
     `jq -r '[.skill, .verdict] | @tsv' trace-log.jsonl | sort | uniq -c`

4. **How to Generate the Log** — one code block showing the npx tsx invocation and
   where the output lands.

5. **How to Validate** — one code block showing `bash scripts/validate-trace-log.sh`.

**Acceptance Criteria:**
- File exists at `experiments/skill-quality/docs/trace-replay-slice.md`.
- All five sections are present and contain accurate information consistent with the
  Subject 1 and Subject 2 implementations.
- The `jq` examples are syntactically correct and runnable against a real
  `trace-log.jsonl`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED — background accurately captures the lost-trace problem; goals are observable (JSONL file with required fields); 3-subject decomposition is well-scoped; trade-off rationale is sound.

Proposal approved. Drafting implementation plan.

Plan review iteration 1: APPROVED — all three subjects have precise file paths grounded in actual repo layout; acceptance criteria are observable and shell-verifiable; no forbidden checkbox items; dry-run guard and CI-safe missing-file handling are correctly specified.
<!-- SECTION:NOTES:END -->
