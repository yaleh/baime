# Gate 理解负载（GCL）操作化定义

**状态**：研究基线（TASK-150 Phase 1 输出）
**日期**：2026-06-22
**依据**：docs/baime-software-engineering-capability-analysis.md §7.3.1–7.3.2

---

## 概念动机

随着 BAIME loop-backlog 自治深化，人类角色从 throughput 贡献者转为 gate 判断者（§7.3）。"可理解"与"可靠"在全局层面已解耦：全局可理解有内生障碍（无稳定参照系、观察者在系统内部、速率非平稳、叶子不透明），而可靠是可经验确立的行为属性。

由此引出工程问题：**人为了做出可靠的 Yes/No gate 判断，究竟需要理解多少？** Gate 理解负载（GCL，Gate Comprehension Load）是这个问题的操作化度量。

---

## GCL 定义

**Gate 理解负载（GCL）**：在一次 gate 事件中，判断者为做出可靠 Yes/No 决策所必须读取、持有或推断的认知单元（cognitive units）总数。

**认知单元（cognitive unit）**：gate 判断中被独立访问或推断的结构化信息块，例如：
- 一条 DoD 条目
- 一个 Plan Phase 描述
- 一次对外部文档或任务的引用（需要跳转查阅）
- 一条不在任何 artifact 中但判断所需的前提知识

**GCL 边界**：测量范围是 gate 判断开始到 Yes/No 输出之前的认知工作。不包括执行阶段后验证、不包括判断者的背景知识（仅计其被迫**主动调取**的内容）。

**公式**：
```
GCL = 显性项(E) + 跨界项(C) + 隐性项(H)
```

---

## 显性项（Explicit Items, E）

### 定义

显性项是判断者可以直接从**本任务自身 artifacts**（task `.md` 文件的 Description、Implementation Plan、DoD 字段）读取的认知单元。无需跳转，无需推断。

### 可观测代理

- DoD 条目数：`grep -c '- \[' task.md` （每条 checkbox = 1 unit）
- Plan Phase 数：`grep -c '^## Phase' task.md`（每个 Phase header = 1 unit）
- Description 段落数：Description 字段中的自然段落数

### 测量方式

从 backlog task `.md` 提取：
```bash
# DoD 条目
dod_count=$(grep -c '- \[' "$task_file")
# Plan Phases
phase_count=$(grep -c '^## Phase' "$task_file")
# Description 段落（以空行分隔）
desc_paragraphs=$(awk '/SECTION:DESCRIPTION:BEGIN/,/SECTION:DESCRIPTION:END/' "$task_file" | grep -c '^[A-Za-z0-9\*\-]')
E = dod_count + phase_count
```

**决策**：本研究以 DoD 条目数 + Plan Phase 数为显性项主指标（两者最能代表判断者需要在大脑中持有的核心结构），Description 段落作为补充但不纳入主计数。

---

## 跨界项（Cross-boundary Items, C）

### 定义

跨界项是 gate 判断中必须参考的**来自本任务 artifacts 之外**的信息单元。包括：
- 父 Epic 的计划或 acceptance gate（child task 判断需要）
- 兄弟任务的结果（实验结论、依赖任务输出）
- 共享基础文档（SKILL.md、validate-plugin.sh 契约定义）
- 外部实验结果文件（`docs/experiments/exp-a-*.md`）

### 可观测代理

- 任务描述或计划中显式引用的外部文件/任务数：`grep -oE 'TASK-[0-9]+(\.[0-9]+)?|docs/[a-z/.-]+\.md' "$task_file" | grep -v "^TASK-ID$" | sort -u | wc -l`
- 父任务存在时：+1（需要读父任务的 acceptance gate）
- 依赖字段（`dependencies:` YAML 字段）非空时：+len(dependencies)

### 测量方式

```bash
# 跨任务引用
cross_task=$(grep -oE 'TASK-[0-9]+(\.[0-9]+)?' "$task_file" | grep -v "^${TASK_ID}$" | sort -u | wc -l)
# 跨文档引用（外部 .md 文件）
cross_doc=$(grep -oE 'docs/[a-z_/-]+\.md' "$task_file" | sort -u | wc -l)
# 父任务
has_parent=$(grep -q 'parent_task_id:' "$task_file" && echo 1 || echo 0)
C = cross_task + cross_doc + has_parent
```

---

## 隐性项（Hidden Items, H）

### 定义

隐性项是 gate 判断中被援引但**不存在于任何 artifact** 中的前提知识——必须从判断者的记忆或先前会话中主动回忆，或从系统行为推断。

典型来源：
- 系统不变量（"daemon 是单进程，不得拆分"）——未写在任何可见文档中
- 历史决策背景（"我们选择 A 而非 B 的原因"）——只在会话记忆中
- 隐式质量基准（"APPROVED 的标准是什么"）——在 SKILL.md 中但 gate 事件未显式引用
- 架构约束（当前哪些文件不能动）——未外化为 artifact

### 可观测代理

隐性项难以从静态 artifact 提取，需通过以下方式逼近：

1. **负空间法**：gate 判断所需的全部前提 - 显性项 - 跨界项 = 隐性项候选
2. **引用追踪法**：查看实现笔记（Implementation Notes）中出现的判断理由，如果某理由无法在任何引用的 artifact 中找到对应内容，则计为 1 隐性项
3. **会话上下文法**（最可靠但需 meta-cc）：从会话 transcript 中提取判断者引用的信息，未被 artifact 锚定的计为隐性项

**本研究的测量降级**：因为 meta-cc session trace 在此研究语境中不可用，所有隐性项计数基于**方法 1 + 2 的保守估算**，并标注为 `[estimated: 负空间+引用追踪]`，除非有直接证据标注为 `[measured]`。

### 测量方式

```
H = max(0, required_premises - E - C)
```

其中 `required_premises` 由分析者在阅读 gate 事件全部可用 artifact 后，列出判断所需的每条前提，计总数。

---

## 测量程序

一次 GCL 测量的标准步骤：

### Step 1：确认 gate 事件
- 指定 gate 类型（proposal review / plan review / merge decision / DoD evaluation / epic evaluate）
- 确认 gate 时间点（从 Implementation Notes 的 "APPROVED" / "claimed" / "Completed" 时间戳）
- 确认判断者（human / automated guard）

### Step 2：收集 gate 时刻可见的 artifacts
- 主任务 `.md` 文件（含 Description、Plan、DoD、Notes）
- 显式引用的外部文件（按跨界项定义列出）
- 父任务 `.md`（如存在 parent_task_id）

### Step 3：计算 E（显性项）
- 统计 DoD 条目数
- 统计 Plan Phase 数
- E = dod_count + phase_count

### Step 4：计算 C（跨界项）
- 统计任务文件中的跨任务引用（不含自身 ID）
- 统计跨文档引用（外部 .md）
- 加父任务存在标志（0 或 1）
- C = cross_task + cross_doc + has_parent

### Step 5：估算 H（隐性项）
- 列出 gate 判断所需的全部前提（阅读全部 artifacts 后）
- 计 required_premises
- H = max(0, required_premises - E - C)
- 标注 `[estimated: 负空间+引用追踪]`

### Step 6：记录 GCL
```
GCL = E + C + H
```
标注每个分量的测量方法和置信度。

---

## 操作化约束与范围限制

1. **测量精度**：E 和 C 可从 artifact 机械计算（高置信度）；H 依赖人工判断（低精度，高不确定性）。GCL 总量的精度受 H 的估算质量主导。

2. **gate 类型差异**：不同 gate 类型的认知负载结构不同。proposal review 的显性项主要是 Description；DoD evaluation 的显性项主要是 DoD 条目。跨类型比较时需控制 gate 类型。

3. **判断者差异**：人类判断者与自动化 guard 的"理解需求"不同（自动化 guard 无隐性项）。本研究聚焦人类 gate 判断者。

4. **artifact 截面**：GCL 测量需指定 artifact 截面时间点（gate 事件发生时的版本），而非当前版本。对于已完成任务，使用 git log 确认 gate 时刻前最近一次 commit 的版本。

5. **认知单元粒度**：本定义将"一条 DoD 条目"和"一个 Phase header"定为等价的 1 单元，这是操作性简化。更精细的加权（按信息量/复杂度）需要额外研究。

6. **范围排除**：
   - 不测量判断者的背景知识（只测需主动调取的内容）
   - 不测量执行阶段（只测 gate 决策时刻）
   - 不测量自动化 CI 检查（只测人类认知工作）
