# Skill Quality Experiments Summary

**Period**: 2026-06-19  
**Experiments**: TASK-36（基础设施）、TASK-37（Exp-A）、TASK-38（Exp-B）、TASK-39（Exp-C）  
**Infrastructure**: `experiments/skill-quality/` — TypeScript/tsx，litellm 代理，checkpoint/resume

---

## 实验设计回顾

三个实验围绕 `docs/skill-quality-engineering.md` 提出的三个核心质量主张展开：

| 实验 | 研究问题 | 方法 |
|------|---------|------|
| **Exp-A** | `## Implementation`（P3）内容是否损害 LLM 决策准确率？ | 4 变体消融（V0=Spec only → V3=full+noise）× 10 fixture × 2 model × k=5 |
| **Exp-B** | Haiku 能否作为 Layer 2.5 的自动 Oracle？ | 3 决策类 × 24 fixture × 3 model × k=5，预登记假设 |
| **Exp-C** | validate-plugin.sh Layer 2 contracts 的 FP/FN 率是多少？ | 24 条结构化断言全集，手工标注 + 对立变体构造 |

---

## Exp-A 结果：P3 消融

### 数字

| Variant | Haiku | GLM | 均值 |
|---------|-------|-----|------|
| V0 Spec only | 0.76 | 0.56 | 0.66 |
| V1 V0 + Constraints | 0.80 | 0.52 | 0.66 |
| V2 完整 SKILL.md | **0.92** | **0.72** | **0.82** |
| V3 V2 + 150 行噪声 | 0.90 | 0.68 | 0.79 |

V0/V1 均值 = 0.660，V2/V3 均值 = 0.805，**差距 +14.5pp**

### 假设结果

- **H-P3**（V0/V1 > V2/V3）：**NULL**，方向完全相反
- **H-null**（无显著差异）：**CONFIRMED**（方向层面；未执行 Friedman 统计检验）

### 解释

`## Implementation` 对 freshnessCheck 准确率的贡献来自 Step 4 中的判断准则：

> "Check only what the executor runs, not what those scripts do internally."  
> "Do NOT check files that are only mentioned in descriptive text."

没有这些准则（V0/V1），模型从抽象 Spec 中无法推导出正确的判断策略。V2 中的 Implementation 不是 P3 背景噪声，而是执行规格的一部分。

V3（V2 头部插入 150 行无关噪声）相比 V2 略有回退（Haiku -0.02，GLM -0.04），说明真正无关的噪声确实有轻微代价，但量级远小于 Implementation 内容的收益。

GLM V1 < V0（0.52 vs 0.56）：加了 Constraints 后 GLM 轻微下降，可能是统计噪声（k=5），但提示 GLM 对 Constraints 文本存在某种敏感性。

### 对文档 §3.1 的影响

当前 §3.1 表述：

> "P3 内容不只是零价值的噪声——它是**主动干扰**。"

需修改为区分两种 P3：

- **无关 P3**（历史数据、配置模板、案例描述，与当前执行步骤无关）：是主动干扰，支持原结论
- **执行规格型 P3**（`## Implementation` 中直接规定当前步骤判断准则的内容）：是关键上下文，应保留

---

## Exp-B 结果：Oracle 标定

### 预登记假设

| 类 | 任务类型 | 阈值 | Haiku | 结果 |
|----|---------|------|-------|------|
| **A** | 二元门控（freshnessCheck FRESH/STALE） | ≥ 0.85 | 0.70 | **REJECTED** |
| **B** | 不变量检查（reviewPlan DoD 合法性） | ≥ 0.70 | 0.625 | **REJECTED** |
| **C** | 分支选择（verifyDod checkDod/fix_retry/raise_Stuck） | ≥ 0.80 | **1.00** | **CONFIRMED** |

Sonnet 在 Class C 同为 1.00（Haiku/Sonnet gap = 0）。

### Layer 2.5 建议

```
Class A (freshnessCheck)   → manual-review   （Haiku 0.70，差阈值 15pp）
Class B (reviewPlan)       → manual-review   （Haiku 0.625，差阈值 7.5pp）
Class C (verifyDod)        → auto-CI         （Haiku 1.0，可用 Haiku 无需 Sonnet）
```

### 未解决的不一致

Exp-A Haiku 在 V2（完整 SKILL.md）上 freshnessCheck 准确率 **0.92**；Exp-B Class A 同为 Haiku + freshnessCheck 只有 **0.70**。差距 22pp，来源不明：

- Exp-B fixture 难度分布可能更均匀（含更多边界情况）
- Exp-B prompt 构建方式不同（注入规格片段而非完整 SKILL.md 内容）

若差异来自 prompt 构建，则 Class A 在正确 prompt 下可能达到 auto-CI 门槛。需 **Exp-D** 验证（见行动项）。

---

## Exp-C 结果：contracts FP/FN 基线

### 核心数字

| 指标 | 值 |
|------|---|
| 总 skill 数 | 23 |
| 有 contracts 前置元数据 | 22 |
| 结构化格式（被执行） | **7**（24 条断言） |
| 非结构化格式（静默跳过） | **16** |
| FP 率（结构化断言） | **0.0** |
| FN 率（对立变体测试） | **0.0** |

### 解读

结构化断言机械可靠：FP=0，FN=0。验证框架本身没有问题。

**最大问题是覆盖缺口**：16/22 的 contracts 写成了纯字符串，验证器静默跳过，等同于无约束。`validate-plugin.sh` 的 ALL CHECKS PASSED 对这 16 个 skill 是误导性的——它们的合约从未被检查过。

### 次要风险

- `not-grep` 断言会匹配 HTML 注释中的字符串（低概率 FP 风险，当前无实例）
- `grep:Backlog`、`grep:Observe`、`grep:templates` 三条断言词过于宽泛，incidental mention 即可通过

---

## 行动项

### 立即可执行（无需进一步实验）

**A1 — 修复 16 个覆盖缺口**（TASK-35 扩展）  
将非结构化 contracts 转为 `{grep: '...', target: 'self'}` 格式。  
优先：`feature-developer`、`build-quality-gates`（最重要的 skill，当前合约形同虚设）。  
参考现有结构化示例：`feature-to-backlog`、`loop-backlog`。

**A2 — 更新 docs/skill-quality-engineering.md §3.1**  
将"P3 是主动干扰"的表述改为区分"无关 P3"（干扰）与"执行规格型 P3"（关键上下文）。  
依据：Exp-A 结果，H-P3 方向反转。

**A3 — 部署 Class C Layer 2.5 Oracle**  
在 validate-plugin.sh 或独立 CI step 中加入 `verifyDod` 分支选择的自动语义校验。  
Haiku 即可（Sonnet 无额外收益，gap=0）。  
Class A/B 暂维持人工审查。

**A4 — not-grep 加注释过滤**（低优先级，可选）  
在 validate-plugin.sh 的 not-grep 检查中先过滤 `<!--...-->` 行，消除注释触发 FP 的理论风险。

### 需要进一步实验（见 backlog proposals）

**Exp-D** — Exp-B Class A prompt 差异复现：用完整 SKILL.md 内容（等同 Exp-A V2）重跑 Class A，确认 0.70 vs 0.92 差距是 prompt 构建造成的，还是 fixture 难度造成的。若 prompt 对齐后准确率回升到 ≥0.85，则 Class A 可进 auto-CI。

**Exp-E** — Exp-B Class B fixture 审计与重跑：检查 8 个 Class B fixture 的 ground truth 设计，确认 0.625 是 Haiku 能力上限还是 fixture 边界歧义导致。若调整后准确率可达 ≥0.70，则 Class B 也有自动化潜力。

---

## 对 skill-quality-engineering.md 的系统性影响

| 章节 | 当前表述 | 修正方向 |
|------|---------|---------|
| §3.1 约束密度 | "P3 内容是主动干扰" | 区分无关 P3 vs 执行规格型 P3 |
| §4.2 Layer 2 contracts | 隐含"contracts = 机械检查覆盖" | 加注：16/22 skill 的 contracts 为非结构化，无实际执行 |
| §5.2 Layer 2.5 Oracle | "Haiku 可作为自动 Oracle" | 仅对 Class C 成立；Class A/B 需人工审查或进一步实验 |

---

---

## Exp-D 结果：Class A 准确率差距诊断（H-prompt CONFIRMED）

**TASK-40，2026-06-19**

| Prompt 风格 | Haiku 准确率 |
|---|---|
| P-spec（仅 specSection 片段，Exp-B 方式） | 0.70 |
| P-full（完整 V2 SKILL.md，249 行，Exp-A 方式） | 0.90 |

- **H-prompt CONFIRMED**：delta = +20pp ≥ 阈值 15pp
- **H-fixture REFUTED**：delta ≥ 5pp，fixture 难度不是主因

差距完全来自 prompt 构建方式。用完整 SKILL.md 注入后 Haiku 准确率 0.90 ≥ 0.85 阈值。

**Class A 建议修订**：`manual-review` → **`auto-CI`**（当 runner 使用完整 SKILL.md 而非 specSection 片段时）

数据：`experiments/skill-quality/artifacts/analysis/exp-d-results.json`

---

## Exp-E 结果：Class B fixture 审计与 reviewPlan Oracle 重标定

**TASK-41，2026-06-19**

### Fixture 审计结论

8 个 Class B fixture 中 **2 个 AMBIGUOUS**（H-fixture-noise CONFIRMED）：

| Fixture | 清晰度 | 原因 |
|---|---|---|
| review-approved-01 | CLEAR | 所有不变量明确满足 |
| review-approved-02 | CLEAR | 多 phase，命令合法 |
| review-fail-empty-phases | CLEAR | phases=[] 明确空 |
| review-fail-no-instructions | CLEAR | instructions="" 明确空 |
| review-fail-empty-dod | CLEAR | dod=[] 明确空 |
| review-fail-no-acceptance | CLEAR | acceptance=[] 明确空 |
| review-fail-nl-dod | **AMBIGUOUS** | "make tests green" 以 make 开头，模型可能理解为合法 shell 命令 |
| review-fail-nl-acceptance | **AMBIGUOUS** | 违规明显，但 partial scorer 要求精确符号串 "isShellCmd(acceptance[0])"，模型用不同记法得 0 分 |

### 关键发现：Scoring Brittleness

在 6 个 CLEAR fixture 上：
- Haiku 准确率（复合 partial score）：66.7%
- Sonnet 准确率（复合 partial score）：66.7%
- **Haiku verdict-only 准确率：100%**
- **Sonnet verdict-only 准确率：100%**

两个模型的 verdict 判断全部正确，66.7% 的复合分数低是因为：
1. APPROVED fixture 在 partial scorer 中最高只能得 0.5（n=0 时 items 分量不适用）
2. NEEDS_REVISION fixture 中模型用不同记法（如 "¬empty(P.phases)"）表达正确判断，严格字符串匹配得 0 分

H-sonnet-gap（Sonnet ≥ Haiku + 10pp）：**REFUTED**（delta = 0pp），因为 scorer 才是瓶颈。

### Class B 建议修订

Scorer 修复方向：
- APPROVED fixture：verdict 正确 + failing_invariants 为空 → 得 1.0 分
- NEEDS_REVISION fixture：relaxed 匹配（normalize 记法差异）或采用语义等价判断

修复后预期 Haiku 准确率接近 100%。**Class B 建议：auto-CI（待 scorer 设计修复后）**

数据：`experiments/skill-quality/artifacts/analysis/exp-e-results.json`、`exp-e-audit.json`

---

## 修订后 Layer 2.5 建议总表

| 类 | 决策类型 | Exp-B 原始建议 | 修订建议 | 条件 |
|---|---|---|---|---|
| A | binary-gate / freshnessCheck | manual-review | **auto-CI** | 使用完整 SKILL.md 注入（非 specSection 片段） |
| B | invariant-check / reviewPlan | manual-review | **auto-CI** | partial scorer 修复后（verdict 匹配松弛） |
| C | branch-selection / verifyDod | auto-CI | **auto-CI** | 已确认，无需修改 |

三个类别均可自动化。Exp-B 的 A/B 拒绝是方法论 artifact（prompt 构建和 scorer 设计），而非模型能力上限。

---

---

## Exp-F 结果：reference/ 加载验证（TASK-44）

**研究问题**：当 Claude Code 通过 skill 激活路径加载 SKILL.md 时，`reference/` 目录下的文件是否也被自动注入上下文？

**设计**：对 Exp-A/D 的 10 个 freshnessCheck fixture，比较两个 SKILL.md 变体：

| 变体 | 内容 | 行数 |
|---|---|---|
| Variant A | 完整 Implementation 内嵌（等同 Exp-A V2） | 249 行 |
| Variant B | Spec-only（≤40 行）；Step 4 判断准则移至 `reference/freshnessCheck-criteria.md` | 40 行 |

**结果**：

| 变体 | Haiku 准确率 | Delta |
|---|---|---|
| Variant A（inline） | **0.980** | — |
| Variant B（spec-only，无 reference/ 注入） | 0.800 | **-18pp** |

**假设判决**：
- **H-ref CONFIRMED**：delta = 18pp ≥ 10pp 阈值，reference/ 未被可靠加载
- **H-load REFUTED**：gap 远超 5pp 容忍带

### 解释

Skill 激活路径（Claude Code harness 注入 SKILL.md）只加载 SKILL.md 文件本身。`reference/` 目录下的文件不会自动注入上下文。没有 Step 4 判断准则，模型只能依赖抽象 Spec 推理，准确率下降 18pp——与 Exp-D 的 P-spec 结果（0.70）方向一致（Variant B=0.80 略高，因 Variant B Spec 节比 Exp-D P-spec 更完整）。

### 架构建议

**废除 knowledge-extractor 的 ≤40 行约束**。执行规格型内容（判断准则、分支决策逻辑）必须留在 SKILL.md 主体，不得推到 reference/。reference/ 目录仍可用于纯无关背景（历史数据、案例描述），但不能承载 load-bearing 内容。

数据：`experiments/skill-quality/artifacts/analysis/exp-f-results.json`

---

---

## Exp-G 结果：自评 V_instance 膨胀度量化（TASK-45）

**研究问题**：BAIME OCA 第 5/9 步的 Accuracy 自评是否系统性高估行为准确率？膨胀度是否超过 10pp（H-inflation），还是可以忽略（H-negligible < 5pp）？

**设计**：对 3 个已收敛 skill 并排比较自评 Accuracy（VALIDATION-REPORT）与 Layer 2.5 行为准确率（P-full，Haiku，k=5）。

### 数字

| Skill | 自评 Accuracy | 行为 composite | 行为 verdict-only | 膨胀度 |
|---|---|---|---|---|
| task-from-template | 0.90 | 0.92 | 0.92 | **−0.02pp** |
| loop-backlog | 0.85 | 1.00 | 1.00 | **−15pp** |
| task-to-backlog | 0.88 | 0.875 | 1.00 | **+0.5pp** |

（task-to-backlog composite 基于修复后 scorer；Exp-E 原始值 0.667 系 scorer bug 导致，verdict-only 全程 1.0）

### 假设结果

- **H-inflation**（自评 ≥ composite + 10pp）：**NOT CONFIRMED**（最大正向膨胀 +0.5pp）
- **H-negligible**（所有差距 < 5pp）：**NOT CONFIRMED**（loop-backlog −15pp）

**总判决**：**INCONCLUSIVE**

### 关键发现

1. **自评不是系统性高估**：在 3 个 skill 中，2 个自评低于或接近行为准确率。loop-backlog 作者保守地将 verifyDod 自评为 0.85，实际行为准确率为 1.0（Exp-B 验证）。
2. **Scorer 质量是关键变量**：task-to-backlog 在旧 scorer 下看似低（0.667），实际 verdict-only = 1.0。Exp-G 强调：composite 低 + verdict-only 高 → scorer 是瓶颈，而非 skill 质量不足。
3. **自评具有不确定性但方向合理**：自评者倾向于低估复杂 skill（loop-backlog），对简单决策点（task-from-template freshnessCheck）估计接近行为测量值。

### 决策结论

根据决策表（H-inflation NOT confirmed，H-negligible NOT confirmed），采用**双轨制**：
- VALIDATION-REPORT 须同时报告自评 Accuracy 和 Layer 2.5 行为准确率（composite + verdict-only）
- 行为准确率不可得时，自评可作为 proxy，须加注"未行为化验证"
- Scorer 边界验证（n=0，notation 模糊匹配）是前提条件，否则 composite 数字无法可靠使用

数据：`experiments/skill-quality/artifacts/analysis/exp-g-results.json`

---

## 实验框架可复用性

`experiments/skill-quality/` 基础设施（TASK-36）可直接支持 Exp-D/E：
- `lib/env.ts`：dotenv fallback，`.env` 不提交
- `lib/llm-client.ts`：checkpoint/resume，GLM extra_body 处理
- `lib/score.ts`：exact/partial 评分复用
- 新实验只需在 `scripts/` 下添加新的 runner，`fixtures/` 下添加新 fixture 目录
