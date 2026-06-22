# BAIME 与定量实验机制的结合与统一

> 写作日期：2026-06-19  
> 依据：Exp-A（TASK-37）、Exp-B（TASK-38）、Exp-C（TASK-39）实验结论；以及 `methodology-bootstrapping` skill 的 OCA/双层价值函数框架

---

## 一、两套机制的现状

本仓库当前并存两套实验机制，认识论严格度不同。

### 机制甲：BAIME 原生 OCA 循环（`methodology-bootstrapping`）

生命周期完整：`iteration-prompt-designer → iteration-executor(×N) → knowledge-extractor`  
产物：`experiments/Bootstrap-NNN/`，含 `iteration-0..N.md`、`results.md`  
度量：双层价值函数 `V_instance`、`V_meta`（目标 ≥ 0.80）  
收敛判据：agent set 稳定 2+ 轮

**核心弱点**：度量是软自评。  
`methodology-bootstrapping` frontmatter 里的 "100% success rate, 4.9 avg iterations, 10-50x speedup"、"V_instance = 0.87"、"195x speedup"——这些数字是 agent 自己打的分，没有经过任何 held-out fixture 或外部 oracle 检验。

### 机制乙：skill-quality 定量实验（`experiments/skill-quality/`）

预登记假设（H-P3、H-oracle-A/B/C）、held-out fixtures、LLM oracle、k=5、cross-model 一致性检验  
硬裁决：`CONFIRMED / NULL / REJECTED`  
有 checkpoint/resume、FP/FN 基线

**核心弱点**：单发、无外循环。  
Exp-D/E 是事后补救（Exp-B 内部的 22pp gap 和 Class B fixture 质量问题），说明机制乙缺少发现"实验本身有洞"时自动触发下一轮的循环机制。

### 最尖锐的对照

Exp-A 用机制乙**证伪了机制甲风格的断言**。§3.1 "P3 是主动干扰" 是自信的、未预登记的断言，结果方向完全相反（+14.5pp）。`methodology-bootstrapping` 里那些软断言是同一类风险——尚未被任何 oracle 检验。

这正是统一的真正动机：**不是为了整洁，而是把 BAIME 的经验主义施加到 BAIME 自己的主张上**——兑现 OCA "Evolve: apply methodology to itself" 一直承诺但尚未实现的闭环。

---

## 二、如何用 BAIME 方法建立和改进定量实验机制

把"如何跑定量实验"本身当作一个待 bootstrap 的方法论域，套 OCA 四步：

### Observe

Exp-A..E 序列本身就是观察数据。结合 meta-cc 会话轨迹，可以观察"实验是怎么被执行的"：哪些 fixture 反复出问题、哪些假设事后发现有混淆变量、哪些步骤是每次手写的重复劳动。

### Codify

把可复现的流程抽成一个 Operator Skill（`run-quantitative-experiment`）：

```
预登记假设（冻结阈值）
  → 构造 held-out fixtures（schema 校验）
  → 多模型 k=5 运行（checkpoint/resume）
  → 统计裁决（CONFIRMED / NULL / REJECTED）
  → 写回文档修订（evidence 指针）
```

现在这个流程活在 TASK-37/38/39 的 prose 描述里，每次手写。它完全符合 §2.1 Operator Skill 的定义：窄输入、离散、有可验证 postcondition——应该被算子化。

### Automate

`lib/`（env / llm-client / score）已经是 Automate 的一半。缺的另一半是脚手架：一个命令吃 `hypotheses.md`，自动生成 `run-exp.ts` 骨架、校验 fixture schema、运行后产出带裁决的 `results.json`，并触发 evidence 指针写回。

### Evolve（最关键）

**Exp-D 和 Exp-E 就是 Evolve 步，只是没被命名为 Evolve。**  
Exp-D 修的是 Exp-B 的 22pp 混淆（prompt 构建 vs fixture 难度）；Exp-E 审计的是 Exp-B Class B 的 fixture 质量。实验机制已经在自我改进，但触发是临时的、手动的。

BAIME 在这里能加的关键东西，是机制乙完全缺少的一层：**实验本身的元价值函数 `V_meta(experiment)`**：

| 分量 | 度量 |
|---|---|
| 预登记纪律 | 假设是否在跑之前冻结 |
| 统计功效 | k 和 n 是否足够（Exp-A 未跑 Friedman，只看方向） |
| oracle 标定度 | oracle 在被使用前是否已标定（Exp-B 做了，是好的） |
| 混淆控制 | 有无已知未隔离变量（22pp gap 就是低分信号） |

如果 Exp-B 当时算过 `V_meta(experiment)`，那个 22pp gap 会立刻把元分数压下去，Exp-D 就不是事后补救，而是收敛判据未满足的**必然下一轮**。

---

## 三、如何建立更统一的实验机制

**核心命题**：让机制乙成为机制甲价值函数的测量仪器；让机制甲成为机制乙的外层循环和生命周期。

两者是互补的缺口，不是竞争：

| 机制甲（BAIME）有、乙缺 | 机制乙（定量）有、甲缺 |
|---|---|
| 多轮迭代的外循环 | 预登记假设 + 冻结阈值 |
| 生命周期与 agent 角色 | held-out fixture + 外部 oracle |
| knowledge-extractor 回写 | 可证伪裁决 CONFIRMED/NULL/REJECTED |
| 双层价值函数的概念 | FP/FN 基线、cross-model 一致性 |

### 统一的约束契约（整合的支点）

> 价值函数的每一个分量，要么由 oracle/fixture 测量，要么显式标注为 `[unvalidated]`。禁止把测出来的 0.92 准确率和手算的 0.87 `V_instance` 混在一起，统称 "empirical"。

这一条直接根治了 Exp-A 暴露的病：自信断言混入未检验数字。

### 统一的实验记录布局

```
experiments/<domain>-<NNN>/
  hypotheses.md        # 乙：预登记、冻结、带阈值（在运行前签名）
  ITERATION-PROMPTS.md # 甲：迭代设计（iteration-prompt-designer 产出）
  fixtures/            # 乙：held-out、版本受控
  lib/                 # 乙：oracle / scoring / checkpoint（或指向共享 harness）
  iteration-N.md       # 甲：每轮观察 + 硬测量 V 分量（标 [measured]/[soft]）
  results.md           # 最终裁决 + 价值函数，每个 V 分量注明来源
  knowledge/           # 甲：knowledge-extractor 回写
```

### Agent 角色挂钩

BAIME 的 agent 角色和定量实验的执行步骤已经自然对应，缺的只是显式挂钩：

| BAIME agent | 定量实验对应步骤 |
|---|---|
| `iteration-prompt-designer` | 设计实验变体 + 预登记假设（冻结阈值） |
| `iteration-executor` | `run-exp.ts` + `analyze.ts`，产出硬裁决 |
| `knowledge-extractor` | 写 summary、修订方法论文档、写回 evidence 指针 |

差别只是：现在 executor 产软分，统一后 executor **必须调 oracle 产硬分**，才能算完成一次迭代。

### 收敛判据升级

- **旧**：agent set 稳定 2 轮 + 自评 `V_instance ≥ 0.80`
- **新**：预登记假设全部裁决，且连续 2 轮无新混淆变量被发现

Exp-D/E 这种"发现旧实验有洞"算作未收敛信号——它们是迭代继续的依据，不是临时补丁。

### Evidence 回写链（把两个仓库变成一个制品的两面）

每条方法论主张挂证据指针，是统一的最后一环：

```yaml
# SKILL.md frontmatter 示例
contracts:
  - grep: "Monitor(persistent=true"
    oracle-f1: 1.0          # Exp-B Class C 实测
    evidence: exp-b-class-c

transferability: 90%        # [unvalidated] — 尚无 held-out 实验支撑
```

这样 `validate-plugin.sh` 可以增加一条 meta-lint：**任何带数字的方法论主张，要么有 `evidence:` 指针，要么必须标 `[unvalidated]`**。

`methodology-bootstrapping` 里的 "100% success / 10-50x" 会立刻被这条 lint 点名——这就是 BAIME 自我应用的闭环真正合拢的地方。

---

## 五、Exp-I 结论摘要（2026-06-22）

**实验**: persona 对 decomposer CODE-CHANGE vs DOC-ONLY 分类的影响  
**设计**: V0（功能性指令）vs V1（专家架构师 persona），16 个 fixture（8 CLEAR + 8 AMBIGUOUS），k=5，双模型（Haiku + Sonnet）

| 假设 | 裁决 | Δ（Haiku 主模型）|
|------|------|-----------------|
| H-A: V1 AMBIGUOUS 准确率 ≥ V0 + 5pp | **CONFIRMED** | +0.050（恰好达阈值）|
| H-B: 两变体 CLEAR 准确率 ≥ 0.90 | **CONFIRMED** | V0=1.00, V1=1.00 |
| H-C: V1 总体准确率 ≥ V0 + 5pp | **NULL** | +0.025（低于 5pp 阈值）|
| H-D: DOC-ONLY 召回不下降 > 10pp | **CONFIRMED** | Δ=0（无偏置）|

**跨模型一致性**: `[underpowered]` — Haiku 显示 AMBIG Δ=+0.050（正向），Sonnet 显示 AMBIG Δ=−0.025（负向），方向不一致。

**结论**: H-A 在 Haiku 上刚好达到 CONFIRMED，但跨模型不一致性将置信度降级为"证据不足"。H-C 为 NULL。当前场景对应设计文档中"persona 对 AMBIGUOUS 有效，但整体无显著提升"——如果接受欠功效信号，可将 V1 persona 添加到 decomposer；如果要求更高置信度，需运行 Exp-J（扩大 AMBIGUOUS fixture 至 n=16）。CLEAR ceiling（100%）和 DOC-ONLY 召回（无偏置）均符合预期。

详细数据: `experiments/skill-quality/artifacts/analysis/exp-i-results.json`

---

## 四、两个最小可行的下一步

| 步骤 | 制品 | 意义 |
|---|---|---|
| **A：`run-quantitative-experiment` 算子化** | 新 Operator Skill，含 λ spec + contracts | 把每次手写的实验流程固化为可重用算子，接入 BAIME 生命周期 |
| **B：evidence/[unvalidated] meta-lint** | `validate-plugin.sh` 新规则 | 让 CI 强制区分"测出来的数字"和"自评的数字"，根治软断言问题 |

步骤 B 的成本低、信号强：它会立即对现有 skill 产出一批 `[unvalidated]` 标注，形成待验证的主张清单，驱动后续实验的选题。

---

## 五、定量实验结果记录（Exp-H 至 Exp-J）

### Exp-H — decomposer persona calibration (TASK-155)

Pre-registered calibration run establishing the runner.ts framework. Confirmed end-to-end harness correctness.

### Exp-I — Persona effect on decomposer CODE-CHANGE classification (TASK-160)

**Purpose**: Test whether replacing the functional directive with an expert architect persona (V1) improves CODE-CHANGE vs DOC-ONLY classification accuracy on n=8 CLEAR + n=8 AMBIGUOUS fixtures at k=5.

**Method**: Two-variant (V0/V1) classification experiment; automated ground-truth scoring; Haiku primary + Sonnet cross-check; 320 LLM calls.

**Verdict**: H-A CONFIRMED on Haiku (Δ=+0.050) but direction reversed on Sonnet (Δ=−0.025). Cross-model tag: `[underpowered]` — models disagree on direction at n=8 AMBIGUOUS fixtures. H-B CONFIRMED (CLEAR ceiling = 1.000). H-D CONFIRMED (no asymmetric bias).

**Implication**: Underpowered — triggered Exp-J replication at n=16.

### Exp-J — Higher-power replication of persona effect (TASK-161)

**Purpose**: Resolve Exp-I's cross-model underpowered tag by doubling AMBIGUOUS fixture set to n=16 (8 from Exp-I + 8 new). Single fixture flip moves Δ by 6.25pp vs 12.5pp in Exp-I.

**Method**: Same V0/V1 prompts as Exp-I; AMBIGUOUS-only run (CLEAR ceiling inherited); Haiku primary + Sonnet cross-check; 320 LLM calls across 64 cells.

**Results**:
- Haiku: V0=0.938, V1=0.975, Δ=+0.037 (below 5pp threshold)
- Sonnet: V0=0.975, V1=0.938, Δ=−0.037 (opposite direction)
- H-D2 CONFIRMED — DO recall = 1.000 in all conditions

**Verdict**: H-A2 **NULL** (Haiku Δ=+0.037 < 0.05). Cross-model consistency: **NULL [cross-model disagreement]** — models disagree on direction after n=16, perfectly symmetric (±0.037). Per pre-registered priority-order rules, this is a definitive NULL.

**Implication**: Do not add the V1 expert persona to loop-backlog decomposer SKILL.md. Classification rules already sufficient; residual errors are idiosyncratic to specific fixtures and do not improve systematically with persona framing. Definitive negative evidence documented in `docs/experiments/exp-j-decomposer-persona.md`.
