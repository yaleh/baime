# baime

**BAIME (Bootstrapped AI Methodology Engineering)** — A systematic methodology development framework for Claude Code.

baime provides 22 validated skills and 4 specialized agents that help teams develop, validate, and scale AI-assisted software engineering methodologies using the Observe-Codify-Automate (OCA) cycle.

---

## Installation

### Via Claude Code (recommended)

```bash
/plugin marketplace add yaleh/baime
/plugin install baime@baime
```

### Via install script

```bash
git clone https://github.com/yaleh/baime
cd baime && ./scripts/install/install.sh
```

Restart Claude Code after installation.

### Prerequisites for loop-backlog workflow

The loop-backlog autonomous worker requires the [`backlog.md`](https://backlog.md) CLI:

```bash
npm install -g backlog.md
```

After installing, run `/backlog-setup` in your project root to initialize the `backlog/` directory (see [Backlog + Loop Workflow](#backlog--loop-workflow) below).

---

## What's Included

### 4 Agents

| Agent | Purpose |
|-------|---------|
| `iteration-executor` | Run iterative improvement cycles with convergence tracking |
| `iteration-prompt-designer` | Design and refine prompts for iterative AI workflows |
| `knowledge-extractor` | Extract and codify knowledge from project artifacts and session history |
| `workflow-coach` | Coach users to optimize their Claude Code workflow (works standalone; optionally enriched by meta-cc) |

### 22 Skills

| Skill | Purpose |
|-------|---------|
| `agent-prompt-evolution` | Evolve agent prompts through empirical validation |
| `api-design` | Design APIs using systematic methodology |
| `backlog-setup` | Initialize a Backlog.md project with all columns required by the backlog+loop workflow (step 1) |
| `baseline-quality-assessment` | Establish quality baselines for projects |
| `build-quality-gates` | Define and enforce build quality checkpoints |
| `ci-cd-optimization` | Optimize CI/CD pipelines using BAIME |
| `code-refactoring` | Systematic code refactoring methodology |
| `cross-cutting-concerns` | Implement cross-cutting concerns consistently |
| `dependency-health` | Monitor and improve dependency health |
| `documentation-management` | Maintain living documentation systematically |
| `feature-developer` | Execute the full feature development lifecycle from proposal to implementation |
| `feature-to-backlog` | Convert a feature description into a backlog task with TDD implementation plan (step 2 of backlog+loop workflow) |
| `knowledge-transfer` | Transfer knowledge between sessions and team members |
| `loop-backlog` | Autonomous L0 worker that executes Ready tasks from the Backlog.md queue in isolated worktrees (step 3 of backlog+loop workflow) |
| `methodology-bootstrapping` | Bootstrap new methodologies using the BAIME framework (includes Prompt Refinement methodology) |
| `next-step-generation` | Generate ready-to-use next-step prompts from conversation context |
| `observability-instrumentation` | Add observability to systems systematically |
| `rapid-convergence` | Accelerate methodology convergence |
| `subagent-prompt-construction` | Construct effective prompts for Claude Code subagents |
| `task-to-backlog` | Convert a non-development task into a backlog task with a phase-based execution plan (step 2 of backlog+loop workflow) |
| `technical-debt-management` | Manage and reduce technical debt systematically |
| `testing-strategy` | Develop comprehensive testing strategies |

---

## Quick Start

### Use an Agent

In Claude Code, mention the agent in your prompt:

```
@agent-stage-executor Execute Stage 2 of the plan at @docs/plans/current-plan.md
```

### Use a Skill

Skills are automatically available to Claude. Reference the skill context in your prompt:

```
Apply the methodology-bootstrapping skill to develop a testing strategy for this project.
```

### Workflow Coaching

Start a coaching session:

```
@agent-workflow-coach Let's review my Claude Code workflow and find areas to improve.
```

The workflow coach works without any other tools installed. If you also have [meta-cc](https://github.com/yaleh/meta-cc) installed, the coach can optionally enrich its analysis with your actual session history.

---

## Creating Skills with BAIME

BAIME uses its own OCA (Observe → Codify → Automate) methodology to develop new skills:

1. **Observe** — run `/methodology-bootstrapping` on a repeated workflow to extract its pattern
2. **Codify** — write the pattern as a `SKILL.md` spec (pseudocode + implementation)
3. **Automate** — invoke the skill via `/skill-name`; use `/task-to-backlog` or `/feature-to-backlog` to queue skill improvements as backlog tasks

Skills live in `plugin/skills/<name>/SKILL.md`. The `loop-backlog` worker can execute skill-creation tasks autonomously when they are queued as `kind:basic` tasks.

---

## Backlog + Loop Workflow

Use the backlog-integrated skills to set up an autonomous task execution pipeline.

### 1. Initialize

Run once per project to set up the Backlog.md task queue with all required columns:

```
/backlog-setup
```

### 2. Create Tasks

Convert feature requests or general tasks into structured backlog items with phase-based execution plans and automated DoD verification:

```
/feature-to-backlog Add OAuth2 login support
/task-to-backlog Update the project README with workflow documentation
```

**Two task granularities:**
- `kind:basic` — single-scope tasks; the worker executes them directly in an isolated git worktree and merges on success
- `kind:epic` — large cross-cutting work; the worker calls `/epic-to-backlog` to decompose the epic into `kind:basic` children, then executes each child autonomously

Epic lifecycle:
```
Epic: Ready → Epic: Decomposing → [Basic: Ready → Basic: In Progress → Basic: Done] → Epic: Evaluating → Epic: Done
```

Use `/epic-to-backlog "Refactor auth module"` for epics and `/feature-to-backlog "Add OAuth2 login"` for individual basic tasks.

Move tasks to `Ready` when they are ready for execution:

```bash
backlog task edit TASK-1 --status "Ready"
```

### 3. Run the Autonomous Worker

Invoke once to start the event-driven worker loop:

```
/loop-backlog
```

The worker claims `Ready` tasks, executes them in isolated git worktrees, verifies DoD shell commands (with auto-retry), commits and merges changes back to `main`, and marks tasks `Done`. It uses an event-driven daemon (`scripts/loop-backlog-daemon.js`) that watches `backlog/tasks/` and triggers instantly when a task becomes `Ready` — no polling delay.

To stop the worker:

```bash
touch backlog/.loop-stop
```

### 4. Monitor Progress

```bash
backlog task list --plain
backlog task view TASK-1 --plain
```

Or launch the web UI:

```bash
backlog browser --port 6422 --no-open
# open http://localhost:6422/
```

Tasks flow through: `Ready` → `In Progress` → `Done` (or `Needs Human` if the worker gets stuck and needs manual intervention).

---

## Measurement & Self-Improvement

BAIME measures and improves its own development process.

### Self-Reference
BAIME's research subject is BAIME itself — the OCA methodology is used to develop the OCA methodology; `loop-backlog` drives its own evolution. This is not a metaphor: the git log is the evidence.

### GCL (Gate Comprehension Load)
GCL measures cognitive density at human gate decisions: `GCL = E + C + H` where E = explicit context read from the task file, C = cross-boundary context requiring external lookups, H = hidden premises recoverable only from background knowledge. As automation deepens, human gate frequency falls but per-gate cognitive load rises — GCL tracks whether oversight remains substantively engaged. See `docs/research/gcl-synthesis.md`.

### meta-cc Session Analysis
The [`meta-cc`](https://github.com/yaleh/meta-cc) MCP server exposes Claude Code session history for self-analysis: tool-call frequency, context switches, token trends, error patterns. The `@workflow-coach` agent uses this data for workflow diagnostics without requiring external instrumentation.

### Skill Quality Experiments
Skill designs are validated through fixture-based oracle experiments (Exp-A to Exp-K), measuring accuracy deltas from specific design choices (e.g., whether an `## Implementation` section improves plan-gate accuracy). A seven-layer acceptance checklist (`docs/llm-capability-measurement-methodology.md`) gates experimental conclusions: metric triad / statistical validity / difficulty stratification / ground truth / deployment fidelity / meta-validation / provenance.

### Bootstrapping
`loop-backlog` currently processes BAIME's own backlog — skill development, experiment execution, and documentation updates — using the same Basic/Epic dual-track it provides to other projects. Every new skill that lands enters the next OCA cycle.

---

## Related Projects

**[meta-cc](https://github.com/yaleh/meta-cc)** — MCP server for Claude Code session history analysis. Provides query tools, token usage tracking, error analysis, and timeline visualization.

baime and meta-cc are complementary:
- **baime**: methodology skills and agents (this repo)
- **meta-cc**: session history MCP tools (Go server)

---

## Validation

Run the plugin validation script locally:

```bash
pip install pyyaml
bash scripts/validate-plugin.sh
```

Expected output: 4 agents, 22 skills, all YAML frontmatter checks passed.

---

## Contributing

1. Fork the repository
2. Add or modify content in `.claude/agents/` or `.claude/skills/`
3. Ensure all YAML frontmatter includes `name` and `description` fields
4. Run `bash scripts/validate-plugin.sh` — must pass
5. Open a pull request

---

## License

MIT
