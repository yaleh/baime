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

Move tasks to `Ready` when they are ready for execution:

```bash
backlog task edit TASK-1 --status "Ready"
```

### 3. Run the Autonomous Worker

Invoke once to start the event-driven worker loop:

```
/loop-backlog
```

The worker claims `Ready` tasks, executes them in isolated git worktrees, verifies DoD shell commands (with auto-retry), commits and merges changes back to `main`, and marks tasks `Done`. It uses an event-driven daemon (`scripts/loop-backlog-daemon.py`) that watches `backlog/tasks/` and triggers instantly when a task becomes `Ready` — no polling delay.

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
