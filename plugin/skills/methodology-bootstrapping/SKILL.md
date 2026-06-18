---
name: methodology-bootstrapping
description: Apply Bootstrapped AI Methodology Engineering (BAIME) to develop project-specific methodologies through systematic Observe-Codify-Automate cycles with dual-layer value functions (instance quality + methodology quality). Use when creating testing strategies, CI/CD pipelines, error handling patterns, observability systems, or any reusable development methodology. Provides structured framework with convergence criteria, agent coordination, and empirical validation. Validated in 8 experiments with 100% success rate, 4.9 avg iterations, 10-50x speedup vs ad-hoc. Works for testing, CI/CD, error recovery, dependency management, documentation systems, knowledge transfer, technical debt, cross-cutting concerns.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
contracts:
  - grep: "Observe"
    target: self
  - grep: "convergence"
    target: self
  - grep: "OCA"
    target: self
---

# Methodology Bootstrapping

**Apply Bootstrapped AI Methodology Engineering (BAIME) to systematically develop and validate software engineering methodologies through observation, codification, and automation.**

> The best methodologies are not designed but evolved through systematic observation, codification, and automation of successful practices.

---

## What is BAIME?

**BAIME (Bootstrapped AI Methodology Engineering)** is a unified framework that integrates three complementary methodologies optimized for LLM-based development:

1. **OCA Cycle** (Observe-Codify-Automate) - Core iterative framework
2. **Empirical Validation** - Scientific method and data-driven decisions
3. **Value Optimization** - Dual-layer value functions for quantitative evaluation

This skill provides the complete BAIME framework for systematic methodology development. The methodology is especially powerful when combined with AI agents (like Claude Code) that can execute the OCA cycle, coordinate specialized agents, and calculate value functions automatically.

**Key Innovation**: BAIME treats methodology development like software development—with empirical observation, automated testing, continuous iteration, and quantitative metrics.

---

## When to Use This Skill

Use this skill when you need to:
- 🎯 **Create systematic methodologies** for testing, CI/CD, error handling, observability, etc.
- 📊 **Validate methodologies empirically** with data-driven evidence
- 🔄 **Evolve practices iteratively** using OCA (Observe-Codify-Automate) cycle
- 📈 **Measure methodology quality** with dual-layer value functions
- 🚀 **Achieve rapid convergence** (typically 3-7 iterations, 6-15 hours)
- 🌍 **Create transferable methodologies** (70-95% reusable across projects)

**Don't use this skill for**:
- ❌ One-time ad-hoc tasks without reusability goals
- ❌ Trivial processes (<100 lines of code/docs)
- ❌ When established industry standards fully solve your problem

---

## Quick Start with BAIME (10 minutes)

### 1. Define Your Domain
Choose what methodology you want to develop using BAIME:
- Testing strategy (15x speedup example)
- CI/CD pipeline (2.5-3.5x speedup example)
- Error recovery patterns (80% error reduction example)
- Observability system (23-46x speedup example)
- Dependency management (6x speedup example)
- Documentation system (47% token cost reduction example)
- Knowledge transfer (3-8x speedup example)
- Technical debt management
- Cross-cutting concerns

### 2. Establish Baseline
Measure current state:
```bash
# Example: Testing domain
- Current coverage: 65%
- Test quality: Ad-hoc
- No systematic approach
- Bug rate: Baseline

# Example: CI/CD domain
- Build time: 5 minutes
- No quality gates
- Manual releases
```

### 3. Set Dual Goals
Define both layers:
- **Instance goal** (domain-specific): "Reach 80% test coverage"
- **Meta goal** (methodology): "Create reusable testing strategy with 85%+ transferability"

### 4. Start Iteration 0
Follow the OCA cycle (see [reference/observe-codify-automate.md](reference/observe-codify-automate.md))

---

## Specialized Subagents

BAIME provides two specialized Claude Code subagents to streamline experiment execution:

### iteration-prompt-designer

**When to use**: At experiment start, to create comprehensive ITERATION-PROMPTS.md

**What it does**:
- Designs iteration templates tailored to your domain
- Incorporates modular Meta-Agent architecture
- Provides domain-specific guidance for each iteration
- Creates structured prompts for baseline and subsequent iterations

**How to invoke**:
```
Use the Task tool with subagent_type="iteration-prompt-designer"

Example:
"Design ITERATION-PROMPTS.md for refactoring methodology experiment"
```

**Benefits**:
- ✅ Comprehensive iteration prompts (saves 2-3 hours setup time)
- ✅ Domain-specific value function design
- ✅ Proper baseline iteration structure
- ✅ Evidence-driven evolution guidance

---

### iteration-executor

**When to use**: For each iteration execution (Iteration 0, 1, 2, ...)

**What it does**:
- Executes iteration through lifecycle phases (Observe → Codify → Automate → Evaluate)
- Coordinates Meta-Agent capabilities and agent invocations
- Tracks state transitions (M_{n-1} → M_n, A_{n-1} → A_n, s_{n-1} → s_n)
- Calculates dual-layer value functions (V_instance, V_meta) systematically
- Evaluates convergence criteria rigorously
- Generates complete iteration documentation

**How to invoke**:
```
Use the Task tool with subagent_type="iteration-executor"

Example:
"Execute Iteration 2 of testing methodology experiment using iteration-executor"
```

**Benefits**:
- ✅ Consistent iteration structure across experiments
- ✅ Systematic value calculation (reduces bias, improves honesty)
- ✅ Proper convergence evaluation (prevents premature convergence)
- ✅ Complete artifact generation (data, knowledge, reflections)
- ✅ Reduced iteration time (structured execution vs ad-hoc)

**Important**: iteration-executor reads capability files fresh each iteration (no caching) to ensure latest guidance is applied.

---

### knowledge-extractor

**When to use**: After experiment converges, to extract and transform knowledge into reusable artifacts

**What it does**:
- Extracts patterns, principles, templates from converged BAIME experiment
- Transforms experiment artifacts into production-ready Claude Code skills
- Creates knowledge base entries (patterns/*.md, principles/*.md)
- Validates output quality with structured criteria (V_instance ≥ 0.85)
- Achieves 195x speedup (2 min vs 390 min manual extraction)
- Produces distributable, reusable artifacts for the community

**How to invoke**:
```
Use the Task tool with subagent_type="knowledge-extractor"

Example:
"Extract knowledge from Bootstrap-004 refactoring experiment and create code-refactoring skill using knowledge-extractor"
```

**Benefits**:
- ✅ Systematic knowledge preservation (vs ad-hoc documentation)
- ✅ Reusable Claude Code skills (ready for distribution)
- ✅ Quality validation (95% content equivalence to hand-crafted)
- ✅ Fast extraction (2-5 min, 195x speedup)
- ✅ Knowledge base population (patterns, principles, templates)
- ✅ Automated artifact generation (43% workflow automation with 4 tools)

**Lifecycle position**: Post-Convergence phase
```
Experiment Design → iteration-prompt-designer → ITERATION-PROMPTS.md
       ↓
Iterate → iteration-executor (x N) → iteration-0..N.md
       ↓
Converge → Create results.md
       ↓
Extract → knowledge-extractor → .claude/skills/ + knowledge/
       ↓
Distribute → Claude Code users
```

**Validated performance** (Bootstrap-005):
- Speedup: 195x (390 min → 2 min)
- Quality: V_instance = 0.87, 95% content equivalence
- Reliability: 100% success across 3 experiments
- Automation: 43% of workflow (6/14 steps)

---

## Core Framework

### The OCA Cycle

```
Observe → Codify → Automate
   ↑                    ↓
   └────── Evolve ──────┘
```

**Observe**: Collect empirical data about current practices
- Use meta-cc MCP tools to analyze session history
- Git analysis for commit patterns
- Code metrics (coverage, complexity)
- Access pattern tracking
- Error rate monitoring

**Codify**: Extract patterns and document methodologies
- Pattern recognition from data
- Hypothesis formation
- Documentation as markdown
- Validation with real scenarios

**Automate**: Convert methodologies to automated checks
- Detection: Identify when pattern applies
- Validation: Check compliance
- Enforcement: CI/CD gates
- Suggestion: Automated fix recommendations

**Evolve**: Apply methodology to itself for continuous improvement
- Use tools on development process
- Discover meta-patterns
- Optimize methodology

**Detailed guide**: [reference/observe-codify-automate.md](reference/observe-codify-automate.md)

### Dual-Layer Value Functions

Every iteration calculates two scores:

**V_instance(s)**: Domain-specific task quality
- Example (testing): coverage × quality × stability × performance
- Example (CI/CD): speed × reliability × automation × observability
- Target: ≥0.80

**V_meta(s)**: Methodology transferability quality
- Components: completeness × effectiveness × reusability × validation
- Completeness: Is methodology fully documented?
- Effectiveness: What speedup does it provide?
- Reusability: What % transferable across projects?
- Validation: Is it empirically validated?
- Target: ≥0.80

**Detailed guide**: [reference/dual-value-functions.md](reference/dual-value-functions.md)

### Convergence Criteria

Methodology complete when:
1. ✅ **System stable**: Agent set unchanged for 2+ iterations
2. ✅ **Dual threshold**: V_instance ≥ 0.80 AND V_meta ≥ 0.80
3. ✅ **Objectives complete**: All planned work finished
4. ✅ **Diminishing returns**: ΔV < 0.02 for 2+ iterations

**Alternative patterns**:
- **Meta-Focused Convergence**: V_meta ≥ 0.80, V_instance ≥ 0.55 (when methodology is primary goal)
- **Practical Convergence**: Combined quality exceeds metrics, justified partial criteria

**Detailed guide**: [reference/convergence-criteria.md](reference/convergence-criteria.md)

---

## Iteration Documentation Structure

Every BAIME iteration must produce a comprehensive iteration report following a standardized 10-section structure. This ensures consistent quality, complete knowledge capture, and reproducible methodology development.

### Required Sections

**See complete example**: [examples/iteration-documentation-example.md](examples/iteration-documentation-example.md)

**Use blank template**: [examples/iteration-structure-template.md](examples/iteration-structure-template.md)

1. **Executive Summary** (2-3 paragraphs)
   - Iteration focus and objectives
   - Key achievements
   - Key learnings
   - Value scores (V_instance, V_meta)

2. **Pre-Execution Context**
   - Previous state: M_{n-1}, A_{n-1}, s_{n-1}
   - Previous values: V_instance(s_{n-1}), V_meta(s_{n-1}) with component breakdowns
   - Primary objectives for this iteration

3. **Work Executed** (organized by BAIME phases)
   - **Phase 1: OBSERVE** - Data collection, measurements, gap identification
   - **Phase 2: CODIFY** - Pattern extraction, documentation, knowledge creation
   - **Phase 3: AUTOMATE** - Tool creation, script development, enforcement
   - **Phase 4: EVALUATE** - Metric calculation, value assessment

4. **Value Calculations** (detailed, evidence-based)
   - **V_instance(s_n)** with component breakdowns
     - Each component score with concrete evidence
     - Formula application with arithmetic
     - Final score calculation
     - Change from previous iteration (ΔV)
   - **V_meta(s_n)** with rubric assessments
     - Completeness score (checklist-based, with evidence)
     - Effectiveness score (speedup, quality gains, with evidence)
     - Reusability score (transferability estimate, with evidence)
     - Final score calculation
     - Change from previous iteration (ΔV)

5. **Gap Analysis**
   - **Instance layer gaps** (what's needed to reach V_instance ≥ 0.80)
     - Prioritized list with estimated effort
   - **Meta layer gaps** (what's needed to reach V_meta ≥ 0.80)
     - Prioritized list with estimated effort
   - Estimated work remaining

6. **Convergence Check** (systematic criteria evaluation)
   - **Dual threshold**: V_instance ≥ 0.80 AND V_meta ≥ 0.80
   - **System stability**: M_n == M_{n-1} AND A_n == A_{n-1}
   - **Objectives completeness**: All planned work finished
   - **Diminishing returns**: ΔV < 0.02 for 2+ iterations
   - **Convergence decision**: YES/NO with detailed rationale

7. **Evolution Decisions** (evidence-driven)
   - **Agent sufficiency analysis** (A_n vs A_{n-1})
     - Each agent's performance assessment
     - Decision: evolution needed or not
     - Rationale with evidence
   - **Meta-Agent sufficiency analysis** (M_n vs M_{n-1})
     - Each capability's effectiveness assessment
     - Decision: evolution needed or not
     - Rationale with evidence

8. **Artifacts Created**
   - Data files (coverage reports, metrics, measurements)
   - Knowledge files (patterns, principles, methodology documents)
   - Code changes (implementation, tests, tools)
   - Other deliverables

9. **Reflections**
   - **What worked well** (successes to repeat)
   - **What didn't work** (failures to avoid)
   - **Learnings** (insights from this iteration)
   - **Insights for methodology** (meta-level learnings)

10. **Conclusion**
    - Iteration summary
    - Key metrics and improvements
    - Critical decisions made
    - Next steps
    - Confidence assessment

### File Naming Convention

```
iterations/iteration-N.md
```

Where N = 0, 1, 2, 3, ... (starting from 0 for baseline)

### Documentation Quality Standards

**Evidence-based scores**:
- Every value component score must have concrete evidence
- Avoid vague assessments ("seems good" ❌, "72.3% coverage, +5% from baseline" ✅)
- Show arithmetic for all calculations

**Honest assessment**:
- Low scores early are expected and acceptable (baseline V_meta often 0.15-0.25)
- Don't inflate scores to meet targets
- Document gaps explicitly
- Acknowledge when objectives are not met

**Complete coverage**:
- All 10 sections must be present
- Don't skip reflections (valuable for meta-learning)
- Don't skip gap analysis (critical for planning)
- Don't skip convergence check (prevents premature convergence)

### Tools for Iteration Documentation

**Recommended workflow**:
1. Copy [examples/iteration-structure-template.md](examples/iteration-structure-template.md) to `iterations/iteration-N.md`
2. Invoke `iteration-executor` subagent to execute iteration with structured documentation
3. Review [examples/iteration-documentation-example.md](examples/iteration-documentation-example.md) for quality reference

**Automated generation**: Use `iteration-executor` subagent to ensure consistent structure and systematic value calculation.

---

## Three-Layer Architecture

**BAIME** integrates three complementary methodologies into a unified framework:

**Layer 1: Core Framework (OCA Cycle)**
- Observe → Codify → Automate → Evolve
- Three-tuple output: (O, Aₙ, Mₙ)
- Self-referential feedback loop
- Agent coordination

**Layer 2: Scientific Foundation (Empirical Methodology)**
- Empirical observation tools
- Data-driven pattern extraction
- Hypothesis testing
- Scientific validation

**Layer 3: Quantitative Evaluation (Value Optimization)**
- Dual-layer value functions (V_instance + V_meta)
- Convergence mathematics
- Agent as gradient, Meta-Agent as Hessian
- Optimization perspective

**Why "BAIME"?** The framework bootstraps itself—methodologies developed using BAIME can be applied to improve BAIME itself. This self-referential property, combined with AI-agent coordination, makes it uniquely suited for LLM-based development tools.

**Detailed guide**: [reference/three-layer-architecture.md](reference/three-layer-architecture.md)

---

## Proven Results

**Validated in 8 experiments**:
- ✅ 100% success rate (8/8 converged)
- ⏱️ Average: 4.9 iterations, 9.1 hours
- 📈 V_instance average: 0.784 (range: 0.585-0.92)
- 📈 V_meta average: 0.840 (range: 0.83-0.877)
- 🌍 Transferability: 70-95%+
- 🚀 Speedup: 3-46x vs ad-hoc

**Example applications**:
- **Testing strategy**: 15x speedup, 75%→86% coverage ([examples/testing-methodology.md](examples/testing-methodology.md))
- **CI/CD pipeline**: 2.5-3.5x speedup, 91.7% pattern validation ([examples/ci-cd-optimization.md](examples/ci-cd-optimization.md))
- **Error recovery**: 80% error reduction, 85% transferability
- **Observability**: 23-46x speedup, 90-95% transferability
- **Dependency health**: 6x speedup (9h→1.5h), 88% transferability
- **Knowledge transfer**: 3-8x onboarding speedup, 95%+ transferability
- **Documentation**: 47% token cost reduction, 85% transferability
- **Technical debt**: SQALE quantification, 85% transferability

---

## Usage Templates

### Experiment Template
Use [templates/experiment-template.md](templates/experiment-template.md) to structure your methodology development:
- README.md structure
- Iteration prompts
- Knowledge extraction format
- Results documentation

### Iteration Prompt Template
Use [templates/iteration-prompts-template.md](templates/iteration-prompts-template.md) to guide each iteration:
- Iteration N objectives
- OCA cycle execution steps
- Value calculation rubrics
- Convergence checks

**Automated generation**: Use `iteration-prompt-designer` subagent to create domain-specific iteration prompts.

### Iteration Documentation Template

**Structure template**: [examples/iteration-structure-template.md](examples/iteration-structure-template.md)
- 10-section standardized structure
- Blank template ready to copy and fill
- Includes all required components

**Complete example**: [examples/iteration-documentation-example.md](examples/iteration-documentation-example.md)
- Real iteration from test strategy experiment
- Shows proper value calculations with evidence
- Demonstrates honest assessment and gap analysis
- Illustrates quality reflections and insights

**Automated execution**: Use `iteration-executor` subagent to ensure consistent structure and systematic value calculation.

**Quality standards**:
- Evidence-based scoring (concrete data, not vague assessments)
- Honest evaluation (low scores acceptable, inflation harmful)
- Complete coverage (all 10 sections required)
- Arithmetic shown (all value calculations with steps)

---

## Common Pitfalls

❌ **Don't**:
- Use only one methodology layer in isolation (except quick prototyping)
- Predetermine agent evolution path (let specialization emerge from data)
- Force convergence at target iteration count (trust the criteria)
- Inflate value metrics to meet targets (honest assessment critical)
- Skip empirical validation (data-driven decisions only)

✅ **Do**:
- Start with OCA cycle, add evaluation and validation
- Let agent specialization emerge from domain needs
- Trust the convergence criteria (system knows when done)
- Calculate V(s) honestly based on actual state
- Complete all analysis thoroughly before codifying

### Iteration Documentation Pitfalls

❌ **Don't**:
- Skip iteration documentation (every iteration needs iteration-N.md)
- Calculate V-scores without component breakdowns and evidence
- Use vague assessments ("seems good", "probably 0.7")
- Omit gap analysis or convergence checks
- Document only successes (failures provide valuable learnings)
- Assume convergence without systematic criteria evaluation
- Inflate scores to meet targets (honesty is critical)
- Skip reflections section (meta-learning opportunity)

✅ **Do**:
- Use `iteration-executor` subagent for consistent structure
- Provide concrete evidence for each value component
- Show arithmetic for all calculations
- Document both instance and meta layer gaps explicitly
- Include reflections (what worked, didn't work, learnings, insights)
- Be honest about scores (baseline V_meta of 0.20 is normal and acceptable)
- Follow the 10-section structure for every iteration
- Reference iteration documentation example for quality standards

---

## Related Skills

**Acceleration techniques** (achieve 3-4 iteration convergence):
- [rapid-convergence](../rapid-convergence/SKILL.md) - Fast convergence patterns
- [retrospective-validation](../retrospective-validation/SKILL.md) - Historical data validation
- [baseline-quality-assessment](../baseline-quality-assessment/SKILL.md) - Strong iteration 0

**Supporting skills**:
- [agent-prompt-evolution](../agent-prompt-evolution/SKILL.md) - Track agent specialization

**Domain applications** (ready-to-use methodologies):
- [testing-strategy](../testing-strategy/SKILL.md) - TDD, coverage-driven, fixtures
- [error-recovery](../error-recovery/SKILL.md) - Error taxonomy, recovery patterns
- [ci-cd-optimization](../ci-cd-optimization/SKILL.md) - Quality gates, automation
- [observability-instrumentation](../observability-instrumentation/SKILL.md) - Logging, metrics, tracing
- [dependency-health](../dependency-health/SKILL.md) - Security, freshness, compliance
- [knowledge-transfer](../knowledge-transfer/SKILL.md) - Onboarding, learning paths
- [technical-debt-management](../technical-debt-management/SKILL.md) - SQALE, prioritization
- [cross-cutting-concerns](../cross-cutting-concerns/SKILL.md) - Pattern extraction, enforcement

---

## References

**Core documentation**:
- [Overview](reference/overview.md) - Architecture and philosophy
- [OCA Cycle](reference/observe-codify-automate.md) - Detailed process
- [Value Functions](reference/dual-value-functions.md) - Evaluation framework
- [Convergence Criteria](reference/convergence-criteria.md) - When to stop
- [Three-Layer Architecture](reference/three-layer-architecture.md) - Framework layers

**Quick start**:
- [Quick Start Guide](reference/quick-start-guide.md) - Step-by-step tutorial

**Examples**:
- [Testing Methodology](examples/testing-methodology.md) - Complete walkthrough
- [CI/CD Optimization](examples/ci-cd-optimization.md) - Pipeline example
- [Error Recovery](examples/error-recovery.md) - Error handling example

**Templates**:
- [Experiment Template](templates/experiment-template.md) - Structure your experiment
- [Iteration Prompts](templates/iteration-prompts-template.md) - Guide each iteration

---

**Status**: ✅ Production-ready | BAIME Framework | 8 experiments | 100% success rate | 95% transferable

**Terminology**: This skill implements the **Bootstrapped AI Methodology Engineering (BAIME)** framework. Use "BAIME" when referring to this methodology in documentation, research, or when asking Claude Code for assistance with methodology development.

---

## Prompt Refinement Methodology

BAIME includes a systematic process for refining prompts used to drive LLM workflows. Effective prompts are a form of methodology asset — they encode hard-won knowledge about how to get consistent, high-quality results from AI agents.

### Why Prompt Refinement Matters

Prompts are the primary interface between human intent and AI execution. Poorly specified prompts lead to:

- Excessive clarification rounds (efficiency loss)
- Inconsistent outputs across sessions (quality loss)
- Repeated manual corrections (knowledge not captured)

Applying BAIME's OCA cycle to prompts transforms them from ad-hoc one-offs into validated, reusable assets.

### The OCA Cycle Applied to Prompts

**Observe**: Collect evidence of prompt performance
- Record which prompts required correction
- Note which prompts produced excellent results on the first attempt
- Identify patterns in the corrections (missing context, vague objectives, wrong scope)

**Codify**: Extract and formalize what makes prompts effective
- Document the structural patterns from high-performing prompts
- Identify the minimum context a prompt needs (file refs, scope, constraints)
- Create a reusable template for each recurring task type

**Automate**: Operationalize the refined prompts
- Save validated prompts to a prompt library (e.g., `.meta-cc/prompts/library/`)
- Tag prompts with task category and effectiveness score
- Reference saved prompts instead of re-writing from scratch

### Prompt Quality Dimensions

When evaluating a prompt, assess these dimensions:

| Dimension | Poor | Good |
|-----------|------|------|
| Context specificity | "Fix the bug" | "Fix the type error in `@src/parser.go:42`" |
| Scope clarity | "Update docs" | "Update `@README.md` Installation section only" |
| Constraint explicitness | "Make it fast" | "Optimize without changing the public API" |
| File references | File content pasted inline | `@file:line-range` references |
| Success criteria | Absent | Explicit and verifiable |

### Iterative Refinement Process

1. **Draft**: Write the prompt as you naturally would
2. **Execute**: Run it and observe the result
3. **Gap analysis**: What did the result lack? What clarification did you need to add?
4. **Refine**: Incorporate the gap into the prompt upfront
5. **Validate**: Re-run the refined prompt (or apply it to a similar task) and confirm improvement
6. **Save**: If the refined prompt is reusable, save it to the project prompt library

### Integration with BAIME Value Functions

Apply the dual-layer value function to prompt methodology:

- **Instance quality V_I**: Did this specific prompt produce a correct, complete result without correction?
- **Methodology quality V_M**: Does the prompt template transfer to similar tasks with consistent results?

A prompt template with V_M ≥ 0.8 is a validated methodology asset worth preserving in the library.

### Prompt Library Management

Maintain a local prompt library to capture institutional knowledge:

```
.meta-cc/prompts/library/
├── feature-implementation-001.md   # Template for new feature work
├── bug-fix-002.md                  # Template for bug investigation
├── test-writing-001.md             # Template for test authoring
└── code-review-003.md              # Template for review requests
```

Each saved prompt should include:
- **Original prompt**: what you first wrote
- **Optimized prompt**: the refined version after gap analysis
- **Keywords**: for retrieval
- **Usage count**: tracks which prompts are most valuable
- **Effectiveness score**: tracks prompt quality over time
