# Proposal: Epic 能力模型（B 档）——用可组合 trait 替代 Meta-* 类型体系

**状态**: Proposal  
**日期**: 2026-06-21  
**关联**: TASK-93（Exp-K）、loop-meta-architecture.md

---

## Background

当前系统在 `loop-backlog`（L0 执行器）之上叠加了 `loop-meta`（L1 规划器），引入了四个自定义状态（Meta-Proposal / Meta-Plan / Meta-Active / Meta-Done）和独立的第二个 daemon session。这套"类型叠加"的架构在 TASK-93 执行过程中暴露出两类具体问题：

1. **竞争 bug（实证）**：两个 daemon 并存时，loop-meta 在 `/meta-task-to-backlog` skill 尚未完成计划撰写期间就抢先处理 Meta-Proposal 任务，创建出内容为字面量 `\n` 的裸任务（TASK-105），需要手动删除。这是两个事件源、两条 lane、两套状态竞争的直接产物。

2. **类型爆炸（结构性）**：每加一种"任务形态"就要新 skill + 新状态 + 新 daemon 逻辑。现在已有 task-to-backlog / feature-to-backlog / meta-task-to-backlog 三套几乎平行的 reviewLoop 代码。下一个"带安全审计的 epic"需要再来一套。

根因是设计层面的误判：**proposal、plan、子任务分解、执行、验收——这些是任务拥有的"能力"，不是任务的"类型"**。把能力捆绑进类型，必然导致类型爆炸；把能力正交化，任意组合即可涵盖所有当前和未来的形态。

---

## Goals

1. 单一事件循环、单一 daemon——彻底消除 Meta-* lane 与 Backlog lane 的竞争。
2. 任务形态由声明的 `capabilities` 决定，不由状态名称决定——标准状态 lane 不变。
3. 新增能力 = 注册表加一行，不动 dispatcher、不加状态、不加 daemon。
4. 现有三套 reviewLoop 合并为 spec-stdlib 中一个共享处理器——消除代码重复（直接解决 MT-08 跨 skill 重复检测的动机之一）。
5. Exp-K 数据采集的 evaluate→replan 环原封不动保留，只是不再绑死在 Meta-Active 状态上。

---

## 核心概念：能力（Capability）

能力是任务可以声明的、相互独立的附加处理单元。每个能力包含四个正交组件：

```
Capability :: {
  facet     : StructuredContent,   -- 存在任务 implementationPlan / notes 中的内容
  processor : TaskId → ()          -- dispatcher 调用的处理器函数
  done-marker : String             -- 写入 notes 的完成标记（可 grep）
  deps      : [Capability]         -- 前置能力（构成 DAG）
}
```

### 能力目录（当前 5 个 + 扩展槽）

| 能力 | Facet 内容 | 处理器动作 | Done-marker | 前置依赖 |
|------|-----------|-----------|-------------|---------|
| `propose` | Proposal（背景/目标/取舍） | 起草 + proposalLoop | `cap:propose=approved` | — |
| `plan` | Plan（subjects 或 phases） | 起草 + planLoop | `cap:plan=approved` | `propose`（若声明） |
| `decompose` | 子任务链接（parent_task_id） | reconcile(desired ⊖ actual) + WIP 调度 | `cap:decompose=converged` | `plan` |
| `execute` | DoD shell-gates | 执行 + verifyDod | `cap:execute=done` | `plan` |
| `evaluate` | Acceptance Criteria | oracle/dod/trace 切片 → Met/NotMet | `cap:evaluate=Met` 或 `cap:evaluate=NotMet` | `decompose`（epic 路径）或 `execute`（leaf 路径） |

`replan` 不是独立能力，而是 `evaluate=NotMet` 的**反馈边**：根因分类 + 修改 plan facet → 重触发 `decompose` 处理器。

### 能力 DAG

```
propose → plan ─┬─→ decompose ──→ evaluate ⟲ NotMet → (修 plan → 重触发 decompose)
                └─→ execute ───→ evaluate
```

**`decompose` 与 `execute` 是互斥推荐但非强制**：epic 声明 `decompose`，leaf 声明 `execute`。同时声明两者在模型上合法，只是实践中没有意义（dispatch 会依次执行）。

---

## 任务表示

### Frontmatter 扩展

在现有 backlog frontmatter 中增加一个 `capabilities` 字段：

```yaml
---
id: TASK-106
title: Add contracts-density soft-warning to validate-plugin.sh
status: Ready                                          # ← 标准状态，不变
capabilities: [propose, plan, decompose, evaluate]    # ← 新增，声明拥有的能力
parent_task_id: null
---
```

`status` 沿用标准 lane（Proposal / Plan / Backlog / Ready / In Progress / Done）。`capabilities` 决定处理器路由，与 `status` 正交：一个处于 `In Progress` 的任务可以是 epic（有 `decompose`），也可以是 leaf（有 `execute`）。

### Done-marker 写入 notes

能力处理器完成后，在任务 notes 写入标记：

```
cap:propose=approved
cap:plan=approved
cap:decompose=converged
cap:evaluate=Met
```

这些标记**可 grep、可追溯、向后兼容**。`check-roi-gate.sh` 只需把 `status: Meta-Done` 改为 `cap:evaluate=Met` 即可。

### 现有标准状态的语义

| 状态 | 在新模型中的含义 |
|------|----------------|
| `Proposal` | 处理器正在运行 `propose` 能力（起草/review） |
| `Plan` | 处理器正在运行 `plan` 能力（起草/review） |
| `Backlog` | 已完成 plan，等待调度（epic 子任务的初始状态） |
| `Ready` | WIP 调度器已提升，等待执行 |
| `In Progress` | 执行器正在工作（execute）或 reconcile 正在进行（decompose） |
| `Done` | 所有声明能力的 done-marker 均已写入 |

---

## 统一 Dispatcher

**核心变更：合并 loop-meta 和 loop-backlog 为单一事件循环。**

```haskell
-- 单一处理器注册表
registry :: Map Capability Processor
registry = {
  propose   ↦ proposeProcessor,
  plan      ↦ planProcessor,
  decompose ↦ decomposeProcessor,
  execute   ↦ executeProcessor,
  evaluate  ↦ evaluateProcessor,
}

-- 单一 dispatcher：按能力 DAG 找下一个未满足的能力
dispatch :: TaskId → Outcome
dispatch(id) = {
  caps    : readField(id, "capabilities"),
  markers : readCapMarkers(id),           -- grep notes for cap:*=*
  next    : firstUnsatisfied(caps, markers, dependencyDAG),
  case next of
    Nothing  → setStatus(id, "Done")     -- 所有能力均满足
    Just cap → registry[cap](id)         -- 路由到对应处理器
}

-- 事件循环：单一 daemon，单一 task-ready 事件
workerLoop :: () → ()
workerLoop() = {
  daemonBootstrap(),
  catchUpScan(),           -- 启动时扫描所有 capabilities 不空且未 Done 的任务
  Monitor(command="tail -f -n 0 .daemon.log"):
    | "task-ready:TASK-N" → dispatch(TASK-N)
    | stopSentinel        → return Stopped
    | _                   → continue
}
```

**关键点**：daemon 只发一种事件（`task-ready`），dispatcher 内部按 `capabilities` 路由。loop-meta 的 `meta-ready` 事件和第二个 session **消失**。

---

## 处理器规格

### proposeProcessor（= 现 draftMetaProposal + proposalLoop）

```haskell
proposeProcessor :: TaskId → ()
proposeProcessor(id) = {
  if marker(id, "cap:propose") == "approved": return,  -- 幂等：已完成则跳过
  draft : proposalAgent(id),
  _     : reviewLoop(id, draft, "propose", maxIter=4),
  -- reviewLoop 写 cap:propose=approved 后返回
}
```

### planProcessor（= 现 planLoop）

```haskell
planProcessor :: TaskId → ()
planProcessor(id) = {
  if marker(id, "cap:plan") == "approved": return,
  draft : planAgent(id, readProposal(id)),
  _     : reviewLoop(id, draft, "plan", maxIter=4),
}
```

**两个 reviewLoop 共用 spec-stdlib 中的同一个实现**，只有 review 标准不同（通过 `reviewCriteria` 参数区分 propose/plan/TDD-plan）。这直接消除现有 task-to-backlog / feature-to-backlog / meta-task-to-backlog 三处平行代码。

### decomposeProcessor（= 现 draftDecomposition + idempotentReconcile + WIP）

```haskell
decomposeProcessor :: TaskId → ()
decomposeProcessor(id) = {
  desired : decomposerAgent(id, readPlan(id)),
  actual  : listChildren(id),
  gap     : desired ⊖ actual,

  if empty(gap):
    writeMarker(id, "cap:decompose=converged"),
    setReady(id, filter(c → status(c) == Backlog, listChildren(id))),
    return,

  if anomaly(id): escalate(id, reason); return,  -- noProgress / diverging / budget

  ∀t ∈ gap: createSubTask(id, t),   -- 必须经 epic-to-backlog 或 task-to-backlog
  appendNote(id, "decomposeProcessor: created " + |gap| + " sub-task(s)"),
}
```

`decomposeProcessor` 是**可重入的**：`evaluate=NotMet → replan 改 plan → dispatch(id) 再次路由到 decompose`，它重跑 diff，只补缺口。

### executeProcessor（= 现 loop-backlog leaf task 执行体）

不变。leaf task 的 `capabilities: [plan, execute]`（或含 `propose`）路由到此。

### evaluateProcessor（= 现 evaluator + replanner）

```haskell
evaluateProcessor :: TaskId → ()
evaluateProcessor(id) = {
  -- epic 路径：等所有子任务 Done
  if hasCap(id, "decompose"):
    pending : filter(c → status(c) ≠ Done, listChildren(id)),
    if ¬empty(pending): return,   -- 子任务未全完，等待
  
  result : evaluator(id),

  if result == Met:
    writeMarker(id, "cap:evaluate=Met"),
    setStatus(id, "Done"),
    return,

  -- NotMet → replan → 重触发 decompose
  replanResult : replanner(id, result),
  if replanResult ≠ Escalated:
    clearMarker(id, "cap:decompose"),  -- 让 dispatch 重新路由到 decompose
    appendNote(id, "replan: " + replanResult.rootCause + " — " + replanResult.summary),
}
```

---

## Skills 映射

skill 的职责收敛为**"生成器"**：生成初始 facet 内容 + 写入 `capabilities` 字段 + 设置初始状态。处理器逻辑全部在 dispatcher 侧，不在 skill 侧。

| Skill | capabilities 产出 | 初始状态 | 处理器路径 |
|-------|-----------------|---------|-----------|
| `task-to-backlog` | `[plan, execute]` | Backlog | plan → execute → evaluate（可选） |
| `feature-to-backlog` | `[propose, plan, execute]` | Proposal | propose → plan → execute → evaluate（可选） |
| `epic-to-backlog`（new） | `[propose, plan, decompose, evaluate]` | Proposal | propose → plan → decompose ⟲ evaluate |

`meta-task-to-backlog`（本次新建）**直接改名/收敛为 `epic-to-backlog`**，内容几乎不变——它已经产出 proposal + plan，只需：
1. 写入 `capabilities: [propose, plan, decompose, evaluate]` frontmatter
2. 最终状态设 `Backlog`（不再需要 `Meta-Plan`，dispatcher 会按 capabilities 路由）

---

## 可扩展性：新增能力 = 注册表加一行

以"安全审计"能力为例，未来要给高风险 epic 加一道审计：

```yaml
# 任务声明
capabilities: [propose, security-review, plan, decompose, evaluate]
```

```haskell
-- 注册表加一行
registry["security-review"] = securityReviewProcessor

-- DAG 加一条边
dependencyDAG["security-review"] = { deps: ["propose"], before: ["plan"] }
```

**不需要**：不新增状态、不新增 daemon、不改 dispatcher、不改现有 skill。

同理适用于：`risk-assess`、`cost-estimate`、`legal-review`、`design-doc`……任意新能力只在两处注册即可。

---

## 与现有机制的对比

| 维度 | 现有 Meta-* 模型 | Epic Capability 模型（B 档） |
|------|----------------|---------------------------|
| 状态数 | 4 自定义（Meta-\*）+ 6 标准 = 10 | 6 标准（不变） |
| Daemon 数 | 2（loop-backlog + loop-meta） | 1 |
| 事件类型 | task-ready + meta-ready | task-ready（1 种） |
| 新增任务形态 | +1 skill + 自定义状态 | 注册表 +1 行 |
| ReviewLoop 实现 | 3 份平行代码 | 1 份（spec-stdlib） |
| replan 环 | 保留 | 保留（不变） |
| evaluate 门控 grep | `status: Meta-Done` | `cap:evaluate=Met` |
| 竞争 bug 根因 | 两 daemon 共享 backlog | 消除（单 daemon） |

---

## 迁移路径

### 阶段 1：基础设施（不动现有任务）

1. **spec-stdlib 扩展**：把 reviewLoop 从 task-to-backlog / feature-to-backlog / meta-task-to-backlog 提取为 `spec-stdlib § reviewLoop`（通用，参数化 review 标准）。
2. **Dispatcher 实现**：在 loop-backlog（或新统一 loop）中加入 `capabilities` 读取 + 注册表路由逻辑。兼容旧任务（无 `capabilities` 字段 → 走原有 execute 路径）。
3. **check-roi-gate.sh**：把 `status: Meta-Done` + `evaluator:` 改为 `cap:evaluate=Met`。

### 阶段 2：新 skill

4. `epic-to-backlog` skill（从 `meta-task-to-backlog` 改名，写入 `capabilities` frontmatter，终态改 Backlog）。
5. 更新 `task-to-backlog` / `feature-to-backlog` 写入对应 `capabilities` 字段（向后兼容：旧任务无此字段不影响执行）。

### 阶段 3：现有 Meta-Plan 任务迁移（TASK-106–117）

6. 批量 sed：把 12 个任务的 `status: Meta-Plan` 改为 `status: Backlog`，加入 `capabilities: [propose, plan, decompose, evaluate]`，并写入 `cap:propose=approved` + `cap:plan=approved`（已通过 review）。
7. 删除 loop-meta 独立 session / Meta-* 状态配置。

### 阶段 4：验证

8. 跑 Exp-K（loop-backlog + dispatcher 路由 12 个 epic → draftDecomposition → 子任务 → evaluate），采集 replan 频率 baseline。
9. `check-roi-gate.sh` 用新 grep 模式确认 P3→P4 门控可用。

---

## 风险与护栏

| 风险 | 对策 |
|------|------|
| backlog frontmatter 不兼容 `capabilities` 数组 | 退路：全部放 notes 标记（`cap:has=decompose,evaluate`）；先验证 |
| DAG 推断 bug（任务卡死或重复执行） | 实现 `scripts/verify-capability-state.sh`：检查 caps ∩ markers 的一致性 |
| `firstUnsatisfied` 边界条件（循环依赖）| DAG 显式写死，不允许运行时声明依赖；循环依赖在 lint 时报错 |
| 旧任务（无 capabilities）与新 dispatcher 混跑 | Dispatcher 对无 `capabilities` 字段的任务走旧 execute 路径（向后兼容默认） |

---

## 约束

- 不引入新状态枚举；现有 backlog.md 状态 lane 不变
- 不引入第三方 schema 库；能力注册表是纯 bash/JS 字典
- `capabilities` 字段一旦写入不再运行时修改（只读声明）；能力进度通过 notes 标记追踪
- 本文档是 B 档方案（预注册 5 个能力，DAG 写死）；C 档（能力依赖可声明、schema 化）留作未来演进

---

## 下一步

1. **确认 backlog frontmatter 对 `capabilities` 数组的支持**（10 分钟验证实验）
2. **spec-stdlib reviewLoop 提取**（修改 3 个 SKILL.md）
3. **Dispatcher 路由逻辑实现**（修改 loop-backlog-daemon.js 或新统一 loop 脚本）
4. 依次执行阶段 1–4
