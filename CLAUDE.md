# baime

BAIME (Bootstrapped AI Methodology Engineering) - systematic methodology development framework.

Plugin directory: `plugin/`
Validation: `bash scripts/validate-plugin.sh`

## Architecture Decision Records

ADRs live in `docs/adr/`. Read relevant ADRs before:
- modifying or creating skills/agents
- using backlog CLI flags (see ADR-006)
- touching Monitor lifecycle or daemon scripts (see ADR-001, ADR-002)
When a fix resolves a recurring architectural problem, capture it as a new ADR.

## L0 Config

test-cmd: bash scripts/validate-plugin.sh
test-all: bash scripts/validate-plugin.sh
doc-path: docs
adr-path: docs/adr
worktree-symlinks:

## Build & Install

After modifying plugin skills or scripts, rebuild and reinstall:

```bash
bash scripts/install/install.sh --user
```

Verify:

```bash
bash scripts/validate-plugin.sh
```

## loop-backlog

Start the autonomous worker once per session:

```
/loop-backlog
```

Check status: `backlog task list --plain`
Stop: `touch backlog/.loop-stop`

Do NOT start a second loop if one is already running — check for an active Monitor before invoking.

## Experiments

Quantitative skill experiments live in `experiments/skill-quality/`.
Use `/run-quantitative-experiment` to run a new experiment.
Pre-register hypotheses before execution (see `docs/llm-capability-measurement-methodology.md`).

## Session Analysis

Use meta-cc MCP tools to query Claude Code session history for self-analysis, GCL measurement, or debugging session state:

- `mcp__plugin_meta-cc_meta-cc__query_session_signals`
- `mcp__plugin_meta-cc_meta-cc__get_work_patterns`
