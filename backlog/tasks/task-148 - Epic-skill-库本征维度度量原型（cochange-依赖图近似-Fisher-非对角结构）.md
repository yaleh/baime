---
id: TASK-148
title: 'Epic: skill 库本征维度度量原型（cochange/依赖图近似 Fisher 非对角结构）'
status: 'Epic: Proposal'
assignee: []
created_date: '2026-06-22 07:07'
labels:
  - 'kind:epic'
dependencies: []
references:
  - docs/baime-geometric-information-theory.md
  - docs/baime-self-reference-analysis.md
ordinal: 103000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Epic 目标

把"BAIME 是收敛还是发散"从论断变成读数。基于几何信息论（GIT）框架，为 skill 库构建一个**可跑的本征维度 d 度量原型**：用 cochange / 依赖图近似 Fisher 信息矩阵的非对角结构，量化 skill 之间的真实耦合，输出 skill 库的有效自由度 d 与冗余信号。

理论依据见 docs/baime-geometric-information-theory.md §四.1 与 §六：
- GIT §8.1：本征维度 d 是系统健康的核心指标；d 异常增长预示架构腐化。
- GIT 信息几何：Fisher 信息矩阵的非对角元 = 模块间耦合。两个"独立" skill 若总是一起改（cochange）或互相依赖，则其非对角元非零 → 真实自由度 < skill 数。
- 锚定事实：TASK-126 退役 meta-task-to-backlog、loop-meta/loop-backlog 合并为 B″，都是已发生的 MDL 压缩事件——原型应能在历史数据上"事后"识别出这类冗余。

## 核心思路

1. **耦合矩阵 M**：对 N 个 skill 构建 N×N 对称矩阵，M[i][j] = skill i 与 j 的耦合强度。两个近似信号源：
   - **cochange**：git 历史中两个 skill 的文件在同一 commit 一起被改的频率（archguard get_cochange 或 git log 直接统计）。
   - **依赖图**：SKILL.md 之间的显式引用 / 调用关系（一个 skill 的正文是否提到、调用另一个 skill；contracts 中的 grep 目标）。
2. **本征维度 d**：对 M（或其拉普拉斯/相关矩阵）做谱分析，用"有效秩"（如 participation ratio、或保留 X% 能量所需的特征值数）作为 d 的估计。d ≈ N 表示 skill 高度正交（健康）；d ≪ N 表示存在可压缩冗余。
3. **冗余报告**：列出耦合最强的 skill 对（候选合并/支柱化对象），作为人工 OCA 收敛阶段的输入。

## 拟拆分（decompose 阶段细化，~4-5 Basic）

1. **数据采集层**：从 git 历史提取 skill 级 cochange 计数（plugin/skills/*/ 路径粒度），输出 cochange 邻接表。优先复用 archguard_get_cochange；不足则 git log --name-only 自统计。
2. **依赖图层**：扫描 SKILL.md 正文与 frontmatter，提取 skill→skill 的显式引用，输出依赖邻接表。
3. **耦合矩阵 + 谱分析**：合并两个信号源为对称矩阵 M，计算有效秩 d（participation ratio 或能量阈值法），脚本化为 scripts/skill-intrinsic-dim.* 。
4. **冗余报告 + 历史验证**：输出 top-K 强耦合 skill 对；在历史快照上验证原型能识别出 meta-task-to-backlog / loop-meta 这类已被压缩的冗余（负控制：已合并后 d 应下降）。
5. （可选）**集成点**：把 d 读数接入 check-roi-gate.sh 或 daemon evaluate 输出，作为后续"系统内生呼吸节律"的信号源。

## 验收信号（Epic）

- bash scripts/validate-plugin.sh 通过。
- scripts/skill-intrinsic-dim.* 可跑，对当前 plugin/skills/ 输出一个数值 d 与 top-K 强耦合 skill 对。
- 历史验证：在合并 loop-meta 之前的某个 commit 上运行，d 高于合并之后（证明原型对真实压缩事件敏感）。
- 输出一份简短报告（docs/ 下），把 d、ρ 与 docs/baime-geometric-information-theory.md §四.1 的"收敛 vs 发散"问题对接。

## 关联

- 理论底座：docs/baime-geometric-information-theory.md
- 动机问题：docs/baime-self-reference-analysis.md（收敛 vs 发散 / 自我修改脆弱性）
- 复用工具：archguard_get_cochange、archguard_analyze_git、git log
- 下游：本 epic 的 d 读数是 GIT §四.2「系统内生呼吸节律」与 epic-to-backlog「分解正交性判据」的前置输入。
<!-- SECTION:DESCRIPTION:END -->
