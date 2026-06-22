# 提案：开发过程情境感知（Situational Awareness）

**状态**：修订版 v2（基于 GCL 实证研究，2026-06-22）
**背景**：2026-06-22 会话讨论；v2 使命依据 TASK-150 实证结果更新

---

## 使命

> **最小化人为了可靠 gate 所必须理解的表面积。**

本提案 v1 的原使命为"帮人重建对系统的理解"。根据 TASK-150 GCL 实证研究（见下文§研究基础），全局理解不是可达目标，工具建设的正确锚点是**最小化 gate 判断所需的认知单元数量**，不是恢复理解。

---

## 研究基础（TASK-150，2026-06-22）

以下数据来自 [docs/research/gcl-synthesis.md](gcl-synthesis.md)，完整分析见各引用文件。

### GCL 基线（N=20 gate 事件）

Gate 理解负载（GCL = 显性项 E + 跨界项 C + 隐性项 H）的操作化定义见 [docs/research/gcl-definition.md](gcl-definition.md)。

| 分量 | 均值 | 占比 | 可压缩路径 |
|------|------|------|-----------|
| E（显性项：DoD 条目 + Plan Phase 数）| 8.35 | 57% | 收窄 gate 判断范围（Scope−）|
| C（跨界项：跨任务 / 跨文档引用）| 4.50 | 31% | 降低 task 耦合（H2）|
| H（隐性项：无 artifact 支撑的前提）| 1.70 | 12% | Scope− 稳定有效；Artifact+ 对规则类有效 |
| **GCL 总量** | **14.55** | — | — |

关键对照：dod-eval gate（纯机械 DoD 验证）均值 GCL = **5.0**，为全局均值的 **34%**。这是 Scope− 干预效果的实测值。数据来源：[docs/research/gcl-baseline.md](gcl-baseline.md)（N=20）。

### H2：任务耦合度与跨界 GCL 正相关（confirmed）

Spearman ρ = 0.87，p = 0.001，N = 9 任务（[docs/research/gcl-drivers.md](gcl-drivers.md)）。耦合代理 = 跨任务引用数 + git 变更文件数，均从 artifact 机械提取。

工程推论：降低 task 耦合（更自包含的 task 设计、child task 内联父任务 acceptance gate）是压缩 C 分量的主要杠杆。

### H4：隐性项压缩路径（null，细化）

反事实分析（N=3 高 H 事件）显示（[docs/research/gcl-intervention.md](gcl-intervention.md)）：

| 隐性项类型 | Artifact+ 效果 | Scope− 效果 |
|-----------|--------------|------------|
| 规则类（可文档化的规则、判断标准、历史决策记录）| ✅ 可消除（~100%）| ✅ 可消除 |
| 判断类 / 结构类（整体评估框架、演化中的系统策略）| ⚠️ 有限（33%–67%，H 转为 C，非净减）| ✅ 稳定（~100%）|

严格 H4 confirmed 条件（Artifact+ ≤10%）未满足，裁定为 **H4 null**。§7.3 压缩表面积方向无需整体回退。

**关键推论**：
1. **主要杠杆（Scope−）**：收窄 gate 判断范围对所有隐性项类型均有效，且不受系统演化影响（新涌现的隐性项天然不进入收窄后的 gate 范围）。
2. **辅助工具（Artifact+）**：针对规则类隐性项，先外化到 `docs/ARCHITECTURE.md`（系统不变量、判断准则、架构决策记录）再收窄范围，是可行的双阶段路径。

*注：H 分量基于负空间估算法（中低置信度），H4 反事实预测标注为 [directional-prediction, needs validation]。后续验证路径见§下一步。*

---

## 问题

### 背景

随着 backlog.md + epic/basic tasks 的深度应用，开发工作的颗粒度显著增大：一个 epic 可拆出 8-12 个 basic tasks，每个 task 由自治 agent 在独立 worktree 执行并 merge 回主干。这在执行效率上有显著收益，但同时引入了三类**上下文断层**：

### 1. 架构断层

系统结构（哪些 skill 存在、职责是什么、互相怎么依赖）在多次 task 执行后悄然演变。没有一个持续同步的结构摘要，导致：

- 新 session 的 AI agent 需要从零重建对当前架构的认知
- 人类返回工作台时，不确定"现在的系统长什么样"
- 随着 task 数增加，靠记忆维护的架构认知越来越不可靠

### 2. 状态断层

当前没有一个统一入口能在 30 秒内回答"现在发生着什么"：

- daemon 是否在运行？last-event 是什么？
- board 上哪些 task 是 In Progress / Ready / Blocked？
- 是否有 unmerged worktree 或悬挂的 agent？

三个信息源（`daemon-status.sh`、`backlog task list`、`git log`）各自独立，没有组合。

### 3. 方向断层

每次新 session 开始时，人和 AI 都需要重建"我们在做什么、刚完成了什么、下一步是什么"的上下文。目前的信息路径：

- `git log` 告诉你文件改了什么，不告诉你为什么
- backlog 任务告诉你计划，不告诉你执行过程中的决策
- CLAUDE.md 是静态配置，不反映架构演变

**影响评估**（待确认）：这三类断层在当前任务规模下的实际耗时和错误率尚未量化。后续需要在几次实际 loop-backlog 执行中记录：每次 session 开始前的定向时间、因上下文丢失导致的返工次数。

---

## 建议方案

以下方案分三层，按优先级排列。各方案的实际 ROI 待进一步验证。

### Tier 1 — 统一即时定位入口（P0）

**方案**：创建 `scripts/orient.sh`，将三条标准命令合并为一个 30 秒快照。

```bash
#!/usr/bin/env bash
# orient.sh — session 开始时的标准定向快照
set -u

echo "=== daemon ==="
bash scripts/daemon-status.sh

echo ""
echo "=== board (active) ==="
backlog task list --status "Basic: In Progress,Basic: Ready,Epic: In Progress,Epic: Ready" 2>/dev/null || \
  backlog task list 2>/dev/null | grep -E "(In Progress|Ready)"

echo ""
echo "=== recent commits ==="
git log --oneline -8

echo ""
echo "=== git status ==="
git status --short
```

**待确认**：`backlog task list` 的过滤语法是否支持多状态；orient.sh 的输出格式是否适合 AI agent 直接消费（还是主要给人类看）。

---

### Tier 2 — Session 热身，基于 meta-cc（P1）

**方案**：在 loop-backlog 的 evaluate 阶段（epic 全部子任务 Done 时），自动调用 meta-cc 查询当前 session 摘要，附加到 evaluate 输出中。

具体查询点：

| 工具 | 用途 | GCL 效用 |
|------|------|---------|
| `query_user_messages` | 人类做了哪些 gate 决策（APPROVED / ITERATE / 手动修正）| 直接测量 gate 行为，可用于 H4 验证 |
| `query_summaries` | 最近几次 session 做了什么 | 还原决策上下文，降低 H 分量 |
| `get_work_patterns` | 哪些文件/技能被高频使用 | 识别高 C 分量的耦合热点 |
| `query_file_snapshots` | 关键文件（如 SKILL.md）如何演变 | 追踪规则类隐性项的外化进度 |
| `get_timeline` | 近期工作的时间骨架 | session 定向，降低 H |

**GCL 视角下的新用途**：meta-cc session trace 是目前唯一可以提供**实测 H 分量**的数据源（区别于本研究使用的负空间估算）。具体路径见§下一步。

**待确认**：meta-cc 的查询在 loop-backlog agent 上下文中是否可用（工具权限）；加入 evaluate 阶段是否会显著增加执行时间。

另一使用场景：session 开始时，主动向 meta-cc 询问"最近 3 次 session 主要工作了什么、做了哪些 human gate 决策"——这比读 git log 更能还原决策上下文，适合人类定向。

---

### Tier 3 — 结构可见性，基于 archguard + skills-map（P2/P3）

#### archguard（P2，聚焦变更模式）

archguard 对 SKILL.md 为主体的项目，结构分析（AST、依赖图）价值有限；**变更模式分析**更有意义：

| 工具 | 用途 |
|------|------|
| `archguard_get_change_risk` | 哪些文件最频繁变动（高 churn = 高风险区） |
| `archguard_get_cochange` | 哪些文件总是一起改（隐含耦合） |
| `archguard_analyze_git` | 近期 git 演变趋势 |

**建议集成点**：epic evaluate 阶段加入 change risk 查询，作为"哪里最可能埋了坏味道"的信号，写入 evaluate 报告。

**待确认**：archguard 对 shell/JS 脚本的分析覆盖率；`archguard_get_change_risk` 的输出格式是否适合自动消费。

#### skills-map（P3，受 Aider repo-map 启发）

**方案**：创建 `scripts/gen-skills-map.sh`，扫描 `plugin/skills/*/SKILL.md`，提取每个 skill 的 name、description、contracts 摘要，生成 `docs/SKILLS-MAP.md`。

目标输出示例：

```
loop-backlog      — B″ unified worker; channels: basic-ready/epic-ready/child-done
epic-to-backlog   — interactive epic decomposer; calls: backlog task_create
backlog-setup     — one-time initializer; validates columns
...
```

新 session 的 AI agent 可以一次性加载 `docs/SKILLS-MAP.md`，获得完整 skill 图谱，无需逐一读 SKILL.md。

**待确认**：skills-map 的信息密度是否合适（过详则冗余，过简则无用）；是否需要包含 skill 间的调用关系（`epic-to-backlog` 被 `loop-backlog` 调用等）。

---

### 补充方向：AGENTS.md 模式（P3）

受 2026 年实践影响，传统 ADR 记录"决定了什么、为什么"，但 AI agent 更需要"**给定当前架构，什么不能碰、什么必须做**"。

**建议**：在 `CLAUDE.md`（当前只有 L0 Config）旁边建立 `docs/ARCHITECTURE.md`，记录：

- 当前 B″ 架构的核心不变量（例：daemon 是单进程，不得拆分）
- 各 skill 的职责边界（例：epic-to-backlog 只分解、不执行）
- 最近一次 epic 的架构演变摘要

**待确认**：由谁来维护这个文件（人工、还是由 loop-backlog evaluate 自动更新一部分）；更新频率和格式规范。

---

## 下一步

1. **P0 快速验证**：`scripts/orient.sh` 成本最低，可先实施并使用几次，验证是否真正缩短了 session 开始时的定向时间。

2. **规则类隐性项外化**（Artifact+ 路径）：建立 `docs/ARCHITECTURE.md`，记录系统不变量（daemon 单进程、BasicDAG 状态机）、R1 guard 豁免规则、FINISH/ITERATE 判断准则。首批条目可从 gcl-corpus.md 的 H 列直接提取（TASK-125 H-A、TASK-147 H-B）。

3. **H4 动态验证（premise-ledger 路径，已就绪）**：TASK-151 已将 premise-ledger 指令注入 feature-to-backlog 和 epic-to-backlog 的 reviewLoop reviewer prompt——后续每次 gate 裁决均自动向 task Notes 写入 `[E|C|H] criterion: premise` 和 `GCL-self-report: E=n C=n H=n`。H 从此可从 Notes 机械提取，无需 forensic 重建。下一步：累积若干自报事件后，与 gcl-corpus.md 估算值对比，验证偏差方向，并纵向观察判断类隐性项是否随 artifact 增加而持续涌现（H4 动态版本）。meta-cc session trace 可作为辅助交叉验证，不再是主路径。

4. **Scope− 对照实验**：对比"全 proposal 评审"（当前）与"仅 DoD 机械验证"（Scope−）的 gate 可靠性差异，实证验证 GCL 5.0 vs 14.55 是否在保持可靠性的同时不增加漏检率。

5. **影响量化**：在后续几次 loop-backlog 执行中，记录每次 session 开始的定向时间，以及因上下文丢失导致的返工事件，作为 ROI 基线。
