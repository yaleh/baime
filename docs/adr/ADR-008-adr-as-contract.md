---
adr: "008"
title: "ADR 作为契约：将架构决策接入 proposal/plan/check 管线"
status: Accepted
date: 2026-06-24
applies-to: ["docs/adr/**", "scripts/validate-plugin.sh", "plugin/skills/feature-to-backlog/**", "plugin/skills/loop-backlog/**"]
enforcement: static
stage: [check]
lint: |
  # 每个 ADR 必须声明 enforcement 字段；缺失即视为未分类决策。
  missing=0
  for f in docs/adr/ADR-0*.md; do
    grep -qE '^enforcement:\s*(static|semantic|runtime|advisory)\s*$' "$f" || { echo "ADR missing enforcement: $f"; missing=1; }
  done
  test "$missing" = "0"
---

## Context

baime 有 7 个 ADR，但只有 ADR-006 真正接入了执行管线（它在 `validate-plugin.sh`
Layer 0 加了 CLI flag 白名单）。其余 ADR——包括 ADR-001 和 ADR-007 这两条几乎同构的
"运行时脚本必须 plugin-resident"规则——只是人类可读文档，靠 CLAUDE.md 里
"修改 skill 前读相关 ADR"这句话提醒，没有任何自动执行。

后果是可观测的：TASK-183 把 enrichment 助手放进 `scripts/lib/`、TASK-190 把
read-out 脚本放进 `scripts/`，两者都违反了 ADR-001/007 的同类约束，且都通过了
feature-to-backlog 的多轮 plan review。原因是 review 判据是 spec 里固定的**结构规则**
（文件存在、DoD 可执行），不包含仓库的**架构约束**。ADR 写了不等于约束被执行。

进一步观察：ADR 不是同一种东西。按可验证性可分三类：

- **静态可验证**（ADR-001/004/005/007）：grep 路径、命名、标签即可判定。
- **语义可验证**（ADR-003 prompt 自包含）：只能靠 LLM 判断或运行时失败暴露。
- **时序/运行时**（ADR-002 建 Monitor 前必先 stopStaleMon）：需在执行序列中断言。

不存在单一的"应用 ADR"动作。任何通用方案的第一步是给每条 ADR 标注其类别，再路由到
能执行它的那一层。ADR-006 是手工接入的特例；本 ADR 把它一般化。

## Decision

**每个 ADR 携带机器可读的 frontmatter，由统一 harness 消费并路由到管线的相应阶段。
新增一条可静态执行的 ADR 不应需要改动 `validate-plugin.sh` 的代码——只加 frontmatter。**

### 1. Frontmatter schema

每个 ADR 文件的 YAML frontmatter 增加以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `adr` | string | ADR 编号，如 `"008"` |
| `title` | string | 标题 |
| `status` | string | `Proposed` \| `Accepted` \| `Superseded` |
| `applies-to` | [glob] | 路径 glob 列表；任务触及的文件命中其一则该 ADR 相关 |
| `enforcement` | enum | `static` \| `semantic` \| `runtime` \| `advisory` |
| `stage` | [enum] | `proposal` \| `plan` \| `check` 的子集，标明在管线哪几步生效 |
| `lint` | string \| null | `enforcement: static` 时必填：一段 shell 断言，exit 0 = 合规 |

`lint` 块从 REPO_ROOT 执行，约定退出码即判定（非 0 = 违规）。`enforcement` 非 `static`
的 ADR 不要求 `lint`。

### 2. 三层路由

统一 harness 按 `enforcement` 与 `stage` 把每条相关 ADR 送到对应层：

**check 层（static，确定性后防线）**
`validate-plugin.sh` 遍历 `docs/adr/*.md`，对每个 `enforcement: static` 的 ADR 执行其
`lint:` 块，失败报 ERROR。lint 与决策同住一个文件，杜绝 ADR-006 现状那种
"规则在 ADR、代码在 validate-plugin.sh"的两处漂移。

**plan 层（合成 DoD）**
feature-to-backlog 的 draftPlan 前，用任务触及文件匹配各 ADR 的 `applies-to`；命中且
`stage` 含 `plan` 的 ADR，其 `lint` 断言直接作为 DoD 项注入计划。如此 TASK-183 这类任务
在计划阶段就带上对应 DoD，worker 跑 gate 时被自动拦截。

**proposal 层（语义约束注入）**
proposal/plan review prompt 前，匹配 `applies-to`；命中的 ADR（尤其 `enforcement:
semantic`）的 Decision 段作为额外 review 判据注入 reviewer。语义类拦不住于 grep，
此层靠 LLM 判断作早期软预警，与 check 层的硬底线互补。

### 3. 覆盖率 meta 检查

关键不是让所有 ADR 都能 lint（002/003 本就不能），而是让"哪些决策只能靠人盯"显式可见：

- 每个 ADR **必须**声明 `enforcement` 字段（本 ADR 自身的 `lint` 块即执行此检查）。
- 声明 `advisory` 的 ADR 被 `validate-plugin.sh` 列出，使"无自动防护的架构决策"
  随时可数。这是 GCL"把隐性前提显性化"思路在 ADR 治理上的应用。

## Consequences

- 新增静态 ADR 的成本降为"写一段 frontmatter + lint"，无需改 validate 代码。
- 现有 ADR 需逐个补 frontmatter：001/004/007 标 `static` 并补 lint；005 对齐已有的
  半接入实现；006 改造为本 schema 的一个实例；002 标 `runtime`；003 标 `semantic`。
- `applies-to` 的相关性判断与 memory 系统的召回相关性是同一问题；glob 够用则止步，
  不够时两者应共用同一相关性机制，避免重复造轮子。
- feature-to-backlog 与 loop-backlog 的 review/plan 阶段需要增加 ADR 匹配与注入逻辑；
  这是后续任务，本 ADR 只确立 schema 与路由契约。

## Alternatives Considered

- **继续逐条手工接入（ADR-006 模式）**：被否。每条 ADR 各写各的 validate 代码，
  规则与执行两处漂移，且无覆盖率视图。
- **把所有 ADR 塞进每次 proposal/plan 的 context**：被否。ADR 数量增长后 context 爆炸，
  且无关 ADR 稀释 reviewer 注意力。`applies-to` 粗筛是必要的。
- **要求所有 ADR 都可 lint**：被否。语义/时序约束（002/003）本质上无法静态验证；
  强行 lint 会产生假合规。正确做法是分类路由 + 让 advisory 显式可见。
