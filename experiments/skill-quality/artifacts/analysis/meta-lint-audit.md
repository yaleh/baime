# Meta-lint Audit: Untagged Quantitative Claims

Scanned: `plugin/skills/*/SKILL.md` — frontmatter `description:` + body lines[:200]

Patterns: multiplier-effect (`Nx speedup`), pct-effect (`N% success/accuracy/...`),
          transferability-field, V-score, time-comparison (`N min → N min`)

Exempt if same line or ±2 lines contain: `evidence:`, `*evidence*:`, `*-evidence:`, `[unvalidated]`

## agent-prompt-evolution

- `[multiplier-effect]` `- Added: coverage-analyzer (10x speedup for coverage analysis)`
- `[pct-effect]` `- **coder**: Universal (100% transferable)`
- `[pct-effect]` `- **doc-writer**: Universal (100% transferable)`
- `[pct-effect]` `- **data-analyst**: Universal (100% transferable)`
- `[pct-effect]` `- **coverage-analyzer**: Domain-specific (testing methodology, 70% transferable to other languages)`
- `[multiplier-effect]` `Potential specialist (coverage-analyzer): 4.5 min (10x faster)`
- `[pct-effect]` `**Universal** (90-100% transferable):`
- `[pct-effect]` `**Domain-Specific** (60-80% transferable):`
- `[pct-effect]` `**Task-Specific** (10-30% transferable):`
- `[transferability-field]` `Transferability: 70%`
- `[pct-effect]` `- Overall: 70% transferable to Python/Rust/TypeScript testing`
- `[transferability-field]` `Transferability: 40%`
- `[pct-effect]` `- Overall: 40% transferable`
- `[transferability-field]` `Transferability: 85%`
- `[pct-effect]` `- Overall: 85% transferable`

## api-design

- `[V-score]` `- **Overall**: V_instance = 0.87 (exceeds 0.80 threshold by +8.75%)`
- `[V-score]` `- **Overall**: V_meta = 0.786 (approaches 0.80 threshold, gap -1.4%)`

## baseline-quality-assessment

- `[V-score]` `Result: V_completeness = 0.60 (60% from prior art, 40% novel)`

## build-quality-gates

- `[V-score]` `V_instance = 0.4×(1−CI_failure_rate)`

## ci-cd-optimization

- `[pct-effect]` `description: Comprehensive CI/CD pipeline methodology with quality gates, release automation, smoke testing, observabili`
- `[pct-effect]` `- ❌ Non-GitHub Actions without adaptation time (70-80% transferable)`

## cross-cutting-concerns

- `[pct-effect]` `description: "Systematic methodology for standardizing cross-cutting concerns (error handling, logging, configuration) t`

## dependency-health

- `[multiplier-effect]` `description: Security-first dependency management methodology with batch remediation, policy-driven compliance, and auto`
- `[multiplier-effect]` `- 6x faster (validated in meta-cc)`

## documentation-management

- `[transferability-field]` `transferability: 93%`
- `[pct-effect]` `- **Retrospective Validation**: 90% structural match, 93% transferability, -3% adaptation effort across 3 diverse docume`
- `[pct-effect]` `- **Validation**: 70% match with CLI Reference (85% transferability)`
- `[pct-effect]` `- **93% transferability** (templates work with <10% adaptation)`

## methodology-bootstrapping

- `[multiplier-effect]` `description: Apply Bootstrapped AI Methodology Engineering (BAIME) to develop project-specific methodologies through sys`
- `[multiplier-effect]` `- Testing strategy (15x speedup example)`
- `[multiplier-effect]` `- CI/CD pipeline (2.5-3.5x speedup example)`
- `[multiplier-effect]` `- Observability system (23-46x speedup example)`
- `[multiplier-effect]` `- Dependency management (6x speedup example)`
- `[multiplier-effect]` `- Knowledge transfer (3-8x speedup example)`
- `[multiplier-effect]` `- Achieves 195x speedup (2 min vs 390 min manual extraction)`
- `[multiplier-effect]` `- ✅ Fast extraction (2-5 min, 195x speedup)`
- `[time-comparison]` `- Speedup: 195x (390 min → 2 min)`
- `[V-score]` `- Quality: V_instance = 0.87, 95% content equivalence`
- `[pct-effect]` `- Reliability: 100% success across 3 experiments`

## observability-instrumentation

- `[multiplier-effect]` `description: Comprehensive observability methodology implementing three pillars (logs, metrics, traces) with structured `

## rapid-convergence

- `[V-score]` `description: Achieve 3-4 iteration methodology convergence (vs standard 5-7) when clear baseline metrics exist, domain s`
- `[multiplier-effect]` `- ❌ Complex specialization needed (>10x speedup from specialists)`
- `[multiplier-effect]` `coverage-analyzer (10x speedup)`
- `[multiplier-effect]` `test-generator (200x speedup)`

## subagent-prompt-construction

- `[V-score]` `description: Systematic methodology for constructing compact (<150 lines), expressive, Claude Code-integrated subagent p`
- `[V-score]` `**Validation**: V_instance=0.895 (phase-planner-executor: 92 lines, 2 agents, 2 MCP tools) | V_meta=0.709 (compactness=0`

## technical-debt-management

- `[multiplier-effect]` `description: Systematic technical debt quantification and management using SQALE methodology with value-effort prioritiz`
- `[multiplier-effect]` `**Transform subjective debt assessment into objective, data-driven paydown strategy with 4.5x speedup.**`

## testing-strategy

- `[multiplier-effect]` `description: Systematic testing methodology for Go projects using TDD, coverage-driven gap closure, fixture patterns, an`
- `[multiplier-effect]` `**Transform ad-hoc testing into systematic, coverage-driven strategy with 15x speedup.**`
- `[pct-effect]` `- ❌ Non-Go projects without adaptation (89% transferable, needs language-specific adjustments)`
- `[multiplier-effect]` `### 1. Coverage Gap Analyzer (186x speedup)`
- `[time-comparison]` `**Speedup**: 15 min manual → 5 sec automated (186x)`
- `[multiplier-effect]` `### 2. Test Generator (200x speedup)`
- `[time-comparison]` `**Speedup**: 10 min manual → 3 sec automated (200x)`

---

## Summary

- **Skills with untagged claims**: 14 / 23
- **Total warnings**: 55

### Top offenders
- `agent-prompt-evolution`: 15 untagged claims
- `methodology-bootstrapping`: 11 untagged claims
- `testing-strategy`: 7 untagged claims
- `documentation-management`: 4 untagged claims
- `rapid-convergence`: 4 untagged claims

### Remediation

For each untagged claim, either:
1. Add `[unvalidated]` inline (for self-reported / theoretical estimates)
2. Add `<field>-evidence: <path-to-results>` in frontmatter (for experimentally validated claims)

Example: `methodology-bootstrapping` 195x speedup
```yaml
# Option A: mark as unvalidated
description: "...195x speedup [unvalidated]..."

# Option B: add evidence pointer
speedup-evidence: experiments/skill-quality/artifacts/analysis/exp-a-results.json
```
