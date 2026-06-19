---
id: TASK-16
title: 为无形式规格的 14 个 skill 评估并补充规格覆盖
status: Done
assignee: []
created_date: '2026-06-17 16:04'
updated_date: '2026-06-18 10:09'
labels:
  - spec-quality
  - documentation
dependencies: []
priority: low
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 问题

22 个 skill 中有 14 个（占 64%）完全没有形式化规格（无 `## Spec` 节，无 `λ` 入口，无类型签名）：

agent-prompt-evolution, api-design, baseline-quality-assessment, build-quality-gates, ci-cd-optimization, cross-cutting-concerns, dependency-health, documentation-management, feature-developer, knowledge-transfer, next-step-generation, observability-instrumentation, rapid-convergence, technical-debt-management, testing-strategy

另有 2 个（code-refactoring, subagent-prompt-construction）只有 `λ` 入口，无 spec 体。

这些 skill 的行为完全依赖自然语言描述，没有可验证的约束，也无法做静态分析。

## 建议方向

1. 先调研这些 skill 的实际使用情况（是否有用户/项目在用）
2. 对高价值 skill 补充至少：`λ` 入口签名 + 核心数据类型定义 + 主流程函数签名
3. 制定"skill 规格最低标准"，作为新 skill 合并的门槛
4. 评估是否所有 skill 都需要 Haskell spec，或部分 skill 用自然语言描述已足够
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: 为 16 个无形式规格的 skill 建立最低规格标准

## Background

BAIME 的 Layer 0-2 验证框架（`scripts/validate-plugin.sh`）已具备三级检查能力：

- **Layer 0（内部一致性）**：`## Spec` 与 `## Implementation` 的函数引用对齐检查
- **Layer 1（合约测试）**：YAML frontmatter 中 `contracts:` 字段的 grep/not-grep 断言
- **Layer 2（单元测试）**：`scripts/*.test.{js,sh}` 的可执行验证

TASK-25 已为 `loop-backlog` 建立了 `contracts:` 范例，但 23 个 skill 中仅有 1 个持有 `contracts:` 断言，5 个持有 `## Spec`，合计 **16 个 skill 完全没有形式化规格**（无 `## Spec`，无 `contracts:`）：

`api-design`, `baseline-quality-assessment`, `build-quality-gates`, `ci-cd-optimization`, `code-refactoring`, `cross-cutting-concerns`, `dependency-health`, `documentation-management`, `feature-developer`, `knowledge-transfer`, `next-step-generation`, `observability-instrumentation`, `rapid-convergence`, `subagent-prompt-construction`, `technical-debt-management`, `testing-strategy`

这些 skill 的行为完全依赖自然语言描述，没有可验证的约束，Layer 1 合约测试对它们形同虚设。随着 TASK-20（执行时 manifest 验证）即将落地，缺少 `contracts:` 字段将成为持续的测试覆盖空洞。

## Goals

1. 为每个无规格 skill 的 SKILL.md 建立 **6 节结构标准**（Trigger、Do not trigger、Workflow、Boundaries、Verification、Failure behavior），使 skill 行为边界可读可审查。
2. 为每个无规格 skill 的 frontmatter 添加 **至少 2 条 `contracts:` 断言**，使 Layer 1 合约测试能够对这 16 个 skill 产生实际覆盖。
3. 验证完成后 `bash scripts/validate-plugin.sh` 全部通过（0 errors），且每个 skill 至少有 1 条合约 PASS 记录。
4. 建立"skill 最低规格门槛"文档（`docs/skill-spec-standard.md`），作为新 skill 合并的标准参考，防止规格空洞复发。

## Proposed Approach

### 6 节结构标准

每个 SKILL.md 的 `## Spec` 节采用以下固定小节，替代现有的 Haskell DSL（对无行为状态机的 skill 过重）：

```
## Spec

### Trigger
（何时调用此 skill——触发条件，一到三句话）

### Do not trigger
（反例——哪些场景不应调用此 skill）

### Workflow
（主流程步骤，编号列表，每步一行）

### Boundaries
（明确不做什么；资源/时间/副作用边界）

### Verification
（如何判断 skill 执行成功——可观测的输出或状态）

### Failure behavior
（遇到歧义或阻塞时的降级策略）
```

### contracts: 最低要求

每个 skill 的 frontmatter 至少包含 **2 条** `contracts:` 断言，优先覆盖：

- 核心关键词是否出现（grep），例如 Verification 节中的动词
- 禁止行为是否缺席（not-grep），例如 Boundaries 明确排除的工具/命令

示例（以 `code-refactoring` 为例）：

```yaml
contracts:
  - grep: "## Verification"
    target: self
  - not-grep: "git push"
    target: self
```

### 实施优先级

16 个 skill 按使用频率分两批处理：

**批次 1（高频，8 个）**：`feature-developer`, `code-refactoring`, `subagent-prompt-construction`, `testing-strategy`, `api-design`, `documentation-management`, `technical-debt-management`, `dependency-health`

**批次 2（低频，8 个）**：`baseline-quality-assessment`, `build-quality-gates`, `ci-cd-optimization`, `cross-cutting-concerns`, `knowledge-transfer`, `next-step-generation`, `observability-instrumentation`, `rapid-convergence`

每批处理完成后运行 `bash scripts/validate-plugin.sh` 做阶段性验收。

## Trade-offs and Risks

| 风险 | 缓解 |
|------|------|
| 6 节结构标准对高复杂 skill（如 `feature-developer`）描述力不足 | 允许在 `### Workflow` 节内嵌子步骤列表；复杂 skill 可额外保留 λ 入口 |
| contracts: 断言过于宽泛（如 grep: "##"）无实际保护价值 | 每条断言必须绑定具体业务词汇，代码审查时校验断言非平凡性 |
| 批量修改 16 个文件可能引入格式回归 | 每批修改后执行 validate-plugin.sh；Layer 0 frontmatter 检查兜底 |
| skill-spec-standard.md 文档过时风险 | 将文档路径写入 validate-plugin.sh 的存在性检查（Layer 0 扩展点） |

---

# TDD Implementation Plan: Establish Minimum Spec Standards for 16 Skills (TASK-16)

## Overview

Add a 6-section `## Spec` block and at least 2 `contracts:` assertions to each of the 16 skill
SKILL.md files that currently have no formal specification. Also create `docs/skill-spec-standard.md`
as the canonical template document. All phases are validated with `bash scripts/validate-plugin.sh`.

**16 target skills** (confirmed spec-less from codebase inspection):
`api-design`, `baseline-quality-assessment`, `build-quality-gates`, `ci-cd-optimization`,
`code-refactoring`, `cross-cutting-concerns`, `dependency-health`, `documentation-management`,
`feature-developer`, `knowledge-transfer`, `next-step-generation`, `observability-instrumentation`,
`rapid-convergence`, `subagent-prompt-construction`, `technical-debt-management`, `testing-strategy`

---

## Phase A: Establish the Skill-Spec Standard Document

### Tests

```bash
# A-T1: standard doc exists
test -f docs/skill-spec-standard.md

# A-T2: required section headings present
grep -q "^## 6-Section Spec Structure" docs/skill-spec-standard.md
grep -q "### Trigger"            docs/skill-spec-standard.md
grep -q "### Do not trigger"     docs/skill-spec-standard.md
grep -q "### Workflow"           docs/skill-spec-standard.md
grep -q "### Boundaries"         docs/skill-spec-standard.md
grep -q "### Verification"       docs/skill-spec-standard.md
grep -q "### Failure behavior"   docs/skill-spec-standard.md

# A-T3: contracts minimum requirement documented
grep -q "contracts:" docs/skill-spec-standard.md

# A-T4: validate script passes (pre-existing baseline)
bash scripts/validate-plugin.sh
```

### Implementation

1. Create `docs/skill-spec-standard.md` with:
   - **Purpose**: explains that every SKILL.md merged into BAIME must satisfy this standard
   - **`## 6-Section Spec Structure`** — defines the six subsections (Trigger, Do not trigger, Workflow, Boundaries, Verification, Failure behavior) with one-sentence description each and a copy-paste skeleton
   - **`## contracts: Minimum Requirement`** — states >= 2 assertions per skill, non-trivial (must bind domain vocabulary, not just `## ` presence), with a worked example using `code-refactoring`
   - **`## Exemptions`** — skills using Haskell/lambda-DSL Spec (like `loop-backlog`) are exempt from the 6-section structure but still need `contracts:`
   - **`## Merge Checklist`** — ordered checklist a PR author runs before merging a new skill

### DoD

- [ ] `bash scripts/validate-plugin.sh` passes (0 errors)
- [ ] `test -f docs/skill-spec-standard.md`
- [ ] `grep -q "### Trigger" docs/skill-spec-standard.md`
- [ ] `grep -q "### Failure behavior" docs/skill-spec-standard.md`
- [ ] `grep -q "contracts:" docs/skill-spec-standard.md`

---

## Phase B: Batch 1 — 8 High-Frequency Skills

Target skills: `feature-developer`, `code-refactoring`, `subagent-prompt-construction`,
`testing-strategy`, `api-design`, `documentation-management`, `technical-debt-management`,
`dependency-health`

### Tests

```bash
# B-T1: validate script passes after each skill edit
bash scripts/validate-plugin.sh

# B-T2: ## Spec section exists in each skill
grep -q "^## Spec"       plugin/skills/feature-developer/SKILL.md
grep -q "^## Spec"       plugin/skills/code-refactoring/SKILL.md
grep -q "^## Spec"       plugin/skills/subagent-prompt-construction/SKILL.md
grep -q "^## Spec"       plugin/skills/testing-strategy/SKILL.md
grep -q "^## Spec"       plugin/skills/api-design/SKILL.md
grep -q "^## Spec"       plugin/skills/documentation-management/SKILL.md
grep -q "^## Spec"       plugin/skills/technical-debt-management/SKILL.md
grep -q "^## Spec"       plugin/skills/dependency-health/SKILL.md

# B-T3: required Spec subsections present in each skill (spot-check Trigger + Verification)
for skill in feature-developer code-refactoring subagent-prompt-construction testing-strategy \
             api-design documentation-management technical-debt-management dependency-health; do
  grep -q "### Trigger"       plugin/skills/$skill/SKILL.md
  grep -q "### Verification"  plugin/skills/$skill/SKILL.md
done

# B-T4: contracts: field present in each frontmatter
for skill in feature-developer code-refactoring subagent-prompt-construction testing-strategy \
             api-design documentation-management technical-debt-management dependency-health; do
  grep -q "^contracts:" plugin/skills/$skill/SKILL.md
done

# B-T5: each skill has at least 2 contract entries
for skill in feature-developer code-refactoring subagent-prompt-construction testing-strategy \
             api-design documentation-management technical-debt-management dependency-health; do
  count=$(grep -c "^  - grep:\|^  - not-grep:" plugin/skills/$skill/SKILL.md || true)
  [ "$count" -ge 2 ]
done
```

### Implementation

For each of the 8 skills, apply two edits to its `SKILL.md`:

**Edit 1 — Add `contracts:` to YAML frontmatter** (before the closing `---`).
Each skill gets >= 2 non-trivial assertions. Planned contracts per skill:

| Skill | contract 1 (grep) | contract 2 (not-grep) |
|---|---|---|
| `feature-developer` | `grep: "## Phase"` | `not-grep: "git push"` |
| `code-refactoring` | `grep: "### Verification"` | `not-grep: "git push"` |
| `subagent-prompt-construction` | `grep: "### Boundaries"` | `not-grep: "git commit"` |
| `testing-strategy` | `grep: "### Trigger"` | `not-grep: "git push"` |
| `api-design` | `grep: "### Trigger"` | `not-grep: "git push"` |
| `documentation-management` | `grep: "### Trigger"` | `not-grep: "git push"` |
| `technical-debt-management` | `grep: "### Trigger"` | `not-grep: "git push"` |
| `dependency-health` | `grep: "### Trigger"` | `not-grep: "git push"` |

**Edit 2 — Append `## Spec` section** (after existing body content, or replacing a thin body).
The section follows the 6-section structure from `docs/skill-spec-standard.md`. Content is grounded
in the skill's existing description and body, not invented.

Sub-steps per skill:
1. Read the existing SKILL.md to understand current body/description.
2. Draft all 6 subsections (Trigger, Do not trigger, Workflow, Boundaries, Verification, Failure behavior) from that context — max ~40 lines total for the Spec block.
3. Choose 2 contracts that reference concrete terms from the Spec (e.g., subsection heading or domain verb).
4. Apply both edits. Run `bash scripts/validate-plugin.sh` after each skill; stop and fix on FAIL.

Order: `feature-developer` -> `code-refactoring` -> `subagent-prompt-construction` ->
`testing-strategy` -> `api-design` -> `documentation-management` -> `technical-debt-management` ->
`dependency-health`. Run the full validate script after all 8 are done.

### DoD

- [ ] `bash scripts/validate-plugin.sh` passes (0 errors)
- [ ] `grep -q "^## Spec" plugin/skills/feature-developer/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/code-refactoring/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/subagent-prompt-construction/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/testing-strategy/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/api-design/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/documentation-management/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/technical-debt-management/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/dependency-health/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/feature-developer/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/code-refactoring/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/subagent-prompt-construction/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/testing-strategy/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/api-design/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/documentation-management/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/technical-debt-management/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/dependency-health/SKILL.md`

---

## Phase C: Batch 2 — 8 Lower-Frequency Skills

Target skills: `baseline-quality-assessment`, `build-quality-gates`, `ci-cd-optimization`,
`cross-cutting-concerns`, `knowledge-transfer`, `next-step-generation`,
`observability-instrumentation`, `rapid-convergence`

### Tests

```bash
# C-T1: validate script passes
bash scripts/validate-plugin.sh

# C-T2: ## Spec section present in each skill
grep -q "^## Spec"  plugin/skills/baseline-quality-assessment/SKILL.md
grep -q "^## Spec"  plugin/skills/build-quality-gates/SKILL.md
grep -q "^## Spec"  plugin/skills/ci-cd-optimization/SKILL.md
grep -q "^## Spec"  plugin/skills/cross-cutting-concerns/SKILL.md
grep -q "^## Spec"  plugin/skills/knowledge-transfer/SKILL.md
grep -q "^## Spec"  plugin/skills/next-step-generation/SKILL.md
grep -q "^## Spec"  plugin/skills/observability-instrumentation/SKILL.md
grep -q "^## Spec"  plugin/skills/rapid-convergence/SKILL.md

# C-T3: contracts: present in each skill frontmatter
for skill in baseline-quality-assessment build-quality-gates ci-cd-optimization \
             cross-cutting-concerns knowledge-transfer next-step-generation \
             observability-instrumentation rapid-convergence; do
  grep -q "^contracts:" plugin/skills/$skill/SKILL.md
done

# C-T4: next-step-generation still has 0 mcp_ references (existing constraint)
count=$(grep -c 'mcp_' plugin/skills/next-step-generation/SKILL.md || true)
[ "$count" -eq 0 ]
```

### Implementation

Same two-edit pattern as Phase B applied to the 8 remaining skills. Planned contracts:

| Skill | contract 1 (grep) | contract 2 (not-grep) |
|---|---|---|
| `baseline-quality-assessment` | `grep: "### Trigger"` | `not-grep: "git push"` |
| `build-quality-gates` | `grep: "### Trigger"` | `not-grep: "git push"` |
| `ci-cd-optimization` | `grep: "### Trigger"` | `not-grep: "git push"` |
| `cross-cutting-concerns` | `grep: "### Trigger"` | `not-grep: "git push"` |
| `knowledge-transfer` | `grep: "### Trigger"` | `not-grep: "git push"` |
| `next-step-generation` | `grep: "### Trigger"` | `not-grep: "mcp_"` |
| `observability-instrumentation` | `grep: "### Trigger"` | `not-grep: "git push"` |
| `rapid-convergence` | `grep: "### Trigger"` | `not-grep: "git push"` |

Note: `next-step-generation`'s second contract uses `not-grep: "mcp_"` to codify the existing
validate-plugin.sh constraint as a formal contract assertion.

Order: `baseline-quality-assessment` -> `build-quality-gates` -> `ci-cd-optimization` ->
`cross-cutting-concerns` -> `knowledge-transfer` -> `next-step-generation` ->
`observability-instrumentation` -> `rapid-convergence`. Run validate script after all 8 are done.

### DoD

- [ ] `bash scripts/validate-plugin.sh` passes (0 errors)
- [ ] `grep -q "^## Spec" plugin/skills/baseline-quality-assessment/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/build-quality-gates/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/ci-cd-optimization/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/cross-cutting-concerns/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/knowledge-transfer/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/next-step-generation/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/observability-instrumentation/SKILL.md`
- [ ] `grep -q "^## Spec" plugin/skills/rapid-convergence/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/baseline-quality-assessment/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/build-quality-gates/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/ci-cd-optimization/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/cross-cutting-concerns/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/knowledge-transfer/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/next-step-generation/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/observability-instrumentation/SKILL.md`
- [ ] `grep -q "^contracts:" plugin/skills/rapid-convergence/SKILL.md`
- [ ] `count=$(grep -c 'mcp_' plugin/skills/next-step-generation/SKILL.md || true) && [ "$count" -eq 0 ]`

---

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh` passes with 0 errors
- [ ] `test -f docs/skill-spec-standard.md`
- [ ] All 16 target skills have Spec section: `for s in api-design baseline-quality-assessment build-quality-gates ci-cd-optimization code-refactoring cross-cutting-concerns dependency-health documentation-management feature-developer knowledge-transfer next-step-generation observability-instrumentation rapid-convergence subagent-prompt-construction technical-debt-management testing-strategy; do grep -q "^## Spec" plugin/skills/$s/SKILL.md || echo "MISSING Spec: $s"; done`
- [ ] All 16 target skills have contracts: `for s in api-design baseline-quality-assessment build-quality-gates ci-cd-optimization code-refactoring cross-cutting-concerns dependency-health documentation-management feature-developer knowledge-transfer next-step-generation observability-instrumentation rapid-convergence subagent-prompt-construction technical-debt-management testing-strategy; do grep -q "^contracts:" plugin/skills/$s/SKILL.md || echo "MISSING contracts: $s"; done`
- [ ] `for s in api-design baseline-quality-assessment build-quality-gates ci-cd-optimization code-refactoring cross-cutting-concerns dependency-health documentation-management feature-developer knowledge-transfer next-step-generation observability-instrumentation rapid-convergence subagent-prompt-construction technical-debt-management testing-strategy; do bash scripts/validate-plugin.sh 2>&1 | grep -q "PASS.*$s" || echo "NO PASS for $s"; done`
- [ ] `grep -c 'mcp_' plugin/skills/next-step-generation/SKILL.md` returns 0
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal approved (reframed: 6-section structure + contracts minimum standard). Starting plan draft.

Plan review iteration 1: APPROVED

claimed: 2026-06-18T09:58:49Z

workerLoop DoD verified: 37/37 pass (DoD#40 passed — mcp_ count=0)
Completed: 2026-06-18T10:09:34Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 test -f docs/skill-spec-standard.md
- [ ] #3 grep -q "### Trigger" docs/skill-spec-standard.md
- [ ] #4 grep -q "### Failure behavior" docs/skill-spec-standard.md
- [ ] #5 grep -q "contracts:" docs/skill-spec-standard.md
- [ ] #6 bash scripts/validate-plugin.sh
- [ ] #7 grep -q "^## Spec" plugin/skills/feature-developer/SKILL.md
- [ ] #8 grep -q "^## Spec" plugin/skills/code-refactoring/SKILL.md
- [ ] #9 grep -q "^## Spec" plugin/skills/subagent-prompt-construction/SKILL.md
- [ ] #10 grep -q "^## Spec" plugin/skills/testing-strategy/SKILL.md
- [ ] #11 grep -q "^## Spec" plugin/skills/api-design/SKILL.md
- [ ] #12 grep -q "^## Spec" plugin/skills/documentation-management/SKILL.md
- [ ] #13 grep -q "^## Spec" plugin/skills/technical-debt-management/SKILL.md
- [ ] #14 grep -q "^## Spec" plugin/skills/dependency-health/SKILL.md
- [ ] #15 grep -q "^contracts:" plugin/skills/feature-developer/SKILL.md
- [ ] #16 grep -q "^contracts:" plugin/skills/code-refactoring/SKILL.md
- [ ] #17 grep -q "^contracts:" plugin/skills/subagent-prompt-construction/SKILL.md
- [ ] #18 grep -q "^contracts:" plugin/skills/testing-strategy/SKILL.md
- [ ] #19 grep -q "^contracts:" plugin/skills/api-design/SKILL.md
- [ ] #20 grep -q "^contracts:" plugin/skills/documentation-management/SKILL.md
- [ ] #21 grep -q "^contracts:" plugin/skills/technical-debt-management/SKILL.md
- [ ] #22 grep -q "^contracts:" plugin/skills/dependency-health/SKILL.md
- [ ] #23 bash scripts/validate-plugin.sh
- [ ] #24 grep -q "^## Spec" plugin/skills/baseline-quality-assessment/SKILL.md
- [ ] #25 grep -q "^## Spec" plugin/skills/build-quality-gates/SKILL.md
- [ ] #26 grep -q "^## Spec" plugin/skills/ci-cd-optimization/SKILL.md
- [ ] #27 grep -q "^## Spec" plugin/skills/cross-cutting-concerns/SKILL.md
- [ ] #28 grep -q "^## Spec" plugin/skills/knowledge-transfer/SKILL.md
- [ ] #29 grep -q "^## Spec" plugin/skills/next-step-generation/SKILL.md
- [ ] #30 grep -q "^## Spec" plugin/skills/observability-instrumentation/SKILL.md
- [ ] #31 grep -q "^## Spec" plugin/skills/rapid-convergence/SKILL.md
- [ ] #32 grep -q "^contracts:" plugin/skills/baseline-quality-assessment/SKILL.md
- [ ] #33 grep -q "^contracts:" plugin/skills/build-quality-gates/SKILL.md
- [ ] #34 grep -q "^contracts:" plugin/skills/ci-cd-optimization/SKILL.md
- [ ] #35 grep -q "^contracts:" plugin/skills/cross-cutting-concerns/SKILL.md
- [ ] #36 grep -q "^contracts:" plugin/skills/knowledge-transfer/SKILL.md
- [ ] #37 grep -q "^contracts:" plugin/skills/next-step-generation/SKILL.md
- [ ] #38 grep -q "^contracts:" plugin/skills/observability-instrumentation/SKILL.md
- [ ] #39 grep -q "^contracts:" plugin/skills/rapid-convergence/SKILL.md
- [ ] #40 count=$(grep -c 'mcp_' plugin/skills/next-step-generation/SKILL.md || true) && [ "$count" -eq 0 ]
- [ ] #41 bash scripts/validate-plugin.sh
- [ ] #42 test -f docs/skill-spec-standard.md
- [ ] #43 for s in api-design baseline-quality-assessment build-quality-gates ci-cd-optimization code-refactoring cross-cutting-concerns dependency-health documentation-management feature-developer knowledge-transfer next-step-generation observability-instrumentation rapid-convergence subagent-prompt-construction technical-debt-management testing-strategy; do bash scripts/validate-plugin.sh 2>&1 | grep -q "PASS.*$s" || echo "NO PASS for $s"; done
- [ ] #44 grep -c 'mcp_' plugin/skills/next-step-generation/SKILL.md
<!-- DOD:END -->
