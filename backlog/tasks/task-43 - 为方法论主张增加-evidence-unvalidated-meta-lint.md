---
id: TASK-43
title: '为方法论主张增加 evidence/[unvalidated] meta-lint'
status: Backlog
assignee: []
created_date: '2026-06-19 12:26'
updated_date: '2026-06-19 12:41'
labels:
  - baime
  - validate-plugin
  - contracts
  - meta-lint
dependencies: []
references:
  - docs/baime-and-quantitative-experiments.md
  - scripts/validate-plugin.sh
  - plugin/skills/methodology-bootstrapping/SKILL.md
priority: medium
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

`methodology-bootstrapping` frontmatter 里有大量带数字的方法论主张：

```
"100% success rate, 4.9 avg iterations, 10-50x speedup vs ad-hoc"
"V_instance = 0.87, 95% content equivalence"
"195x speedup (390 min → 2 min)"
"transferability: 90%"
```

这些数字是 agent 自评产出的，没有经过任何 held-out fixture 或外部 oracle 检验。它们和 Exp-B 实测的 `oracle-f1: 1.0` 在文档里被同等对待，统称 "empirical"——但认识论地位完全不同。

Exp-A 已经证明这种混淆是危险的：§3.1 "P3 是主动干扰" 正是一个未检验的自信断言，实测方向完全相反（+14.5pp）。当前 `validate-plugin.sh` 的 Layer 2 contracts 只检查结构约束，对这类软断言没有任何检测。

本任务在 `validate-plugin.sh` 增加一条 meta-lint 规则，强制区分"测出来的数字"（有 `evidence:` 指针）和"自评的数字"（必须标 `[unvalidated]`）。

参见 `docs/baime-and-quantitative-experiments.md` §三 "Evidence 回写链"。

## Goals

1. 在 `validate-plugin.sh` 增加 meta-lint：检测 SKILL.md frontmatter 和正文中的裸数字断言
2. 定义合规格式：`evidence:` 指针 或 `[unvalidated]` 标注，二选一
3. 对现有 skill 产出审计报告，识别需补标注的主张
4. 在 `docs/skill-quality-engineering.md` 补充对应规范节

## Proposed Approach

### 什么算"需要检测的数字断言"

满足以下任一模式的字符串，出现在 SKILL.md frontmatter 或 `## What` / description 节中：

```
[0-9]+x speedup          # "10-50x speedup"
[0-9]+% .*rate           # "100% success rate"、"95% content equivalence"
transferability: [0-9]   # "transferability: 90%"
V_instance.*[0-9]\.[0-9] # "V_instance = 0.87"
[0-9]+ (min|hours?) .*→  # "390 min → 2 min"
```

### 合规格式（两选一）

**选项 A：有 evidence 指针**
```yaml
# frontmatter
transferability: 90%
transferability-evidence: bootstrap-004-results   # 指向实验 results.md
```

**选项 B：标 [unvalidated]**
```yaml
description: "... 10-50x speedup [unvalidated] ..."
```

正文中的软断言在句末加 `[unvalidated]`：
```markdown
Validated in 8 experiments with 100% success rate [unvalidated], 4.9 avg iterations [unvalidated].
```

### validate-plugin.sh 实现方案

新增 `check_meta_lint()` 函数，在 Layer 2 之后、Layer 3 之前运行：

1. 对每个 SKILL.md，用 grep 提取符合数字断言模式的行
2. 对每条命中行，检查同行或相邻行是否有 `evidence:` 或 `[unvalidated]`
3. 若都没有 → `WARN: untagged quantitative claim in <skill>` （软警告，不 fail）

初始为软警告（不阻断 CI），待第一轮审计结束、现有 skill 全部补标后，升级为 hard fail。

### 审计现有 skill 的预期结果

预计受影响的 skill（需补标注）：
- `methodology-bootstrapping`：大量软断言（"100% success"、"10-50x"、"195x"、"V_instance = 0.87"）
- `rapid-convergence`、`agent-prompt-evolution`：可能有类似模式
- 其他 Methodology Skills：按 §3.1 修订后可能有新增断言

审计报告输出到 `experiments/skill-quality/artifacts/analysis/meta-lint-audit.md`。

### docs/skill-quality-engineering.md 补充节

在 §4（contracts 断言设计）后增加 §4.4：

```
### §4.4 数字断言的证据要求

方法论文档中任何带数字的效果声明（speedup、success rate、V 分量、transferability），
必须满足以下之一：
- 有 `evidence:` 指针，指向 held-out oracle 实验的 results.md
- 标注 `[unvalidated]`，表示为自评或理论估算

违反此规则不影响功能正确性，但影响方法论可信度评分（V_meta 分量：oracle 标定度）。
```

## Trade-offs

- **软警告而非 hard fail（初始）**：现有 skill 有大量需要补标的主张，一次性 hard fail 会阻断所有 CI，先以报告形式暴露问题，再分批修复
- **不要求补做实验**：`[unvalidated]` 是合法状态，不强制要求为每条断言设计实验；它的作用是让读者知道该数字的认识论地位
- **grep 实现而非语义分析**：与现有 contracts 体系保持一致；FN（没检测到的软断言）可接受，FP（误报合法内容）通过模式精化解决
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 为方法论主张增加 evidence/[unvalidated] meta-lint

## Context

`validate-plugin.sh` 的 Layer 0 已覆盖结构一致性、trigger 重叠、contracts 密度等检查，
但对 SKILL.md 中带数字的方法论主张（"10-50x speedup"、"V_instance = 0.87"）完全没有约束。
这类软断言与实测数据混用，已被 Exp-A 证明存在风险（§3.1 方向反转事件）。

本任务分三个阶段：先审计现有 skill 暴露问题规模，再实现 check_meta_lint() 函数，
最后补充规范文档节（§4.5，§4.4 已被 Trigger 重叠检测占用）。

---

## Phase 1: 审计现有 skill 的数字断言

用 Python 对所有 SKILL.md 扫描，提取命中数字断言模式的行，产出审计报告。

**扫描范围**：frontmatter `description:` 字段值 + 正文前 200 行（`lines[:200]`）。

**5 个检测 regex 模式**（精确到"效果声明"语境，避免匹配结构性数字）：

```python
PATTERNS = [
    r'\d+[x×]\s*(speedup|faster|reduction|improvement|boost)',  # 倍数效果: "10-50x speedup"
    r'\d+%\s*(speedup|reduction|improvement|success|accuracy|equivalence|transferab)',  # 效果类百分比
    r'^transferability:\s*\d',           # frontmatter transferability 字段
    r'V_\w+\s*[=:]\s*0\.\d+',           # V_instance = 0.87 类自评分
    r'\d+\s*min\b.*→',                  # 时间对比: "390 min → 2 min"
]
```

**豁免条件**（以下任一出现在同行或上下 2 行内 → 合规，跳过）：

```python
EXEMPT_RE = re.compile(
    r'(?i)(\*{0,2}evidence\*{0,2}:|\w+-evidence:|\[unvalidated\])',
    re.IGNORECASE
)
```

这覆盖：`evidence:`、`**Evidence**:`、`transferability-evidence:`、`[unvalidated]`。

**输出**：`experiments/skill-quality/artifacts/analysis/meta-lint-audit.md`
格式：每个 skill 的命中行列表（区分"已合规"和"需补标"），附全局 Summary 统计（受影响 skill 数 / 总 warning 行数）。

### DoD
- `test -f experiments/skill-quality/artifacts/analysis/meta-lint-audit.md`
- `grep -q '## Summary' experiments/skill-quality/artifacts/analysis/meta-lint-audit.md`
- `grep -q 'methodology-bootstrapping' experiments/skill-quality/artifacts/analysis/meta-lint-audit.md`

---

## Phase 2: 在 validate-plugin.sh 实现 check_meta_lint()

在 `# ── Layer 0: Contract Density Check ──` 块之后、`# ── Summary ──` 之前插入新节：

```bash
# ── Layer 0: Meta-lint — Quantitative Claims ─────────────────────────────────

echo ""
echo "=== Layer 0: Meta-lint (Quantitative Claims) ==="
```

实现为 Python heredoc（与 Contract Density Check 同风格），逻辑：

1. **扫描范围**：与 Phase 1 完全一致——frontmatter `description:` 字段 + 正文 `lines[:200]`
2. 对每行用 5 个模式（同 Phase 1，含相同的 PATTERNS 和 EXEMPT_RE）做 regex match
3. 命中且不豁免 → 打印 `  WARN: [<skill>] untagged quantitative claim: <line>`，`warnings += 1`
4. 所有 skill 无命中 → `  PASS: no untagged quantitative claims`
5. `sys.exit(warnings)` — 退出码传给 shell

shell 侧累加：
```bash
META_WARNINGS=$?
WARNINGS=$((WARNINGS + META_WARNINGS))
```

**重要**：命中增加 WARNINGS（不增加 ERRORS），不阻断 CI，是软警告。

### DoD
- `grep -q "Meta-lint" scripts/validate-plugin.sh`
- `grep -q "untagged quantitative claim" scripts/validate-plugin.sh`
- `grep -q 'META_WARNINGS' scripts/validate-plugin.sh`
- `bash scripts/validate-plugin.sh 2>&1 | grep -q "Meta-lint"`

---

## Phase 3: 补充 docs/skill-quality-engineering.md §4.5

在现有 `### 4.4 Trigger 重叠检测` 节末尾之后插入 §4.5 节
（§4.4 已被占用，新节编号为 4.5）。

插入内容：

```markdown
### 4.5 数字断言的证据要求（Meta-lint）

方法论文档中任何带数字的效果声明（speedup、success rate、V 分量、transferability）
出现在 SKILL.md frontmatter `description` 字段或正文前 200 行中时，
必须满足以下之一：

- **有 `evidence:` 指针**（frontmatter 同名字段加 `-evidence` 后缀，指向实验 results.md）：
  ```yaml
  transferability: 90%
  transferability-evidence: experiments/skill-quality/artifacts/analysis/exp-b-results.json
  ```
- **标注 `[unvalidated]`**（行内或句末，表示为自评或理论估算）：
  ```markdown
  Validated with 10-50x speedup [unvalidated], based on 8 self-reported experiments.
  ```

`[unvalidated]` 是合法状态，不要求补做实验；其作用是让读者知道该数字的认识论地位。
违反此规则由 `validate-plugin.sh` Layer 0 Meta-lint 输出软警告（不阻断 CI）。

检测模式（仅匹配效果声明语境，不匹配结构性数字）：
- `\d+[x×]\s*(speedup|faster|reduction|improvement|boost)`
- `\d+%\s*(speedup|reduction|improvement|success|accuracy|equivalence|transferab)`
- frontmatter `transferability:` 字段、`V_*` 自评分、时间对比 `NNN min → NNN min`
```

### DoD
- `grep -q '### 4\.5' docs/skill-quality-engineering.md`
- `grep -q 'evidence-' docs/skill-quality-engineering.md`
- `grep -q '\[unvalidated\]' docs/skill-quality-engineering.md`

---

## Constraints

- meta-lint 初始为软警告（WARNINGS），不得修改为 ERRORS；升级为 hard fail 是后续独立任务
- 不修改任何现有 SKILL.md 的内容（审计报告只读，不写回）
- validate-plugin.sh 已有的所有检查不得被破坏（回归保护）
- Python heredoc 风格与现有 Contract Density Check 保持一致
- 新节编号必须为 §4.5（§4.4 已被 Trigger 重叠检测占用）
- Phase 1 的扫描范围（frontmatter description + 正文前 200 行）必须与 Phase 2 实现完全一致

## Acceptance Gate
- `bash scripts/validate-plugin.sh`
- `grep -q "Meta-lint" scripts/validate-plugin.sh`
- `grep -q '### 4\.5' docs/skill-quality-engineering.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: NEEDS_REVISION
修复 4 个问题：
1. Phase 2 DoD 第三条替换为 `grep -q 'META_WARNINGS' scripts/validate-plugin.sh`（原命令存在 FN 风险）
2. Phase 3 节编号从 §4.4 改为 §4.5（§4.4 已被 Trigger 重叠检测占用），DoD 对应更新
3. Acceptance Gate 删除与 Phase 1 DoD 重复的 `test -f ...meta-lint-audit.md`
4. Phase 1 补充了 5 个具体 regex 模式

Plan review iteration 2: NEEDS_REVISION
修复 3 个问题：
1. `\d+%` 模式过于宽泛（预计命中 314 行），改为仅匹配效果声明语境：`\d+%\s*(speedup|reduction|...)`
2. 豆免模式 `evidence:` 未匹配实际文件中的 `**Evidence**:` 格式，补充 EXEMPT_RE 覆盖两种写法
3. Phase 2 扫描范围明确限定为 `lines[:200]`，与 Phase 1 一致

Plan review iteration 3: APPROVED
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f experiments/skill-quality/artifacts/analysis/meta-lint-audit.md
- [ ] #2 grep -q '## Summary' experiments/skill-quality/artifacts/analysis/meta-lint-audit.md
- [ ] #3 grep -q 'methodology-bootstrapping' experiments/skill-quality/artifacts/analysis/meta-lint-audit.md
- [ ] #4 grep -q 'Meta-lint' scripts/validate-plugin.sh
- [ ] #5 grep -q 'untagged quantitative claim' scripts/validate-plugin.sh
- [ ] #6 grep -q 'META_WARNINGS' scripts/validate-plugin.sh
- [ ] #7 bash scripts/validate-plugin.sh 2>&1 | grep -q 'Meta-lint'
- [ ] #8 grep -q '### 4\.5' docs/skill-quality-engineering.md
- [ ] #9 grep -q 'evidence-' docs/skill-quality-engineering.md
- [ ] #10 grep -q '\[unvalidated\]' docs/skill-quality-engineering.md
- [ ] #11 bash scripts/validate-plugin.sh
- [ ] #12 grep -q 'Meta-lint' scripts/validate-plugin.sh
- [ ] #13 grep -q '### 4\.5' docs/skill-quality-engineering.md
<!-- DOD:END -->
