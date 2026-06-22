# GCL 驱动因素分析：H2 验证（GCL 与耦合度正相关）

**状态**：研究基线（TASK-150 Phase 4 输出）
**日期**：2026-06-22
**数据来源**：docs/research/gcl-corpus.md，git log

---

## H2 假设

> **H2**：Gate 理解负载（GCL）中的跨界分量（C）与任务耦合度正相关。耦合度越高（更多跨任务引用、更多共享文件修改），cross-boundary GCL 越高。

**可证伪形式**：Spearman 秩相关 ρ > 0.4 且 p < 0.10 → H2 confirmed；否则 H2 null 或 refuted。

---

## 耦合度代理变量

对每个任务，耦合度代理 = **跨任务引用数**（任务文件中引用的其他 TASK-ID 数）+ **git 变更文件数**（merge commit 的文件变更数量）。

**理由**：
- 跨任务引用数反映逻辑耦合（依赖其他任务的决策或输出）
- 文件变更数反映结构耦合（同一文件被多个任务触及）
- 两者之和作为综合耦合代理，来源均为可机械提取的 artifact

---

## 数据表

| TASK-ID | 跨任务引用数 | git 变更文件数 | 耦合代理(coupling) | mean C (跨界GCL均值) | 数据来源 |
|---------|------------|--------------|-------------------|---------------------|---------|
| TASK-149 | 1 | 1 | 2 | 1.00 | git diff 38cffce^..38cffce; task file refs |
| TASK-144 | 1 | 2 | 3 | 2.00 | git diff 08e27b8^..08e27b8; task file refs |
| TASK-145 | 1 | 4 | 5 | 2.00 | git diff b218790^..b218790; task file refs |
| TASK-146 | 2 | 3 | 5 | 3.00 | git diff 84240cb^..84240cb; task file refs |
| TASK-137 | 2 | 4 | 6 | 5.00 | git diff 5757d8d^..5757d8d; task file refs |
| TASK-125 | 3 | 4 | 7 | 3.67 | git diff 4050578^..4050578; task file refs |
| TASK-136 | 3 | 4 | 7 | 7.00 | git diff ab70eb2^..ab70eb2; task file refs |
| TASK-138 | 3 | 5 | 8 | 9.00 | git diff ce49b08^..ce49b08; task file refs |
| TASK-147 | 4 | 6 | 10 | 5.00 | git diff bfba51a^..bfba51a; task file refs |

**测量方法**：[measured] — 所有数值从 git log 和 task file 机械提取，见数据来源列。

---

## Spearman 秩相关

**计算方法**：python3 `scipy.stats` 模块（t 近似法），N=9 个任务

```python
from scipy import stats
coupling = [2, 3, 5, 5, 6, 7, 7, 8, 10]
mean_C   = [1.0, 2.0, 2.0, 3.0, 5.0, 3.67, 7.0, 9.0, 5.0]
rho, p   = stats.spearmanr(coupling, mean_C)
# rho = 0.8708, p = 0.0022 (two-tailed)
```

**结果**（实际计算，非估算）：

| 指标 | 值 |
|------|-----|
| Spearman ρ | **0.8708** |
| t 统计量 | 4.686 |
| df | 7 |
| p 值（单尾） | **0.00112** |
| p 值（双尾） | 0.00224 |

**H2 判定条件**：ρ > 0.4 AND p < 0.10（单尾）

- ρ = 0.8708 > 0.4 ✓
- p = 0.00112 < 0.10 ✓

## H2 confirmed

> **H2 confirmed**：耦合度代理与跨界 GCL 均值的 Spearman 秩相关为 ρ=0.87，p=0.001（单尾），显著高于 H2 判定阈值（ρ>0.4，p<0.10）。结论：在 BAIME backlog 语料中，task 耦合度越高，gate 判断所需的跨界认知负载（C 分量）越高。

---

## 散点图（文本形式）

```
mean_C
9 |                                                    *TASK-138
8 |
7 |                                    *TASK-136
6 |
5 |                    *TASK-137            *TASK-147
4 |
3 |              *TASK-144                        *TASK-125
  |      *TASK-145  *TASK-146
2 |
1 |  *TASK-149
  +-------+-------+-------+-------+-------+-------
  2       4       6       8      10      coupling
```

趋势线方向一致（右上），但有两个显著离群值：
- **TASK-125**（coupling=7, C=3.67）：low 于趋势——该 Epic 任务的跨界项被高度整合在单一 Notes 字段中，外部引用实际被 artifact 内化，C 被低估
- **TASK-147**（coupling=10, C=5.00）：high coupling 但 medium C——依赖的外部任务（TASK-143/144/145/146）结果已被间接整合为背景知识，部分转为 H

---

## 局限性

1. **N=9 任务**（而非 N=20 gate 事件）：每个任务的 coupling 值唯一，gate 事件的多样性在任务层面被平均，降低了细粒度。

2. **耦合代理的选择**：files_changed + cross_task_refs 是耦合的粗略代理。更精细的耦合度量（如文件-级共变分析）超出本研究范围。

3. **因果推断**：相关不等于因果。耦合 → C 增加是机理上合理的（引用更多外部来源），但也可能存在第三方共因（复杂任务同时导致高耦合和高 C）。

4. **语料范围**：两日窗口（2026-06-21–22）内的 9 个任务，可能不代表所有任务类型。

---

## 对工程方向的影响

H2 confirmed 意味着：

> 降低任务耦合（更自包含的 task 设计、更强的接缝定义）是压缩 C 分量的主要杠杆，进而降低 GCL。

具体操作路径：
1. 减少 task 对外部文档/任务的显式引用（在 task 内内化关键信息）
2. 强化 DoD 的自包含性（DoD 条目只引用本任务内可验证的 artifact）
3. 父任务的 acceptance gate 应在 child task 创建时就内联写入 child description，而非要求 gate 判断者临时查阅父任务
