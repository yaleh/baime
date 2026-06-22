---
id: TASK-19
title: 为 SKILL.md 构建静态分析 linting 工具链
status: "Basic: Proposal"
assignee: []
created_date: '2026-06-17 17:24'
updated_date: '2026-06-18 02:27'
labels:
  - kind:basic
  - architecture
  - spec-quality
  - tooling
dependencies: []
priority: medium
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

本项目交付的核心资产是 `.md` 格式的 skill 文件（SKILL.md），其中嵌有 Haskell-like 形式规格 DSL。迄今为止，规格质量问题只能靠人工发现：

- **Config 类型名冲突**（TASK-12）：三个 skill 各自声明了同名 `Config` 类型，字段完全不同，LLM 跨 skill 上下文时产生歧义。靠人工 code review 发现。
- **Undefined references**（TASK-13）：`loop-backlog` spec 调用了 12 个未声明签名的函数，形成不可见接口。靠人工枚举发现。
- **description 字段被 plan 覆盖**（已修复）：skill 实现层用 `--description` 写入 plan 内容，覆盖了原始 proposal。根源是 spec 层对 `finalise` 的副作用约束缺失。
- **resolveOrCreate 缺失**（已修复）：λ 入口对 topic 类型未精确定义（`TaskId | Description` 没有区分），导致实现层永远 createTask，即使已有 task 也创建新的。

以上问题均属**可用 parser/regex 机械检测**的类别，不需要 LLM 语义判断。类比 ArchGuard 对源代码的分析，理论上可以建立等效的 `.md` 静态分析工具。

## Goals

1. 实现 **undefined reference detection**：提取 spec 所有 `identifier(` 调用点，减去同文件声明的函数集，差集即为 undefined refs（区分 intentional primitive vs spec gap 留给 skill/subagent）
2. 实现 **type name duplicate detection**：跨 skill 文件扫描同名 `TypeName ::` 定义，报出字段结构不同的冲突
3. 实现 **spec coverage check**：检查每个 skill 是否具备 YAML frontmatter、`## Spec` 节、λ 入口点三要素
4. 实现 **implementation constraint coverage**：检查每个 spec 函数是否在 `## Implementation` 节有对应 section（防止 `finalise` 类 spec gap）
5. 实现 **field write convention lint**：在 Implementation 区块中检测 `backlog task edit --description "$(cat ...)"`，应改为 `--planSet`（纯 regex rule）
6. 实现 **clone detection**：提取所有函数定义体并做文本相似度比较，检出跨 skill 重复规格（如 `reviewLoop`、`detectLang`）

## DSL 扩展前提：四个最小有效语法扩展

linter 的解析精度取决于 SKILL.md 格式的规范化程度。在实现 linting 工具之前，需先将以下四个扩展作为 SKILL.md 格式约定落地，以提供精确的解析目标：

### 扩展 1：模块声明（解决类型名冲突）

每个 SKILL.md 在 `## Spec` 顶部声明模块名：

```haskell
module TaskToBacklog where
```

效果：类型名自动获得模块前缀（`TaskToBacklog.DocConfig`），跨 skill 上下文中同名类型不再歧义。linter 可将"模块声明缺失"作为 warning。

### 扩展 2：显式外部引入块（解决 undefined refs）

在模块声明之后、类型声明之前，集中声明所有来自 harness/环境的外部原语：

```haskell
import Harness (Monitor, exists, fromClaudeMd)
```

效果："declared in spec + imported from Harness"构成完整的已知标识符集合，call sites 中不在此集合内的即为 undefined ref，规则变为纯集合差运算。

### 扩展 3：Sum type 用于输入区分（解决分支遗漏）

当 λ 入口的输入有多种语义时，用 sum type 而非裸 `String` 表达：

```haskell
Topic = TaskId String | Description String

taskToBacklog :: Topic → BacklogTask
```

效果：linter 可检查主函数是否对 sum type 的每个构造子都有对应 pattern；LLM 在实现时看到两个分支，不会遗漏 `TaskId` 路径。

### 扩展 4：Effect 注解（解决字段写入 spec gap）

对有副作用的函数（通常是 `finalise`、`createTask`、`edit` 类操作），在签名下方用结构化注释声明读写行为：

```haskell
finalise :: Task → Plan → Config → ()
  -- effect: task.planSection ← plan   (WRITE)
  -- effect: task.description           (PRESERVE)
  -- effect: task.status ← "Backlog"   (WRITE)
```

效果：linter 可对比 Implementation 区块中的 `backlog task edit` 调用与 effect 注解的一致性；同时为 LLM 提供明确的字段操作约束，防止实现时写错字段。

### 扩展的收益边界

这四个扩展覆盖今天发现的四类 bug，且均在"parser/regex 可表达"范围内，不引入 Haskell 高级特性（类型类、monad、参数多态）。后者依赖编译器强制执行，在 LLM executor 场景下无载体，加了反而降低可读性。

## Proposed Approach

### 两层架构

**Layer 1 — 通用 Claude Code skill 结构解析**（适合纳入 ArchGuard .md 插件）：
- 解析 YAML frontmatter（name、description、allowed-tools）
- 提取 `/skill-name` 显式引用，构建 inter-skill reference graph
- spec coverage check（三要素）
- field write convention lint

**Layer 2 — baime Haskell-like DSL 解析**（项目特定，适合独立 linter 脚本）：
- 解析模块声明和 import 块，构建已知标识符集合
- 解析类型声明 `TypeName :: { ... }`，跨文件比对同名类型
- 提取函数签名 `funcName :: TypeA → TypeB`，构建 declared function 集合
- 提取函数调用 `funcName(` ，构建 call sites 集合，差集 = undefined refs
- 检查 sum type 的 pattern match 穷举性
- 对比 effect 注解与 Implementation 区块的字段操作
- 提取函数实现体，做跨 skill 文本相似度比较（clone detection）
- 检查 `## Implementation` 各 section 标题与 spec 函数名的对应关系

### 交付形式

优先以 `bash scripts/skill-lint.sh` 实现，通过 `test-cmd` 集成到现有验证流程（`bash scripts/validate-plugin.sh`）。不需要引入新依赖。

## Trade-offs

**In scope**：确定性的结构检查，parser/regex 可表达。
**Out of scope**：
- "这些 undefined refs 是 intentional primitive 还是 spec gap？"——需要语义判断，交给 skill/subagent
- "这 15 个从未单独修改的 skill 是稳定还是废弃？"——需要结合 git history + 用途分析（TASK-17）
- "Doc 是否是 Proposal 和 Plan 的合法父类型？"——非正式类型系统，语义判断
- Git co-change / change risk——ArchGuard MCP 已直接支持，无需重复实现

## Known Risks

- Haskell-like DSL 没有正式 grammar 文档，解析规则需从现有文件归纳，可能有边缘情况
- Layer 2 是 baime 项目特定约定，ArchGuard 上游不一定接受
- `→`、`∀`、`¬` 等 Unicode 符号在 bash/grep 中需要特别处理
- 四个 DSL 扩展需要先更新现有 5 个有形式规格的 skill，才能让 linter 有精确解析目标
<!-- SECTION:DESCRIPTION:END -->
