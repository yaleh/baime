---
id: TASK-20
title: 为 SKILL.md 实现两阶段校验：静态 linter + 执行前 manifest 检查
status: "Basic: Done"
assignee: []
created_date: '2026-06-17 22:25'
updated_date: '2026-06-18 10:15'
labels:
  - kind:basic
  - toolchain
  - skill-quality
  - linting
dependencies:
  - TASK-19
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景

上下文压缩前发现的两类 bug 的共同根源：
- **author-time 缺陷**（Config 类型冲突、undefined ref）：写 SKILL.md 时没有机械化校验
- **execution-time 缺陷**（`--description` 覆盖原始描述、resolveOrCreate 缺失）：Claude 执行 skill 时偏离 spec，且 spec 本身不完整

TASK-19 覆盖了 author-time 静态检查。本任务覆盖 execution-time 校验，并明确两阶段的架构分工。

---

## 核心设计

### 两阶段分工

```
author-time  (写 SKILL.md 时)
  → skill-lint.sh --static plugin/skills/*/SKILL.md
  → 捕获：类型冲突、undefined ref、field 写法、clone

execution-time (Claude 运行 skill 前)
  → Claude 在 Phase 0 生成 manifest.json（CoT 展开为结构化输出）
  → skill-lint.sh --manifest $TMPDIR/<skill>-manifest.json
  → 捕获：field 写法错误、phase 跳过逻辑不一致、entry_point 非法
```

### LLM 承担"展开"，linter 承担"校验"

不实现 DSL 解释器。Claude 自行将 SKILL.md spec 展开为执行计划（即 CoT），最终物化为一个结构化 manifest，linter 对 manifest 做机械化检查。

这是 compiler 方案的简化替代：保留"形式校验"，放弃"确定性展开"。

---

## Manifest 格式（Phase 0 输出）

```json
{
  "skill": "task-to-backlog",
  "task_id": "TASK-12 | null",
  "entry_point": "resolveOrCreate | createTask",
  "skip_draft": true,
  "field_writes": [
    { "tool": "backlog task edit", "field": "planSet",  "source": "$TMPDIR/ttb-plan.md" },
    { "tool": "backlog task edit", "field": "status",   "value": "Plan Review" }
  ],
  "phases_to_execute": ["resolveOrCreate", "reviewLoop", "finalise"]
}
```

Linter 规则（manifest 层）：
- `field_writes[*].field` ≠ `"description"`（task create 除外）
- `phases_to_execute` 中的每项必须对应 SKILL.md spec 中已定义的函数
- `entry_point` 必须是 spec 中 resolveOrCreate 的合法返回构造子
- `skip_draft == true` iff `entry_point == "resolveOrCreate"`

---

## 与 TASK-19 的关系

| | TASK-19 | 本任务 |
|---|---|---|
| 检查时机 | author-time | execution-time |
| 检查对象 | SKILL.md 文件本身 | manifest JSON（Claude 生成） |
| 主要发现 | 类型冲突、undefined ref | field 写法错误、phase 逻辑偏离 |
| 实现复杂度 | grep + diff | JSON Schema + 业务规则 |
| 依赖关系 | 独立 | 可复用 TASK-19 的 skill-lint.sh |

两者共用同一工具入口：`bash scripts/skill-lint.sh`，通过子命令区分。

---

## 遗留缺口（本方案不覆盖）

- Claude 写了正确的 manifest 但实际执行时调用了不同的字段（manifest 与实现解耦）
- Manifest 格式被 Claude 写错（需 JSON Schema 校验兜底，已含在 linter 规则中）

如需完全消除第一项缺口，需实现 compiler 方案（Phase 3，可选，见 TASK-19 讨论）。

---

## 目标交付物

1. `scripts/skill-lint.sh --manifest <path>` 子命令：manifest 规则校验
2. `plugin/skills/task-to-backlog/SKILL.md` Phase 0 节：manifest 生成 + lint 步骤
3. `plugin/skills/feature-to-backlog/SKILL.md` Phase 0 节：同上
4. 集成到 `scripts/validate-plugin.sh`（可选：用示例 manifest fixture 做 smoke test）
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## 背景

上下文压缩前发现的两类 bug 的共同根源：
- **author-time 缺陷**（Config 类型冲突、undefined ref）：写 SKILL.md 时没有机械化校验
- **execution-time 缺陷**（`--description` 覆盖原始描述、resolveOrCreate 缺失）：Claude 执行 skill 时偏离 spec，且 spec 本身不完整

TASK-19 覆盖了 author-time 静态检查。本任务覆盖 execution-time 校验，并明确两阶段的架构分工。

---

## 核心设计

### 两阶段分工

```
author-time  (写 SKILL.md 时)
  → skill-lint.sh --static plugin/skills/*/SKILL.md
  → 捕获：类型冲突、undefined ref、field 写法、clone

execution-time (Claude 运行 skill 前)
  → Claude 在 Phase 0 生成 manifest.json（CoT 展开为结构化输出）
  → skill-lint.sh --manifest $TMPDIR/<skill>-manifest.json
  → 捕获：field 写法错误、phase 跳过逻辑不一致、entry_point 非法
```

### LLM 承担"展开"，linter 承担"校验"

不实现 DSL 解释器。Claude 自行将 SKILL.md spec 展开为执行计划（即 CoT），最终物化为一个结构化 manifest，linter 对 manifest 做机械化检查。

这是 compiler 方案的简化替代：保留"形式校验"，放弃"确定性展开"。

---

## Manifest 格式（Phase 0 输出）

```json
{
  "skill": "task-to-backlog",
  "task_id": "TASK-12 | null",
  "entry_point": "resolveOrCreate | createTask",
  "skip_draft": true,
  "field_writes": [
    { "tool": "backlog task edit", "field": "planSet",  "source": "$TMPDIR/ttb-plan.md" },
    { "tool": "backlog task edit", "field": "status",   "value": "Plan Review" }
  ],
  "phases_to_execute": ["resolveOrCreate", "reviewLoop", "finalise"]
}
```

Linter 规则（manifest 层）：
- `field_writes[*].field` ≠ `"description"`（task create 除外）
- `phases_to_execute` 中的每项必须对应 SKILL.md spec 中已定义的函数
- `entry_point` 必须是 spec 中 resolveOrCreate 的合法返回构造子
- `skip_draft == true` iff `entry_point == "resolveOrCreate"`

---

## 与 TASK-19 的关系

| | TASK-19 | 本任务 |
|---|---|---|
| 检查时机 | author-time | execution-time |
| 检查对象 | SKILL.md 文件本身 | manifest JSON（Claude 生成） |
| 主要发现 | 类型冲突、undefined ref | field 写法错误、phase 逻辑偏离 |
| 实现复杂度 | grep + diff | JSON Schema + 业务规则 |
| 依赖关系 | 独立 | 可复用 TASK-19 的 skill-lint.sh |

两者共用同一工具入口：`bash scripts/skill-lint.sh`，通过子命令区分。

---

## 遗留缺口（本方案不覆盖）

- Claude 写了正确的 manifest 但实际执行时调用了不同的字段（manifest 与实现解耦）
- Manifest 格式被 Claude 写错（需 JSON Schema 校验兜底，已含在 linter 规则中）

如需完全消除第一项缺口，需实现 compiler 方案（Phase 3，可选，见 TASK-19 讨论）。

---

## 目标交付物

1. `scripts/skill-lint.sh --manifest <path>` 子命令：manifest 规则校验
2. `plugin/skills/task-to-backlog/SKILL.md` Phase 0 节：manifest 生成 + lint 步骤
3. `plugin/skills/feature-to-backlog/SKILL.md` Phase 0 节：同上
4. 集成到 `scripts/validate-plugin.sh`（可选：用示例 manifest fixture 做 smoke test）

Acceptance Criteria:

1. `bash scripts/skill-lint.sh --manifest <fixture>` exits 0 for a valid manifest fixture and exits non-zero for each of the four invalid-manifest fixtures (wrong field, missing phase, illegal entry_point, skip_draft mismatch).
2. `grep -q 'Phase 0' plugin/skills/task-to-backlog/SKILL.md` exits 0.
3. `grep -q 'Phase 0' plugin/skills/feature-to-backlog/SKILL.md` exits 0.
4. `bash scripts/validate-plugin.sh` exits 0 after all changes are applied.

---

# Plan: 为 SKILL.md 实现两阶段校验：静态 linter + 执行前 manifest 检查

Proposal: docs/proposals/proposal-task20-two-stage-skill-validation.md

## Phase A: 创建 scripts/skill-lint.sh 并实现 --manifest 子命令

### Tests (write first)

Test file: `scripts/skill-lint.test.sh`

Test cases (each must fail before Phase A implementation):

- `test_valid_manifest_exits_0`: 使用合法 fixture 调用 `bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-valid.json`，期望 exit 0
- `test_bad_field_description_exits_nonzero`: `field_writes[*].field == "description"` 时期望 exit 非零
- `test_bad_missing_phase_exits_nonzero`: `phases_to_execute` 包含白名单外的函数名时期望 exit 非零
- `test_bad_entry_point_exits_nonzero`: `entry_point` 不是合法值时期望 exit 非零
- `test_bad_skip_draft_mismatch_exits_nonzero`: `skip_draft == false` 且 `entry_point == "resolveOrCreate"` 时期望 exit 非零

Fixture files to create (must exist before tests run):
- `scripts/fixtures/manifest-valid.json`
- `scripts/fixtures/manifest-bad-field-description.json`
- `scripts/fixtures/manifest-bad-missing-phase.json`
- `scripts/fixtures/manifest-bad-entry-point.json`
- `scripts/fixtures/manifest-bad-skip-draft-mismatch.json`

### Implementation

Files to create:
- `scripts/skill-lint.sh` — 主入口；解析 `--manifest <path>` 子命令；使用 python3 标准库（json 模块）执行以下四条规则：
  - R1：`field_writes[*].field != "description"`（当 `tool` 为 `"backlog task create"` 时豁免）
  - R2：`phases_to_execute` 中每项属于已知合法阶段白名单（resolveOrCreate、createTask、reviewLoop、finalise、proposalLoop、planLoop、draftProposal、draftPlan）
  - R3：`entry_point` 是 `"resolveOrCreate"` 或 `"createTask"`
  - R4：`skip_draft == true` iff `entry_point == "resolveOrCreate"`
- `scripts/skill-lint.test.sh` — 运行上述五条测试
- `scripts/fixtures/manifest-valid.json`
- `scripts/fixtures/manifest-bad-field-description.json`
- `scripts/fixtures/manifest-bad-missing-phase.json`
- `scripts/fixtures/manifest-bad-entry-point.json`
- `scripts/fixtures/manifest-bad-skip-draft-mismatch.json`

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/skill-lint.test.sh`
- [ ] `bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-valid.json`
- [ ] `! bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-bad-field-description.json`
- [ ] `! bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-bad-entry-point.json`

---

## Phase B: 将 skill-lint.test.sh 集成到 validate-plugin.sh

### Tests (write first)

Test case（在现有 validate-plugin.sh 框架内验证）：

- `validate-plugin.sh` 输出中包含 `skill-lint.test.sh`（确认 Unit Tests 节自动发现了该文件）

验证命令（修改前应 grep 失败，Phase B 完成后通过）：
```
bash scripts/validate-plugin.sh 2>&1 | grep -q 'skill-lint.test.sh'
```

### Implementation

无需修改 `validate-plugin.sh` 源码——现有 `run_skill_unit_tests()` 已扫描 `scripts/*.test.sh`。
Phase A 创建的 `scripts/skill-lint.test.sh` 在 Phase A 完成后已被自动发现。

本 Phase 的工作是验证集成已正确发生，并在 `validate-plugin.sh` 中添加对 5 个 fixture 的 smoke test 显式检查块（约 20 行）：

```bash
# ── Manifest Lint Smoke Tests ─────────────────────────────────────────────────

echo ""
echo "=== Manifest Lint Smoke Tests ==="

LINT="$REPO_ROOT/scripts/skill-lint.sh"
if [ -f "$LINT" ]; then
    if bash "$LINT" --manifest "$REPO_ROOT/scripts/fixtures/manifest-valid.json" 2>/dev/null; then
        pass "skill-lint: valid manifest"
    else
        fail "skill-lint: valid manifest should exit 0"
    fi
    for bad in manifest-bad-field-description manifest-bad-missing-phase \
                manifest-bad-entry-point manifest-bad-skip-draft-mismatch; do
        if ! bash "$LINT" --manifest "$REPO_ROOT/scripts/fixtures/${bad}.json" 2>/dev/null; then
            pass "skill-lint: ${bad} rejected"
        else
            fail "skill-lint: ${bad} should exit non-zero"
        fi
    done
fi
```

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -q 'skill-lint.test.sh'`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -q 'Manifest Lint Smoke Tests'`

---

## Phase C: 在 plugin/skills/task-to-backlog/SKILL.md 添加 Phase 0 节

### Tests (write first)

- `test_ttb_has_phase0`: `grep -q 'Phase 0' plugin/skills/task-to-backlog/SKILL.md` 期望 exit 0（修改前应 exit 非零）
- `test_ttb_phase0_has_manifest_json`: `grep -q 'manifest.json' plugin/skills/task-to-backlog/SKILL.md` 期望 exit 0
- `test_ttb_phase0_has_skill_lint`: `grep -q 'skill-lint.sh' plugin/skills/task-to-backlog/SKILL.md` 期望 exit 0

### Implementation

文件修改：`plugin/skills/task-to-backlog/SKILL.md`

在 `## Implementation` 节最前面（`### Phase 1: resolveOrCreate` 之前）插入 Phase 0 节，约 30 行。

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'Phase 0' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q 'skill-lint.sh' plugin/skills/task-to-backlog/SKILL.md`

---

## Phase D: 在 plugin/skills/feature-to-backlog/SKILL.md 添加 Phase 0 节

### Tests (write first)

- `test_ftb_has_phase0`: `grep -q 'Phase 0' plugin/skills/feature-to-backlog/SKILL.md` 期望 exit 0（修改前应 exit 非零）
- `test_ftb_phase0_has_manifest_json`: `grep -q 'manifest.json' plugin/skills/feature-to-backlog/SKILL.md` 期望 exit 0
- `test_ftb_phase0_has_skill_lint`: `grep -q 'skill-lint.sh' plugin/skills/feature-to-backlog/SKILL.md` 期望 exit 0

### Implementation

文件修改：`plugin/skills/feature-to-backlog/SKILL.md`

在 `## Implementation` 节最前面（第一个 Phase 1 之前）插入 Phase 0 节，约 30 行。

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'Phase 0' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'skill-lint.sh' plugin/skills/feature-to-backlog/SKILL.md`

---

## Constraints

- `scripts/skill-lint.sh` 不得引入新的 npm/pip 依赖；只使用 bash + python3 标准库（json 模块）
- Manifest 校验规则精确对应 proposal 中定义的四条规则（R1–R4），不多不少
- Phase 0 节中的 manifest 示例必须是合法 JSON（可被 `python3 -c "import json"` 解析）
- SKILL.md 的 YAML frontmatter 不得被修改（避免触发 validate-plugin.sh frontmatter 校验失败）
- 每个 Phase 代码改动量 ≤ 200 行
- Phases 顺序：A（工具）→ B（集成）→ C（ttb）→ D（ftb）；前序 Phase 是后续 Phase 的前提

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-valid.json`
- [ ] `! bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-bad-field-description.json`
- [ ] `! bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-bad-missing-phase.json`
- [ ] `! bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-bad-entry-point.json`
- [ ] `! bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-bad-skip-draft-mismatch.json`
- [ ] `grep -q 'Phase 0' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q 'Phase 0' plugin/skills/feature-to-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 2: APPROVED

Proposal approved. Starting plan draft.

Plan review iteration 1: APPROVED

claimed: 2026-06-18T10:10:59Z

workerLoop DoD verified: 13/13 passed
Completed: 2026-06-18T10:15:15Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 bash scripts/skill-lint.test.sh
- [ ] #3 bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-valid.json
- [ ] #4 ! bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-bad-field-description.json
- [ ] #5 ! bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-bad-entry-point.json
- [ ] #6 bash scripts/validate-plugin.sh 2>&1 | grep -q 'skill-lint.test.sh'
- [ ] #7 bash scripts/validate-plugin.sh 2>&1 | grep -q 'Manifest Lint Smoke Tests'
- [ ] #8 grep -q 'Phase 0' plugin/skills/task-to-backlog/SKILL.md
- [ ] #9 grep -q 'skill-lint.sh' plugin/skills/task-to-backlog/SKILL.md
- [ ] #10 grep -q 'Phase 0' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #11 grep -q 'skill-lint.sh' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #12 ! bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-bad-missing-phase.json
- [ ] #13 ! bash scripts/skill-lint.sh --manifest scripts/fixtures/manifest-bad-skip-draft-mismatch.json
<!-- DOD:END -->
