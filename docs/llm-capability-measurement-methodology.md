# LLM 能力度量方法论

**适用范围**: 所有面向 BAIME skill 质量的量化实验（Exp-A 及之后）  
**版本**: 1.0（2026-06-22）  
**状态**: 规范文档——后续实验设计必须通过本文档的七层验收清单

---

## 背景与动机

BAIME 实验管道（Exp-A 至 Exp-H）已建立了基础的 fixture-based oracle 测量机制，并在 Exp-E 中发现 scorer bug 导致结论逆转（composite 0.667 → 0.875）。这表明：**测量器本身的可靠性尚未被独立验证，报告值的置信范围未被量化，部分已用于架构决策的结论在统计上欠功效**。

本文档将度量管道组织为七层验收标准，并为每层给出具体的操作规则。所有层必须通过，实验结论方可被视为可信。

---

## 七层验收清单

一个实验在可信之前必须通过以下七层：

```
□ 1. 指标三元组    按部署方式派生正确指标，不只报均值
□ 2. 统计有效性    Wilson CI + 功效分析 + UNDERPOWERED 判据
□ 3. 难度分层      三层全测（CLEAR/AMBIGUOUS/ERROR），AMBIGUOUS 正确答案 = ESCALATE
□ 4. Ground truth  人工锚定 + 双标注 κ，κ 低者降级
□ 5. 部署保真度    每 fixture 声明 mirrors_role/mirrors_invocation，禁跨角色外推
□ 6. 元验证        score.ts 单测 + sanity fixtures + null 负控
□ 7. Provenance    预注册时间戳 + data_source: measured（verify-experiment-provenance.sh 门）
```

---

## 第 1 层：指标三元组

### 问题

当前 `scoreResponse` 对 k=5 取 mean。但 mean 对应的部署语义含糊——它既不是"单次抽样的期望"也不是"k 次投票"，在实际用于选模型或门控时缺乏直接含义。

### 三个指标的定义

| 指标 | 定义 | 对应的部署方式 | BAIME 角色 |
|---|---|---|---|
| **single-shot**（p̂） | 单次随机抽样正确概率的点估计（= 均值，但需带 CI） | k=1，直接采用模型输出 | reviewLoop 单次 verdict；worker 单步工具调用 |
| **majority@k** | k 次投票取多数，最终正确的概率 | k>1，投票后采用 | 未在 BAIME 部署，但是便宜的鲁棒性升级选项 |
| **pass^k（同 fixture）** | 同一 fixture k 次全部正确的概率（实测，非 p^k 推算） | 衡量对单个输入的稳定性 | 门控类 oracle（失败一次即阻断的场景） |
| **chain-pass^n（跨步骤）** | n 步骤链路全部正确的概率（agentic 轨迹级） | 多步 agentic 执行 | Orchestrator / Implementer / epicDecompose |

### 关键数学（必须理解再选指标）

**majority@k 的价值**：
```
p = 0.92, majority@5 ≈ 0.997  （接近完美）
p = 0.70, majority@5 ≈ 0.836  （比 single-shot 仅好 13pp，但成本 5×）
```
在 BAIME 的 reviewLoop 场景：如果 oracle 单次 0.92，加 majority@3 几乎零质量代价地消除大部分随机错误。

**chain-pass^n 的复利衰减**（`pass^k` 不独立，必须实测）：
```
设每步 single-shot = 0.98（看起来很高）
chain-pass^10 = 若独立 ≈ 0.817，实际因步骤相关可能更低或更高
```
这解释了为什么单决策 0.92 完全不能外推到 10 步 worker 的端到端可靠性。

**pass^k 必须实测，不能用 p^k 推算**：同一 fixture 的 k 次调用，prompt 相同、只有温度抖动，错误不独立（模型在同一概念上的理解是稳定的偏差，不是随机噪声）。p^k 会系统性低估 pass^k 的方差。

### 实施规则

- 每个实验**必须报告 single-shot + CI**；其他指标按角色需要添加
- 所有 k 次运行的原始结果（0/1 序列）必须保存在 `artifacts/runs/` 以支持事后重算
- 报告时标明：这个数字对应哪种部署方式（k=1 单次 / majority@k / chain）

---

## 第 2 层：统计有效性

### 问题

Exp-H 用 2 个 skill × 约 10 个 fixture 得出"H-universal CONFIRMED"。在二元结局、区分 δ=0.07 差距所需的有效样本：
```
n ≈ 16 · p(1−p) / δ²  ≈ 16 · 0.106 / 0.0049  ≈ 346 次独立有效试验
当前：~50 次（10 fixtures × k=5），且同 fixture 内强相关 → 有效 n 远低于 50
```
**结论欠功效约一个数量级。**

### 三条硬规则

**规则 2.1：Wilson 置信区间**

每个准确率必须报 95% Wilson CI（不是正态近似 ± 1.96·SE，小样本下正态近似覆盖率严重不足）：

```
Wilson CI:
  center = (k + z²/2) / (n + z²)，z = 1.96
  半宽   = z·√(k(n−k)/n + z²/4) / (n + z²)
```

**规则 2.2：CONFIRMED/REJECTED/UNDERPOWERED 判据**

| 判据 | 条件 | 含义 |
|---|---|---|
| `CONFIRMED` | CI 下界 > 阈值 | 以 95% 置信度确认超过阈值 |
| `REJECTED` | CI 上界 < 阈值 | 以 95% 置信度确认低于阈值 |
| `UNDERPOWERED` | CI 跨越阈值 | 无法判断——**需要更多样本，不得默认为 NULL** |
| `NULL` | CONFIRMED ∧ 方向与假设相反 | 方向反转，有统计把握 |

这正好对应 `cap:experiment=CONFIRMED|NULL|REJECTED|UNDERPOWERED` 的四值语义。**`UNDERPOWERED` 不是实验失败，是诚实的未知。**

**规则 2.3：预注册功效分析**

在 `hypotheses.md` 中（提交早于第一次 LLM 调用）必须包含：
```yaml
power_analysis:
  target_delta: 0.15       # 要分辨的最小差距
  target_power: 0.80       # 期望功效
  alpha: 0.05
  required_fixtures: 32    # 由上述参数计算
  required_k: 5
  rationale: "区分 0.85 vs 0.70，单侧检验"
```
如果无法满足所需样本，实验结论只能报 `UNDERPOWERED`，不得 CONFIRMED/REJECTED。

---

## 第 3 层：难度分层（AMBIGUOUS = ESCALATE）

### 问题

`loadFixtures` 过滤 `fixtureClass === 'CLEAR'`，导致所有报告值是**简单子集的上界**，而 AMBIGUOUS 层恰好测的是 BAIME 最关键的 calibration 能力。

### 三层映射到 BAIME 机制

| 层 | 定义 | 正确模型行为 | BAIME 对应机制 |
|---|---|---|---|
| `CLEAR` | 规格给出唯一正确答案 | 输出正确答案 | 正常执行路径 |
| `AMBIGUOUS` | 规格在此情形下不唯一 / 信息不足 | 输出 `ESCALATE`，**不猜测** | `escalate()` → Basic: Needs Human |
| `ERROR` | 输入本身违反前提条件 | 输出 `REJECT` 并说明原因 | `escalate()` + 错误诊断 |

### 评分规则

```
CLEAR    fixture：answer vs ground_truth → 现有 scoreResponse 规则
AMBIGUOUS fixture：answer == "ESCALATE" → 1.0，否则 → 0.0（无论答案多"聪明"）
ERROR    fixture：answer == "REJECT"    → 1.0，否则 → 0.0
```

### 新增 answer 词表值

所有 fixture schema 的 `answer` 字段允许两个保留值：
- `"ESCALATE"` — 正确行为是升级，不是判断
- `"REJECT"` — 正确行为是拒绝，不是判断

**过度自信指标（calibration score）**：
```
over_confidence_rate = (AMBIGUOUS fixtures 中 answer ≠ "ESCALATE" 的比例)
```
这是单独报告的指标，不和 CLEAR 层混合计算均值。

### 难度分层报告格式

```json
{
  "per_layer": {
    "CLEAR":     {"n": 30, "accuracy": 0.92, "ci_lower": 0.77, "ci_upper": 0.98},
    "AMBIGUOUS": {"n": 10, "escalate_rate": 0.70, "over_confidence_rate": 0.30},
    "ERROR":     {"n": 5,  "reject_rate": 0.80}
  },
  "combined_CLEAR_accuracy": 0.92,
  "calibration_score": 0.70
}
```

---

## 第 4 层：Ground Truth 完整性

### 两条硬规则

**规则 4.1：人工锚定**

Ground truth 不得由被测模型族（Anthropic Claude / GLM 等）生成后直接采用。规则：
- 标注者先独立阅读 SKILL.md 规格，写下 `ground_truth_rationale`
- **禁止参考任何模型输出**进行标注
- 如果 SKILL.md 规格本身有歧义导致无法确定答案，fixture 直接标为 `AMBIGUOUS`（而非强行猜一个 ground truth）

**规则 4.2：双标注 + Cohen's κ**

每个 fixture 需两名独立标注者：
```
κ = (p_o − p_e) / (1 − p_e)

判定：
  κ ≥ 0.80 → CLEAR（可信 ground truth）
  0.60 ≤ κ < 0.80 → 需讨论解决后方可 CLEAR
  κ < 0.60 → 降级为 AMBIGUOUS（标注者自己都不一致，fixture 本身有歧义）
```

实践中两名标注者 = 一名人类 + 一次独立 LLM 标注也可接受，但**第二次 LLM 标注必须用不同 prompt 和不同模型族**。

---

## 第 5 层：部署保真度

### 问题

`buildPromptExact` 注入完整 SKILL.md + 完美 state，问一个孤立决策。这镜像的是 **Reviewer 角色在理想上游下的单次原子判断**，不代表其他角色的能力。

### 五个 BAIME 部署角色

| 角色 | 实际工作形态 | 对应的 fixture 类型 | 允许外推到 |
|---|---|---|---|
| **Reviewer** | 拿到完整文档，做单次 APPROVED/NEEDS_REVISION 判断 | 单决策 fixture + 完整 SKILL.md 注入 | 仅 Reviewer |
| **Drafter** | 从规格 + 代码库上下文生成 50–200 行结构化文档 | 生成质量评分 fixture | 仅 Drafter |
| **Decomposer** | Epic plan → N 个子任务规格（含 DoD） | 集合输出 fixture：(plan, child_set) | 仅 Decomposer |
| **Implementer** | 写代码/bash，跑 DoD，修失败，commit | DoD pass/fail 端到端 | 仅 Implementer |
| **Orchestrator** | 10+ 步工具链：claim → spawn → wait → merge | 轨迹型 fixture（多步状态序列） | 仅 Orchestrator |

### Fixture schema 新增字段

```json
{
  "mirrors_role": "reviewer",
  "mirrors_invocation": "single-verdict / k=1",
  "upstream_quality": "perfect",
  "extrapolation_forbidden_to": ["drafter", "decomposer", "implementer", "orchestrator"]
}
```

`upstream_quality` 字段：
- `perfect` — 上游 state 由人工构造，永远正确（当前所有实验）
- `realistic` — 上游 state 来自真实 LLM 输出，含噪声（误差传播实验）
- `adversarial` — 上游 state 故意含缺陷（鲁棒性实验）

**报告中每个数字必须标注 `mirrors_role`。** 不同 role 的数字严禁混合平均。

---

## 第 6 层：元验证（测量器本身的测量）

### Exp-E 教训

Exp-E 中 `n=0` 被 cap 到 0.5、严格 notation 匹配 → 修复后结论从 0.667 反转到 0.875。**测量器的 bug 直接改变了科学结论。**

### 三类元验证

**6.1 score.ts 单测套件**

已知 `(answer, groundTruth, answerType)` → 期望分数，覆盖所有边界：

```typescript
// exact
assert(scoreResponse("APPROVED", "APPROVED", "exact") === 1.0)
assert(scoreResponse("approved", "APPROVED", "exact") === 1.0)  // 大小写归一化
assert(scoreResponse("NEEDS_REVISION", "APPROVED", "exact") === 0.0)

// set（顺序无关）
assert(scoreResponse(["a","b"], ["b","a"], "set") === 1.0)
assert(scoreResponse("a", ["a","b"], "set") === 0.0)  // 未覆盖集合

// partial（verdict + items）
assert(scoreResponse({verdict:"NEEDS_REVISION",items:[]}, {verdict:"NEEDS_REVISION",items:[]}, "partial") === 1.0)
assert(scoreResponse({verdict:"APPROVED",items:[]}, {verdict:"NEEDS_REVISION",items:["x"]}, "partial") === 0.0)
// n=0 时 verdict 匹配即 1.0（曾是 bug 来源）
assert(scoreResponse({verdict:"APPROVED",items:[]}, {verdict:"APPROVED",items:[]}, "partial") === 1.0)

// ESCALATE / REJECT（新增保留值）
assert(scoreResponse("ESCALATE", "ESCALATE", "exact") === 1.0)
assert(scoreResponse("APPROVED", "ESCALATE", "exact") === 0.0)  // 过度自信，得 0
```

**6.2 Sanity fixtures（正控）**

`fixtures/sanity/` 中的 fixture 必须满足：**任何合理指令遵从能力的模型都应该过**。每次实验运行前先跑 sanity fixtures；若 sanity accuracy < 0.90，**实验数据作废**（说明 API、prompt 构建或评分管道有问题）。

**6.3 Null 负控 fixtures**（目前缺失，需新增）

构造"信息不足以判定"的 fixture，正确答案 = `ESCALATE`：
```json
{
  "id": "null-control-01",
  "fixtureClass": "AMBIGUOUS",
  "answer": "ESCALATE",
  "ground_truth_rationale": "Input 中缺少 task status 字段，规格无法确定 entryPoint",
  "null_control": true
}
```

若 oracle 在 null 负控上给出非 `ESCALATE` 的答案并得正分，说明**评分器在白送分**。null 负控必须全部得 0（若答 ESCALATE）或全部计入 over_confidence_rate。

---

## 第 7 层：Provenance

### 两条规则（已有部分基础设施，TASK-141 在建）

**规则 7.1：预注册时间戳**

`hypotheses.md` 的 git commit 时间戳必须早于 `artifacts/runs/` 下任何 LLM 调用产出文件的时间戳。由 `scripts/verify-experiment-provenance.sh` 自动检查（TASK-141-E）。

**规则 7.2：data_source: measured**

结果文件中 `data_source` 字段：
- `measured` — 本次真实 LLM 调用
- `prior-data` — 来自前序实验的重用（Exp-B/D/E/F 现状，需标明来源实验 ID）
- `estimated` — **BLOCKED**，由 provenance gate 阻断，禁止出现在最终结果文件

`prior-data` 重用规则：允许，但必须在 `data_source_note` 里说明来源实验 ID、原始测量条件（model/k/fixture set）与当前实验的差异。

---

## 七层与 TASK-141 runner.ts 的对应关系

`runner.ts` 不只是遍历 `variant × fixture × model × k`，它的输出合约应强制产出满足七层的报告结构：

| runner.ts 职责 | 对应层 |
|---|---|
| 保存每次 raw 0/1 结果 → `artifacts/runs/` | 层 1（支持事后重算三元组指标） |
| 自动计算 Wilson CI | 层 2 |
| 按 `fixtureClass` 分组报告，不混合 | 层 3 |
| 读取 fixture 的 `mirrors_role` 字段并在报告中标注 | 层 5 |
| 运行前先跑 sanity fixtures，失败即终止 | 层 6 |
| 检查 `data_source` 字段，`estimated` 直接报错 | 层 7 |
| 记录第一次 LLM 调用时间戳（用于 provenance 门） | 层 7 |

层 4（ground truth 双标注）和层 6.1（score.ts 单测）是 runner.ts 运行前的人工/离线工作，无法由 runner.ts 自动执行，但 runner.ts 可以在启动时检查 fixture 是否有 `annotation_kappa` 字段并在缺失时 WARN。

---

## 附录：实验分类账（现有实验的层级状态）

| 实验 | 层1 | 层2 | 层3 | 层4 | 层5 | 层6 | 层7 | 结论可信度 |
|---|---|---|---|---|---|---|---|---|
| Exp-A | 均值 only | 无 CI | CLEAR only | 未知 | 未标注 role | 无 score 单测 | prior-data | **低**（方向正确，量值可疑） |
| Exp-B | 均值 only | 无 CI | CLEAR only | 未知 | Reviewer | 无 | prior-data | **低** |
| Exp-G | 均值 only | 无 CI | CLEAR only | 未知 | V_instance≠Reviewer | 无 | measured✓ | **极低**（测的不是部署语义） |
| Exp-H | 均值 only | 无 CI | CLEAR only | 未知 | Reviewer | 无 | measured✓ | **中**（方向可信，绝对值有 CI 空白）|

**没有一个实验完整满足七层**，但 Exp-H（measured + Reviewer 角色清晰）是最接近的。后续实验应以本文档为基准逐层补齐。

---

## 附录 A：AMBIGUOUS fixture schema 完整设计

### A.1 两种子类型

AMBIGUOUS 层不是同质的，需区分来源：

**Sub-A：规格歧义**（spec 在此情形下真的没有唯一答案）

```json
{
  "id": "ftb-from-status-ambiguous-01",
  "skill": "feature-to-backlog",
  "taskClass": "A",
  "taskType": "branch-selection",
  "decisionPoint": "fromStatus",
  "fixtureClass": "AMBIGUOUS",
  "ambiguity_type": "spec_gap",
  "ambiguity_rationale": "规格定义 fromStatus('Plan') = PlanLoop，但实际任务 status 字段同时存在 'Basic: Plan' 前缀和历史 'Plan' 值。规格未处理带前缀的变体，无唯一正确答案。",
  "input": { "taskStatus": "Basic: Plan" },
  "answer": "ESCALATE",
  "answerType": "exact",
  "ground_truth_rationale": "规格未覆盖带前缀的状态字符串，正确行为是识别歧义并升级，不是猜测。",
  "annotation_kappa": 0.85,
  "mirrors_role": "reviewer",
  "mirrors_invocation": "single-verdict / k=1",
  "upstream_quality": "perfect"
}
```

**Sub-B：信息不足**（规格无歧义，但输入缺少判断所需字段）

```json
{
  "id": "ftb-review-plan-missing-config-01",
  "skill": "feature-to-backlog",
  "taskClass": "B",
  "taskType": "invariant-check",
  "decisionPoint": "reviewPlan",
  "fixtureClass": "AMBIGUOUS",
  "ambiguity_type": "missing_input",
  "ambiguity_rationale": "reviewPlan 需要 cfg.testCmd 验证 dod[0]，但 config 字段未提供。核心不变式无法验证。",
  "config": {},
  "plan": {
    "phases": [{ "tests": ["x.test.ts"], "dod": ["npm test -- --run x.test.ts"] }],
    "acceptance": ["npm test"]
  },
  "answer": "ESCALATE",
  "answerType": "exact",
  "ground_truth_rationale": "缺少 cfg.testCmd，应升级而非猜测。",
  "null_control": true,
  "mirrors_role": "reviewer",
  "mirrors_invocation": "single-verdict / k=1",
  "upstream_quality": "perfect"
}
```

`null_control: true` 用于元验证：若评分器对此 fixture 给出正分，说明评分器在白送分（见层 6）。

### A.2 ESCALATE 在现有 scorer 中的位置

`scoreResponse` 对 `answerType: "exact"` 已做大小写归一化比较——当 `groundTruth = "ESCALATE"` 时现有逻辑可直接处理，**无需修改 score.ts**。

需要在 runner 层新增的是**按 fixtureClass 分层的聚合逻辑**：

```typescript
interface LayeredResult {
  CLEAR:     { n: number; accuracy: number; ci_lower: number; ci_upper: number };
  AMBIGUOUS: { n: number; escalate_rate: number; over_confidence_rate: number };
  ERROR:     { n: number; reject_rate: number };
}

function aggregateByLayer(results: RunResult[]): LayeredResult {
  const clear = results.filter(r => r.fixtureClass === 'CLEAR');
  const ambig = results.filter(r => r.fixtureClass === 'AMBIGUOUS');
  const error = results.filter(r => r.fixtureClass === 'ERROR');

  const clearAcc = mean(clear.map(r => r.score));
  const [ci_lower, ci_upper] = wilsonCI(
    clear.filter(r => r.score === 1).length, clear.length
  );
  const escalateRate = mean(ambig.map(r => r.score));

  return {
    CLEAR:     { n: clear.length, accuracy: clearAcc, ci_lower, ci_upper },
    AMBIGUOUS: { n: ambig.length, escalate_rate: escalateRate,
                 over_confidence_rate: 1 - escalateRate },
    ERROR:     { n: error.length, reject_rate: mean(error.map(r => r.score)) },
  };
}
```

**CLEAR accuracy** 和 **escalate_rate** 是独立报告的两个维度，禁止混合平均。

### A.3 Calibration：独立于 accuracy 的能力维度

一个模型可以在 CLEAR 层 accuracy=0.95，但 over_confidence_rate=0.80（遇到歧义几乎从不 ESCALATE）。在 BAIME 里，这种"高准确但低 calibration"的模型会把有歧义的决策包装成确定性输出，污染下游状态机，导致看板状态腐化。

Exp-G 的"自评膨胀"从本质上也是 calibration 问题：模型对自己输出的置信度系统性高于其实际准确率。**Calibration（escalate_rate）和 Accuracy（CLEAR 层）必须分别报告，不得合并。**

---

## 附录 B：轨迹型 fixture 与 chain-pass^n 评分设计

### B.1 单决策 vs 轨迹的本质差异

| 维度 | 单决策 fixture | 轨迹型 fixture |
|---|---|---|
| 问题形态 | 给定 state，下一个动作是什么？ | 从 state₀ 出发，整条轨迹是否满足协议约束？ |
| 评分粒度 | 单个 answer vs ground_truth | 整条工具调用序列的结构属性 |
| 正确性定义 | 答案值匹配 | 顺序约束 + 禁止动作约束 + 终态约束 |
| 统计单位 | 每次 API 调用（k 次独立） | 每条轨迹（轨迹内步骤强相关） |

Class-D fixtures（`lb-claim-before-spawn-01.json` 等）已有骨架（`required_sequence` + `forbidden_before_step_1` + `answerType: "trace"`），但 `scoreResponse` 没有 `trace` 分支，runner 也没有轨迹聚合逻辑。

### B.2 轨迹 scorer

```typescript
interface TraceStep {
  step: number;
  tool: string;        // "*" 匹配任意工具
  pattern: string;     // 正则，匹配工具调用参数/内容
  description: string;
}

interface ForbiddenAction {
  tool: string;
  pattern: string;
  description: string;
}

interface TraceRunResult {
  tool_invocations: Array<{ tool: string; args: string; timestamp: number }>;
  terminal_state?: string;
}

function scoreTrace(run: TraceRunResult, fixture: TraceFixture): number {
  const invs = run.tool_invocations;

  // Step 1：找第一个 required step 的位置
  const firstReqIdx = invs.findIndex(inv =>
    matchesStep(inv, fixture.required_sequence[0]!)
  );
  if (firstReqIdx === -1) return 0;  // Step 1 从未出现

  // Step 2：检查 forbidden_before_step_1
  for (let i = 0; i < firstReqIdx; i++) {
    for (const f of fixture.forbidden_before_step_1 ?? []) {
      if (matchesTool(invs[i]!, f)) return 0;
    }
  }

  // Step 3：验证后续 required steps 的顺序
  let lastIdx = firstReqIdx;
  for (const step of fixture.required_sequence.slice(1)) {
    const idx = invs.findIndex((inv, i) => i > lastIdx && matchesStep(inv, step));
    if (idx === -1) return 0;
    lastIdx = idx;
  }

  // Step 4：终态检查（可选）
  if (fixture.terminal_state && run.terminal_state !== fixture.terminal_state) {
    return 0.5;  // 序列合规但终态错：给部分分
  }

  return 1.0;
}

function matchesStep(inv: { tool: string; args: string }, step: TraceStep): boolean {
  const toolMatch = step.tool === '*' || inv.tool === step.tool;
  const patternMatch = new RegExp(step.pattern).test(inv.args);
  return toolMatch && patternMatch;
}
```

### B.3 chain-pass^n 的正确统计单位

**错误做法（步骤级均值，混淆了相关结构）**：
```
k=5 条轨迹，每条 n=10 步，共 50 步
per_step_accuracy = 44/50 = 0.88  ← 不代表任何部署语义
```

**正确做法（轨迹级二元结果）**：
```
per_trajectory_pass = [1, 0, 1, 1, 0]  （每条轨迹全部通过 → 1，否则 → 0）
chain_pass_rate = 3/5 = 0.60           ← 这才是"一次完整任务不掉步"的概率
```

Wilson CI 作用在**轨迹级**而非步骤级：
```typescript
function chainPassStats(trajectoryResults: number[]) {
  const k = trajectoryResults.length;
  const passes = trajectoryResults.filter(r => r === 1).length;
  const [ci_lower, ci_upper] = wilsonCI(passes, k);
  return { k, passes, chain_pass_rate: passes / k, ci_lower, ci_upper };
}
```

**对 BAIME 部署的含义**：loop-backlog worker 一次完整任务约 10 步。若每步 single-shot=0.98：

```
若各步独立（下界估计）：chain-pass^10 ≈ 0.817
实际：同一轨迹内步骤强相关（模型整体"理解"协议）
  → 若模型理解协议结构：chain-pass^10 > 0.817
  → 若存在系统性盲点（如总漏 notifyParent）：chain-pass^10 << 0.817
```

单决策 0.92 完全不能外推到 chain-pass^10——只有实测轨迹型 fixture 才能回答这个问题。

### B.4 两种执行模式

| 模式 | 描述 | 测量的能力 | 成本 |
|---|---|---|---|
| **prompt-compliance**（路径 B） | 让 LLM 描述"我会怎么做"，评分输出序列 | "知道规则"（declarative）| 接近单决策 |
| **sandbox-real**（路径 A） | 在临时 git repo 中真实执行，捕获工具调用 | "会不会真的这样做"（procedural）| 高 10–100× |

Class-D 现有 fixtures 是路径 B（`prompt_template` + 文字序列评估）。路径 A 的基础设施现已有：`scripts/run-smoke-test.sh` + `plugin/skills/loop-backlog/smoke/`（TASK-145 建立）。

**两者测量不同能力维度，不可互替**。建议：
- 路径 B：高频 calibration 检查（知道规则）
- 路径 A：低频高保真验证（真实 agentic 行为），挂在 smoke 流程而非 `validate-plugin.sh`

---

## 附录 C：统一 fixture schema（TypeScript 接口）

整合以上两个附录，形成所有 BAIME fixture 的规范接口：

```typescript
type FixtureClass = 'CLEAR' | 'AMBIGUOUS' | 'ERROR';
type AnswerType   = 'exact' | 'set' | 'partial' | 'trace';
type Role = 'reviewer' | 'drafter' | 'decomposer' | 'implementer' | 'orchestrator';
type UpstreamQuality = 'perfect' | 'realistic' | 'adversarial';
type AmbiguityType   = 'spec_gap' | 'missing_input' | 'conflicting_constraints';
type ExecutionMode   = 'prompt-compliance' | 'sandbox-real';

interface BaimeFixture {
  // ── 现有字段（不变）──────────────────────────────────────────────
  id: string;
  skill: string;
  taskClass: 'A' | 'B' | 'C' | 'D';
  taskType: string;
  decisionPoint: string;
  specSection: string;
  answer: unknown;           // 含保留值 "ESCALATE" | "REJECT" | "sequence_compliant"
  answerType: AnswerType;
  fixtureClass: FixtureClass;
  ground_truth_rationale: string;

  // ── 层 3 扩展：难度分层 ──────────────────────────────────────────
  ambiguity_type?: AmbiguityType;   // 仅 fixtureClass=AMBIGUOUS 时
  null_control?: boolean;           // true → 元验证负控（答 ESCALATE 必须得 0 分）

  // ── 层 4 扩展：双标注 ────────────────────────────────────────────
  annotation_kappa?: number;        // Cohen's κ；缺失时 runner WARN

  // ── 层 5 扩展：部署保真度 ────────────────────────────────────────
  mirrors_role: Role;
  mirrors_invocation: string;       // 如 "single-verdict / k=1"
  upstream_quality: UpstreamQuality;

  // ── 附录 B 扩展：轨迹型（仅 answerType='trace'）──────────────────
  required_sequence?: TraceStep[];
  forbidden_before_step_1?: ForbiddenAction[];
  terminal_state?: string;
  execution_mode?: ExecutionMode;
}
```

**runner.ts 必须检查的字段**：
- `fixtureClass` → 分层聚合（禁止混合 CLEAR/AMBIGUOUS 均值）
- `mirrors_role` → 报告中标注，拒绝跨角色外推
- `null_control` → 得分 > 0 时报警（评分器白送分）
- `annotation_kappa` → 缺失时 WARN，κ < 0.60 时 ERROR（fixture 本身不可信）
- `answerType` → 分发到对应 scorer（`exact`/`set`/`partial`/`trace`）
