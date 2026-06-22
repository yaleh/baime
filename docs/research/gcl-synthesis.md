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

## 下一步

1. **首次 premise-ledger 对比验证**（TASK-151 已完成仪器建设）：从下一个经过 feature-to-backlog 或 epic-to-backlog reviewLoop 的 gate 事件中读取 task Notes 的 `GCL-self-report` 行，将自报 H 值与 gcl-corpus.md 同类事件的估算 H 值对比，验证估算方法的系统偏差方向；持续累积自报数据以验证 H4 的动态版本（判断类隐性项是否随 artifact 增加而持续涌现）

2. **增加语料范围**：将语料扩展到更长时间窗口（>2 天）和更多任务类型，特别是 task-to-backlog 产生的 doc-only 任务

3. **收窄 gate 实验**：设计一个对照实验——对比"全 proposal 评审"（当前）与"仅 DoD 机械验证"（Scope−）的 gate 可靠性，实证验证 Scope− 是否在保持可靠性的同时降低 GCL

4. **规则类隐性项外化**：对 H 均值贡献最大的隐性项（系统不变量、judge 标准）考虑建立 `docs/ARCHITECTURE.md`，作为 Artifact+ 的实施路径

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

参考文档：
- docs/baime-software-engineering-capability-analysis.md §7.3（研究动机）
- docs/proposals/proposal-situational-awareness.md（受影响的使命设定）
- docs/research/gcl-intervention.md（H4 反事实分析，含 situational-awareness 影响）
