# Proposal: 统一板双状态机模型（B″ 档）

**状态**: Proposal
**日期**: 2026-06-21
**关联**: TASK-93（Exp-K）、loop-meta-architecture.md
**取代**: `proposal-epic-capability-model.md`（B 档）
**演进自**: B′ 档（原拆板模型，已被本文替代）

---

## 设计思路

### B 档的问题

B 档在单板上把 `status` 压缩为纯调度轴（5 态），把 capability 进度塞进 label/notes，再靠派生视图重算 `firstUnsatisfied`——等于在视图层复制了一遍 dispatcher 逻辑，且两者必然漂移。

### B′ 档的代价

B′ 为每类任务各设一块 backlog 板，根因问题消失，但引入了双 MCP 实例、跨板引用、双端口 web UI，并把 `parentTaskId` 这个原生字段变成了需要额外校验的跨板链接。

### B″ 的解法

B″ 保留 B′ 的核心洞察——**每类任务只有一根自然轴，让它直接成为列轴**——但不拆物理板：

> **一块板、一个 `config.yml`、14 列 = 两个不相交的列子集 + `kind` 标签判别。**

每类任务的状态机完全闭合在自己的列子集内，没有任何转移跨越分区，独立性是**构造性**保证的，不靠运行时约束。`parentTaskId` 仍是原生字段，跨板引用问题不复存在。

---

## 列清单（一块板，14 列，零共享）

| 列名 | kind:epic | kind:basic | 语义 |
|---|:---:|:---:|---|
| Epic: Proposal | ✓ | | epic 起草 + 审核 proposal |
| Epic: Plan | ✓ | | epic 起草 + 审核 plan |
| Epic: Decomposing | ✓ | | epic 分解 / 三路 reconcile 子任务 |
| Epic: Awaiting Children | ✓ | | epic 等所有子任务到达 Basic: Done |
| Epic: Evaluating | ✓ | | epic 跑验收（evaluator）|
| Epic: Done | ✓ | | 终态 |
| Epic: Needs Human | ✓ | | review 门控 或 escalation |
| Basic: Proposal | | ✓ | basic 起草 + 审核 proposal |
| Basic: Plan | | ✓ | basic 起草 + 审核 plan |
| Basic: Backlog | | ✓ | 计划批准，进调度队列 |
| Basic: Ready | | ✓ | WIP 调度器已提升，等 worker 拾取 |
| Basic: In Progress | | ✓ | worker 执行中 |
| Basic: Done | | ✓ | 终态（若有 epic 父 → 触发唤醒事件）|
| Basic: Needs Human | | ✓ | 阻塞 / escalation |

```yaml
# config.yml
statuses:
  - "Epic: Proposal"
  - "Epic: Plan"
  - "Epic: Decomposing"
  - "Epic: Awaiting Children"
  - "Epic: Evaluating"
  - "Epic: Done"
  - "Epic: Needs Human"
  - "Basic: Proposal"
  - "Basic: Plan"
  - "Basic: Backlog"
  - "Basic: Ready"
  - "Basic: In Progress"
  - "Basic: Done"
  - "Basic: Needs Human"
```

---

## 状态机 A：epic（kind:epic）

| From | To | 触发 / 条件 | 谁动作 | 写入 |
|---|---|---|---|---|
| *(创建)* | Epic: Proposal | epic-to-backlog skill 播种 | skill | `kind:epic` label |
| Epic: Proposal | Epic: Plan | propose 自动审通过 | dispatcher | `cap:propose=approved` |
| Epic: Proposal | Epic: Needs Human | 需人审 | dispatcher | note `review: iter N`，note `return-to: Epic: Proposal` |
| Epic: Plan | Epic: Decomposing | plan 自动审通过 | dispatcher | `cap:plan=approved` |
| Epic: Plan | Epic: Needs Human | 需人审 | dispatcher | note `review: iter N`，note `return-to: Epic: Plan` |
| Epic: Decomposing | Epic: Awaiting Children | gap 空（converged）| dispatcher | `cap:decompose=converged` |
| Epic: Decomposing | Epic: Needs Human | diverging（gap 不收敛）| dispatcher | note `escalation: diverging`，note `return-to: Epic: Decomposing` |
| Epic: Awaiting Children | Epic: Evaluating | 所有子任务达到 Basic: Done | dispatcher（被唤醒）| — |
| Epic: Awaiting Children | Epic: Decomposing | 子任务上报缺口（中途 replan）| dispatcher | 清 `cap:decompose` |
| Epic: Evaluating | Epic: Done | 验收 Met | dispatcher | `cap:evaluate=Met` |
| Epic: Evaluating | Epic: Decomposing | 验收 NotMet → replan | dispatcher | 清 `cap:decompose`，note `replan: <root-cause>` |
| Epic: Evaluating | Epic: Needs Human | infeasible / budget 耗尽 | dispatcher | note `escalation: infeasible`，note `return-to: Epic: Evaluating` |
| Epic: Needs Human | *(return-to 列)* | 人翻状态 | 人 | 视情写 `cap:*=approved` 或清标记 |
| Epic: Done | — | 终态 | — | — |

**人工干预恢复场景**：

| 场景 | return-to | 人的动作 | dispatcher 恢复动作 |
|---|---|---|---|
| propose/plan 要批准 | Epic: Proposal / Epic: Plan | note `review: APPROVED` + 翻回 return-to | 写 `cap:*=approved`，推进下一列 |
| propose/plan 要修改 | 同上 | 编辑正文 + note `review: CHANGES: …` + 翻回 | 重起草纳入反馈，iter+1 |
| decompose diverging | Epic: Decomposing | 收紧 plan subjects + 翻回 | 清 `cap:plan` → 重审 plan → 重 decompose |
| evaluate infeasible | Epic: Evaluating | 改 Acceptance Criteria / 砍范围 + 翻回 | 清下游 marker，重入 |
| 人决定放弃 | — | 打 `outcome:cancelled`，archive epic（含子树逐级退役）| 终结 |

---

## 状态机 B：basic（kind:basic）

| From | To | 触发 / 条件 | 谁动作 | 写入 |
|---|---|---|---|---|
| *(创建)* | Basic: Proposal | task/feature-to-backlog skill 播种，**或 epic 在 Decomposing 时创建** | skill / dispatcher | `kind:basic` label；若来自 epic 则写 `parentTaskId` |
| Basic: Proposal | Basic: Plan | propose 自动审通过 | dispatcher | `cap:propose=approved` |
| Basic: Proposal | Basic: Needs Human | 需人审 | dispatcher | note `review: iter N`，note `return-to: Basic: Proposal` |
| Basic: Plan | Basic: Backlog | plan 自动审通过 | dispatcher | `cap:plan=approved` |
| Basic: Plan | Basic: Needs Human | 需人审 | dispatcher | note `review: iter N`，note `return-to: Basic: Plan` |
| Basic: Backlog | Basic: Ready | WIP 调度器提升 | dispatcher | — |
| Basic: Ready | Basic: In Progress | worker 拾取 | dispatcher | — |
| Basic: In Progress | Basic: Done | 执行成功（DoD 通过）| dispatcher | `cap:execute=done` |
| Basic: In Progress | Basic: Needs Human | 阻塞 / escalation | dispatcher | note `escalation: …`，note `return-to: Basic: In Progress` |
| Basic: Needs Human | *(return-to 列)* | 人翻状态 | 人 | — |
| Basic: Done | — | 终态；若有 `parentTaskId` → 触发唤醒事件 | dispatcher | — |

**人工干预恢复场景**：

| 场景 | return-to | 人的动作 | dispatcher 恢复动作 |
|---|---|---|---|
| propose/plan 批准 | Basic: Proposal / Basic: Plan | note `review: APPROVED` + 翻回 | 写 `cap:*=approved`，推进 |
| propose/plan 要改 | 同上 | 编辑正文 + note `review: CHANGES: …` + 翻回 | 重起草，iter+1 |
| 执行阻塞 | Basic: In Progress | 解决阻塞 + 翻回 | 重拾取继续执行 |
| 人决定放弃 | — | 打 `outcome:cancelled`，archive | 终结 |

---

## 颗粒度（Epic vs Basic）

选错泳道的根因是低估了 Basic Task 的容量。判据如下：

**Basic Task** —— 一个**单一 worker 能在一个隔离 worktree 内连续完成**的工作单元，由自洽的 shell-gate DoD 验收。它**不小**：
- Implementation Plan 可含 **Phase + Stage 两层**结构（Phase A/B/C，每个 Phase 内再分 Stage / Tests / Implementation / DoD）。
- 单个 Basic Task 的代码变更可达**上千行**。已完成样例：TASK-16（为 16 个 skill 建立规格覆盖，计划正文 ~430 行，Phase A/B/C）、TASK-25/20/38 均 ≥370 行计划。
- "几处相关的小修"（例如对同一个 skill 的 3 处 bug 修复）是**一个 Basic Task 的多个 Phase**，不是一个 epic。

**Epic** —— 仅当目标需要**≥2 个独立的 Basic Task**、子任务间有顺序/依赖、且需要分解 + 统一验收时才用 epic lane。Epic 本身**不含实现代码**，只产出 proposal/plan + 子任务分解（每个子任务本身就是一个上述容量的 Basic Task）。

**反模式**：
- ❌ 把"几处相关小修"当 epic（→ 应为单个 Basic Task 的多 Phase）。
- ❌ 把"需要多个独立交付物的大目标"塞进单个 Basic Task（→ 应升为 epic，拆成多个 Basic Task）。

---

## 跨 kind 的边（事件，不穿越列分区）

| 边 | 方向 | 时机 | 效果 |
|---|---|---|---|
| 创建子任务 | epic → basic | epic 处于 Epic: Decomposing | `task_create`（kind:basic，parentTaskId=<epicId>），落在 **Basic: Proposal**——子任务走完整 basic 流水线 |
| 子任务完成唤醒 | basic → epic | basic 进 Basic: Done 且有 parentTaskId | dispatcher 查 `parentTaskId` → 重新 dispatch epic 父任务，检查 Epic: Awaiting Children 是否可推进 |

两条边均只**创建新行 / 读已有行**，不修改对方分区内既有行的 `status`——列分区不被穿越，两台状态机各自闭合。

---

## Dispatcher 设计（单 daemon，kind 路由）

单板 + 单写者 = 单 daemon，内部按 `kind` 分流，彻底消除 TASK-105 竞态的结构性根因：

```haskell
-- 单一事件入口
dispatch :: TaskId → ()
dispatch(id) = {
  kind : readLabel(id, "kind"),
  case kind of
    "epic"  → dispatchEpic(id)
    "basic" → dispatchBasic(id)
    _       → log("unknown kind, skip")
}

-- Epic dispatcher：按 cap marker DAG 路由
dispatchEpic :: TaskId → ()
dispatchEpic(id) = {
  markers : readCapMarkers(id),
  next    : firstUnsatisfied(markers, epicDAG),  -- propose→plan→decompose→evaluate
  case next of
    Nothing  → setStatus(id, "Epic: Done")
    Just cap → { setStatus(id, epicColumnOf(cap)); epicRegistry[cap](id) }
}

-- Basic dispatcher：按 cap marker DAG 路由
dispatchBasic :: TaskId → ()
dispatchBasic(id) = {
  markers : readCapMarkers(id),
  next    : firstUnsatisfied(markers, basicDAG),  -- propose→plan→execute
  case next of
    Nothing  → setStatus(id, "Basic: Done"); notifyParentIfAny(id)
    Just cap → { setStatus(id, basicColumnOf(cap)); basicRegistry[cap](id) }
}

-- 列映射
epicColumnOf  : propose→"Epic: Proposal", plan→"Epic: Plan",
                decompose→"Epic: Decomposing",
                evaluate→"Epic: Evaluating"   -- evaluateProcessor 自己判断是否先置 Awaiting Children
basicColumnOf : propose→"Basic: Proposal", plan→"Basic: Plan",
                execute→"Basic: Backlog"       -- 调度器内部再走 Backlog→Ready→In Progress

-- 父任务唤醒（cross-kind 通知）
notifyParentIfAny(id) = {
  epicId : readField(id, "parentTaskId"),
  if epicId ≠ null: emit("task-ready:" + epicId)   -- 复用同一事件类型，dispatcher 重新 dispatch epic
}

-- diverging 判定：同一 epic 在连续 N 轮 decomposeProcessor 运行后 gap 仍不为空
diverging(id) = reconcileRunCount(id) ≥ DIVERGE_THRESHOLD   -- 默认 DIVERGE_THRESHOLD = 3

-- 事件循环
workerLoop = {
  daemonBootstrap(); catchUpScan()
  Monitor(tail .daemon.log):
    | "task-ready:TASK-N" → dispatch(TASK-N)
    | stopSentinel        → return Stopped
}
```

**`epicColumnOf(evaluate)` 的执行流程**：dispatcher 先置 `Epic: Evaluating` 再调 evaluateProcessor；若处理器发现子任务未全完，处理器**覆盖**置 `Epic: Awaiting Children` 后 return（让出 worker）。子任务 Done 触发 `task-ready:<epicId>`，dispatcher 再次路由到 evaluate，处理器重新检查，全完则继续跑验收。这意味着 `Epic: Evaluating` 只在子任务已全完时稳定停留；`Epic: Awaiting Children` 是处理器内部的"让位"跳转，不经过 `epicColumnOf` 映射。

---

## 处理器规格

### proposeProcessor / planProcessor（epic 与 basic 共用同一实现）

```haskell
proposeProcessor(id, kind) = {
  if marker(id, "cap:propose") == "approved": return,  -- 幂等
  draft : proposalAgent(id),
  reviewLoop(id, draft, "propose", maxIter=4, needsHumanCol=kind+": Needs Human",
             returnTo=kind+": Proposal")
  -- reviewLoop 在批准时写 cap:propose=approved 并 return
}
```

两类任务的 propose/plan 处理器共用 **spec-stdlib 中同一 reviewLoop 实现**，通过参数传入 `needsHumanCol` 和 `returnTo` 区分列名。批准令牌：note `review: APPROVED`（与 `review: CHANGES: …` 显式区分）。

### decomposeProcessor（仅 epic）——三路 reconcile

```haskell
decomposeProcessor(id) = {
  desired : decomposerAgent(id, readPlan(id)),
  actual  : listChildren(id),          -- 原生 parentTaskId 查询，同板
  ADD     = desired \ actual,          -- task_create，落在 Basic: Proposal
  KEEP    = desired ∩ actual,          -- 不动
  RETIRE  = actual \ desired,          -- 按当前 status 分级退役（见下）

  if empty(ADD) ∧ empty(RETIRE):
    writeMarker(id, "cap:decompose=converged")
    setStatus(id, "Epic: Awaiting Children")
    return

  if diverging(id): escalate(id, "Epic: Needs Human"); return

  for t in ADD: task_create(title=t, kind="basic", parentTaskId=id,
                             status="Basic: Proposal")
}
```

**子任务退役分级**（RETIRE 路）：

| 子任务当前列 | 处理 |
|---|---|
| Basic: Proposal / Plan / Backlog / Ready（未开工）| archive |
| Basic: In Progress（执行中）| 置 Basic: Needs Human + note `Cancelled: parent replan`，或打 `outcome:cancelled` 后 archive |
| Basic: Done（已完成）| 保留，打 `outcome:superseded` label |

> `outcome:cancelled` / `outcome:superseded` 是**终态原因**，进 label，不进列——避免状态爆炸。

`decomposeProcessor` 可重入：任何触发源（evaluate=NotMet / 人改 plan / 子任务上报缺口）统一归一为「清 `cap:decompose`（必要时连 `cap:plan`）→ 重发 task-ready → dispatch 回 Epic: Decomposing 重跑 diff，只补缺口」。

### evaluateProcessor（仅 epic）

```haskell
evaluateProcessor(id) = {
  pending : filter(c → status(c) ≠ "Basic: Done", listChildren(id)),
  if ¬empty(pending): setStatus(id, "Epic: Awaiting Children"); return,

  result : evaluator(id),
  if result == Met:
    writeMarker(id, "cap:evaluate=Met"); setStatus(id, "Epic: Done"); return,

  replan : replanner(id, result),
  if replan == Escalated:
    setStatus(id, "Epic: Needs Human")
    appendNote(id, "escalation: infeasible")
    appendNote(id, "return-to: Epic: Evaluating")
    return,

  clearMarker(id, "cap:decompose")
  appendNote(id, "replan: " + replan.rootCause)
  emit("task-ready:" + id)   -- 回 Epic: Decomposing
}
```

### executeProcessor（仅 basic）

```haskell
executeProcessor(id) = {
  -- Backlog→Ready 由 WIP 调度器触发（与现有 loop-backlog 逻辑相同）
  -- Ready→In Progress 由 worker 拾取触发
  -- 以下为 worker 执行体：
  runWorktree(id)                        -- 在 git worktree 内执行任务
  if dodPassed(id):
    writeMarker(id, "cap:execute=done")
    -- dispatchBasic 的 firstUnsatisfied 返回 Nothing → 置 Basic: Done + notifyParentIfAny
  else:
    setStatus(id, "Basic: Needs Human")
    appendNote(id, "escalation: dod-failed")
    appendNote(id, "return-to: Basic: In Progress")
}
```

执行成功后 dispatchBasic 的 `Nothing` 分支置 `Basic: Done` 并调 `notifyParentIfAny`，唤醒 epic 父任务重新 dispatch。

---

## Skills 映射

| Skill | 创建 kind | 初始列 | 不写的 marker |
|---|---|---|---|
| `epic-to-backlog`（由 meta-task-to-backlog 改名）| `kind:epic` | Epic: Proposal | `cap:*`（全部由 dispatcher 在运行时审查写入）|
| `task-to-backlog` | `kind:basic` | Basic: Proposal | 同上 |
| `feature-to-backlog` | `kind:basic` | Basic: Proposal | 同上 |

Skill 职责收敛为**播种草稿**：写 `kind` label、写初始 proposal/plan 正文、设初始列、**不触发 reviewLoop**（dispatcher 在运行时负责）。

---

## 并发护栏

**Epic: Awaiting Children 不占 WIP**：dispatcher 进入该列时不计入 WIP 限额，纯事件等待，不驻留 worker。WIP 计数只算正在被处理器执行的任务（Proposal / Plan / Decomposing / Evaluating / In Progress）。

**并发再入锁**：多个子任务近乎同时到达 Basic: Done 会触发多次唤醒事件。dispatcher 对 epic 任务加行锁（`backlog/.locks/`），evaluateProcessor / decomposeProcessor 幂等（重算 diff / 重读 children，幂等天然成立，marker 写入在锁内）。

---

## 与 B 档、B′ 档对比

| 维度 | B 档 | B′ 档（拆板）| **B″ 档（本方案）** |
|---|---|---|---|
| 物理板数 | 1 | 2 | **1** |
| 列数 | 5 | 7 + 5 = 12（跨两板）| **14（单板，分区）** |
| Daemon 数 | 1（目标）| 2 | **1** |
| 状态机独立 | ✗ 积状态冲突 | ✓ 结构性（分文件）| **✓ 构造性（列不相交）** |
| parentTaskId | 同板原生 | 跨板，需校验脚本 | **同板原生** |
| MCP 实例 | 1 | 2 | **1** |
| Web UI 端口 | 1 | 2 | **1** |
| epic 阶段可见性 | label 派生视图 | epic 板 column | **Epic: * 列** |
| basic propose/plan | 无（执行前 skill 内完成）| 同左 | **纳入 dispatcher 运行时** |
| reviewLoop 实现数 | 3（并行代码）| 1（spec-stdlib）| **1（spec-stdlib，同）** |
| TASK-105 竞态 | 单 daemon 消除 | 单写者/板消除 | **单 daemon 结构性消除** |

---

## 迁移路径

### 阶段 0：扩展 config.yml

1. 将 `config.yml` 的 `statuses` 替换为 14 列（见上文 yaml）。
2. 验证 MCP 及 CLI 接受新 status 值。

### 阶段 1：基础设施

3. **spec-stdlib reviewLoop 提取**：从 task-to-backlog / feature-to-backlog / meta-task-to-backlog 中提取共用 reviewLoop，参数化 `needsHumanCol` / `returnTo` / `reviewCriteria`。
4. **Dispatcher 实现**：单 daemon，`dispatch(id)` 读 `kind` label 后分流 `dispatchEpic` / `dispatchBasic`，注册表 + `firstUnsatisfied`。
5. **向后兼容**：无 `kind` label 的旧任务走旧 execute 路径（不中断现有 loop-backlog）。

### 阶段 2：现有 Meta-* 任务迁移

6. 批量为现有 Meta-* 任务写 `kind:epic` label。
7. 状态映射（sed + marker 补写）：
   - `Meta-Proposal` → `Epic: Proposal`
   - `Meta-Plan` → `Epic: Plan` + `cap:propose=approved`（视情况）
   - `Meta-Active` → `Epic: Decomposing` 或 `Epic: Awaiting Children` + `cap:propose=approved` + `cap:plan=approved`
   - `Meta-Done` → `Epic: Done` + 全部 `cap:*` marker
8. 旧 `Proposal / Plan / Meta-*` 从 `statuses` 删除（步骤 7 必须先完成）。

### 阶段 3：Skills 更新

9. `epic-to-backlog`（meta-task-to-backlog 改名）：写 `kind:epic`，初始列 `Epic: Proposal`。
10. `task-to-backlog` / `feature-to-backlog`：写 `kind:basic`，初始列 `Basic: Proposal`。

### 阶段 4：验证

11. 跑 Exp-K：dispatcher 路由 12 个 epic → decompose → 子任务（在 `Basic: Proposal` 起跑）→ evaluate，采集 replan 频率 baseline。
12. `check-roi-gate.sh`：P3→P4 门控 grep 由 `status: Meta-Done` 改为 `cap:evaluate=Met`。

---

## 风险与护栏

| 风险 | 对策 |
|---|---|
| 14 列看板过宽，视觉杂乱 | Web UI 按 `kind` label 过滤出 7 列视图；CLI `task list --label kind:epic` 分类查看 |
| kind 约束靠约定（不靠物理隔离）| `scripts/verify-kind-status.sh`：断言每个任务 `status ∈ allowedColumns(kind)`；接入 pre-commit |
| 子任务退役竞态（epic 改 plan 时子任务仍执行中）| 退役分级已处理（In Progress → Needs Human + note，不静默删）|
| 父任务并发再入 | 行锁（`backlog/.locks/`）+ 处理器幂等 |
| reviewLoop 批准令牌歧义 | 约定 `review: APPROVED` 与 `review: CHANGES: …` 显式区分；lint 检查 |
| 旧任务（无 kind label）混跑 | dispatcher 遇无 kind 走旧 execute 路径（向后兼容默认）|

---

## 约束

- 一块 backlog 板，14 列，两个不相交的列子集，`kind` label 判别。
- 单 daemon，`dispatch` 内部按 kind 路由，无共享可变状态竞争。
- 终态原因（cancelled / superseded）进 label，不进列。
- `cap:*` marker 仍用于幂等、审计与能力扩展（新增能力 = registry +1 行，通常不必加列）。
- 本文取代 `proposal-epic-capability-model.md`（B 档）及本文件的 B′ 版本。

---

## 下一步

1. 实测 web UI 按 `kind` label 过滤能否渲染独立 7 列看板（10 分钟）。
2. 起草 `verify-kind-status.sh` lint 脚本（约束兜底）。
3. spec-stdlib reviewLoop 提取（修改 3 个 SKILL.md）。
4. Dispatcher 实现（修改 loop-backlog-daemon.js）。
5. 依次执行阶段 0–4。
