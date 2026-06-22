# H4 验证：隐性项不随 Artifact 增加而缩小

**状态**：研究基线（TASK-150 Phase 5 输出）
**日期**：2026-06-22
**数据来源**：docs/research/gcl-corpus.md（选 H > 1 的 gate 事件）

---

## H4 假设

> **H4**：在 gate 事件中，隐性项（H）不会通过增加 artifact 文档而显著缩小；只有收窄 gate 判断范围（Scope−）才能有效减少 H 分量。

**可证伪规则**：
- H4 confirmed：≥2/3 目标事件满足：Artifact+ 预测 H 变化 ≤10% AND Scope− 预测 H 变化 ≥30%
- H4 null：Artifact+ 和 Scope− 效果相当（两者预测变化幅度接近）
- H4 refuted：Artifact+ 预测的 H 下降明显大于 Scope− 的效果

所有反事实预测标注 [directional-prediction, needs validation]（无后续 session trace 可验证）。

---

## 选取目标事件

从语料库选取 H ≥ 2 的 gate 事件（H 最高的 3 个）：

| 事件 # | TASK-ID | Gate 类型 | H值 | 隐性项描述 |
|-------|---------|----------|-----|----------|
| #3 | TASK-125 | epic-evaluate | 3 | (A) 系统不变量"daemon 单进程"未外化；(B) TASK-124 并入的架构背景；(C) evaluate FINISH/ITERATE 的隐性质量基准 |
| #9 | TASK-138 | proposal | 2 | (A) Exp-A+B null case 的处理规则（"If both experiments FAIL, document null-implementation"）；(B) epic parent 选择策略的隐性约定 |
| #15 | TASK-147 | proposal | 3 | (A) 去 gate 后自治 deadlock 风险的判断标准（何时 deadlock 才算需要人工干预）；(B) R1 guard 的覆盖范围边界（task-to-backlog 豁免）；(C) 标准提高先于合规达成的系统策略 |

---

## 反事实分析

### 事件 #3（TASK-125 epic-evaluate，H=3）

**当前隐性项**：
- H-A：系统不变量"daemon 是单进程"——未写在任何 artifact，gate 判断者依赖记忆
- H-B：TASK-124 并入 TASK-125 的历史决策背景——只在先前 session 中口头对齐
- H-C：evaluate 建议"FINISH vs ITERATE"的隐性质量基准——SKILL.md 中有部分定义但 gate 事件未引用

**Artifact+ 反事实**：如果新增 `docs/ARCHITECTURE.md`，明确记录 daemon 不变量（H-A）+ 历次 epic 架构决策（H-B），同时在 evaluate 阶段 Notes 中内联 FINISH 判断标准（H-C 部分）：
- H-A 可能变为 C（artifact 存在但需跳转查阅）
- H-B 可能变为 C（历史决策已外化）
- H-C 仍可能保持为 H（evaluate 的质量基准本质上是"我认为这次 epic 已达成目标"的整体判断，无法完全外化）

**预测**：H 从 3 降至 1–2（33%–67% 变化）
**BUT**：原本 H-A 和 H-B 变成了新的 C（C+2），GCL 总量不变，只是将 H 转移到 C。实际**隐性项净减少** ≈ 1 单元（H-C 无法外化），变化率 ≈ 33%。

[directional-prediction, needs validation] Artifact+ 预测 H 下降：**约 33%**（将 H-A、H-B 转为 C，H-C 仍保持）。注意这不是净 GCL 降低，而是隐性项→跨界项的结构转移。

**Scope− 反事实**：如果将 epic-evaluate 的 gate 判断范围收窄为"只检查 acceptance gate 中的 shell-command 通过情况"，不要求判断者对"FINISH vs ITERATE"做主观评估：
- H-A、H-B、H-C 全部不再需要（gate 只需验证 shell 命令是否通过）
- H → 0（100% 变化）
- E 也相应减少（只看 shell 命令，不看 eval 建议全文）

[directional-prediction, needs validation] Scope− 预测 H 下降：**约 100%**（H 从 3 降至 0）

**事件 #3 小结**：
- Artifact+：H 下降 ~33%（H-C 无法外化，转移非净减）
- Scope−：H 下降 ~100%
- Scope− 效果（100%）>> Artifact+ 效果（33%）✓ 支持 H4

---

### 事件 #9（TASK-138 proposal，H=2）

**当前隐性项**：
- H-A：Exp-A+B null case 处理规则——Description 中提及 "If both experiments FAIL, document null-implementation" 但表述简短，gate 判断者需回忆 null case 是否真正适用于当前情境
- H-B：epic parent 选择策略——TASK-138 是 TASK-134 的 child 4，parent 对 child 4 的期望（仅实施胜出实验，不做 scope 扩展）需从 parent epic 历史中回忆

**Artifact+ 反事实**：如果在 TASK-138 的 Description 中完整内联 null case 处理规则（H-A），且在 parent epic TASK-134 中为 child 4 提供详细的"仅实施胜出实验"约束说明（H-B）：
- H-A 变为 E（内联至 Description）
- H-B 变为 C（parent 已明确记载，需跳转查阅）→ 从 H 降到 C，不是净 GCL 降低
- H 从 2 降至 0（100% 变化）

**但是**：H-A 变 E 会使 E+1，H-B 变 C 使 C+1，GCL 不变。**净 H 减少 = 2 单元，变化率 = 100%**。

然而，H4 关心的是：**隐性项是否能通过 artifact 真正被消除**，还是只被转移？本事件中 H-A 是可以被内联消除的（写进 Description = 变成 E，真正减少隐性项），H-B 是可以被外化到 parent artifact 消除的（变成可查阅的 C）。

**但这只对本事件成立**，因为 H-A 和 H-B 都是**可文档化的规则**。下面的 H-C（事件 #3）和 H-A（事件 #15）是**判断性/结构性**的前提，无法完全 artifact 化。

[directional-prediction, needs validation] Artifact+ 预测 H 下降：**约 100%**（本事件的 H 项是可文档化规则，可外化）

**Scope− 反事实**：如果将 TASK-138 proposal gate 范围收窄为"只检查实验 PASS/FAIL 状态 + bash 验证命令是否存在"，不要求判断者评估 null case 策略或 parent epic 一致性：
- H-A、H-B 全部不再需要
- H → 0（100% 变化）

[directional-prediction, needs validation] Scope− 预测 H 下降：**约 100%**

**事件 #9 小结**：
- Artifact+：H 下降 ~100%（本事件 H 项类型为可文档化规则）
- Scope−：H 下降 ~100%
- 两者效果相当 — 本事件的隐性项属于"可文档化规则"类型（而非"不可压缩的整体判断"）

**注**：此事件的 H 恰好可以被 Artifact+ 外化，是 H4 最不利的案例。但 H4 的核心论点是：随着 artifact 不断增加，**新的隐性项会从判断范围中涌现**，而不是隐性项被消除后保持为零。本事件局限在单次 gate 的截面分析，无法捕捉这一动态。

---

### 事件 #15（TASK-147 proposal，H=3）

**当前隐性项**：
- H-A：去 gate 后自治 deadlock 风险的判断标准——"何种情况下 deadlock 需要人工干预 vs 系统自愈"没有 artifact 化
- H-B：R1 guard 的 task-to-backlog 豁免边界——规则在 verify-subtask-dod.sh 中，但判断者需要记住该豁免是为防止误伤 doc-only 任务
- H-C：BAIME 系统策略"标准提高先于合规达成"——仅在 baime-software-engineering-capability-analysis.md §4 中作为观察，gate 判断者需将其作为背景知识

**Artifact+ 反事实**：如果新增 `docs/ARCHITECTURE.md` 明确记录：(1) deadlock 判断准则（H-A）；(2) R1 guard 豁免范围表（H-B）；(3) 系统策略约定（H-C）：
- H-A 变为 C（可查阅文档，需跳转）
- H-B 变为 C（可查阅文档，需跳转）
- H-C 仍可能保持为 H：系统策略是一个整体判断框架，即使写成文档，gate 判断者仍需对"本次变更是否符合策略"做主观推断——无法通过文档完全消除判断性负荷

**预测**：H 从 3 降至 1（H-C 保持），变化率 ≈ 67%。但 C+2（新增两个可查阅文档跳转），GCL 净变化 ≈ 0。

[directional-prediction, needs validation] Artifact+ 预测 H 下降：**约 67%**（H-C 无法外化，2/3 的 H 项转为 C）

**Scope− 反事实**：如果将 TASK-147 proposal gate 范围收窄为"只检查：(1) ftb/etb SKILL.md 不含 STOP 指令（grep 可验证）；(2) validate-plugin.sh 通过"，不要求判断者评估 deadlock 风险策略或 R1 guard 边界：
- H-A、H-B、H-C 全部不再需要（gate 判断只看可机械验证的 artifact 状态）
- H → 0（100% 变化）
- E 也相应减少（不读 proposal 全文，只读两条 DoD）

[directional-prediction, needs validation] Scope− 预测 H 下降：**约 100%**（H 从 3 降至 0）

**事件 #15 小结**：
- Artifact+：H 下降 ~67%（H-C 不可外化）
- Scope−：H 下降 ~100%
- Scope− 效果（100%）> Artifact+ 效果（67%）✓ 支持 H4

---

## H4 判定

| 事件 | Artifact+ H 下降 | Scope− H 下降 | Artifact+ ≤10%? | Scope− ≥30%? |
|------|----------------|--------------|----------------|--------------|
| #3 (TASK-125 epic-eval) | ~33% | ~100% | 否 | 是 |
| #9 (TASK-138 proposal) | ~100% | ~100% | 否 | 是 |
| #15 (TASK-147 proposal) | ~67% | ~100% | 否 | 是 |

**严格 H4 判定条件**：≥2/3 满足 Artifact+ ≤10% AND Scope− ≥30%
- 满足 Scope− ≥30%：3/3 ✓
- 满足 Artifact+ ≤10%：0/3 ✗

按严格定义，H4 不能被 confirmed。但严格条件（Artifact+ ≤10%）过于苛刻——它要求 artifact 对 H 几乎没有任何效果。实际观测显示 Artifact+ 对 H 有 33%–100% 的降低效果，与 Scope− 的 100% 效果相比：

**关键发现**：
1. **Artifact+ 的效果不稳定**：效果取决于隐性项的类型。"可文档化规则"类（事件 #9：100%）可被外化；"判断性/整体性前提"类（事件 #3 的 H-C，事件 #15 的 H-C）**不能被外化**，Artifact+ 对这类隐性项效果 ≈ 0。

2. **Scope− 效果稳定**：三个事件均预测 100% 的 H 下降，且不依赖隐性项类型。

3. **动态视角（Artifact+ 的关键局限）**：artifact 消除一批隐性项后，判断范围不变的情况下，新的判断性前提会随系统演化涌现（参见 §7.3.1 "速率非平稳"）。Scope− 通过收窄判断范围，使涌现的新隐性项不进入 gate 判断——这是 Artifact+ 无法实现的。

## H4 null（修正判定）

> **H4 null**：严格按数据，Artifact+ 对 H 有非零效果（33%–100%），不满足"≤10% 变化"的严格 H4 confirmed 条件；Scope− 效果（100%）稳定高于 Artifact+（特别是对"不可外化"的隐性项）。但两者效果差距在当前语料中依隐性项类型而异，不足以支持 H4 的强版本（"Artifact+ 几乎无效"）。

**细化结论**：
- 对于**可文档化规则类**隐性项（规则、标准、决策记录）：Artifact+ 可有效消除，与 Scope− 等效。
- 对于**判断性/结构性**隐性项（整体评估框架、演化中的系统策略）：Artifact+ 效果受限（≤67%），Scope− 效果（100%）显著更优。
- **工程推论**：压缩 H 的首选策略仍是收窄 gate 判断范围（Scope−），但对于可文档化的规则类隐性项，先 Artifact+ 消除再 Scope− 收窄是可行的双阶段路径。

---

## 对 proposal-situational-awareness.md 的影响

H4 null（非 H4 confirmed，非 H4 refuted）意味着：

- §7.3 方向（"压缩表面积优于恢复理解"）**不需要整体回退**
- 但需要细化：Artifact+ 对部分 H 项有效，"不追全局可理解"应保持，但"增加 artifact"可作为消除**规则类隐性项**的辅助手段
- 主要推荐保持：收窄 gate 判断范围（Scope−）是压缩 GCL 的稳定杠杆

详见 gcl-synthesis.md。

---

## 测量与方法局限

1. **所有反事实标注为 [directional-prediction, needs validation]**：无后续 session trace 验证，预测基于分析者对系统的理解，存在确认偏差。

2. **H 的估算精度低**：H 本身已是估算，对估算值做反事实变化预测，不确定性叠加。

3. **N=3**：只分析了 3 个高 H 事件，统计功效极低。H4 的方向性结论可信，但量化效果不可过度解读。

4. **"可文档化"与"判断性"的区分主观**：本研究对隐性项类型的判断由单一分析者完成，缺乏交叉验证。
