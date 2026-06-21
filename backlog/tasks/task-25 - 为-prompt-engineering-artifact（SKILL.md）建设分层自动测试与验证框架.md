---
id: TASK-25
title: 为 prompt engineering artifact（SKILL.md）建设分层自动测试与验证框架
status: Basic: Done
assignee: []
created_date: '2026-06-18 01:58'
updated_date: '2026-06-18 04:22'
labels:
  - kind:basic
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

BAIME 的核心交付资产是 SKILL.md——一种结合了 YAML frontmatter、Haskell-like 形式规格 DSL、嵌入式 shell 脚本和 Implementation 文档的复合工程制品。这类制品既不是普通源代码（无编译器、无类型检查器），也不是纯文档（其中的脚本和规格会被 LLM 逐字执行）。

当前的开发流程在 design/review 阶段投入了大量精力（proposal review、plan review、多轮迭代），但在实现完成之后没有任何自动化的回归门控。结果是：每次 skill 改动后，所有验证依赖人工执行和观察。以 loop-backlog 的近期开发为例，在同一会话中发现了 7 个 bug，全部在人工运行后才暴露，而非在写入 SKILL.md 时被截获。

现有的 `validate-plugin.sh` 只检查 JSON manifest 合法性、YAML frontmatter 有无必要字段、symlink 一致性，以及少数 hardcoded grep 规则，无法覆盖 SKILL.md 内部一致性。`test-loop-backlog-skill-monitor.sh` / `test-loop-backlog-skill-template.sh` 是手写 grep 测试，已随 skill 演进而过时，因为测试知识存在于外部文件，作者修改 spec 时无提示需同步更新测试。TASK-19 提出了 author-time 静态分析，TASK-20 提出了 execution-time manifest 校验，两者聚焦规格文本的 DSL 语义正确性。本任务提出覆盖完整质量层次的分层框架，将这两项作为 Layer 0 的上游，并向上延伸至可抽取纯函数单测（Layer 1）、co-located 结构性 contract（Layer 2）和面向可观测结果的行为 smoke test（Layer 3）。

## Goals

1. **[Layer 0]** `validate-plugin.sh` 运行时能自动检测 SKILL.md 制品结构问题：Spec 节中被调用的函数在 Implementation 节有对应 section；`allowed-tools` 字段覆盖文件中实际出现的工具关键词；嵌入脚本的 `daemon-version` tag 与 SKILL.md 声明一致。检测到违规时 `validate-plugin.sh` 以非零退出码退出。

2. **[Layer 1]** 含有可抽取纯函数测试的 SKILL.md（如现有 `ensureDaemonTest` 模式），其单测在 `validate-plugin.sh` 运行时被自动发现并执行，无需手动注册；新 skill 遵循相同路径约定后自动纳入。

3. **[Layer 2]** SKILL.md frontmatter 支持可选 `contracts:` 字段，每条规则声明 grep/not-grep 断言及目标（self 或外部脚本路径）；`validate-plugin.sh` 解析并执行这些规则；`test-loop-backlog-skill-monitor.sh` 等现有外部脚本的逻辑迁移到对应 skill 的 `contracts:` 字段后可被删除。

4. **[Layer 3]** 每个 skill 可选包含 `smoke/` 目录（含 `setup.sh`、`expect.sh`、`scenario.md`）；`expect.sh` 只使用 shell 断言（文件存在、git log 内容、task 状态），不依赖 LLM 判断结果；提供独立手动触发入口 `bash scripts/run-smoke-test.sh <skill-name>`，不集成到 `validate-plugin.sh`。

5. **[DoD 规范化]** `task-to-backlog` 和 `feature-to-backlog` 的 DoD 模板新增强制项：Layer 0–2 检查通过；新增 skill 的 `contracts:` 字段覆盖本 skill 的关键行为约束。新 skill 实现完成后 `bash scripts/validate-plugin.sh` 绿色通过即可机械验证此要求。

## Proposed Approach

### Layer 0 — 静态内部一致性检查（无 LLM，fast）

在 `validate-plugin.sh` 中增加 `validate_skill_internals()` 函数，对每个 SKILL.md 执行三项检查：

**函数覆盖检查**：从 `## Spec` 节提取所有 `funcName(` 调用模式，从 `## Implementation` 节提取所有 `### funcName` 标题，计算差集并报告缺失覆盖。初期采用保守规则（精确 `### funcName` 标题匹配），宁可漏报也避免误报阻塞 CI。对尚无 `## Implementation` 节的 skill 跳过此检查（与 TASK-16 的规格补全工作协同）。

**allowed-tools 完整性检查**：扫描 SKILL.md 全文中出现的已知工具关键词集合（Bash、Read、Write、Edit、Monitor、Agent 等），与 frontmatter `allowed-tools` 字段比对，报告未声明的工具使用。

**版本标签一致性检查**：若文件内嵌 `// daemon-version: vN` 或 `# daemon-version: vN` 注释，与 frontmatter 对应字段比对。仅对声明了版本字段的 skill 启用，无声明则跳过。

三项检查全部在现有 shell/python3 框架内实现，无新依赖。与 TASK-19 的 undefined reference detection 和 type name conflict detection 形成互补——TASK-19 聚焦 DSL 语义，Layer 0 聚焦制品结构完整性。两者共用 `validate-plugin.sh` 入口但实现独立。

### Layer 1 — 可抽取纯函数单测自动发现（无 LLM，fast）

在 `validate-plugin.sh` 中增加 `run_skill_unit_tests()` 函数：扫描约定路径（`scripts/<skill-name>.test.js` 或 `scripts/<skill-name>.test.sh`），若文件存在则执行并汇报结果。`loop-backlog-daemon.test.js` 已是此模式的原型，现有的 `ensureDaemonTest` 在 bootstrap 时写入并运行该文件，Layer 1 在 `validate-plugin.sh` 中增加第二个触发点（静态注册），使其脱离 skill 执行路径也能运行。

新 skill 遵循命名约定后自动纳入，无需修改 `validate-plugin.sh`。

### Layer 2 — Co-located 结构性 Contract 测试（无 LLM，fast）

SKILL.md frontmatter 新增可选 `contracts:` 字段：

```yaml
contracts:
  - grep: "Monitor(persistent=true"
    target: self
  - not-grep: "schedule("
    target: self
  - grep: "ensureDaemonScript"
    target: self
```

`validate-plugin.sh` 的 frontmatter 解析扩展为同时读取并执行 `contracts:` 规则。规则与 SKILL.md 主体同文件提交，当 spec 演进导致旧断言过时时，作者若不同步更新 contracts，CI 会立即失败，消除 stale test 的漏窗口。现有 `test-loop-backlog-skill-monitor.sh` 的四条 grep 断言可直接迁移为 loop-backlog 的 `contracts:` 字段，之后删除外部脚本文件。

初期 `contracts:` 为可选字段；新 skill 实现时（通过 DoD 规范化 Goal 5）强制要求。

### Layer 3 — 行为 Smoke Test（需 LLM，slow，可选）

每个 skill 可选包含 `smoke/` 目录：

```
plugin/skills/<skill-name>/smoke/
  setup.sh      # 在临时 git repo 中创建 backlog fixture（task 状态、文件等）
  scenario.md   # 给 subagent 的自然语言触发指令
  expect.sh     # 纯 shell 断言：task 状态、git log 内容、文件存在性
```

触发：`bash scripts/run-smoke-test.sh <skill-name>`。Subagent 在 fixture repo 中执行 skill，`expect.sh` 对 fixture repo 做断言，无需 LLM 判断。不集成到 `validate-plugin.sh`（避免 CI 依赖 LLM）。初期只为 loop-backlog 和 feature-to-backlog 建立 smoke test，降低维护面。

### DoD 规范化

`task-to-backlog` 和 `feature-to-backlog` Implementation Plan 模板的最终阶段新增：

```
- [ ] bash scripts/validate-plugin.sh 绿色通过（含 Layer 0-2 检查）
- [ ] 新 SKILL.md 的 contracts: 字段覆盖本 skill 的关键行为约束（≥ 2 条）
```

## Trade-offs and Risks

### Trade-offs

**Layer 0 误报率控制**：函数名提取使用 regex，对 DSL 中 lambda 表达式、高阶函数、管道符等语法可能产生漏报。初期采用保守规则，只对有完整 `## Implementation` 节的 skill 启用函数覆盖检查，避免对存量 16 个无规格 skill 产生大量噪音。

**contracts: 表达能力上限**：grep/not-grep 只能捕获字面量存在性，无法表达顺序、数量、语义约束。对于复杂约束，需 Layer 3 smoke test 或人工 review。不引入 YAML 内嵌表达式语言，避免在 frontmatter 内部创建新 DSL。

**Layer 3 的 LLM 依赖**：smoke test 需要 LLM 执行 skill，单次运行成本和时间不可预测，不适合每次提交触发。定位为"大版本变更前的手动验收门"或可选 DoD item。

**与 TASK-19/20 的边界清晰性**：三个任务共用 `validate-plugin.sh` 入口，但检查对象不同——TASK-19 检查 DSL 语义（undefined ref、type conflict），TASK-20 检查 execution-time manifest，本任务检查制品结构和测试框架。实现时需明确哪个任务负责往 `validate-plugin.sh` 注入哪一节，避免合并冲突。

### Risks

**Layer 0 对存量 skill 的破坏性**：23 个现有 skill 中约 16 个无 `## Implementation` 节（实测：`grep -L "## Implementation"` 返回 16 个），对它们启用函数覆盖检查会立即产生大量 FAIL。必须在实现时决策跳过策略，否则 `validate-plugin.sh` 第一次运行即全红。

**contracts: 的维护负担**：若作者在修改 spec 时遗忘同步更新 contracts，CI 将产生误报（与 stale test 方向相反）。代码 review 仍需关注 contracts 与 spec 的一致性；不能完全消除此风险，只能缩短暴露窗口。

**smoke/ fixture 腐化**：`setup.sh` 创建的 fixture 状态随 backlog CLI 版本或 skill 接口演进可能过时。初期限定 loop-backlog 等高风险 skill 建立 smoke test，接受每次大版本升级时需手动验证和更新 fixture 的维护成本。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 为 prompt engineering artifact（SKILL.md）建设分层自动测试与验证框架

Proposal: docs/proposals/proposal-skill-layered-test-framework.md

## Phase A: Layer 1 — 单测自动发现（unit test auto-discovery）

### Tests (write first)

Test cases to assert before implementing `run_skill_unit_tests` in validate-plugin.sh:

- `loop-backlog-daemon.test.js` is discovered and reported in validate-plugin.sh output
- validate-plugin.sh exits non-zero when a discovered `.test.js` exits 1
- validate-plugin.sh exits zero when all discovered tests pass
- A `.test.js` path that does not exist is silently skipped (no spurious FAIL)

Manual verification approach: temporarily replace `loop-backlog-daemon.test.js` with a stub that `process.exit(1)`, confirm validate-plugin.sh fails; restore the real file, confirm PASS.

### Implementation

File to modify:
- `/home/yale/work/baime/scripts/validate-plugin.sh` — add `run_skill_unit_tests()` function and `=== Unit Tests ===` section (~35 lines)

```bash
# ── Unit test auto-discovery ──────────────────────────────────────────────────

echo ""
echo "=== Unit Tests ==="

run_skill_unit_tests() {
  local test_dir="$REPO_ROOT/scripts"
  for test_file in "$test_dir"/*.test.js "$test_dir"/*.test.sh; do
    [ -f "$test_file" ] || continue
    local name
    name="$(basename "$test_file")"
    if [[ "$test_file" == *.test.js ]]; then
      if node "$test_file" >/dev/null 2>&1; then
        pass "unit test: $name"
      else
        fail "unit test: $name"
      fi
    elif [[ "$test_file" == *.test.sh ]]; then
      if bash "$test_file" >/dev/null 2>&1; then
        pass "unit test: $name"
      else
        fail "unit test: $name"
      fi
    fi
  done
}

run_skill_unit_tests
```

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -q "unit test: loop-backlog-daemon.test.js"`
- [ ] `node scripts/loop-backlog-daemon.test.js`

---

## Phase B: Layer 2 — contracts: フォーマット定義とバリデーター

### Tests (write first)

Test cases to assert before implementing the contract validator:

- A SKILL.md with `contracts: [{grep: "pattern", target: self}]` where pattern exists → PASS reported
- A SKILL.md with `contracts: [{not-grep: "absent", target: self}]` where pattern is absent → PASS reported
- A SKILL.md with `contracts: [{grep: "missing", target: self}]` where pattern is absent → FAIL reported
- A SKILL.md with no `contracts:` field → silently skipped (no FAIL)
- validate-plugin.sh `=== Contract Tests ===` section header appears in output

Manual verification: create two minimal SKILL.md stubs in a temp dir to exercise pass/fail paths.

### Implementation

File to modify:
- `/home/yale/work/baime/scripts/validate-plugin.sh` — add `validate_contracts()` function and `=== Contract Tests ===` section (~70 lines)

Implementation approach:
1. Add a python3 inline script that extracts `contracts:` from YAML frontmatter; returns empty list if field absent
2. For each rule: resolve `target: self` → the SKILL.md file path; external path → `$REPO_ROOT/<path>`
3. Execute `grep -q "<pattern>" <file>` for `grep:` rules; `! grep -q "<pattern>" <file>` for `not-grep:` rules
4. Report `PASS: contracts[N] <skill>` or `FAIL: contracts[N] <skill> — <rule>`
5. Call `validate_contracts "$skill_file"` inside the existing `for skill_dir in "$SKILLS_DIR"/*/` loop

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -q "Contract Tests"`
- [ ] `! python3 -c "import yaml; yaml.safe_load(open('plugin/skills/loop-backlog/SKILL.md').read().split('---')[1])" 2>&1 | grep -q "Error"`

---

## Phase C: loop-backlog の contracts: 追加 + 陳腐化スクリプト削除

### Tests (write first)

Test cases to assert before modifying loop-backlog/SKILL.md and deleting stale scripts:

- `plugin/skills/loop-backlog/SKILL.md` frontmatter contains `contracts:` key
- `validate-plugin.sh` reports PASS for all loop-backlog contract rules
- `scripts/test-loop-backlog-skill-monitor.sh` is absent
- `scripts/test-loop-backlog-skill-bootstrap.sh` is absent
- `scripts/test-loop-backlog-skill-template.sh` is absent

### Implementation

File to modify:
- `/home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md` — add `contracts:` block to YAML frontmatter (~15 lines):

```yaml
contracts:
  - grep: "Monitor(persistent=true"
    target: self
  - not-grep: "schedule("
    target: self
  - grep: "loop-stop"
    target: self
  - grep: "## Shutdown"
    target: self
  - grep: "daemonBootstrap"
    target: self
  - grep: "Monitor"
    target: self
  - not-grep: "ScheduleWakeup"
    target: self
  - grep: "loop-backlog-daemon"
    target: self
  - grep: ".daemon.pid"
    target: self
```

Files to delete:
- `/home/yale/work/baime/scripts/test-loop-backlog-skill-monitor.sh`
- `/home/yale/work/baime/scripts/test-loop-backlog-skill-bootstrap.sh`
- `/home/yale/work/baime/scripts/test-loop-backlog-skill-template.sh`

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "contracts:" plugin/skills/loop-backlog/SKILL.md`
- [ ] `! test -f scripts/test-loop-backlog-skill-monitor.sh`
- [ ] `! test -f scripts/test-loop-backlog-skill-bootstrap.sh`
- [ ] `! test -f scripts/test-loop-backlog-skill-template.sh`

---

## Phase D: Layer 0 — validate-plugin.sh に静的内部一致性チェックを追加

### Tests (write first)

Test cases to assert before implementing `validate_skill_internals()`:

- A SKILL.md with `## Implementation` section missing a `### funcName` heading for a function called in `## Spec` → FAIL reported
- A SKILL.md with no `## Implementation` section → check silently skipped (no spurious FAIL)
- A SKILL.md whose body uses `Bash(` but `allowed-tools` omits `Bash` → WARNING reported
- A SKILL.md whose `allowed-tools` covers all tool keywords present → PASS reported
- All 23 existing SKILL.md files pass with zero new FAIL items (regressions forbidden)

Manual verification: create two minimal temp SKILL.md stubs to exercise pass/fail paths.

### Implementation

File to modify:
- `/home/yale/work/baime/scripts/validate-plugin.sh` — add `validate_skill_internals()` function and `=== Layer 0: Internal Consistency ===` section (~80 lines)

Three sub-checks in a single python3 inline script called per SKILL.md:

1. **Function coverage** (only when `## Implementation` exists):
   - Extract `funcName(` patterns from `## Spec` section (conservative regex: word-char sequences immediately followed by `(`)
   - Extract `### funcName` headings from `## Implementation` section
   - FAIL for each function in Spec missing a `### funcName` heading

2. **allowed-tools completeness** (WARNING, not FAIL, for existing skills):
   - Known tool set: `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Monitor`, `Agent`, `Task`, `WebFetch`, `WebSearch`
   - Scan body (excluding frontmatter) for `ToolName(` patterns
   - Compare against `allowed-tools` value; report undeclared tools

3. **daemon-version consistency** (only when frontmatter has `daemon-version:` field):
   - Scan body for `// daemon-version: vN` or `# daemon-version: vN`
   - FAIL if value differs from frontmatter

Call `validate_skill_internals "$skill_file"` inside the existing skill loop.

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -q "Layer 0"`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -c "FAIL" | xargs -I{} test {} -eq 0`

---

## Phase E: DoD テンプレート正規化 — task-to-backlog と feature-to-backlog

### Tests (write first)

Test cases to assert before modifying the skill Implementation sections:

- `plugin/skills/feature-to-backlog/SKILL.md` Implementation section contains `validate-plugin.sh`
- `plugin/skills/feature-to-backlog/SKILL.md` Implementation section contains `contracts:` guidance
- `plugin/skills/task-to-backlog/SKILL.md` Implementation section contains `validate-plugin.sh`
- Both skills still pass `bash scripts/validate-plugin.sh` with zero errors

### Implementation

Files to modify:

1. `/home/yale/work/baime/plugin/skills/feature-to-backlog/SKILL.md` — in the `## Implementation` section, find the final-phase DoD template block and append (~10 lines):

```markdown
Layer 0-2 gate — add as mandatory final-phase DoD items:
- [ ] `bash scripts/validate-plugin.sh`  (Layer 0-2 all green)
- [ ] `grep -q "contracts:" plugin/skills/<skill-name>/SKILL.md`  (≥1 contract rule present)
```

2. `/home/yale/work/baime/plugin/skills/task-to-backlog/SKILL.md` — same location in `## Implementation`, append (~8 lines):

```markdown
Layer 0-2 gate — add as mandatory final-phase DoD item:
- [ ] `bash scripts/validate-plugin.sh`  (Layer 0-2 all green)
```

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "validate-plugin.sh" plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q "validate-plugin.sh" plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q "contracts:" plugin/skills/feature-to-backlog/SKILL.md`

---

## Constraints

- Layer 3 smoke test scaffold (`run-smoke-test.sh`, `smoke/` directories) is out of scope for this plan; it is defined in proposal Goal 4 and belongs in a separate task.
- Layer 0 allowed-tools check reports at WARNING level (not FAIL) to avoid breaking existing green baseline; FAIL is reserved for function-coverage and daemon-version mismatches where evidence is unambiguous.
- Function coverage check is silently skipped for the 16 skills currently lacking `## Implementation`; no new regressions are permitted after this change.
- `contracts:` field is optional in frontmatter; absence is not an error for existing skills. Failing contract rules (pattern not found) increment ERRORS and cause non-zero exit.
- All new shell logic must be compatible with bash 4+; python3 and node are already in use and are the only permitted new runtime dependencies.
- Phases A, B, C, D each touch validate-plugin.sh; implement in order to avoid merge conflicts within a single worktree.

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -q "unit test: loop-backlog-daemon.test.js"`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -q "Contract Tests"`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -q "Layer 0"`
- [ ] `! test -f scripts/test-loop-backlog-skill-monitor.sh`
- [ ] `! test -f scripts/test-loop-backlog-skill-bootstrap.sh`
- [ ] `grep -q "contracts:" plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "validate-plugin.sh" plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q "validate-plugin.sh" plugin/skills/task-to-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED (minor factual fix applied: skill count without Implementation section corrected from 14 to 16 based on codebase grep)

Proposal approved. Starting plan draft.

Plan review iteration 2: APPROVED

Docs committed: docs/proposals/proposal-skill-layered-test-framework.md + docs/plans/115-skill-layered-test-framework.md

claimed: 2026-06-18T04:13:30Z

Completed: 2026-06-18T04:22:13Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 bash scripts/validate-plugin.sh 2>&1 | grep -q "unit test: loop-backlog-daemon.test.js"
- [ ] #3 node scripts/loop-backlog-daemon.test.js
- [ ] #4 bash scripts/validate-plugin.sh 2>&1 | grep -q "Contract Tests"
- [ ] #5 ! python3 -c "import yaml; yaml.safe_load(open('plugin/skills/loop-backlog/SKILL.md').read().split('---')[1])" 2>&1 | grep -q "Error"
- [ ] #6 grep -q "contracts:" plugin/skills/loop-backlog/SKILL.md
- [ ] #7 ! test -f scripts/test-loop-backlog-skill-monitor.sh
- [ ] #8 ! test -f scripts/test-loop-backlog-skill-bootstrap.sh
- [ ] #9 ! test -f scripts/test-loop-backlog-skill-template.sh
- [ ] #10 bash scripts/validate-plugin.sh 2>&1 | grep -q "Layer 0"
- [ ] #11 bash scripts/validate-plugin.sh 2>&1 | grep -c "FAIL" | xargs -I{} test {} -eq 0
- [ ] #12 grep -q "validate-plugin.sh" plugin/skills/feature-to-backlog/SKILL.md
- [ ] #13 grep -q "validate-plugin.sh" plugin/skills/task-to-backlog/SKILL.md
- [ ] #14 grep -q "contracts:" plugin/skills/feature-to-backlog/SKILL.md
- [ ] #15 bash scripts/validate-plugin.sh 2>&1 | grep -q "unit test: loop-backlog-daemon.test.js"
- [ ] #16 bash scripts/validate-plugin.sh 2>&1 | grep -q "Contract Tests"
- [ ] #17 bash scripts/validate-plugin.sh 2>&1 | grep -q "Layer 0"
- [ ] #18 ! test -f scripts/test-loop-backlog-skill-bootstrap.sh
- [ ] #19 grep -q "contracts:" plugin/skills/loop-backlog/SKILL.md
- [ ] #20 grep -q "validate-plugin.sh" plugin/skills/feature-to-backlog/SKILL.md
- [ ] #21 grep -q "validate-plugin.sh" plugin/skills/task-to-backlog/SKILL.md
<!-- DOD:END -->
