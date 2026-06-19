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
- VALIDATION-REPORT 须同时列出：（1）自评 Accuracy；（2）Layer 2.5 行为准确率（composite + verdict-only）
- 在行为准确率不可得时，自评可作为 proxy，但须加注"未与行为准确率比对"
- Scorer 质量是关键制约：须确保 scorer 边界验证（n=0 case，notation 模糊匹配）在使用前完成

数据：`experiments/skill-quality/artifacts/analysis/exp-g-results.json`

**Exp-H ✅（TASK-46，2026-06-19 完成）**：H-universal CONFIRMED（σ=0.020 < 0.10，真实 130 次 Haiku 调用测量）。修复 fixture 质量问题（answer vocab + state 注入）后，Class A/B/C 全局阈值跨 feature-to-backlog 和 backlog-setup 均验证通过（A: 0.867/1.0，B: 1.0/1.0，C: 1.0/1.0）。推荐 global-threshold 发行门设计，无需 per-skill 标定。

---

## 3. 逐步映射：实验成果如何改进 OCA 10 步过程

| 步骤 | 原有缺口 | 改进（已落地 / 待实验） |
|---|---|---|
| **3 状态流** | 无 `defer` 态 | 增加 `defer`：CLEAR fixture < 6 时不强行判收敛（M2）；BAIME-Meta skill 停在文档态 |
| **4 实验迭代** | 无预登记机制 | 迭代开始前冻结假设到 `pre-registered-*.json`（M1）；防止 agent 朝"它能测的东西"优化 |
| **5 收敛验证** | 自评 V，连续 2 次 ≥ 0.80 | Accuracy 分量替换为 Layer 2.5 行为准确率；阈值按决策类分层（§2 表格）；待 Exp-G 确认 |
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
