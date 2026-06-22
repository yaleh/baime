---
id: TASK-56
title: 为 backlog-setup 补充 contracts 字段
status: "Basic: Done"
assignee: []
created_date: '2026-06-19'
updated_date: '2026-06-20 00:46'
labels:
  - kind:basic
  - skill-quality
  - contracts
dependencies:
  - TASK-35
references:
  - plugin/skills/backlog-setup/SKILL.md
  - docs/skill-quality-engineering.md
  - experiments/skill-quality/artifacts/analysis/exp-c-results.json
priority: low
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Exp-C（TASK-39）发现 contracts FP/FN 率均为 0，结构化断言机械可靠。TASK-35 随后为当时无 contracts 的 5 个 skill 补充了断言，清零了 Exp-C 记录的覆盖缺口。

当前扫描（2026-06-19）显示 24 个 skill 中有 1 个例外：`backlog-setup` 的 SKILL.md frontmatter 缺少 `contracts:` 字段。该 skill 是后续新增的（未在 TASK-35 范围内），属于遗漏。

`backlog-setup` 是 BAIME 工作流的入口 skill（`/backlog-setup` 初始化整个任务板），Exp-H（TASK-46）还以它作为 oracle 泛化测试的目标 skill 之一——有 `contracts:` 保护尤为重要，防止核心约束（列名、幂等性、CLI 调用顺序）在 skill 演化时静默丢失。

## Goal

为 `plugin/skills/backlog-setup/SKILL.md` 添加 `contracts:` 字段，覆盖 Spec 节中的关键不变量，使 `validate-plugin.sh` 对该 skill 产生实质性检查，而非静默跳过。

## Scope

分析 `backlog-setup` 的 λ spec，提取以下类型的断言：

**候选断言（至少选 3 条）**：

1. `grep: "backlogSetup"` / `target: self` — 确认主入口函数名存在（Spec 演化时若重命名会被捕获）
2. `grep: "verifyColumns"` / `target: self` — 确认列校验步骤未被删除（核心幂等性保护）
3. `grep: "seedExamples"` / `target: self` — 确认种子步骤存在（首次初始化完整性）
4. `grep: "initProject"` / `target: self` — 确认项目初始化步骤存在
5. `not-grep: "backlog column add"` / `target: self` — 确认未使用已废弃的 CLI 命令（`backlog column add` 在 CLI v1.45+ 被移除，Implementation 节已改为 Python 直接编辑 config.yml）

最终选词遵循"若这个字符串不在文件里，说明某个重要约定缺失了"原则（`skill-quality-engineering.md §4.2`）。

## Out of Scope

- 修改 `backlog-setup` 的功能逻辑或 Spec
- 为 `backlog-setup` 补充 Layer 2.5 fixtures（该 skill 已在 Exp-H 中作为 oracle 测试目标覆盖，独立于 contracts 机制）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `plugin/skills/backlog-setup/SKILL.md` frontmatter 包含 `contracts:` 字段，至少 3 条结构化断言（`grep:` 或 `not-grep:`，带 `target: self`）
- [ ] #2 `bash scripts/validate-plugin.sh` 运行通过，`backlog-setup` 不再出现 NO_CONTRACTS 警告
- [ ] #3 每条断言附单行注释说明其保护的不变量（与选词理由对应）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 为 backlog-setup 补充 contracts 字段

Proposal: TASK-56 — 为 plugin/skills/backlog-setup/SKILL.md 添加 contracts: 字段，覆盖 Spec 节关键不变量，使 validate-plugin.sh 对该 skill 产生实质的契约检查（contract grep/not-grep PASS 行），而非在 `if not contracts: sys.exit(0)` 处静默跳过。

## Grounding notes (verified against the real file)

- Current frontmatter of `plugin/skills/backlog-setup/SKILL.md` (lines 1-5) has only `name`, `description`, `allowed-tools` — NO `contracts:` field. The contract validator (`scripts/validate-plugin.sh`, `validate_contracts()`) early-returns at `if not contracts: sys.exit(0)`, so the skill is silently skipped today.
- The contract validator strips frontmatter and greps only the BODY (`body_text`, everything after the closing `---`). So contract patterns must match strings in the body, not in the frontmatter itself.
- Verified body occurrence counts (frontmatter excluded):
  - `backlogSetup` = 3 (main entry, λ + Spec) → valid `grep`
  - `verifyColumns` = 4 (column-check / idempotency step) → valid `grep`
  - `seedExamples` = 4 (seed step) → valid `grep`
  - `initProject` = 4 (project init step) → valid `grep`
  - `config.yml` = 3 (statuses are edited via config.yml, not CLI) → valid `grep`
  - `backlog column add` = 3 → present as DEPRECATION DOCS (lines 58/94/281). CANNOT be used as `not-grep` (it would FAIL). Instead use a genuinely-absent regression string.
  - `backlog board add` = 0 → valid `not-grep` (a wrong CLI form that must never appear; if it ever does, someone reintroduced CLI-based column mutation instead of the Python config.yml edit).
- Existing schema (from `loop-backlog` / `code-refactoring` SKILL.md): list under `contracts:`, each item `  - grep: "<pattern>"` or `  - not-grep: "<pattern>"`, with optional `    target: self` (default is `self`). Inline `# ...` comments are permitted on/after list items.
- Baseline: `bash scripts/validate-plugin.sh` currently exits 0 (Errors: 0, Warnings: 55 — pre-existing, unrelated).

## Phase A: Add contracts block to backlog-setup frontmatter

### Tests (write first)
Establish the RED state before editing — these commands must currently FAIL (and will PASS after the Implementation):

1. backlog-setup currently has NO contracts field — this command currently succeeds (field absent), proving the gap:
   `! grep -q '^contracts:' plugin/skills/backlog-setup/SKILL.md` (currently exit 0 = red baseline; after the edit it must FAIL, i.e. the field exists).
2. The skill produces NO contract PASS lines today — running the validator and grepping its output for a backlog-setup contract line returns nothing:
   `bash scripts/validate-plugin.sh 2>&1 | grep -q "contract grep 'backlogSetup'"` (currently exit 1 = red; after the edit it must exit 0).
3. Confirm the chosen not-grep target is genuinely absent in the body so the not-grep assertion is meaningful and won't false-fail:
   `! grep -q 'backlog board add' plugin/skills/backlog-setup/SKILL.md`.

### Implementation
Edit ONLY the frontmatter of `plugin/skills/backlog-setup/SKILL.md`. Insert a `contracts:` block after the `allowed-tools:` line and before the closing `---`, so the frontmatter becomes:

```yaml
---
name: backlog-setup
description: "One-time initializer for the backlog task board. Checks that the backlog CLI is installed, initializes a backlog project if none exists, and verifies that all columns required by loop-backlog and feature-to-backlog are present. Idempotent — safe to run multiple times."
allowed-tools: Bash, Read, Write
contracts:
  # Main entry function must exist — λ() → backlogSetup() is the skill's single root invariant.
  - grep: "backlogSetup"
    target: self
  # Column-verification / idempotency step must exist — required-column reconciliation is core behavior.
  - grep: "verifyColumns"
    target: self
  # First-time seed step must exist — onboarding doc/decision seeding is part of the contract.
  - grep: "seedExamples"
    target: self
  # Project-init step must exist — the skill must initialise backlog/ when absent.
  - grep: "initProject"
    target: self
  # Statuses are managed by editing backlog/config.yml; this string must remain present.
  - grep: "config.yml"
    target: self
  # Regression guard: column mutation must use the Python config.yml edit, never a CLI 'board add' form.
  - not-grep: "backlog board add"
    target: self
---
```

Notes:
- 6 structured assertions (5 `grep:` + 1 `not-grep:`), each `target: self`, each with a single-line `#` comment — satisfies AC#1 (≥3) and AC#3 (per-assertion comment).
- All grep patterns are verified to occur in the body; the not-grep pattern is verified absent. So the validator will emit PASS lines, not FAIL.
- Do NOT use `not-grep: "backlog column add"` — that string is present as deprecation documentation and would make the contract FAIL.

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q '^contracts:' plugin/skills/backlog-setup/SKILL.md`
- [ ] `test "$(grep -cE '^\s+- (grep|not-grep):' plugin/skills/backlog-setup/SKILL.md)" -ge 3`
- [ ] `grep -q 'target: self' plugin/skills/backlog-setup/SKILL.md`
- [ ] `! grep -q 'backlog board add' plugin/skills/backlog-setup/SKILL.md`

## Constraints
- Only the frontmatter of `plugin/skills/backlog-setup/SKILL.md` may change; the body (Spec/Implementation/Notes) must remain byte-identical.
- Do not alter the skill count, symlinks, or any other skill — `bash scripts/validate-plugin.sh` must stay at Errors: 0.
- Every contract assertion must use the repo's existing YAML schema (`- grep:`/`- not-grep:` with `target: self`); no new fields.
- Each assertion must carry exactly one single-line `#` comment naming the invariant it protects (principle: "若这个字符串不在文件里，说明某个重要约定缺失了").
- `grep` patterns must match strings that actually exist in the body; the `not-grep` pattern must be genuinely absent (regression guard, not current documentation).

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q '^contracts:' plugin/skills/backlog-setup/SKILL.md`
- [ ] `test "$(grep -cE '^\s+- (grep|not-grep):' plugin/skills/backlog-setup/SKILL.md)" -ge 3`
- [ ] `grep -q 'target: self' plugin/skills/backlog-setup/SKILL.md`
- [ ] `test "$(awk '/^contracts:/{f=1;next} f&&/^---$/{f=0} f&&/^[[:space:]]*#/' plugin/skills/backlog-setup/SKILL.md | wc -l)" -ge 3`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -q "contract grep 'backlogSetup'"`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -q "contract not-grep 'backlog board add' absent"`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
claimed: 2026-06-20T00:43:21Z

Completed: 2026-06-20T00:46:38Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q '^contracts:' plugin/skills/backlog-setup/SKILL.md
- [ ] #3 test "$(grep -cE '^\s+- (grep|not-grep):' plugin/skills/backlog-setup/SKILL.md)" -ge 3
- [ ] #4 grep -q 'target: self' plugin/skills/backlog-setup/SKILL.md
- [ ] #5 ! grep -q 'backlog board add' plugin/skills/backlog-setup/SKILL.md
- [ ] #6 test "$(awk '/^contracts:/{f=1;next} f&&/^---$/{f=0} f&&/^[[:space:]]*#/' plugin/skills/backlog-setup/SKILL.md | wc -l)" -ge 3
- [ ] #7 bash scripts/validate-plugin.sh 2>&1 | grep -q "contract grep 'backlogSetup'"
- [ ] #8 bash scripts/validate-plugin.sh 2>&1 | grep -q "contract not-grep 'backlog board add' absent"
<!-- DOD:END -->
