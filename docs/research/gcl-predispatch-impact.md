# GCL Pre-dispatch Enrichment: C-Component Impact Measurement

**Status**: Pending data (requires ≥5 enriched gate events)
**Created**: 2026-06-24

## Background

TASK-183 introduces Archguard change-risk context injection into `buildExecutePrompt` at claim
time. The hypothesis is that providing workers with historical commit frequency and co-change
neighbors reduces the C (Comprehension) component of GCL by anchoring their mental model of
the codebase before execution begins.

The enrichment is advisory and non-blocking: when `.archguard/query/git-history/file-metrics.json`
is unavailable, the risk block is omitted silently.

## Measurement Design

- **Unit of observation**: one gate event (verifyDod pass leading to Basic: Done transition)
- **C-component source**: GCL self-report in task Notes (`GCL-self-report` line)
- **Grouping variable**: `context_enriched` — yes if the archguard block was injected (task
  description contained verifiable file paths AND metrics data existed), no otherwise
- **Primary metric**: mean C score per group
- **Baseline period**: all gate events before TASK-183 merge

## Observation Table

| Task ID | Date       | C value | context_enriched | Notes                      |
|---------|------------|---------|------------------|----------------------------|
| —       | —          | —       | —                | Awaiting first enriched run |

## Results

```
baseline: 4.50
post_mean: N/A (pending data)
delta: pending
n_enriched: 0
n_baseline: (see gcl-events.jsonl)
```

> Note: `baseline: 4.50` is drawn from the GCL corpus C-component mean reported in
> `docs/research/gcl-baseline.md`. This document will be updated once ≥5 gate events
> with `context_enriched: yes` have completed.

## Update Protocol

After each enriched task completes:
1. Append a row to the Observation Table above.
2. Recompute `post_mean` and `delta = post_mean − baseline`.
3. When `n_enriched ≥ 5`, update Results and add a brief interpretation.

## Related Artifacts

- `scripts/lib/parse-task-files.js` — extracts file paths from task description
- `scripts/lib/fetch-risk-context.js` — fetches Archguard metrics for those paths
- `plugin/skills/loop-backlog/SKILL.md` — `buildExecutePrompt` integration point
- `docs/research/gcl-events.jsonl` — ground truth event log
- `docs/research/gcl-baseline.md` — baseline C values
