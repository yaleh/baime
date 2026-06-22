# 提案：开发过程情境感知（Situational Awareness）

**状态**：草稿（待影响确认与路径优化）
**背景**：2026-06-22 会话讨论

> **使命更新（TASK-150 GCL 研究，2026-06-22）**：本提案原使命为"帮人重建对系统的理解"。根据 docs/research/gcl-synthesis.md 的 H2/H4 验证结果，使命修正为：**最小化人为了可靠 gate 所必须理解的表面积**。具体地：(1) Scope− 是压缩 gate 认知负载（GCL）的主要杠杆；(2) 规则类隐性项可通过 artifact 外化辅助消除（Artifact+）；(3) 全局可理解性目标不切实际，工具建设应聚焦于降低 gate 判断所需的最小理解量。H4 verdict: H4 null——§7.3 方向无需整体回退，但 Artifact+ 对可文档化规则类隐性项有效，可作为辅助手段。见 docs/research/gcl-intervention.md。

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

| 工具 | 用途 |
|------|------|
| `query_summaries` | 最近几次 session 做了什么 |
| `query_user_messages` | 人类做了哪些 gate 决策 |
| `get_work_patterns` | 哪些文件/技能被高频使用 |
| `query_file_snapshots` | 关键文件（如 SKILL.md）如何演变 |
| `get_timeline` | 近期工作的时间骨架 |

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

1. **影响量化**：在后续几次 loop-backlog 执行中，记录每次 session 开始的定向时间，以及因上下文丢失导致的返工事件，作为 ROI 基线。
2. **路径优化讨论**：上述方案不一定都要实施。根据实际影响数据，确定哪些投入最有价值，以及各方案的具体实施顺序和范围。
3. **P0 快速验证**：`scripts/orient.sh` 成本最低，可先实施并使用几次，验证是否真正缩短了 session 开始时的定向时间。
