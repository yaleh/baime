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

## 4. 三条告诫与它们的适用边界

三条告诫不是说 actor-network 在软件开发中很难落地——它们是在说**不要把组织模拟误认为生产治理**。很多软件开发项目天然具备较好的"接地"条件，可以局部化这些风险而不是一开始就要求解决完整的"自治组织"制度问题。§4.4 展开。

### 4.1 克隆耦合 = H6 在网络层失效

一张全是同一个模型的 CC 网络，evidence source 高度耦合，整网有**相关的盲点**。框架预测（H6）：同质 CC 网络的 evidence independence 低，因此监督质量差，**无论叠多少层**。

> 加层级 ≠ 加监督，只是加了相关的橡皮图章。

真正的组织鲁棒性来自多样性：不同模型、不同证据通道、不同 prompt 视角。一个"boss 和 worker 是同一个模型 + 共享同一份 context"的 dyad，在 H6 意义下监督质量接近于零——boss 只是 worker 的回声。**dyad 实验必须让 boss 持有 worker 没有的独立证据**（archguard / meta-cc / DoD 重跑），否则测的不是 H7 而是自我一致性。

### 4.2 问责真空（C 变量）

三变量拆解（gcl-complete §4.2）中的 C（accountability）说：当前制度下 LLM 不能独立成为责任主体。纯 CC 网络没有 C 节点。

- 做**模拟**：可以，没有 C 节点不影响研究。
- 做**生产治理**：必须在某处锚一个人类 C 节点。一个无人 C 锚的自治 CC 组织，在出问题时没有可追责主体——这是制度问题，不是技术问题。

人类 C 节点不必介入每个 routine gate，但必须锚定最终责任、预算边界和例外升级。实践上这意味着：产品负责人 / tech lead / repo owner 始终保持 C 位，actor-network 负责在 C 位的边界内扩大吞吐。

### 4.3 失控与背压

自治 actor 互相发信号会出现放大、反馈环、信号丢失：

- **反馈环 / 放大**：A 的输出触发 B，B 的输出又触发 A，token 花费失控。
- **死锁**：A 等 B、B 等 A。
- **thundering herd**：一个事件唤醒过多 actor。
- **信号丢失**：重启后丢事件——TASK-170 的 checkpoint/offset 正是这一类问题的初级解。

网络化前需要：预算上限、熔断、背压。reaper（超时 requeue）和 merge-lock（串行化）是它们的雏形，但只覆盖单节点；网络层需要更强的 supervisor 语义。

### 4.4 接地：三类锚点把风险局部化

软件开发场景天然具备三类外部观测锚点，使 H6/H7 的要求变得工程可达，而不是组织理论问题：

**参考实现锚点**。若 actor 要做的是业务系统、管理后台、营销页、SaaS 功能、数据看板，那么"业务相近的参考系统"和"符合产品口味的界面"本身是强的外部证据源。Boss actor 对照一个可见的产品空间（页面层级、交互密度、文案风格、信息架构、竞品惯例、转化路径、异常状态处理），而不是只读 worker 自述——这显著降低了"同模型互相盖章"问题，即使 boss 和 worker 用的是同一个基础模型。

**交付物观测锚点**。软件开发的交付物天然可被观测：代码 diff、截图、录屏、Storybook、Playwright trace、接口契约、日志、性能指标、错误率、schema migration、测试覆盖、lint/typecheck/build 结果。只要 boss actor 的判断依赖这些观测而非只读 worker 总结，它已获得比纯 LLM 自评更独立的证据。

**评价机制锚点**。不必追求人类级别的全面判断。很多阶段只需要判断"有无明显退化""是否符合参考样式""是否跑通主路径""是否破坏现有契约""是否达到 PM 给出的最低可接受口味"。**高频、便宜、可回放的粗糙评价，往往比低频、昂贵、不可复现的人类 review 更适合驱动开发流水线。**

---

## 4.5 早期落点：接地的开发加速层

三条告诫明确了边界后，早期目标可以降级到工程可实验的范围：

> actor-network 的早期落点不应是"无人自治组织"，而应是**接地的开发加速层**：在某个足够大的开发阶段中，以显著高于人类手工开发或低密度使用 Claude Code / Codex 的速度，稳定地产出可观察、可评价、可回滚的交付物。

在这个边界内，H6/H7 的要求变得工程化：boss actor 不必"比人更懂产品的一切"，但必须持有 worker 没有的独立证据；评价机制不必覆盖所有治理问题，但必须能发现该阶段的主要 failure mode；人类 C 节点不必介入每个 routine gate，但必须锚定最终责任、预算边界和例外升级。

**适合接地的开发阶段（举例）**：

1. 从需求草案 → 可交互 prototype
2. 从参考网站 → 业务贴近的前端实现
3. 从 issue backlog → 小批量 PR
4. 从 failing test → 修复候选
5. 从产品反馈 → UI variant
6. 从已有代码库 → 一致性重构
7. 从 QA 发现 → 回归测试 + 补丁

这些阶段的共同点：有外部可观测物，且价值不完全依赖"最终责任归属"。**C 变量可以先由人类产品负责人 / tech lead / repo owner 兜底，而 actor-network 负责扩大 A/B 阶段的吞吐。**

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

**实验指标**：不是测"能否替代人类组织"，而是测一个局部生产函数——

> 在相同需求输入、相同参考实现、相同验收标准下，actor-network 相比单 Claude Code / Codex 或人类低密度操作，是否能以更低人工介入、更短 wall-clock、更低返工率，交付同等或更高验收率的结果？

这个 framing 把问题从宏大的"自治组织是否可能"，降级成可实验的"接地开发闭环是否增益"。更容易设计，也更容易赢。
