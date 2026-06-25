# baime

**BAIME (Bootstrapped AI Methodology Engineering)** — a self-referential framework for AI-assisted software development, built around two engines with **opposite optimization targets**:

| Engine | Input | Output | Dynamics | Optimizes |
|--------|-------|--------|----------|-----------|
| **Generation Engine** (`/methodology-bootstrapping`) | A repeated workflow + human's project-external insight | A reusable skill / new scope | **Diverges** (its job is *not* to converge) | **Maximizes human leverage** per insight |
| **Execution Engine** (`/loop-backlog`) | A backlog of tasks with DoD gates | Merged, verified software | **Converges** (toward a fixed point) | **Minimizes human touch** |

The two are not a pipeline. **The generation engine decides *what* is worth doing and *how* to do it; the execution engine drives that scope to completion autonomously.** One opens range; the other closes it. The other skills in this repo are products of the generation engine — the skill library is what methodology engineering produces.

---

## What "Bootstrapped" Means — Self-Reference

BAIME's research subject is BAIME itself. This is not a slogan; it is the system's operating structure, along three axes the docs name explicitly (`docs/baime-self-reference-analysis.md`):

- **Self-reference** — the product is not "the output of a methodology" but *"the methodology that develops methodologies."* The OCA cycle works at the meta level: it does not prescribe how to write code, it prescribes how to codify *"how we do things"* into a skill.
- **Self-knowledge** — the system measures its own cognition at human decision points (GCL, premise-ledger) rather than assuming oversight stays meaningful.
- **Self-bootstrap** — the system improves itself with its own tools. `loop-backlog` fixes bugs in `loop-backlog`; the OCA cycle refines the OCA cycle. The git log is the evidence.

**How the two engines relate (without merging them).** They form a feedback loop bridged by the human *at the gate* — execution produces observations → the human, via the generation engine, redesigns the next generation of scope → execution runs the improved version. The human sits on the *boundary* of the loop, not inside it: *"human owns gates, autonomous loop owns execution."* This is a feedback relationship, **not** a linear hand-off. Note the asymmetry the project openly acknowledges: the execution engine is heavily instrumented and measured, while **the generation engine is still almost entirely uninstrumented — the project's current frontier** (`docs/proposals/proposal-self-direction-generative-engine.md`).

---

## Generation Engine (`/methodology-bootstrapping`)

The generation engine turns a repeated human workflow into a reusable Claude Code skill via the **Observe → Codify → Automate (OCA)** cycle:

1. **Observe** — run `/methodology-bootstrapping` on any workflow you repeat more than twice
2. **Codify** — the skill produces a `SKILL.md` spec: pseudocode + implementation + verification gates
3. **Automate** — invoke the new skill via `/skill-name` in any session

The OCA cycle is, formally, **a fixed-point solver for methodology** — it iterates `f(method) = method`: observe current practice → freeze it into a skill → automate execution → that automation generates new observations. Convergence means the method has stabilized; divergence is where the human injects project-external insight to redefine *what the method should even be*.

Skills live in `plugin/skills/<name>/SKILL.md`. **The skills shipped in this repo are the output of this engine** — each was extracted from a recurring engineering pattern and codified into reusable form. See [Skills Built with the Generation Engine](#skills-built-with-the-generation-engine). This engine needs no backlog, no worker, no execution infrastructure.

---

## Execution Engine (`/loop-backlog`)

The execution engine is an autonomous software-development worker. It solves the **collaboration gap** in AI-assisted development: LLM agents are powerful executors but lack reliable task coordination across sessions. The worker provides that coordination — humans control which work is admitted; the machine converges it to completion.

### How it works

Invoke once per session:

```
/loop-backlog
```

It runs indefinitely until you stop it:

```bash
touch backlog/.loop-stop
```

A persistent daemon (`plugin/scripts/basic-daemon.js`) watches `backlog/tasks/` and emits events over five channels:

| Channel | Trigger |
|---------|---------|
| `basic-ready` | A `kind:basic` task is promoted to Ready |
| `epic-ready` | A `kind:epic` task is promoted to Ready for decomposition |
| `child-done` | A child task reaches Done; check if the parent epic is complete |
| `proposal-approved` | Human approved a proposal; draft the plan |
| `plan-approved` | Human approved a plan; finalise the task |

On each event the worker **claims** the task, **spawns** a background agent in an isolated git worktree, **waits** for its signal, **verifies** the DoD shell commands independently, then **merges** to `main` and marks it `Done`. A level-triggered 60-second pulse re-surfaces actionable tasks after `/clear`, so the worker self-re-attaches across session resets — no polling, no lost work.

### Humans own the gates; the machine owns execution

The worker never auto-promotes a task. Work enters the pipeline only when a human explicitly sets it to `Ready`. The Epic lifecycle makes the boundary visible:

```
Epic: Backlog
  → (human promotes)  Epic: Ready
  → (worker)          Epic: Decomposing → Epic: Awaiting Children
  → (children finish) Epic: Evaluating   ← worker writes FINISH/ITERATE recommendation
  → (human confirms)  Epic: Done
```

### Cross-project validation

The execution engine has been deployed on three independent projects:

- **baime** — this repo (self-referential)
- **archguard** — TypeScript MCP architecture-analysis toolset (tasks `task-1` … `task-23`)
- **meta-cc** — Go MCP session-analysis server (tasks `TASK-1` … `TASK-17`)

Bugs found in one deployment (e.g., the `child-done` infinite-wakeup loop seen on both baime and archguard) are fixed once in the plugin and benefit all deployments (ADR-001 design intent). See `docs/loop-backlog-report.md` for the full design and evolution account, and `docs/adr/ADR-009-pulse-predicate-self-clearing.md` for the most recent correctness fix.

### Companion skills

These skills prepare and admit work into the backlog the worker consumes:

| Skill | Role |
|-------|------|
| `backlog-setup` | Initialize the `backlog/` directory with the columns the worker requires |
| `feature-to-backlog` | Convert a code-change request into a task with a TDD plan + DoD gates |
| `task-to-backlog` | Convert a doc/research task into a phased execution plan |
| `epic-to-backlog` | Convert large cross-cutting work into an Epic with a decomposition plan |
| `loop-backlog` | The autonomous B″ worker itself |

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

### Prerequisites for the execution engine

```bash
npm install -g backlog.md
```

Then run `/backlog-setup` once in your project root. The generation engine needs no extra setup.

---

## Using the Execution Engine — the Backlog + Loop Workflow

### 1. Initialize

```
/backlog-setup
```

### 2. Create Tasks

```
/feature-to-backlog Add OAuth2 login support
/task-to-backlog Update the project README
/epic-to-backlog Refactor the auth module
```

**Two granularities:**
- `kind:basic` — single-scope; the worker executes directly in a worktree and merges on success
- `kind:epic` — cross-cutting; the worker decomposes it into `kind:basic` children, then executes each autonomously

Promote a task when it is ready for execution:

```bash
backlog task edit TASK-1 --status "Basic: Ready"
```

### 3. Run the Worker

```
/loop-backlog
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

---

## Skills Built with the Generation Engine

Every skill below was produced by the OCA methodology — extracted from a recurring engineering pattern and codified into a reusable `SKILL.md`. (Companion skills specific to the execution engine are listed [above](#companion-skills).)

| Skill | Purpose |
|-------|---------|
| `agent-prompt-evolution` | Evolve agent prompts through empirical validation |
| `api-design` | Design APIs using systematic methodology |
| `baseline-quality-assessment` | Establish quality baselines for projects |
| `build-quality-gates` | Define and enforce build quality checkpoints |
| `ci-cd-optimization` | Optimize CI/CD pipelines |
| `code-refactoring` | Systematic code refactoring methodology |
| `cross-cutting-concerns` | Implement cross-cutting concerns consistently |
| `dependency-health` | Monitor and improve dependency health |
| `documentation-management` | Maintain living documentation systematically |
| `feature-developer` | Execute the full feature development lifecycle |
| `knowledge-transfer` | Transfer knowledge between sessions and team members |
| `methodology-bootstrapping` | Bootstrap new methodologies using the OCA cycle (the generation engine itself) |
| `next-step-generation` | Generate ready-to-use next-step prompts from conversation context |
| `observability-instrumentation` | Add observability to systems systematically |
| `rapid-convergence` | Accelerate methodology convergence |
| `subagent-prompt-construction` | Construct effective prompts for Claude Code subagents |
| `technical-debt-management` | Manage and reduce technical debt systematically |
| `testing-strategy` | Develop comprehensive testing strategies |

### Agents

| Agent | Purpose |
|-------|---------|
| `iteration-executor` | Run iterative improvement cycles with convergence tracking |
| `iteration-prompt-designer` | Design and refine prompts for iterative AI workflows |
| `knowledge-extractor` | Extract and codify knowledge from project artifacts and session history |
| `workflow-coach` | Coach users to optimize their Claude Code workflow (optionally enriched by meta-cc) |

---

## Measurement & Self-Improvement

BAIME measures its own development process — a methodology is not accepted on intuition but on oracle evidence.

### GCL — Gate Comprehension Load
As automation deepens, the human role shifts from throughput contributor to *gate judge*. GCL operationalizes the question **"how much must a human understand to make a reliable Yes/No gate decision?"** It counts the cognitive units a judge must read, hold, or infer:

`GCL = E + C + H`
- **E (Explicit)** — units read directly from the task's own artifacts (DoD entries, Plan phases)
- **C (Cross-boundary)** — units requiring lookups outside the task (parent Epic, sibling tasks, shared docs)
- **H (Hidden)** — premises in no artifact at all, recalled from memory or inferred from system behavior

The thesis: as automation deepens, human gate *frequency* falls but per-gate *cognitive density* rises. Across a baseline of N=20 gate events, E dominates (~57%) while H is small but high-variance — and a narrowed gate (e.g. DoD evaluation) measures ~1/3 of the overall mean, showing gate-scope control works. The open risk: when GCL is pushed too low, gates degrade into rubber stamps and escape rate climbs. See `docs/research/gcl-definition.md` and `docs/research/gcl-synthesis.md`.

### Skill Quality Experiments (Exp-A … Exp-K)
Skill designs are not asserted; they are tested with fixture-based oracle experiments that measure the accuracy delta of a specific design choice. Concrete findings:

- **Implementation section is load-bearing** — adding an `## Implementation` section to a SKILL.md raised plan-gate accuracy by **+14.5pp** (Exp-A); it is signal, not interference.
- **`reference/` files are not auto-injected** — inlining the implementation (0.98) beat relying on a `reference/` directory (0.80), a **−18pp** gap from a wrong assumption about context loading (Exp-F).
- **Persona framing is a rule-substitute, not a rule-augment** — a reviewer persona lifted under-specified prompts by **+23.7pp** (P-minimal), but the effect collapsed once explicit rules were present (Exp-K), and proved a cross-model **NULL** under higher power (Exp-J).

The lesson recurring across experiments: measurement artifacts (prompt construction, scorer brittleness, fixture ambiguity) explain larger variances than raw model capability. See `docs/skill-quality-experiments-summary.md`.

### Seven-Layer Acceptance Checklist
No experimental conclusion is accepted unless it clears all seven layers (`docs/llm-capability-measurement-methodology.md`): metric triad (single-shot / majority@k / pass^k) · statistical validity (Wilson CI + power) · difficulty stratification (CLEAR/AMBIGUOUS/ERROR) · human-anchored ground truth (dual annotation, κ ≥ 0.60) · deployment fidelity · meta-verification (scorer unit tests + null controls) · provenance (pre-registration + `data_source: measured`). The binding rule: every numeric methodology claim is either oracle-measured or explicitly tagged `[unvalidated]`.

---

## Related Projects

**[meta-cc](https://github.com/yaleh/meta-cc)** — MCP server for Claude Code session history analysis. Injected into the execution engine's gate evidence packs; provides the observability layer for GCL measurement.

**[archguard](https://github.com/yaleh/archguard)** — MCP server for software architecture analysis. Injected into the execution engine's worker context at task claim time; provides change-risk scores that inform execution decisions.

---

## Validation

```bash
pip install pyyaml
bash scripts/validate-plugin.sh
```

Expected output: 4 agents, 25 skills, all YAML frontmatter checks passed.

---

## Contributing

1. Fork the repository
2. Add or modify content in `plugin/skills/` or `plugin/agents/`
3. Ensure all YAML frontmatter includes `name` and `description` fields
4. Run `bash scripts/validate-plugin.sh` — must pass
5. Open a pull request

---

## License

MIT
