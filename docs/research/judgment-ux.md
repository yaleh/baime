# Judgment 用户的 UX：从 executor CLI 到 gate console

**日期**：2026-06-23
**背景**：GCL 框架（H6/H7）确立"监督质量由 evidence independence 决定，而非 actor 是否为人"后，派生出的人机交互前端问题
**依赖**：docs/research/gcl-complete-observation-mechanism.md, gcl-synthesis.md
**关联**：docs/research/cc-actor-network.md（同一根轴的相反方向）

---

## 1. 问题：当前开发环境为 executor 优化，不为 judgment 用户优化

随着 loop-backlog 自治深化，人类角色从 throughput 贡献者退为 gate 判断者（gcl-definition.md §概念动机）。但当前的软件开发环境——包括 Claude Code CLI——是为 **executor loop**（LLM 在动、人在看）优化的。它把人放在两个错误的默认位置上：

- **默认执行者**：人被要求读全量 diff、全量 log，承担全量认知负载。
- **默认审核者**：每个 gate 都打断人，approval fatigue 把 human-in-the-loop 退化成橡皮图章（gcl-complete-observation-mechanism.md §1）。

H7 的结论使这个默认位置站不住：在 routine gate 上，human presence 降低的是吞吐（成本），不是风险（效益）。**正确的 UX 重点，是为 judgment 用户提供独立、压缩、可追溯、可校准的信息，使其只在必要判断点高质量介入。**

这是一个与 executor CLI 不同的 surface——本文称为 **judgment console / gate cockpit**。

---

## 2. 三个项目已经是它的后端

judgment console 不需要从零建后端。现有三个项目正好各供一条**独立证据通道**（H6 意义下的 evidence independence）：

| 通道 | 项目 | 在 H6 意义下提供什么 | 独立性来源 |
|------|------|---------------------|-----------|
| 进程证据（发生了什么） | **meta-cc** | session / 工具调用的独立回放 | 不依赖 agent 自述，直接读 session 记录 |
| 系统证据（改动有多危险） | **archguard** | change-risk / cochange / ownership / coverage | 对*被改系统*的独立静态 + 历史分析 |
| gate 结构（在哪判断、负载多大） | **baime/loop-backlog** | gate placement + GCL self-report + escape rate | gate 的位置与负载量化 |

**关键判断**：judgment console 的后端基本齐了，缺的是前端那一层——把三路证据**压缩、路由，并在 A/B/C 决策点呈现**。这一层不是 dashboard，而是一个把"何时打断人、打断时给什么"作为一等公民的交互 surface。

---

## 3. 设计原则：每一条都对应一个已写下的框架约束

| 原则 | 框架来源 | 含义 |
|------|---------|------|
| **选择性打断** | 四层 gate 架构（§4.4） | 只有 ambiguous-preference / high-accountability / meta-governance 浮到人面前；routine gate 永不打断人 |
| **构造性证据独立** | H6 | 人永远不只读 agent summary；每个断言挂着独立源（test 输出 / archguard risk / meta-cc trace），把 anti-automation-bias 做进 UX 而非靠人自律 |
| **带下界的压缩** | H5 | 呈现"最小充分上下文"，但不压到零——UX 必须抵抗坍缩成单个 Approve 按钮 |
| **可追溯** | — | 每个断言可下钻到源；相似历史 gate 的 escape rate 内联展示 |
| **可校准** | gcl-complete §5 三组指标 | 把人自己的判断 track record 显示给人（"你批过 40 个同类 gate，2 个 escape"），使 calibration 可见、可改进 |

### 3.1 选择性打断与 A/B/C 路由

四层 gate 架构（§4.4）规定 routine gate 不触发人。剩下三类触发人的 gate，对应三变量拆解（§4.2）的不同价值来源，UX 呈现也应不同：

- **Ambiguous-preference gate（B）**：UX 任务是"准备好选项 + 暴露 trade-off 的事实面"，让人只提供偏好/risk budget，而不是替人算 trade-off（事实判断 LLM + telemetry 可能更强）。
- **High-accountability gate（C）**：UX 任务是"打包 automated evidence pack + 提供可签字的责任入口"。这里人是责任主体，不是更准的判断者。
- **Meta-governance gate（B+C）**：UX 任务是"呈现机制变更的多版本对比 + escape/rework 历史"，让人选择采用哪个制度设计。

### 3.2 压缩的下界（H5 在 UX 层）

H5 说 GCL 压到零会让 gate 退化成橡皮图章。在 UX 层，这意味着 console **不能**把一个 high-accountability gate 简化成一个按钮。压缩的目标是"去掉 routine 噪声"，不是"去掉判断所需的实质信息"。判据：压缩后人仍能复述出他在为什么风险背书。

---

## 4. 风险：D 支柱问题在 UX 层重演

gcl-complete §2 的"D 反馈支柱为空"问题会在 UX 层原样重演——**很容易做出一个没人读的 dashboard**。

判据不是界面好不好看，而是：

1. 引入 console 后，gate escape rate 是否真的下降？（效益）
2. 人在 routine gate 上的打断次数是否真的减少？（成本）
3. 人对 console 呈现的证据是否真的下钻，还是仍然只看顶层 summary？（automation bias 是否被压制）

如果三者都没改善，console 只是把橡皮图章换了个更漂亮的外壳。

---

## 5. 与 actor-network 方向的关系

本文是 evidence-independence 轴的"人介入"方向：当人确实需要介入时，怎样把独立证据最高质量地递给人。

相反方向是 docs/research/cc-actor-network.md：当 actor 不必是人时，怎样把多个非人 actor 组织起来。两者共享同一个判据（evidence independence），并且 actor-network 是本文若干假设（尤其"LLM-judge + 独立证据是否真比人强"）的实验台架——见该文 §3。

---

## 6. 外部文献

| 来源 | 关联 |
|------|------|
| Buçinca et al., Harvard 2021 — Cognitive Forcing Functions | §3.2 压缩下界、§4 automation bias 判据 |
| EDPS TechDispatch #2/2025 — EU AI Act 人类监督 | §3.1 high-accountability gate 的 C 价值 |
