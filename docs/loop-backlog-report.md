# loop-backlog 机制在 AI 辅助软件开发中的作用

> 报告版本：v1.0  
> 日期：2026-06-25  
> 项目：baime（Bootstrapped AI Methodology Engineering）

---

## 第一章：问题背景——AI 辅助开发中的协作断层

随着大语言模型能力的快速提升，AI 辅助软件开发已从"补全代码片段"进化到"自治执行任务"。然而，在这一进化过程中，一个结构性的协作断层逐渐浮现：**人类开发者与 AI 执行代理之间缺乏可靠的任务协调机制**。

传统软件开发中，任务管理靠 GitHub Issues、Jira 等平台。人类指派任务后，开发者轮询这些平台获取工作。当 AI 代理取代人类成为执行主体时，"任务如何从计划流转到执行"这一问题变得非常迫切：

1. **轮询成本问题**：若让 AI 代理每隔一段时间检查有无新任务，就必须反复调用 LLM，而大多数轮询是徒劳的——队列为空，没有实际工作。以 baime 项目早期实现为例，`ScheduleWakeup` 每 120 秒触发一次 Claude 调用，空闲时每小时产生约 30 次无效调用，仅 overhead 就消耗了可观的 token 成本。

2. **响应延迟问题**：时间驱动触发与事件驱动需求之间存在本质错配。当开发者将一个任务设为 Ready 状态后，AI 代理最多需要等待 120 秒才能被唤醒并领取任务，严重降低了开发流程的流畅性。

3. **状态一致性问题**：多个 AI 代理会话并发运行时，若缺乏协调机制，同一任务可能被多个代理同时领取，产生竞态条件。更隐蔽的问题是旧的监听进程（Monitor）未被清理，导致同一事件被多次触发，任务被重复处理。

4. **跨项目移植难题**：不同项目的任务 ID 格式各异（如 baime 使用 `TASK-N`，archguard 使用 `task-N`），若协调机制依赖硬编码的 ID 格式，则无法跨项目复用。

5. **会话恢复问题**：当用户执行 `/clear` 重置对话上下文后，AI 代理需要重新感知当前看板状态，了解哪些任务仍然 actionable，而不是从零开始扫描历史日志。

这些问题共同构成了 AI 辅助开发中的"协作断层"——AI 代理的执行能力足够强大，但任务调度与协调的基础设施严重滞后。loop-backlog 机制正是为填补这一断层而设计的系统性解决方案。

---

## 第二章：loop-backlog 的设计与演化

loop-backlog 从一个简单的任务轮询脚本，经过数次架构迭代，演化为一个具备事件驱动、双泳道、跨项目支持能力的统一自治工作者框架。

### 2.1 第一代：ScheduleWakeup 轮询模型

最初的 loop-backlog 使用 Claude Code 的 `ScheduleWakeup` 原语，每隔 120 秒唤醒自身，调用 `backlog task list` 检查是否有 Ready 任务。这种方案简单可行，但存在第一章描述的所有问题。本质矛盾在于："是否有新 Ready 任务？"这一问题的答案只在任务文件被编辑时才会改变，而 ScheduleWakeup 是时间驱动机制，对文件变化一无所知。

### 2.2 第二代：daemon + Monitor 事件驱动架构（TASK-5）

TASK-5 完成了最关键的架构转型：用一个常驻后台 Python daemon 替代 ScheduleWakeup。

**daemon 设计原则**：
- 使用 Python stdlib（无需第三方依赖），500ms 轮询间隔扫描任务目录
- 当发现 `status: Ready` 的新任务时，向 stdout 写出 `task-ready:TASK-X` 事件行
- 通过 `notified` Set 实现边沿触发去重，避免重复发送
- 监听 `.backlog/.loop-stop` 哨兵文件，支持优雅停机
- 记录父进程 PID，父进程退出时自动终止，防止僵尸进程

**loop-backlog skill 更新**：
- 移除 `ScheduleWakeup`，调用 `Monitor` 工具订阅 daemon 的 stdout 流
- Monitor 持久阻塞，直到收到事件行才唤醒 Claude 会话
- 空闲时零 Claude 调用（daemon 本身极低 CPU 开销）
- 任务就绪后 ≤2 秒被发现（较旧机制的 120 秒下降 98%+）

ADR-001 确立了 daemon 脚本的归属原则：`plugin/scripts/basic-daemon.js` 是唯一规范位置，通过全局 npm 路径调用，不写入目标项目，避免污染。ADR-002 则确立了 Monitor 生命周期原则：skill 在创建新 Monitor 之前必须调用 `stopStaleMon()` 清理旧进程，保证单 Monitor 不变量。

### 2.3 第三代：双泳道统一 B″ Worker（TASK-125）

TASK-125 是 loop-backlog 演化中影响最深远的里程碑，它将 Basic 泳道和 Epic 泳道合并为一个统一的 B″ Worker。

在 TASK-125 之前，Epic 类任务（需要分解为子任务的大型任务）由独立的 `loop-meta` 会话处理，两个会话共享 backlog 黑板，复杂度高且协调成本大。TASK-125 将两个泳道统一到一个 Worker 中：

**Basic 泳道（原有）**：
- basic-ready 事件 → 创建 git worktree → 后台 Agent 执行 → DoD 验证 → 合并回 main

**Epic 泳道（新增）**：
- epic-ready 事件 → `epicDecompose()` → 创建子任务 → 状态推进到 "Epic: Awaiting Children"
- child-done 事件 → `onChildDone()` → 所有子任务完成时推进到 "Epic: Evaluating" → 生成 FINISH/ITERATE 建议

daemon 同步升级为五通道版本：`basic-ready`、`epic-ready`、`child-done`、`proposal-approved`、`plan-approved`，覆盖完整的任务生命周期。

### 2.4 第四代：电平触发 pulse（TASK-197）

用户执行 `/clear` 重置对话后，边沿触发机制无法让新会话感知到当前仍然 actionable 的任务（因为这些任务的状态变化已经在历史中发生，不会再次触发边沿事件）。

TASK-197 引入了**电平触发 pulse**：每 60 秒，daemon 无条件把当前所有满足谓词的任务 ID 重新发送一遍，无视 `notified` Set。这使得 `/clear` 后的新会话在最多 60 秒内自动接收到所有 actionable 任务的通知，实现自动 re-attach。

### 2.5 第五代：ADR-009 pulse 谓词自清除约束（TASK-200 前置）

电平触发 pulse 引入了一个新的正确性要求：被 pulse 复发的谓词必须"自清除"——actionable 条件一旦被处理，谓词就不再匹配。原 `child-done` 谓词仅检查"子任务是否 Basic: Done 且有 parent"，而子任务完成是永久终态，导致 pulse 每 60s 把历史上所有已完成子任务都复发一遍，形成无限唤醒循环。这一故障在 baime 和 archguard 两个项目中均被观察到。

ADR-009 修复了这一设计缺陷：child-done 谓词增加门控条件，只有当父 epic 处于 "Epic: Awaiting Children" 状态时才匹配。同时，冷启动策略从"从 checkpoint 重放"改为"从日志 EOF 起，依赖 pulse 重新浮现 actionable 状态"，消除了历史事件的反复调查。

### 2.6 前缀无关 ID 提取（TASK-198）

TASK-198 移除了对 `TASK-` 前缀的硬编码，改为通过路径约束和位置/字段锚定提取任务 ID，使 loop-backlog 能够无缝支持任意前缀格式的项目（如 archguard 的 `task-N` 格式）。

---

## 第三章：在 baime 自身开发中的作用（元递归、GCL 测量）

baime 项目的定义是"Bootstrapped AI Methodology Engineering"——一个用于开发 AI 辅助软件开发方法论的框架。loop-backlog 在 baime 自身开发中承担的角色因此具有独特的元递归（meta-recursive）属性：**这套工具既是 baime 的产出，也是驱动 baime 自身演化的基础设施**。

### 3.1 元递归执行循环

baime 的绝大多数功能增强和研究任务都通过 loop-backlog 自身来执行。例如：

- TASK-176 系列（GCL 完整观测机制，8 个子任务）由 loop-backlog 逐一执行
- TASK-182（meta-cc digest 注入 gate evidence pack）、TASK-183（archguard change-risk 注入 worker context）等改进 loop-backlog 本身的任务，也是通过 loop-backlog 来执行的

这种"用工具改进工具本身"的模式是 baime 方法论的核心体现，也对机制的稳定性提出了更高要求——任何 loop-backlog 的 bug 都会直接阻塞其自身的修复流程。

### 3.2 GCL（Gate Closure Level）测量基础设施

baime 建立了一套 GCL 指标体系，用于量化 AI 代理执行任务时的"门控闭合质量"，衡量 E（Execution）、C（Coherence）、H（Hypothesis）三个维度。loop-backlog 的以下特性直接支撑了 GCL 测量：

- **DoD 验证追踪**：每个任务的 Definition of Done 结果（PASS/FAIL）被结构化记录到任务 notes，形成可分析的审计日志
- **gate evidence pack**：TASK-182 通过注入 meta-cc 会话摘要，在任务执行前为 AI 代理提供丰富的上下文信息，影响 gate 决策质量
- **pre-dispatch enrichment**：TASK-183 将 archguard 的 change-risk 分析注入到任务 claim 时的 worker context，让 AI 代理在执行前了解代码变更风险

这些机制使 GCL 测量从事后分析转变为实时嵌入，每次 gate 事件都产生可机械分析的证据记录。

### 3.3 自改进闭环的实证价值

通过将 baime 自身作为 loop-backlog 的主要实验场，团队积累了大量关于"AI 代理在多大程度上能可靠执行结构化任务"的实测数据。这些数据直接驱动了机制的演化：发现 ScheduleWakeup 的 token 浪费问题（→ TASK-5 替换方案）、发现 Monitor 僵尸进程问题（→ ADR-002 强制清理）、发现 child-done 无限唤醒问题（→ ADR-009 谓词自清除约束）。

---

## 第四章：在 archguard 外部项目的跨项目适用性验证

archguard 是一套面向软件架构分析的 MCP 工具服务，与 baime 是完全独立的项目，有自己的技术栈（TypeScript/Go）、代码库和开发节奏。loop-backlog 在 archguard 中的使用是其跨项目适用性的重要验证。

### 4.1 archguard 中的 loop-backlog 部署

archguard 的 `backlog/tasks/` 目录包含从 TASK-1 到 TASK-23 的任务序列，覆盖了 God Object 拆分、认知分析层、MCP 工具开发等多个功能模块。其中多个任务已通过 loop-backlog 执行完成并合并到主分支。

值得注意的是，archguard 使用全小写 `task-N` 格式（而非 baime 的 `TASK-N`），这正是 TASK-198（前缀无关 ID 提取）的直接驱动因素。在 TASK-198 修复前，loop-backlog 无法正确解析 archguard 的任务 ID，限制了跨项目适用性。

### 4.2 跨项目故障发现：ADR-009 的由来

ADR-009 的上下文中明确记录："这是一个跨项目复现的故障（baime 与 archguard 两个看板都观察到）"。具体表现为：父 epic 已经完成后，daemon 仍然每 60 秒把已完成的子任务作为 child-done 事件复发，AI 代理每次都执行 `onChildDone` 检查，返回 Idle 但消耗一次完整的 model round-trip，**永不停止**。

这一故障的跨项目复现，证明了 loop-backlog 的核心机制（包括其缺陷）在不同代码库和工作流中具有高度的可移植性。同时，修复也必须在 plugin 层面（不在各项目本地）进行，这与 ADR-001 的"daemon 归属 plugin"原则完全一致。

### 4.3 baime-archguard 双向集成

TASK-183（baime 中执行）将 archguard 的 `change-risk` MCP 工具输出注入到 loop-backlog 的任务 claim 阶段。这意味着当 loop-backlog 领取一个任务时，它会调用 archguard MCP 分析相关代码的变更风险，并将风险信息附加到任务上下文中，供执行代理参考。

这种双向集成——baime 的任务调度框架消费 archguard 的架构分析能力——展示了 loop-backlog 作为跨工具协调层的潜力，不仅仅是任务调度系统。

### 4.4 共同基础设施的代价与收益

在 archguard 中运行 loop-backlog 需要安装 baime plugin（`npm install -g`），这增加了一定的依赖复杂度。但换取的收益是：
- 统一的任务调度和 worktree 隔离机制
- DoD 结构化验证
- 跨会话的状态恢复（通过 pulse 机制）
- baime plugin 升级时 archguard 自动获益（ADR-001 的设计初衷）

---

## 第五章：在 meta-cc 项目中的作用

meta-cc 是一套用于分析 Claude Code 会话历史的 MCP 工具服务，提供会话时间线、工作模式、质量扫描等功能。作为 baime 的"观测层"，meta-cc 与 loop-backlog 之间存在独特的双向关系。

### 5.1 meta-cc 中的 loop-backlog 运行证据

meta-cc 代码库的 `.gitignore` 中明确包含了 loop-backlog 的运行时文件（`.monitor-task-id` 等），说明 loop-backlog 在 meta-cc 开发过程中实际运行，而非仅作为文档记录。meta-cc 的任务序列（TASK-1 至 TASK-17）覆盖了会话信号分析、MCP 工具优化、GCL 前提台账等功能，这些任务的执行均通过 loop-backlog 完成。

meta-cc v3.3.14 的最新版本包含了多项与 loop-backlog 协作相关的改进，例如 TASK-13（在 MCP 工具 description 字段嵌入使用指引）和 TASK-14（引入 GCL 前提台账标注格式）。

### 5.2 meta-cc 作为 loop-backlog 的观测层

TASK-182（baime 中执行）实现了将 meta-cc 的会话摘要（session digest）注入到 loop-backlog 的 gate evidence pack 中。这意味着 loop-backlog 在决定是否通过某个门控（gate）时，可以参考 meta-cc 提供的历史会话分析数据，包括：

- 当前工作会话中的错误模式
- 工具调用分布
- 代码编辑序列
- 质量信号

这种集成形成了一个精妙的反馈回路：meta-cc 观测 Claude Code 会话 → 提炼信号 → 注入 loop-backlog gate → 影响任务执行质量 → 产生新的会话数据 → meta-cc 再次观测。

### 5.3 工具化协作模式的示范

meta-cc 与 loop-backlog 的集成展示了一种可扩展的工具化协作模式：专门功能的 MCP 工具（archguard 的架构分析、meta-cc 的会话分析）通过标准化接口注入到 loop-backlog 的执行流程中，而 loop-backlog 本身不需要实现这些专业分析能力。

这种"任务调度框架 + 专业能力插件"的架构，体现了关注点分离的设计原则：loop-backlog 专注于任务生命周期管理，archguard 专注于架构风险评估，meta-cc 专注于会话质量观测，三者通过 MCP 标准协议协作，形成互补的工具生态。

---

## 第六章：机制的核心价值分析

### 6.1 从时间驱动到事件驱动的范式转变

loop-backlog 最根本的贡献是将 AI 代理的任务感知模式从时间驱动（polling）转变为事件驱动（event-driven）。这一转变不仅解决了 token 浪费问题，更重要的是改变了 AI 代理与任务系统的交互语义：

- **时间驱动**：代理定期醒来，问"有任务吗？"——多数时候答案是"没有"
- **事件驱动**：代理持续等待，系统通知"有任务了"——每次唤醒都有实质工作

这一范式转变对于需要长期运行的自治代理系统至关重要。在时间驱动模式下，代理的存在感知本身就有成本；在事件驱动模式下，代理的等待状态是真正的零成本。

### 6.2 双泳道（双泳道）架构对并发复杂度的控制

TASK-125 引入的双泳道统一架构，将 Basic 任务执行和 Epic 任务分解整合到单一的 Worker 会话中。这一设计的价值在于：

- **简化协调**：原来需要 loop-backlog 和 loop-meta 两个会话通过 backlog 黑板协调，现在一个会话统一处理
- **降低状态同步成本**：两个会话并发时面临的竞态条件、状态不一致等问题消失
- **保持扩展性**：五通道 daemon 事件机制为未来增加新任务类型提供了清晰的扩展点

双泳道设计也体现了 baime 的核心理念：**人负责战略决策（将任务提升为 Ready），AI 负责战术执行（在隔离 worktree 中执行并验证）**，层次清晰，职责分明。

### 6.3 ADR 体系对机制演化的约束与导引

loop-backlog 的演化过程产生了多个 ADR（架构决策记录），这些 ADR 不仅记录了决策，还通过 lint 脚本将设计约束编码为可自动验证的规则：

- ADR-001: daemon 不写入目标项目（lint: `grep -rE '\$\{?REPO_ROOT\}?/scripts/basic-daemon'`）
- ADR-002: 单 Monitor 不变量（runtime enforcement）
- ADR-009: pulse 谓词自清除（lint: `grep -q "EPIC_AWAITING_CHILDREN_STATUS"`）

这种"决策即约束、约束即 lint"的模式，确保了机制在演化过程中不会退化回已知的错误状态，是 AI 辅助开发中维护架构意图的一种有效方法。

### 6.4 跨项目可移植性与一致性

loop-backlog 的设计始终以跨项目可移植性为约束条件。ADR-001 的 plugin 归属原则、TASK-198 的前缀无关 ID 提取，以及 SKILL.md 中 `allowed-tools` 的声明式约束，都是为了让相同的机制在 baime、archguard、meta-cc 等不同项目中无缝运行。

这种可移植性的代价是一定的抽象复杂度；其收益是：任何一个项目发现的问题（如 ADR-009 的 child-done bug），修复后所有项目自动受益。

---

## 第七章：局限与未来方向

### 7.1 当前局限

**适用边界的约束**：loop-backlog 最适合"任务结构清晰、DoD 可机械验证、可并行执行"的项目。对于需要大量人机协作的探索性研究任务，或者任务间依赖关系复杂的项目，其自动化收益会显著降低。`proposal-loop-meta-architecture.md` 中明确指出："适用于方法论/自改进系统研究，不适用于普通业务软件"。

**冷启动延迟**：ADR-009 采用"Monitor 从日志 EOF 起"的冷启动策略，换取了零陈旧调查。代价是：epic 泳道的任务在 detach 窗口内变 actionable 时，冷启动后最多需要 60s 才能被 pulse 触达（而非立即）。对于人工 gated 泳道，这是可接受的权衡，但在某些高响应性场景下可能不够。

**评价可靠性**：DoD 验证机制依赖 shell 脚本测试，对于"架构设计质量"、"代码可读性"等无法用脚本量化的验收标准，loop-backlog 无法提供实质性验证，仍需人工判断。

**单点故障**：daemon 进程是整个事件驱动机制的基础。如果 daemon 崩溃且 PID 文件未正确清理（虽然有 liveness 检查机制），可能导致任务通知丢失。当前的 watchdog 机制（Monitor 10 分钟无事件时重启 daemon）提供了一定的容错性。

**并发上限**：`maxParallel` 配置控制并发 agent 数量，但在实践中，多个 worktree 并发修改代码并合并时，合并冲突的频率随并发度上升而增加，实际可用并发度低于理论上限。

### 7.2 未来方向

**更智能的任务优先级**：当前 loop-backlog 按 daemon 事件顺序领取任务，未来可结合 archguard 的变更风险评分和 meta-cc 的会话质量信号，实现智能优先级排序——将高风险、高价值的任务优先调度给最适合的执行上下文。

**评价闭环的完善**：`loop-meta` 提案（已在 TASK-125 中以更轻量形式整合）描述了一个完整的目标分解-执行-评价-重规划循环。目前 Epic 泳道的评价仍然依赖人工确认 FINISH/ITERATE 建议，未来可以引入基于 Layer 2.5 oracle 的自动化切片评价，减少人工介入频率。

**跨项目任务协调**：当前 loop-backlog 在各项目独立运行，项目间没有直接协调机制。未来随着项目数量增加，可能需要一个上层协调层，管理跨项目的资源分配和依赖关系。

**自适应 pulse 间隔**：当前 pulse 固定 60 秒，可以根据历史任务活跃度自适应调整——在高活跃期缩短间隔以降低延迟，在低活跃期延长间隔以减少开销。

**更完整的可观测性**：meta-cc 提供了会话级别的观测能力，但 loop-backlog 内部的执行细节（如每个任务的平均执行时间、DoD 通过率趋势、gate 决策分布）尚未系统化采集。建立结构化的 telemetry 输出，将使 GCL 测量更加全面和精确。

---

## 附录：关键里程碑时间线

| 任务 | 描述 | 关键贡献 |
|---|---|---|
| TASK-5 | daemon + Monitor 替代 ScheduleWakeup | 事件驱动基础架构 |
| TASK-125 | 双泳道统一 B″ Worker | Epic 泳道支持，loop-meta 退役 |
| TASK-182 | meta-cc digest 注入 gate evidence pack | meta-cc 集成 |
| TASK-183 | archguard change-risk 注入 worker context | archguard 集成 |
| TASK-197 | 电平触发 pulse，支持 /clear 后 re-attach | 会话恢复机制 |
| TASK-198 | 前缀无关 task ID 提取 | 跨项目可移植性 |
| ADR-009 | pulse 谓词自清除约束 | 无限唤醒故障修复 |

---

*本报告基于 baime 代码库截至 2026-06-25 的 git 历史、ADR 文档及 proposal 文档撰写。*
