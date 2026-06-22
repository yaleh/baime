# Proposal: Epic 能力模型（B 档）——用可组合 trait 替代 Meta-* 类型体系

> ⚠️ **已过时（SUPERSEDED）** — 本文档由 [`proposal-epic-split-board.md`](./proposal-epic-split-board.md)（B′ 档，拆板模型）取代，不再采纳。
>
> **过时原因**：B 档在**单一 backlog 板**上用 capability + done-marker 同时表达 epic 与 leaf 两类任务，并把状态栏缩减为纯调度轴。但 `status`（列）本身就是状态，每个 capability 也有状态——两者并非正交，而是同一积状态 `Capability-PC × Scheduling-SubState` 的两个坐标。在单列轴上同时表达两个坐标，逼出了一整套 `phase:` / `wait:children` / `hold:*` label 机制与派生视图（在视图层重算 `firstUnsatisfied`），并遗留 7 处缺口。
>
> 根因是**把两类对象托管在同一块板上**：leaf 天然只有调度轴，epic 天然只有流水线轴，二者仅在共用 `status` 枚举时冲突。B′ 档为 epic 单设一块 backlog 板，每块板用原生 `column = status` 表达自己唯一的轴，冲突消失、label 机制全删。下文保留作设计推演记录。

**状态**: ~~Proposal~~ → **Superseded by B′ 档**  
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
2. 任务形态由声明的 `capabilities` 决定，不由状态名称决定——状态栏缩减为纯调度轴（5 个状态）。
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

### cap:experiment — Experiment Outcome Facet

`cap:experiment` is an additional capability marker for `kind:basic` experiment tasks. It records the epistemic outcome of a quantitative experiment run as a machine-readable, grep-able marker in the task notes. It is **not** a process-lifecycle facet (unlike `cap:propose` / `cap:plan` / `cap:execute`); it is experiment-domain-specific and only relevant to tasks that run a hypothesis-driven experiment.

**Allowed values** (closed enum — validated by `scripts/verify-cap-markers.sh`):

| Value | Meaning |
|-------|---------|
| `CONFIRMED` | Hypothesis supported: the measured data is consistent with the predicted direction and magnitude |
| `NULL` | No detectable effect: the experiment ran with adequate power but found no signal |
| `REJECTED` | Hypothesis contradicted: the measured data is inconsistent with the prediction |
| `UNDERPOWERED` | Insufficient data or k: the experiment did not run enough trials to reach a conclusion |

**Who sets it**: The experiment runner — either `experiments/skill-quality/lib/runner.ts` (TASK-141-B) writing the marker automatically after producing the results JSON, or a human experimenter setting it manually after reviewing results.

**When**: After the experiment artifact JSON is written and the results have been reviewed. The marker is the terminal signal that the experiment task is complete; it should not be written speculatively.

**Example**:
```
cap:experiment=CONFIRMED
```

**Sync note**: If the allowed-value set changes (e.g., adding `PARTIAL`), update **both** `scripts/verify-cap-markers.sh` (the `EXPERIMENT_VALUES` set in the Python snippet) **and** this document together. The two are the canonical source of truth for the enum.

---

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
status: Backlog                                        # ← 调度轴（5 个状态之一）
capabilities: [propose, plan, decompose, evaluate]    # ← 新增，声明拥有的能力
parent_task_id: null
---
```

`status` 只编码**调度轴**（见下节）；`capabilities` 决定处理器路由，与 `status` 正交：一个处于 `In Progress` 的任务可以是 epic（有 `decompose`），也可以是 leaf（有 `execute`）。

### Done-marker 写入 notes

能力处理器完成后，在任务 notes 写入标记：

```
cap:propose=approved
cap:plan=approved
cap:decompose=converged
cap:evaluate=Met
```

这些标记**可 grep、可追溯、向后兼容**。`check-roi-gate.sh` 只需把 `status: Meta-Done` 改为 `cap:evaluate=Met` 即可。

## 状态栏重设计

### 两轴问题

当前状态栏同时编码了两个独立轴：

- **调度轴**（任务是否可被 worker 拾取）：Backlog → Ready → In Progress → Done / Needs Human
- **能力进度轴**（任务处于哪个能力阶段）：Proposal → Plan → …（Meta-* 系列同理）

把两轴压入同一字段导致矛盾：状态 `Proposal` 既意味着"等待 propose 处理器"（能力轴），又暗示"不应被 worker 执行"（调度轴）。这与"capabilities 与 status 正交"的设计目标直接冲突。

### 缩减后的调度状态（5 个）

| 状态 | 含义 |
|------|------|
| `Backlog` | 已进入队列，等待调度 |
| `Ready` | WIP 调度器已提升，等待 worker 拾取 |
| `In Progress` | Worker 正在处理（任何能力阶段） |
| `Done` | 所有声明能力的 done-marker 均已写入 |
| `Needs Human` | 需要人工介入（escalation） |

**消除的 6 个状态**：`Proposal`、`Plan`、`Meta-Proposal`、`Meta-Plan`、`Meta-Active`、`Meta-Done`

能力进度改由 `cap:*` 标记追踪；"任务现在在哪个能力阶段"从 notes 读取，而不从 `status` 推断。

### propose / plan 是运行时能力（纳入 backlog 管理，但不占 column）

`propose` 和 `plan` 必须作为**运行时能力**由 dispatcher 管理，而非在 skill 内创建前跑完。理由：

- 有些任务需要**人工多轮 propose / plan**。若在任务持久化前就跑完 review，backlog 里此时还没有这个任务——没有载体记录每轮 review 的 notes，无法 park、无法在 web UI 查看、无法中断后恢复。
- 把 propose/plan 留在运行时，任务**从创建起就在 backlog 内**，整个起草—审查—修订过程都被纳入管理。

关键洞察：**纳入 backlog 管理 ≠ 需要专属状态 column**。propose/plan 阶段复用已有的调度轴状态：

| 阶段 | 调度状态（`status`） | 能力进度（notes） |
|------|---------------------|------------------|
| 正在起草 / 自动 review | `In Progress` | — |
| **等待人工 review（多轮门控）** | `Needs Human` | `reviewLoop: iteration N/M` |
| 人工反馈后继续 | `Ready` → `In Progress` | 累积 review notes |
| 批准 | 推进下一能力 | `cap:propose=approved` / `cap:plan=approved` |

任务一直在库里、每轮 review 是一条 note、`Needs Human` 是可见的等待态、`cap:*` 标记记录进度。多轮人工 propose/plan 因此**完整落在 backlog.md 系统内**，却不需要 `Proposal` / `Plan` 两个 column。

skill 的职责退化为**播种草稿**：写入初始 proposal/plan facet 内容 + 声明 `capabilities`，状态置 `Backlog`，**不写 `cap:*=approved` 标记**（审查由 dispatcher 在运行时执行）。

> 注：单一 dispatcher 独占任务生命周期，skill 只播种、不并发执行 reviewLoop，因此把 propose/plan 放回运行时**不会复发** TASK-105 的竞争 bug——那个 bug 是"两 daemon + skill 同时写"的产物，与 propose/plan 在何处执行无关。

### `Needs Human` 的双重语义

缩减后 `Needs Human` 同时承载两类停顿：正常 **review 门控**（propose/plan 等待人工批准）与异常 **escalation**（noProgress / diverging / infeasible）。两者在调度轴上一致（worker 停下、等人介入），语义区别写在 note 前缀里（`reviewLoop:` vs `Escalated:`），由下方看板派生视图分组区分。

### 看板视图

原来的"Proposal / Plan"列变为**派生视图**：从 `In Progress` 任务的 `cap:*` 标记推断当前活跃能力，生成分组展示，不影响 `status` 字段本身。例如：

```
[In Progress | cap:decompose 活跃]  ← 视图过滤，status 仍是 In Progress
[In Progress | cap:evaluate 活跃]
```

### 迁移难点

状态枚举变更需要修改 `backlog.md` 的全局 `status-lane` 配置。这是本次迁移最硬的一步：所有现有任务的 Meta-* 状态必须在变更前完成清理或批量 sed 转换，否则 backlog CLI 会拒绝未知状态值。迁移步骤见"迁移路径"阶段 1B。

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

所有 skill 一律以 `Backlog` 状态播种任务（不再有 Proposal/Plan 初始状态）；dispatcher 按 `capabilities` 顺序路由 propose → plan → …。

| Skill | capabilities 产出 | 初始状态 | 处理器路径 |
|-------|-----------------|---------|-----------|
| `task-to-backlog` | `[plan, execute]` | Backlog | plan → execute → evaluate（可选） |
| `feature-to-backlog` | `[propose, plan, execute]` | Backlog | propose → plan → execute → evaluate（可选） |
| `epic-to-backlog`（new） | `[propose, plan, decompose, evaluate]` | Backlog | propose → plan → decompose ⟲ evaluate |

`meta-task-to-backlog`（本次新建）**直接改名/收敛为 `epic-to-backlog`**：
1. 写入 `capabilities: [propose, plan, decompose, evaluate]` frontmatter
2. 播种初始 proposal/plan 草稿到 facet，最终状态设 `Backlog`（不再需要 `Meta-Plan`）
3. **不写 `cap:propose=approved` / `cap:plan=approved`**——审查门控由 dispatcher 在运行时执行（见"propose / plan 是运行时能力"节）。需要人工多轮审查的任务在此阶段停在 `Needs Human`，直到批准后才写入 approved 标记。

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
| 状态数 | 4 自定义（Meta-\*）+ 6 标准 = 10 | 5（缩减，去掉 Proposal/Plan/Meta-\*） |
| Daemon 数 | 2（loop-backlog + loop-meta） | 1 |
| 事件类型 | task-ready + meta-ready | task-ready（1 种） |
| 新增任务形态 | +1 skill + 自定义状态 | 注册表 +1 行 |
| ReviewLoop 实现 | 3 份平行代码 | 1 份（spec-stdlib） |
| replan 环 | 保留 | 保留（不变） |
| evaluate 门控 grep | `status: Meta-Done` | `cap:evaluate=Met` |
| 竞争 bug 根因 | 两 daemon 共享 backlog | 消除（单 daemon） |

---

## 迁移路径

### 阶段 1A：基础设施（不动现有任务）

1. **spec-stdlib 扩展**：把 reviewLoop 从 task-to-backlog / feature-to-backlog / meta-task-to-backlog 提取为 `spec-stdlib § reviewLoop`（通用，参数化 review 标准）。
2. **Dispatcher 实现**：在 loop-backlog（或新统一 loop）中加入 `capabilities` 读取 + 注册表路由逻辑。兼容旧任务（无 `capabilities` 字段 → 走原有 execute 路径）。
3. **check-roi-gate.sh**：把 `status: Meta-Done` + `evaluator:` 改为 `cap:evaluate=Met`。

### 阶段 1B：状态枚举缩减（最硬的迁移步骤）

4. **清理现有 Meta-\* 任务**：将所有 `Meta-Proposal` / `Meta-Plan` / `Meta-Active` / `Meta-Done` 状态的任务批量转换（sed）为 `Backlog` / `In Progress` / `Done`，并写入对应 `cap:*` 标记：
   - `Meta-Plan` → `Backlog` + `cap:propose=approved` + `cap:plan=approved`
   - `Meta-Active` → `In Progress` + `cap:propose=approved` + `cap:plan=approved`
   - `Meta-Done` → `Done` + `cap:propose=approved` + `cap:plan=approved` + `cap:decompose=converged`
5. **修改 `backlog.md` 全局配置**：从 `status-lane` 枚举中删除 `Proposal`、`Plan`、`Meta-Proposal`、`Meta-Plan`、`Meta-Active`、`Meta-Done`，仅保留 `Backlog / Ready / In Progress / Done / Needs Human`。
6. 步骤 4 必须在步骤 5 之前完成——顺序错误会导致 backlog CLI 拒绝已有任务的状态值。

### 阶段 2：新 skill

7. `epic-to-backlog` skill（从 `meta-task-to-backlog` 改名，写入 `capabilities` frontmatter，终态改 Backlog，并在结束时写入 `cap:propose=approved` + `cap:plan=approved`）。
8. 更新 `task-to-backlog` / `feature-to-backlog` 写入对应 `capabilities` 字段（向后兼容：旧任务无此字段不影响执行）。

### 阶段 3：现有 Meta-Plan 任务迁移（TASK-106–117）

9. 已由阶段 1B 步骤 4 覆盖。确认 12 个任务均已转换为 `status: Backlog` + `capabilities: [propose, plan, decompose, evaluate]` + `cap:propose=approved` + `cap:plan=approved`。
10. 删除 loop-meta 独立 session；停止发布 `meta-ready` 事件。

### 阶段 4：验证

11. 跑 Exp-K（loop-backlog + dispatcher 路由 12 个 epic → draftDecomposition → 子任务 → evaluate），采集 replan 频率 baseline。
12. `check-roi-gate.sh` 用新 grep 模式确认 P3→P4 门控可用。

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

- 状态栏缩减为 5 个（Backlog / Ready / In Progress / Done / Needs Human）；6 个旧状态（Proposal/Plan/Meta-*）在阶段 1B 迁移后删除
- 不引入第三方 schema 库；能力注册表是纯 bash/JS 字典
- `capabilities` 字段一旦写入不再运行时修改（只读声明）；能力进度通过 notes 标记追踪
- 本文档是 B 档方案（预注册 5 个能力，DAG 写死）；C 档（能力依赖可声明、schema 化）留作未来演进

---

## 下一步

1. **确认 backlog frontmatter 对 `capabilities` 数组的支持**（10 分钟验证实验）
2. **spec-stdlib reviewLoop 提取**（修改 3 个 SKILL.md）
3. **Dispatcher 路由逻辑实现**（修改 loop-backlog-daemon.js 或新统一 loop 脚本）
4. 依次执行阶段 1–4
