# GCL Self-Report Analysis：首批自报数据与基线比对

**状态**：TASK-152 输出（Phase 1–4）
**日期**：2026-06-23
**数据来源**：backlog/tasks/*.md（GCL-self-report 行）、docs/research/gcl-corpus.md（估算基线）、docs/research/gcl-baseline.md（分层统计）

---

## 收集说明

TASK-151 于 2026-06-22 将 premise-ledger 自报指令注入 feature-to-backlog 和 epic-to-backlog 的 reviewLoop reviewer prompt（合并提交 b11cb45）。每次 plan/proposal review gate 事件现在向 task Notes 写入 `GCL-self-report: E=n C=n H=n`。

扫描命令：`grep -rl 'GCL-self-report' backlog/tasks/`

找到含 GCL-self-report 的任务文件：13 个（满足 DoD #1 ≥3 的条件）。

---

## Phase 1 数据：GCL-self-report Gate 事件

所有 13 条自报事件汇总如下（按 git 提交时间排序）：

| # | TASK-ID | Gate 类型 | 迭代 | 日期 | E | C | H | GCL | 备注 |
|---|---------|-----------|------|------|---|---|---|-----|------|
| 1 | TASK-153-A | plan | iter1 | 2026-06-22 14:12 | 6 | 0 | 1 | 7 | cap-experiment facet 定义 |
| 2 | TASK-154-B | plan | iter1 | 2026-06-22 14:12 | 5 | 1 | 1 | 7 | experiments-lib/runner.ts |
| 3 | TASK-155-C | plan | iter1 | 2026-06-22 14:12 | 5 | 1 | 1 | 7 | run-exp-h.ts 移植 |
| 4 | TASK-156-D | plan | iter1 | 2026-06-22 14:12 | 5 | 1 | 1 | 7 | timing.ts 提取器 |
| 5 | TASK-157-E | plan | iter1 | 2026-06-22 14:12 | 5 | 1 | 1 | 7 | provenance gate 构建 |
| 6 | TASK-158-F | plan | iter1 | 2026-06-22 14:12 | 5 | 1 | 1 | 7 | SKILL 重构为薄层 |
| 7 | TASK-159 | plan | iter1 | 2026-06-23 06:16 | 2 | 1 | 1 | 4 | ESM/CJS 守护进程修复 |
| 8 | TASK-165 | plan | iter1 | 2026-06-23 03:53 | 8 | 1 | 0 | 9 | kind:basic 标签修复（第1次审查）|
| 9 | TASK-165 | plan | iter2 | 2026-06-23 03:53 | 9 | 0 | 0 | 9 | kind:basic 标签修复（第2次审查）|
| 10 | TASK-166 | plan | iter1 | 2026-06-23 07:27 | 8 | 1 | 1 | 10 | Monitor prompt 跨会话自恢复（第1次）|
| 11 | TASK-166 | plan | iter2 | 2026-06-23 07:27 | 7 | 1 | 0 | 8 | Monitor prompt 跨会话自恢复（第2次）|
| 12 | TASK-167 | plan | iter1 | 2026-06-23 08:22 | 9 | 0 | 0 | 9 | backlog-setup L0 Config 初始化 |
| 13 | TASK-170 | plan | iter1 | 2026-06-23 15:42 | 8 | 1 | 0 | 9 | Monitor checkpoint 无状态 worker |

**所有事件均为 `plan` gate 类型**（feature-to-backlog/epic-to-backlog reviewLoop 目前只在 plan 阶段触发 premise-ledger）。

---

## 比对结果

### 基线参考（来自 gcl-corpus.md + gcl-baseline.md）

`plan` gate 基线（N=7，TASK-125/136/137/138/146/147/149）：

| 分量 | 基线均值 | 基线范围 |
|------|---------|---------|
| E | 12.3 | 6–21 |
| C | 4.7 | 1–9 |
| H | **2.0** | 1–3 |
| GCL | 19.0 | 15–29 |

### 自报数据统计（N=13 事件）

| 分量 | 自报均值 | 自报范围 | 自报标准差 |
|------|---------|---------|-----------|
| E | 6.31 | 2–9 | 1.89 |
| C | 0.69 | 0–1 | 0.48 |
| H | **0.54** | 0–1 | 0.52 |
| GCL | 7.54 | 4–10 | 1.81 |

### delta_H 分析（偏差方向）

**delta_H = self_reported_H − estimated_H_baseline**

基线 plan gate 的 H 均值 = 2.0

| # | TASK-ID | 自报 H | 基线 H（plan 均值） | delta_H |
|---|---------|--------|-------------------|---------|
| 1 | TASK-153-A | 1 | 2.0 | −1.0 |
| 2 | TASK-154-B | 1 | 2.0 | −1.0 |
| 3 | TASK-155-C | 1 | 2.0 | −1.0 |
| 4 | TASK-156-D | 1 | 2.0 | −1.0 |
| 5 | TASK-157-E | 1 | 2.0 | −1.0 |
| 6 | TASK-158-F | 1 | 2.0 | −1.0 |
| 7 | TASK-159 | 1 | 2.0 | −1.0 |
| 8 | TASK-165-iter1 | 0 | 2.0 | −2.0 |
| 9 | TASK-165-iter2 | 0 | 2.0 | −2.0 |
| 10 | TASK-166-iter1 | 1 | 2.0 | −1.0 |
| 11 | TASK-166-iter2 | 0 | 2.0 | −2.0 |
| 12 | TASK-167 | 0 | 2.0 | −2.0 |
| 13 | TASK-170 | 0 | 2.0 | −2.0 |

**汇总**：
- 均值 delta_H = −1.46（自报 H 均值 0.54，基线 H 均值 2.0）
- 偏差方向：**一致负向**（所有 13 个事件的 delta_H ≤ −1.0）
- 偏差含义：原始估算的 H=2.0 相对于自报结果**系统性高估**了约 1.5 单元

### E、C 分量的同步偏差

E 和 C 也呈现出同向的负偏差：
- 自报 E 均值（6.31）vs 基线 E 均值（12.3）：delta_E = −6.0（高估约 2x）
- 自报 C 均值（0.69）vs 基线 C 均值（4.7）：delta_C = −4.0（高估约 7x）

这表明新一批任务（TASK-153+）本质上比基线语料中的任务（TASK-125–149）规模更小、耦合度更低，不能单纯归因于估算偏差。自报 H 偏差方向与 E、C 偏差方向一致，支持"任务类型改变"的解释（而非纯粹的测量偏差）。

---

## H4 动态验证

### H4 假设（动态版本）

H4 的动态版本预测：随着 artifact 覆盖率增加，H 值应下降（隐性前提被外化）。

### Artifact 覆盖代理

以 `docs/research/*.md` 文件数量作为 artifact 覆盖代理：
- 2026-06-22 10:13（b14e1ca）：6 个 gcl-research 文件创建
- 2026-06-22 10:45（582cc7a）：gcl-synthesis.md 和 gcl-definition.md 更新（共 6 个文件）
- 所有 13 个自报 gate 事件均发生在 6 个 research artifact 存在之后

由于所有事件均发生在相同的 artifact 覆盖水平下（6 个 gcl-research 文件），无法用时序手段验证 H4 的动态版本（artifact 覆盖在观测期间未变化）。

### 时序 H 值趋势分析

| 日期区间 | 事件 | H 值 | artifact 数 |
|---------|------|------|------------|
| 2026-06-22 14:12 | #1–#6（TASK-141 子任务） | 全部 H=1 | 6 |
| 2026-06-23 03:53 | #7–#9（TASK-159、TASK-165） | H=1, H=0, H=0 | 6 |
| 2026-06-23 07:27–08:22 | #10–#12（TASK-166、TASK-167） | H=1, H=0, H=0 | 6 |
| 2026-06-23 15:42 | #13（TASK-170） | H=0 | 6 |

**时序观察**：H 值在两天内从 1（最大值）趋向 0（最小值）。前 6 个事件（2026-06-22）全部为 H=1，后 7 个事件（2026-06-23）中有 5 个为 H=0、2 个为 H=1。这与 H4 动态版本的预测方向**一致**。

然而，artifact 覆盖在此期间保持不变，因此此趋势更可能反映的是：
1. 任务特征的变化（TASK-141 子任务包含 H=1 的"DoD 充分性"判断，而后期任务 DoD 全部为机械可验证命令）
2. reviewer 对 E/H 分类标准理解的变化（后期倾向于将更多前提标记为 E 而非 H）

### 规则类 vs 判断类隐性项比较

从 premise-ledger 内容分析：
- **H=1 的事件**（#1–7, #10）：隐性项通常是"DoD sufficiency: wc -l < 609 as LOC gate is a reasonable proxy but does not prove quality"（TASK-155）或"Absence DoD feasibility"（TASK-166-iter1）——属于**判断类**隐性项
- **H=0 的事件**（#8, #9, #11, #12, #13）：reviewer 认为所有前提已被 E 类或 C 类 artifact 覆盖，无需额外判断——属于**规则类** DoD 的任务

这与 gcl-intervention.md 的 H4 细化裁定一致：规则类隐性项（可通过 artifact 外化的判断标准）在 artifact 增加后确实会消失（H=0），而判断类隐性项（整体质量评估、代理有效性判断）仍然保持 H=1。

---

## 结论

### 偏差方向裁定

**估算 H 系统性高估**：相对于 premise-ledger 自报的 H 值，gcl-corpus.md 中的估算 H 偏高约 1.5 单元（均值 delta_H = −1.46，N=13）。偏差方向一致（所有事件均为负向）。

**解释**：这不完全是估算方法的失败——新一批任务的整体规模（E）和耦合度（C）也比基线语料低得多（E: 6.31 vs 12.3，C: 0.69 vs 4.7）。更小、更自包含的任务自然产生更少的隐性前提。建议：在跨任务规模差异较大的情况下，应按任务规模分层比较 H 值，而非直接用整体均值。

### H4 动态裁定

**H4 部分支持**：观测期内 artifact 覆盖未变化（恒定 6 个 gcl-research 文件），无法通过 artifact 增量验证 H4。然而时序上存在 H=1→0 的趋势（前期高、后期低），与 H4 方向一致。

细化发现（与 gcl-synthesis.md H4 null 裁定一致）：
- **规则类隐性项**（机械可验证的 DoD、明确的文件路径检查）：H=0（已被 artifact 完全外化）
- **判断类隐性项**（DoD 充分性代理合理性、质量判断框架）：H=1（仍需判断者记忆/推断）

### 方法论含义

1. **premise-ledger 自报的 H 值普遍低于估算基线**（0–1 vs 2–3），支持"reviewer 倾向于将更多前提归入 E 类"的观察
2. **H=0 的任务均具备：全 DoD 为 shell 命令、无主观阈值判断**——与 Scope− 策略（收窄 gate 判断面积）的方向一致
3. **样本局限**：所有 13 个事件均为 `plan` gate，均由同一 reviewer 框架（feature-to-backlog/epic-to-backlog）产生，泛化到其他 gate 类型需要更多数据

---

## 数据来源

- 自报数据：`grep -rn 'GCL-self-report' backlog/tasks/` 提取（N=13 行，13 个 gate 事件）
- 基线数据：docs/research/gcl-corpus.md（#2,#5,#8,#10,#13,#16,#19 七个 plan gate 事件）
- 分层统计：docs/research/gcl-baseline.md（plan gate: N=7, H均值=2.0）
- H4 背景：docs/research/gcl-intervention.md, docs/research/gcl-synthesis.md
