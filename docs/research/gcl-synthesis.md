# GCL 综合报告：H2/H4 裁定与方向回灌

**状态**：研究总结（TASK-150 Phase 6 输出）
**日期**：2026-06-22
**依赖**：docs/research/gcl-definition.md, gcl-corpus.md, gcl-baseline.md, gcl-drivers.md, gcl-intervention.md

---

## 核心裁定

| 假设 | 裁定 | ρ / 效果 | p 值 | 置信度 |
|------|------|---------|------|--------|
| **H2**: GCL 与耦合度正相关 | **H2 confirmed** | Spearman ρ=0.87 | p=0.001（单尾） | 高（N=9 任务，可机械复现） |
| **H4**: 隐性项不随 artifact 增加而缩小 | **H4 null** | Scope− 效果稳定（100%），Artifact+ 效果依隐性项类型而异（33%–100%） | N/A（方向性预测） | 中（N=3 事件，[directional-prediction]） |

---

## H2 详细裁定

**H2 confirmed**

耦合代理（跨任务引用数 + git 变更文件数）与跨界 GCL 均值之间存在强正相关（Spearman ρ=0.87，p=0.001，N=9）。在当前 BAIME 语料中，该关系成立。

**工程含义**：
- 降低任务耦合是压缩 C 分量（跨界 GCL）的主要杠杆
- 更自包含的 task 设计（内联关键背景、明确接缝定义）可直接降低 gate 负载
- 父任务的 acceptance gate 应在 child task 创建时就内联，而不是要求 gate 判断者临时查阅父任务

**局限**：N=9，两日窗口，结论方向可信但规模有限。

---

## H4 详细裁定

**H4 null（细化）**

严格 H4 confirmed 条件（Artifact+ ≤10%）未满足：对于可文档化规则类隐性项，Artifact+ 可消除 100% 的 H；对于判断性/结构性隐性项，Artifact+ 效果降至 33%–67%，而 Scope− 在所有类型中均达到 100%。

**工程含义**：
- §7.3 方向（"压缩表面积优于恢复理解"）**不需要整体回退**
- 细化建议：区分隐性项类型
  - **规则类**（可文档化规则、判断标准）：Artifact+ 有效，先外化再 Scope−
  - **判断类/结构类**（整体评估框架、演化中的系统策略）：Artifact+ 效果受限，Scope− 是主要手段
- **H4 的枢轴地位保留**：对于判断类隐性项，"压缩表面积优于恢复理解"的建议仍成立，不回退

**局限**：N=3 事件，所有反事实标注为 [directional-prediction, needs validation]，结论需后续 session trace 数据验证。

---

## GCL 基线关键数据

（来源：gcl-baseline.md，N=20 gate events）

- **GCL 总量均值**：14.55（std=6.51，范围 5–29）
- **E 分量**：均值 8.35（占 57%）——主导分量
- **C 分量**：均值 4.50（占 31%）
- **H 分量**：均值 1.70（占 12%）——最小但最难降低
- **dod-eval gate 的 GCL = 5.0**：验证了 gate 收窄的效果（收窄后 GCL 仅为整体均值的 34%）

---

## 对 proposal-situational-awareness.md 的影响

鉴于 H4 null（非 refuted），§7.3 工程方向不需要回退，但需细化：

1. **situational-awareness 工具的使命设定**需要修正，见下方更新说明
2. **Artifact+ 作为辅助工具**：针对规则类隐性项，增加 artifact（如 `docs/ARCHITECTURE.md` 记录系统不变量和决策准则）有效，应作为 Scope− 的补充
3. **Scope− 是核心杠杆**：收窄 gate 判断范围（更强的 DoD 机械验证、更窄的接受标准）是稳定降低所有类型 GCL 的策略

**已更新**：见 docs/proposals/proposal-situational-awareness.md（§使命更新脚注）

---

## GCL-self-report 首批验证结果（TASK-152）

**已完成**：TASK-152 收集了 TASK-151 部署后的首批 13 个 premise-ledger 自报事件，与 gcl-corpus.md 基线进行了系统比对。详见 docs/research/gcl-selfReport-analysis.md。

**关键发现**：
- **偏差方向**：所有 13 个事件的 delta_H 均为负值（均值 −1.46），估算基线系统性高估了 H。部分原因是新任务规模更小（E: 6.31 vs 基线 12.3），自然产生更少隐性前提。
- **H4 动态**：H=0 的任务均为"全 DoD 机械可验证"任务，H=1 的任务均包含主观阈值判断——与 H4 细化裁定（规则类 H 可被 artifact 外化，判断类 H 持续存在）一致。
- **H4 局限**：观测期内 artifact 覆盖未变化（恒定 6 个 gcl-research 文件），无法通过 artifact 增量验证 H4。

## 框架修订：GCL 的服务目标重构（2026-06-23）

**Human oversight 不应被当作天然基准；它只是当前治理结构中的一种 gate actor。**

GCL 最终要服务的不是"保护人类监督的地位"，而是衡量：**一个 gate 是否以可持续成本产生了足够独立、可追责、可校准的监督信号。**

在这个框架下，"降低 GCL"和"提升监督质量"是可以解耦的工程变量。最优 gate 设计是在 **evidence independence**（监督证据与被监督系统信息源的独立程度）最大化的前提下，把 GCL 维持在人类可持续参与的区间——而不是无限压低 GCL。

Automation bias 也因此从"人类被 AI 欺骗"的窄问题，扩展为**监督通道和被监督系统的信息源发生耦合**的一般性失效模式。无论 gate actor 是人还是机器，只要证据源不独立，这种失效就会出现。

"人类监督"在工程语境中实际包含性质不同的三类价值，必须分开处理（详见 docs/research/gcl-complete-observation-mechanism.md §4.2）：
- **A. Epistemic contribution**：人提供了系统尚未外化的上下文——这是 **context externalization gap** 的代理量，不是人类洞察力本质优势，随着 decision records / incident log 建设而下降
- **B. Preference anchoring**：目标函数未完全形式化时，人作为偏好/责任主体提供样本
- **C. Accountability / legitimacy**：当前制度要求人承担后果——纯制度约束，与认知质量无关

**结论**：人类默认不是更强的 reviewer；只有当 A/B/C 有增量价值时才触发人类 gate。除此之外，LLM ensemble + 独立证据通道 + escape-rate 校准可能是更强的监督机制。

见 docs/research/gcl-complete-observation-mechanism.md §4、§5 的完整论述与 H5 / H6 / H7 表述。

---

## 新增假设

### H5：GCL 存在监督有效性下界

> 当 GCL 被 Scope− 压得过低（H=0、C=0），gate 退化为 rubber stamp，escape rate 上升。

**状态**：待验证。需 gcl-events.jsonl + escape_rate 字段（TASK-176 增量 2）建立后实测。

### H6：监督有效性主要取决于 evidence independence，而非 gate actor 是否为人类

> 一个 gate 的监督质量，由其证据来源与被监督系统的信息独立程度决定。人类 gate 如果只消费 agent summary，可能比具备独立测试、独立模型、独立日志通道的 automated gate 监督质量更低。

**状态**：待验证。需 gcl-events.jsonl 增加 `evidence_independence` 字段后实测。

### H7：在大多数 routine engineering gates 中，human-in-the-loop 降低的不是风险，而是系统吞吐

> Routine engineering gate 的监督质量与 gate actor 是否为人类无关；human presence 的主要效果是增加延迟（成本），而非提高信号准确性（效益）。监督质量的主要预测变量是 evidence_independence，与三变量拆解（A/B/C）一致。

**可证伪规则**：在控制 evidence_independence 的情况下，human vs automated gate actor 对 escape rate 无显著差异（routine gate 子集）。需将 `gate_actor_type`（human/llm/hybrid/tool）加入 gcl-events.jsonl schema，配合 H6 的 `evidence_independence` 字段联合检验。

**状态**：待验证。需 gcl-events.jsonl 增加 `gate_actor_type` 字段后实测（TASK-176）。

---

## 下一步

1. **首次 premise-ledger 对比验证**（TASK-151 已完成仪器建设，TASK-152 已执行首批分析）：✓ 已验证，见 docs/research/gcl-selfReport-analysis.md。后续需积累更多样本，扩展到 proposal gate 和 epic-evaluate gate 类型。

2. **完整观测机制建设**（TASK-176，Epic: Backlog）：结构化事件日志 + 可复现分析脚本 + 可靠性采样 + escape rate 配对 + H5/H6/H7 验证实验 + 闭环告警。schema 需包含 `evidence_independence` 和 `gate_actor_type` 字段以支持 H6/H7 联合检验。详见 docs/research/gcl-complete-observation-mechanism.md。

3. **收窄 gate 实验**：设计对照实验——对比"全 proposal 评审"（当前）与"仅 DoD 机械验证"（Scope−）的 gate 可靠性，同时控制 evidence independence，实证验证 H5 边界。

4. **规则类隐性项外化**：对 H 均值贡献最大的隐性项（系统不变量、judge 标准）建立 `docs/ARCHITECTURE.md`，作为 Artifact+ 的实施路径，同时提升 evidence independence。

---

## 研究追踪

| Phase | 文件 | 状态 |
|-------|------|------|
| 1. GCL 定义 | docs/research/gcl-definition.md | ✓ 完成 |
| 2. 语料构建 | docs/research/gcl-corpus.md | ✓ 完成（N=20） |
| 3. 基线统计 | docs/research/gcl-baseline.md | ✓ 完成 |
| 4. H2 验证 | docs/research/gcl-drivers.md | ✓ H2 confirmed |
| 5. H4 验证 | docs/research/gcl-intervention.md | ✓ H4 null（细化）|
| 6. 综合与回灌 | docs/research/gcl-synthesis.md（本文）| ✓ 完成 |
| 7. 首批自报分析 | docs/research/gcl-selfReport-analysis.md | ✓ 完成（N=13，TASK-152）|
| 8. 完整观测机制 | docs/research/gcl-complete-observation-mechanism.md | 进行中（TASK-176）|
| 9. Judgment 用户 UX | docs/research/judgment-ux.md | ✓ 完成（2026-06-23，evidence-independence 轴·人介入方向）|
| 10. CC Actor 网络 | docs/research/cc-actor-network.md | ✓ 完成（2026-06-23，evidence-independence 轴·非人 actor 方向，含接地开发加速层框架）|

参考文档：
- docs/baime-software-engineering-capability-analysis.md §7.3（研究动机）
- docs/proposals/proposal-situational-awareness.md（受影响的使命设定）
- docs/research/gcl-intervention.md（H4 反事实分析，含 situational-awareness 影响）
