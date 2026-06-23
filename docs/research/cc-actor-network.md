# Claude Code Actor 网络：用 monitor 机制模拟组织结构

**日期**：2026-06-23
**背景**：loop-backlog 的 monitor 机制已能用外部信号驱动 Claude Code，使其成为一个 actor 运行时原语；本文讨论将其推向多节点网络以模拟组织结构
**依赖**：plugin/skills/loop-backlog/SKILL.md, plugin/scripts/basic-daemon.js
**关联**：docs/research/judgment-ux.md（同一根轴的相反方向）, docs/research/gcl-complete-observation-mechanism.md（H6/H7）

---

## 1. 我们已经踩上门槛：monitor 就是 actor 运行时

loop-backlog 现有机制——unified daemon 发射事件 → Monitor tail → Claude Code 响应——**本身就是一个单节点 actor 运行时**。它已经具备 actor 模型的全部要件：

| Actor 要件 | loop-backlog 现有实现 |
|-----------|----------------------|
| 消息收发 | basic-daemon.js 发射 `basic-ready` / `epic-ready` / `child-done` / `*-approved` 事件；Monitor `tail -c +OFFSET -f` 消费 |
| 状态隔离 | worktree per task |
| 并发控制 | maxParallel + 串行 merge |
| 互斥 | merge-lock（PID 文件，跨 /clear 存活） |
| 故障恢复 | checkpoint offset（TASK-170，重启不丢信号）+ reaper（超时 requeue） |

把它推向网络只需要一步推广：**一个 actor 能 emit 的信号，被另一个 actor 的 Monitor 消费**。组织拓扑 = "谁 monitor 谁、谁能给谁发信号"的配置。

---

## 2. 拓扑谱系

| 拓扑 | 结构 | loop-backlog 现状 |
|------|------|------------------|
| **Dyad（boss-worker）** | 上位 CC 模拟操作者/管理者，下位 CC 执行 | 最小新增步；见 §3 |
| **Team（扁平）** | N worker + 1 coordinator，fan-out/fan-in | 已有退化版（maxParallel agents + 串行 merge） |
| **Hierarchy（树）** | manager of managers | 未实现 |
| **Mesh（网状）** | peer-to-peer，actor 间直接协商 | 未实现 |

---

## 3. Dyad 是最小步，也是最干净的 H7 实验台架

最有价值的第一步是 boss-worker dyad，且它的落点极巧：`epicEvaluate` 现在正是 soft-halt 等人确认 FINISH/ITERATE 的点（loop-backlog SKILL.md）。

**实验设计**：把这**一个** gate 换成一个 boss CC——它 monitor `child-done`，带着**独立证据**（archguard change-risk + meta-cc trace + DoD 重跑）做 FINISH/ITERATE 决定。

**测量**：在控制 evidence_independence 的前提下，LLM-boss gate 的 escape rate 是否等于人类 gate 的 escape rate？

这正是 **H7 的可证伪规则**（gcl-complete §5）：

> 在控制 evidence_independence 的情况下，human vs automated gate actor 对 escape rate 无显著差异（routine gate 子集）。

人类 boss 的对照样本极难批量获得，但 LLM-boss gate 样本可以批量产出。**actor-network 因此是 GCL 框架若干假设的实验装置**，而不是一个并列的独立课题。它复用了已有的 soft-halt 结构，几乎不需要新机制——只需在 `epicEvaluate` 的人类确认点旁边接一个 boss CC 通道，并把两者的 `gate_actor_type` 都记进 gcl-events.jsonl（TASK-176 176a 已为此预留字段）。

---

## 4. 三条必须先写下的告诫

网络化若不先处理这三点，会很快走坏：

### 4.1 克隆耦合 = H6 在网络层失效

一张全是同一个模型的 CC 网络，evidence source 高度耦合，整网有**相关的盲点**。框架预测（H6）：同质 CC 网络的 evidence independence 低，因此监督质量差，**无论叠多少层**。

> 加层级 ≠ 加监督，只是加了相关的橡皮图章。

真正的组织鲁棒性来自多样性：不同模型、不同证据通道、不同 prompt 视角。一个"boss 和 worker 是同一个模型 + 共享同一份 context"的 dyad，在 H6 意义下监督质量接近于零——boss 只是 worker 的回声。**dyad 实验必须让 boss 持有 worker 没有的独立证据**（archguard / meta-cc / DoD 重跑），否则测的不是 H7 而是自我一致性。

### 4.2 问责真空（C 变量）

三变量拆解（gcl-complete §4.2）中的 C（accountability）说：当前制度下 LLM 不能独立成为责任主体。纯 CC 网络没有 C 节点。

- 做**模拟**：可以，没有 C 节点不影响研究。
- 做**生产治理**：必须在某处锚一个人类 C 节点。一个无人 C 锚的自治 CC 组织，在出问题时没有可追责主体——这是制度问题，不是技术问题。

### 4.3 失控与背压

自治 actor 互相发信号会出现放大、反馈环、信号丢失：

- **反馈环 / 放大**：A 的输出触发 B，B 的输出又触发 A，token 花费失控。
- **死锁**：A 等 B、B 等 A。
- **thundering herd**：一个事件唤醒过多 actor。
- **信号丢失**：重启后丢事件——TASK-170 的 checkpoint/offset 正是这一类问题的初级解。

网络化前需要：预算上限、熔断、背压。reaper（超时 requeue）和 merge-lock（串行化）是它们的雏形，但只覆盖单节点；网络层需要更强的 supervisor 语义。

---

## 5. 与 judgment-ux 方向的关系

本文是 evidence-independence 轴的"非人 actor"方向：当 actor 不必是人时，怎样把多个非人 actor 组织起来并保证证据不坍缩成同一个源。

相反方向是 docs/research/judgment-ux.md：当人确实需要介入时，怎样把独立证据最高质量地递给人。

两者的连接点：actor-network 的 dyad 实验（§3）直接产出 judgment-ux 所依赖假设（"LLM-judge + 独立证据是否真比人强"）的对照数据。如果 H7 在 dyad 实验中成立，judgment-ux 的"选择性打断"就有了实证依据——大量 routine gate 可以安全地交给 LLM-boss，人只保留 A/B/C 三类 gate。

---

## 6. 落地次序建议

1. **先做 dyad + H7 实验**（最小步、最高信息量）：在 `epicEvaluate` 旁接一个持有独立证据的 boss CC，双 `gate_actor_type` 记入 gcl-events.jsonl，依赖 TASK-176 的 schema。
2. **再补 supervisor 语义**（§4.3）：预算、熔断、背压，作为网络化的安全前置。
3. **最后才扩 team / hierarchy / mesh**：在 H6 的多样性约束下设计（异构模型 + 异构证据通道），否则只是叠加相关橡皮图章。
