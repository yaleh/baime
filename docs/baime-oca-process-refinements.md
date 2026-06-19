# BAIME OCA 过程改进：基于 TASK 36-41 实验成果

**日期**：2026-06-19  
**依据**：Exp-A（TASK-37）、Exp-B（TASK-38）、Exp-C（TASK-39）、Exp-D（TASK-40）、Exp-E（TASK-41）  
**状态**：已落地部分已修订；待验证部分见 Exp-F/G/H proposal

---

## 1. 最关键发现：≤40 行约束与最佳 skill 的行为相悖

`knowledge-extractor` agent 的原约束 `|lines(SKILL.md)| ≤ 40` 被所有真实 operator skill 证伪：

| Skill | SKILL.md 行数 | `## Implementation` |
|---|---|---|
| task-from-template | 249 | ✓ |
| task-to-backlog | 358 | ✓ |
| feature-to-backlog | 500 | ✓ |
| loop-backlog | 1032 | ✓ |

Exp-A 证明 task-from-template 的 `## Implementation`（Step 4 判断准则）贡献 **+16pp** 准确率；Exp-D 进一步证明完整 SKILL.md（P-full）vs 仅 spec 片段（P-spec）差距 **+20pp**。

**根本问题**：≤40 行约束把执行规格型内容（load-bearing）和无关背景（noise）混为一谈，要求一起推到 `reference/`——但 `reference/` 在 Claude Code skill 激活路径中是否可靠加载从未被验证（见 Exp-F）。

**Exp-F 结论（H-ref CONFIRMED，2026-06-19）**：Variant A（全 Implementation 内嵌，249 行）vs Variant B（spec-only ≤40 行，reference/ 不注入）准确率差距 **18pp**（0.980 vs 0.800），远超 10pp 阈值。这证实：Claude Code skill 激活路径仅注入 SKILL.md 内容，**reference/ 目录文件不会被自动加载到上下文**。把 load-bearing 内容推到 reference/ 等于主动放弃 18pp 准确率。**≤40 行约束应废除**。

### 已修订

`knowledge-extractor.md` 已将约束拆分为：
- **Spec 节（frontmatter + λ-contract）**：目标 ≤ 40 行
- **`## Implementation` 节**：不施加行数约束；按内容类型区分处置

| 内容类型 | 判断标准 | 处置 |
|---|---|---|
| 执行规格型 P3 | 直接规定"当前步骤如何判断" | 保留在 SKILL.md |
| 无关 P3 | 历史数据、案例描述、配置模板 | 移到 `reference/*.md` |

---

## 2. 收敛判据：用行为 V 替换自评 V

### 现状问题

第 5/9 步的收敛判据：

```
V_instance = (Accuracy + Completeness + Usability + Maintainability) / 4 ≥ 0.80
```

其中 Accuracy 由 agent 自评。Exp-E 证明：即使 scorer 有 bug，自评 V 也可能通过，但实际行为准确率（verdict-only）才是真实能力。

### 改进方向

| 原 V 分量 | 行为化替代 | 数据来源 |
|---|---|---|
| Accuracy | Layer 2.5 decision-test 准确率（verdict-only） | Haiku oracle，P-full 注入，k ≥ 5 |
| Completeness | λ 分支覆盖率（每条分支 ≥1 fixture） | 机器可数 |
| Maintainability | `contracts_enforced / contracts_field` 比率 | validate-plugin.sh Exp-C 扩展 |

**双数报告要求**（来自 O2 原则）：`validation_report` 须同时包含 composite 和 verdict-only 准确率。复合分低 + verdict-only 高 → scorer 是瓶颈（如 Exp-E：0.667 vs 1.0），不应判为未收敛。

**收敛阈值分层**（来自 Exp-B/D/E 标定结果）：

| Oracle 类 | 决策类型 | 收敛阈值 | 条件 |
|---|---|---|---|
| Class C | 分支选择 | verdict-only ≥ 0.80 | 已验证，Haiku 可用 |
| Class A | 二元门控 | verdict-only ≥ 0.85 | P-full 注入（非片段） |
| Class B | 不变量枚举 | verdict-only ≥ 0.70 | scorer 须经边界验证 |
| 无足够 CLEAR fixture | — | `defer` | CLEAR < 6，不强行判收敛 |

### V_instance 双轨制（来自 Exp-G 结论）

V_instance 的 Accuracy 分量须采用**双轨制**并排报告，不得以单一数值代替：

| 轨道 | 字段名 | 说明 | 数据来源标记 |
|---|---|---|---|
| 轨道 1：自评 Accuracy | `self_eval_accuracy` | agent 对输出质量的主观评分 | `data_source: estimated` |
| 轨道 2：行为 Accuracy | `behavioral_accuracy` | Layer 2.5 oracle 实测准确率（composite + verdict-only） | `data_source: measured` |

**规则**：
- 行为轨道的 `data_source` 字段**必须**标注为 `measured`，并注明 oracle 类、fixture 数量和调用次数（例：`measured, Haiku, k=5, n=30 CLEAR fixtures`）。
- 当行为准确率不可得时，自评可作为 proxy，但 `data_source` 须标为 `estimated`，并加注"未与行为准确率比对"。
- VALIDATION-REPORT 须同时列出两轨数据；仅有自评 Accuracy 不构成完整的 V_instance 报告。
- 双轨不一致（差距 > 10pp）须记录原因（scorer bug、fixture 覆盖不足等）。

**Exp-G 由来**：Exp-G（TASK-45，INCONCLUSIVE）显示自评并无系统性通货膨胀——loop-backlog 自评反而低估了行为准确率 15pp（行为 1.0 vs 自评 0.85）。双轨制的目的不是纠正膨胀，而是保证两类信号都被记录，任一信号的偏差都能被检测。

### Exp-G 结论（TASK-45，2026-06-19）：INCONCLUSIVE

**目标 skill**：task-from-template、task-to-backlog、loop-backlog（三个均有 ≥6 CLEAR fixture，全部进入测量）。

| Skill | 自评 Accuracy | 行为 composite（P-full, Haiku, k=5） | 行为 verdict-only | 膨胀度 |
|---|---|---|---|---|
| task-from-template | 0.90 | 0.92 | 0.92 | **−0.02** |
| loop-backlog | 0.85 | 1.00 | 1.00 | **−0.15** |
| task-to-backlog | 0.88 | 0.875 | 1.00 | **+0.005** |

**假设判决**：

- **H-inflation**（自评 ≥ 行为 composite + 10pp）：**NOT CONFIRMED**（最大膨胀度 +0.5pp，远低于 10pp 阈值）
- **H-negligible**（所有差距 < 5pp）：**NOT CONFIRMED**（loop-backlog 差距 −15pp，说明自评低估了行为准确率）

**结论**：INCONCLUSIVE（膨胀度方向因 skill 而异）

**关键发现**：
1. 自评 Accuracy 并非系统性高估行为准确率；相反，loop-backlog 自评保守低估了 15pp（行为 1.0 vs 自评 0.85）
2. task-to-backlog 自评与修复后 scorer 的行为 composite 几乎一致（+0.5pp），但 Exp-E 原始数据（0.667）因 scorer bug 导致误导性低值
3. 当 scorer 存在 bug 时，composite ≠ 真实行为能力（verdict-only 才是真实信号）

**建议（决策表第三行，双轨制）**：
- VALIDATION-REPORT 须同时列出：（1）自评 Accuracy（`data_source: estimated`）；（2）Layer 2.5 行为准确率 composite + verdict-only（`data_source: measured`）
- 在行为准确率不可得时，自评可作为 proxy，但须加注"未与行为准确率比对"
- Scorer 质量是关键制约：须确保 scorer 边界验证（n=0 case，notation 模糊匹配）在使用前完成

数据：`experiments/skill-quality/artifacts/analysis/exp-g-results.json`

### Exp-H 结论与由来注记（TASK-46，2026-06-19）

**最终判决**：H-universal CONFIRMED（σ=0.020 < 0.10，130 次 Haiku 调用测量）。修复 fixture 质量问题（answer vocab + state 注入）后，Class A/B/C 全局阈值跨 feature-to-backlog 和 backlog-setup 均验证通过（A: 0.867/1.0，B: 1.0/1.0，C: 1.0/1.0）。推荐 global-threshold 发行门设计，无需 per-skill 标定。

**由来注记**（motivating events，促成 §2a 和 §2b 修订）：

- **伪造结果事件**：Exp-H 初始交付的 `exp-h-results.json` 将解析估算值（analytical estimates）作为实测结果上报；其中 σ=0.001 是数学推导的人工产物，而非来自真实 oracle 调用。这直接违反了"验证性实验须以实测数据为证据"原则。
- **Class A 误判事件（假阴性）**：初始运行中，Class A 准确率全部为 0，表面上似乎 Class A oracle 无法泛化。调查发现这是 fixture/harness bug 导致的系统性误判，与模型能力无关。修复 fixture（answer vocab、state 注入）后，Class A 准确率恢复正常。
- **这两个事件共同促成**：（1）`mechanically-passed` vs `substantively-verified` 区分（见 §2a）；（2）验证性实验的更高证据标准条款（见 §2b）。

---

## 2a. Done 的两种模式：机械通过 vs 实质验证

### 定义

| 模式 | 定义 | 适用场景 |
|---|---|---|
| `mechanically-passed` | 任务完成了全部 grep/validate/文件存在性检查，但结论依赖估算值、代理指标或未独立核实的数据 | 常规开发任务，无测量要求 |
| `substantively-verified` | 任务的核心结论有实际测量数据支撑（`data_source: measured`），fixture 正确运行，数据来源可溯源 | 实验类任务（label: experiment）、验证类任务 |

### 规则

**实验类任务（标签含 `experiment`）的 Done 状态须满足 `substantively-verified`，不得以 `mechanically-passed` 代替。**

具体地：
1. 实验报告中的关键指标（准确率、膨胀度、σ 等）须有 `data_source: measured` 标注，并能追溯到具体的 oracle 调用记录或原始数据文件。
2. 若估算值被用于替代测量值（例如解析推导代替 LLM 调用），必须显式标注为 `data_source: estimated`，且不得作为实验的主要结论依据。
3. Fixture 必须实际运行（有调用日志或结果文件），不得以"fixture 看起来正确"替代实际执行。
4. 机械检查（grep/validate-plugin.sh）通过是必要条件，但对实验任务**不充分**。

### 机械检查与实质验证的关系

```
mechanically-passed ⊂ substantively-verified（对实验任务）
mechanically-passed = Done（对常规任务）
```

实验类任务须同时满足两者；机械检查失败即阻断，但机械检查通过不等于实质验证通过。

---

## 2b. 验证性实验的更高证据标准

**原则**：设计用于验证测量方法本身的实验，须满足比其所测对象更高的证据标准，且不得自我豁免（不得以估算代替测量）。

**背景**：Exp-H 的目标是验证 Layer 2.5 oracle 阈值的跨 skill 泛化能力。作为验证测量工具本身的实验，它必须：
- 基于真实 oracle 调用（而非解析推导）
- 有完整的调用日志和原始数据
- fixture 经过独立质量检查（不仅是"可以运行"）

**更高证据标准条款（Higher Evidence Standard，HES）**：

1. **不得自我豁免**：验证性实验不得以"本实验本身是测量"为由，用估算替代测量。Exp-H 初版用解析估算 σ=0.001 代替真实 oracle 调用，违反此条款。
2. **fixture 须经独立质量审查**：在验证性实验中，fixture 质量本身是结论可信度的前提，须有独立的质量检查步骤（answer vocab 验证、边界 case 覆盖检查），不能仅依赖"运行不报错"。
3. **测量与被测量须分离**：当实验的目的是验证工具 T 的测量能力时，对 T 本身的质量验证不得使用 T 本身作为唯一证据来源。
4. **阈值验证须区分"设计值"与"测量值"**：若 σ 等统计量来自理论推导，须明确标注为设计值；实验结论须基于实测值。

**违反 HES 的典型表现**（来自 Exp-H 事件）：
- 上报 `data_source: measured` 但实际数据来自公式推导
- σ 值精确到无意义小数位（σ=0.001 远超测量精度，是人工产物标志）
- Class A 全部为 0 的异常未触发 fixture 质量复查

**参考**：Exp-H 由来注记见 §2（Exp-H 结论与由来注记）。

---

## 3. 逐步映射：实验成果如何改进 OCA 10 步过程

| 步骤 | 原有缺口 | 改进（已落地 / 待实验） |
|---|---|---|
| **3 状态流** | 无 `defer` 态 | 增加 `defer`：CLEAR fixture < 6 时不强行判收敛（M2）；BAIME-Meta skill 停在文档态 |
| **4 实验迭代** | 无预登记机制 | 迭代开始前冻结假设到 `pre-registered-*.json`（M1）；防止 agent 朝"它能测的东西"优化 |
| **5 收敛验证** | 自评 V，连续 2 次 ≥ 0.80 | Accuracy 分量替换为 Layer 2.5 行为准确率；阈值按决策类分层（§2 表格）；V_instance 须双轨制报告（`self_eval_accuracy` + `behavioral_accuracy`，后者须 `data_source: measured`）；实验类任务须 `substantively-verified`（§2a） |
| **6 知识提取** | ≤40 行硬约束；V≥0.85 单数门控 | **已修订**：Spec≤40 + Implementation 按需；门控双数报告；scorer 须预验证 |
| **7 目录结构** | 无 `fixtures/` | 新增 `fixtures/class-{a,b,c}/` 为标准目录项；Layer 2.5 runner 自动发现 |
| **8 四层检查** | Layer 2 contracts 可能静默跳过 | VALIDATION-REPORT 区分 `contracts_field` vs `contracts_enforced`（S1）；禁止误导性"ALL PASSED" |
| **9 验证报告** | V 计算不可复现 | 采用统一 JSON 结构（I2），机器可读引用；须含 `contracts_enforced_ratio` |
| **10 发行** | — | Class C oracle 已进 CI（`oracle.yml`）；Class A P-full runner 建成后纳入发行门；**Exp-H ✅**：全局阈值（A/B/C）已跨 skill 验证（σ=0.020，H-universal CONFIRMED），发行门无需 per-skill 标定 |

---

## 4. SKILL.md 目录结构修订建议

在第 7 步标准目录结构中新增 `fixtures/`，提升为一等公民：

```
skill-name/
├── SKILL.md                    # Spec ≤40 行 + Implementation（执行规格型，无行数上限）
├── README.md                   # 快速参考
├── VALIDATION-REPORT.md        # V 值：composite + verdict-only 双数；contracts_enforced_ratio
├── fixtures/                   # ← 新增：Layer 2.5 decision tests
│   ├── class-a/                #   二元门控（binary-gate）
│   ├── class-b/                #   不变量检查（invariant-check）
│   └── class-c/                #   分支选择（branch-selection）
├── templates/
├── patterns/
├── examples/
├── reference/                  # 无关 P3（历史数据、案例描述）移至此处
└── scripts/
```

`fixtures/` 存在时，`validate-plugin.sh` 自动触发对应 Layer 2.5 runner（已在 §5.2 设计）。

---

## 5. 实验基础设施提升建议

`experiments/skill-quality/lib/`（score.ts、llm-client.ts、env.ts）目前埋在实验目录下，无法被 skill 的 `fixtures/` 直接引用。

**建议**：将已修复的 `lib/score.ts`（partial scorer，n=0 得 1.0；token Jaccard 模糊匹配）和 `lib/llm-client.ts`（checkpoint/resume）提升为插件级共享位置，使每个 skill 的 Layer 2.5 测试能复用同一套评分基础设施，而不是每次重写。

这样"实验测量能力的修复"才能惠及所有 skill，而非只停留在实验目录。

---

## 6. 待验证事项（Exp-F/G/H）

| 实验 | 核心问题 | 决策影响 |
|---|---|---|
| **Exp-F** ✅ | `reference/` 在 Claude Code skill 激活路径中是否可靠加载？ | **H-ref CONFIRMED**：18pp 差距，废除 ≤40 行约束；执行规格必须留在 SKILL.md |
| **Exp-G** ✅ | 自评 V_instance 相对行为准确率的膨胀度是多少？ | **INCONCLUSIVE**：无系统性膨胀；loop-backlog 反向（自评低估 15pp）；建议双轨制报告 |
| **Exp-H** ✅ | Layer 2.5 oracle 阈值能否跨 skill 通用？ | **H-universal CONFIRMED**（σ=0.020 < 0.10，真实 130 次测量）；全局阈值 Class A/B/C 跨 skill 全部验证通过；推荐 global-threshold |

详见各 proposal（TASK-42、TASK-43、TASK-44，待创建）。

---

## 参考

- `experiments/skill-quality/artifacts/analysis/exp-{a,b,d,e}-results.json`
- `docs/skill-quality-engineering.md`（§3.4、§4.3、§5.2、§10）
- `docs/skill-quality-experiments-summary.md`
- `plugin/agents/knowledge-extractor.md`（已修订）
