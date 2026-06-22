# Proposal: loop-meta —— 在 loop-backlog 之上的自治 meta 规划/收敛回路

## Background

本项目已经有一个可靠的自治执行系统,但它的"生产者"仍是人:

- `loop-backlog-daemon.js` 持续扫描 `backlog/tasks/`,对每个进入 `status: ready` 的任务发出 `task-ready:TASK-N` 事件(见 `backlog/.daemon.log`)。
- 一个 `claude` 会话运行 `/loop-backlog`,用 `Monitor` 消费这些事件,在隔离 git worktree 中执行 leaf task,`verifyDod` 通过后合并回 main。
- 用户在其它会话中创建 task、择机把部分 task 移到 `Ready`,由上述会话执行。

即:**backlog = 共享黑板(任务 + 状态 + notes + DoD 结果),git = 结果通道,daemon = 事件源,loop-backlog 会话 = 消费者/执行器**。这是一个生产者/消费者系统,但"分解宏观目标 → 产出子任务 → 评价结果 → 修订计划"这一层(生产者)目前完全靠人手工完成。

本会话亲历的若干闭环——TASK-46 reopen(伪造结果→诊断→改 runner/fixture→重测)、TASK-52/54/55/56 的 review→revise——证明这层"执行反馈回灌进计划"的工作是可被结构化、可被自动化的。但它缺少一个常驻机制。

`loop-meta` 即补上这层:一个**与 loop-backlog 并存、经由同一块 backlog 黑板协作的 L1 控制回路**,接受用户创建的 meta-task(宏观目标),持续分解、调度、评价、replan,把 leaf 子任务交给 L0(loop-backlog)执行。

设计类比 Kubernetes 控制器:meta-task = 期望状态(goal),`loop-meta` = reconciler(将期望 reconcile 成 leaf 任务),`loop-backlog` = 执行器(kubelet),backlog = etcd。

## 意义与宏观方向

这项工作的真正意义不在于"再加一个自动化脚本",而在于**持续放大人类参与开发的颗粒度**:

1. **抬高人的介入颗粒度**。当前人在 leaf-task 颗粒度上介入(建 task、移 Ready)。`loop-meta` 把人的介入抬到 **meta-goal 颗粒度**——人只需给出宏观目标与 frozen 验收,分解/调度/评价/replan 交给 AI agent 在更大颗粒度上驱动。人从"逐条派工"变为"定目标、守边界、审方向"。
2. **下一步是并发吞吐**。颗粒度抬高后,单位人力监管的在制工作量上升;在此基础上**进一步提高并发**(多 L0 worker、多 meta-goal 并行 reconcile),即可把整体开发吞吐率再上一个台阶。本方案的黑板 + 幂等 reconcile + WIP 上限正是为这一步预留的结构。
3. **方向是必然的**。"人退到更高颗粒度、AI 在更低颗粒度上并发驱动"是 agent 化开发的必经路径。当前看到的困难——评价可靠性、reward-hacking、收敛/发散、可观测性——不是放弃的理由,而是**必须且必然要被逐一攻克的工程问题**。本方案对每一项都给出了具体对策(见护栏与设计依据),并以证据驱动的分期把风险摊薄。

> 因此 `loop-meta` 是一个**方向性奠基**:它本身要可用,更要为"更高颗粒度 + 更高并发"的后续演进立好骨架。

## Goals

1. **G1 双回路并存**:`loop-meta` 作为独立会话运行,与正在运行的 `loop-backlog` 共用同一 backlog,互不干扰;用户现有"手动建 task + 择机移 Ready"流程零改动仍可用。
2. **G2 Meta 泳道隔离**:meta-task 走独立状态泳道;`loop-backlog` 永远不会拾取 meta-task(可由 `grep` 验证 daemon 与 L0 的过滤逻辑)。
3. **G3 幂等 reconcile**:`loop-meta` 每个 tick 比对"期望(meta-plan 分解) vs 黑板实际(已建/Ready/Done/Needs Human 子任务)",只补缺口,可崩溃重启不产生重复任务。
4. **G4 Gated 自治调度**:meta-plan 经人审批准后,`loop-meta` 在 WIP 上限内自动把子任务移 `Ready`;遇 Needs Human / 指标停滞 / 超 budget 即停机并升级。
5. **G5 实质评价(切片聚合,非整体裁判)**:子任务批次完成后,由独立 evaluator 把 frozen 验收**分解为 measured 切片检查并聚合**(复用 Layer 2.5 oracle + DoD + trace replay),`substantively-verified` 定义为"切片聚合通过",而非单一整体 judge——理由见 §4 与"设计依据"。
6. **G6 宏观 intake**:用户在任意会话用一行宏观目标即可创建 meta-proposal;`loop-meta` 拾取后产出 meta-proposal 文档 + 初始分解,停在人审门。
7. **G7 复用现有件**:子任务计划复用 `task-to-backlog`/`feature-to-backlog`,执行复用 `loop-backlog`;`loop-meta` 自身只新增分解/评价/replan/reconcile。
8. **G8** `bash scripts/validate-plugin.sh` 通过。

## 架构

```
 用户(任意会话) ──放入宏观目标──▶ ┌──────────────────────────────┐
                                   │ meta-task(期望状态)         │   黑板 = backlog
                                   │  Meta-Proposal→Meta-Plan→    │   (任务+状态+notes+DoD结果)
                                   │  Meta-Active→Meta-Done       │
                                   └──────────────────────────────┘
                                       ▲ 评价/replan       │ reconcile 产出子任务
                                       │                   ▼
   L1: /loop-meta 会话 ◀─ meta-ready ─ daemon ─ task-ready ─▶ L0: /loop-backlog 会话
   (decomposer/evaluator/replanner)   (单一事件源)          (worktree + verifyDod + merge)
                                       │
                            git history / task notes / DoD 结果(L1 读取以评价)
```

- **L0(现有 loop-backlog)**:不改其执行语义。仅在事件过滤上排除 Meta 泳道。
- **L1(新增 loop-meta)**:reconciler。读 meta-task 期望 → 比对黑板实际 → 补子任务 → 读 L0 产出做实质评价 → replan。
- **通信只经黑板 + git**:L1 与 L0 是不同会话/进程,无共享内存——与 loop-backlog 现有约束一致(任务自带全部上下文,notes 回传结果)。

## Proposed Approach

### 1. Meta 泳道(状态扩展)

在 `backlog/config.yml` 的 statuses 中新增 Meta 泳道(仿 `backlog-setup` 直接编辑 config.yml 的做法,不用已废弃的 CLI):

| 状态 | 含义 | 谁推进 |
|---|---|---|
| `Meta-Proposal` | 宏观目标已录入,待分解 + 人审 | 用户建 → L1 产出 meta-proposal 文档 |
| `Meta-Plan` | meta-proposal 已人审批准,含 frozen 验收 + 初始分解 | 人审门(用户) |
| `Meta-Active` | L1 正在 reconcile/调度/评价/replan | L1 |
| `Meta-Done` | frozen 实质验收已 measured 达成 | L1(经 evaluator)|
| `Needs Human` | 停滞/发散/不可行/歧义 | L1 升级 |

leaf 子任务仍走原有 `Backlog→Ready→In Progress→Done` 泳道,由 L0 执行。

### 2. daemon 扩展:第二事件类型

`scripts/loop-backlog-daemon.js` 当前对 `status: ready` 发 `task-ready:TASK-N`。扩展为:

- 对 Meta 泳道(`Meta-Proposal`/`Meta-Plan` 转入,以及 `Meta-Active` 需重新评估时)发 `meta-ready:TASK-N`。
- 原 `task-ready` emit **排除** Meta 泳道任务(防止 L0 误吃)。

L0(`loop-backlog`)的 Monitor 仍只订阅 `task-ready`;L1(`loop-meta`)的 Monitor 订阅 `meta-ready`。

### 3. `loop-meta` 的 λ spec(幂等 reconcile)

```haskell
λ() → metaLoop()

MetaTask :: {
  goal       : String,        -- 宏观目标
  acceptance : [Substantive], -- FROZEN 实质验收(measured),开始后不可放宽
  plan       : MetaPlan,      -- 当前整体计划(子目标树)
  budget     : Budget         -- 子任务数上限 / token 上限 / 最大 cycle 数
}

data Outcome = Converged Evidence | Escalated Reason

metaLoop() = onEvent("meta-ready", reconcile)

reconcile :: MetaTask → Outcome
reconcile(m) =
  | exhausted(m.budget)            → escalate(m, "budget")
  | noProgress(m.history, k)       → escalate(m, "stalled")      -- k 个 cycle 指标不动
  | diverging(m.history)           → escalate(m, "oscillation")
  | status(m) == "Meta-Proposal"   → draftMetaProposal(m); gateHuman(m)   -- 停人审门
  | otherwise →                                                  -- Meta-Active
      desired: decompose(m.plan),                 -- 子目标 → 子任务集
      actual:  scanChildren(m),                   -- 黑板上该 meta 的子任务实际状态
      diff:    desired ⊖ actual,                  -- 仅缺口
      _: ∀t ∈ diff.toCreate: createChild(t),      -- 复用 task-to-backlog/feature-to-backlog
      _: ∀t ∈ diff.toSchedule ∧ wip(m) < WIP_CAP: setReady(t),  -- Gated 调度
      done: scanChildren(m) |> filter(Done),
      v:    evaluate(m.acceptance, done),         -- 切片 oracle 聚合(见 §4),非整体 judge
      case v of
        | Met            → setStatus(m, "Meta-Done"); Converged(evidence)
        | NotMet reasons →
            m.plan': replan(m.plan, reasons, childNotes(m)),  -- 诊断+改计划,不改 acceptance
            updatePlan(m, m.plan'); waitNextEvent(m)

-- 子任务完成的信号来源(无共享内存):
--   status==Done + merge commit + "DoD #N: PASS/FAIL" notes + workerLoop 复验记录
```

要点:
- **幂等**:`diff = desired ⊖ actual` 保证重复 `meta-ready` 不会重复建任务(解决 daemon 日志里 TASK-84 ×6 这类重复 emit)。
- **decompose / replan / evaluate** 是子代理(见 §4),`metaLoop` 自身是确定性控制壳,结构镜像 `loop-backlog` 的 workerLoop。
- **acceptance frozen**:replan 只改路径,不改目标(反 reward-hacking)。

### 4. 子代理

| 子代理 | 职责 | 关键约束 |
|---|---|---|
| `decomposer` | meta-goal/plan → 子任务树(每个子任务交 `task-to-backlog`/`feature-to-backlog` 拿审查过的 shell DoD) | 子任务须自带全部上下文(work-order-for-strangers) |
| `evaluator` | 把 meta-goal 的 frozen 验收**分解为切片检查并聚合**(见下),输出 Met / NotMet+reasons | **独立于 executor**;**不做整体 LLM judge**;每个切片须 measured;结论引用具体证据 |
| `replanner` | NotMet 时诊断根因(impl/sub-plan/meta-plan/harness/infeasible)并更新整体计划 | 只改路径不改 acceptance;改动留痕 |

**evaluator 的设计依据(对照本项目研究的"分叉共识")**:工业界已基本放弃"直接整体测完整 agent",主流是 *single-step decision + trace replay + sliced grading*(prior session `0a807fe0`:Promptfoo / DeepEval / LangSmith 三层 eval;Anthropic agent-eval = input→run→trace→grader)。整体 meta-goal 评价正是其中**最贵、最不可靠的 Layer C**。因此 `evaluator` **不实现新的整体裁判**,而是**复用并聚合 baime 已有的切片资产**:

- **Layer 2.5 oracle**(Class A/B/C,TASK-46/55 的产物):决策点级切片准确率。
- **DoD 聚合**:子任务的 shell DoD 结果(measured)。
- **trace replay**:从 L0 的 run 产物/notes 回放关键决策。
- **provenance 门**:任一切片证据 `data_source: measured`,否则该切片判 unknown 而非 pass。

"substantively-verified" 由此**重定义为"一组 measured 切片检查的聚合通过",而不是"一个大裁判说 OK"**——既更便宜,又与项目既有 eval 路线一致。

### 5. Gated 调度 + 护栏

| 护栏 | 机制 | 来源教训 |
|---|---|---|
| 人审门 | `Meta-Proposal→Meta-Plan` 及首次 auto-schedule 需用户批准 | 保留用户宏观控制权 |
| WIP 上限 | 每 cycle 最多 `WIP_CAP` 个子任务进 Ready,不淹没 L0 | L0 容量 |
| budget | 子任务总数 / token / 最大 cycle 数硬顶 | 防失控烧钱 |
| 去重/幂等 | `desired ⊖ actual` reconcile | daemon TASK-84 ×6 重复 emit |
| frozen 验收 | acceptance 开始后只读 | 反 reward-hacking(TASK-52/53/54) |
| provenance | 实质评价证据须 `data_source: measured` | TASK-46 伪造结果事件 |
| divergence 停机 | 停滞/震荡/不可行 → Needs Human,绝不无限造任务 | 自治系统安全底线 |

### 6. 复用映射

- 子任务计划:`task-to-backlog`(非编码)/ `feature-to-backlog`(编码,TDD + 审查 DoD)。
- 子任务执行:`loop-backlog`(worktree + verifyDod + 合并前独立复验)。
- 方法论分解:可借 `methodology-bootstrapping` 的 Observe-Codify-Automate。
- 实质评价:借本项目已确立的对抗验证 + provenance 门思路。
- `loop-meta` 新增的只有:reconcile 控制壳 + decomposer/evaluator/replanner 三个子代理 + daemon 的 `meta-ready` 事件。

## 适用边界(Non-Goals)

对照开发记录得出的一条硬边界:**`loop-meta` 只适用于"回路本身即产物"的项目,不要泛化到普通软件开发。**

证据:同一作者开发 `meta-cc`(恰是观测 Claude Code session 的工具)时**完全没有**使用这套自治机制——纯常规开发(737 Bash、Agent 仅 22、内置 task list、**无 daemon / 无 Monitor / 无 ScheduleWakeup**)。也就是说作者是**有选择地**上自治:meta-cc 这类"普通软件",常规开发已足够;baime 之所以值得 `loop-meta`,是因为**它的产品本身就是"自我改进的方法论回路"**,自治回路是被研究对象,也是交付物。

因此:

- ✅ 适用:方法论/自改进系统研究,目标可分解为大量同构子任务,且**已具备切片 oracle 资产**(如 baime 的 Layer 2.5)。
- ❌ 不适用:普通业务软件、一次性交付、子任务异构且无可复用验收切片——此时人工 `loop-backlog` 颗粒度已是更优解,`loop-meta` 是过度工程。

## Trade-offs and Risks

- **这是一个会自己造活儿的系统**:最大风险是 reward-hacking 与失控。对策已内置(frozen 验收 + 独立评价 + 人审门 + budget + divergence 停机);**首期默认 propose-only**,验证稳定后再开 gated 自动调度。
- **ROI 频率证据偏薄**:历史上"执行反馈回灌进计划"只出现过屈指可数几次(1 个 reopen + 本会话的 review-revise)。故 rollout **证据驱动**:先在 P2/P3 量化"replan 实际触发频率、evaluator 切片可靠性",用 measured 数据决定是否值得投 P4 自治(见 Rollout)。
- **成本**:meta 回路 + 子代理 fan-out 很贵 → budget 硬顶 + 小步 cache-friendly 迭代。
- **诊断质量**:replanner 根因分类错会改错层 → 诊断也要求引用证据,必要时多票。
- **黑板竞态**:L1 与 L0 并发改 backlog → 沿用 loop-backlog 已有的 claim/状态约定,Meta 泳道与 leaf 泳道物理分离降低冲突。
- **状态扩展**:新增 Meta 状态需 backlog.md 支持自定义列;若 config.yml 方案受限,退化为 `meta` label + 视图过滤(已在选型中排在次选)。

## Rollout(证据驱动分期)

每一期都先满足前一期的"放行证据"才推进——这本身就是 `substantively-verified` 的自我应用。

0. **P0 前置:L0 可观测性**。先确保 `loop-backlog` 把 evaluator 所需的真相忠实写回 backlog:每个 DoD 的 PASS/FAIL、verifyDod 的 attempt 次数、实质证据路径。
   - 依据:当前 notes 里 **0 条 "DoD #N FAIL" 记录**(尽管 verifyDod fix-loop 存在),说明 L0 结果可能未被充分记录;若不补,evaluator 读到的是不完整状态,会瞎判。
   - 放行证据:随机抽查近 N 个 Done 任务,notes 含可解析的 DoD 结果 + verifyDod attempts。
1. **P1 Meta 泳道 + daemon `meta-ready` + L0 过滤**(基础设施)。放行:`status: ready` 的 Meta 任务不触发 `task-ready`(daemon 单元测试)。
2. **P2 `loop-meta`(propose-only)**:reconcile + decomposer,产出 Backlog 态子任务,人工移 Ready(等价现状,验证分解质量 + 幂等)。放行:分解质量人审通过 + 重复 `meta-ready` 不重复建任务。
3. **P3 evaluator + replanner**:闭合"评价→replan";evaluator 用切片聚合(§4)。**放行(关键 ROI 闸门)**:measured 记录"replan 触发频率"与"evaluator 切片 vs 人工判断的一致率";若 replan 极少触发或 evaluator 不可靠,**停在 P3,不进 P4**。
4. **P4 Gated 自动调度**:WIP/budget/人审门,开启自治。仅当 P3 放行证据成立才做。
5. **P5 宏观 intake**:meta-proposal 录入 + reviewLoop。

## Acceptance Gate(Frozen)

首个 meta-goal 用**重放 TASK-46** 自检:给 `loop-meta` 一个"会翻车"的目标(初始计划用估计数据冒充测量),验收它能否经 L0 执行 → evaluator 判 NotMet(provenance≠measured)→ replanner 诊断为 WrongDoD/HarnessFault → 自行改成真实测量并收敛到 `Meta-Done`,全程不放宽 frozen 验收。

- [ ] L0 可观测性:近 N 个 Done 任务 notes 含可解析的 DoD 结果 + verifyDod attempts(P0)
- [ ] `grep -q 'meta-ready' scripts/loop-backlog-daemon.js` (P1)
- [ ] Meta 泳道任务不产生 `task-ready`(daemon 单元测试,P1)
- [ ] `loop-meta` reconcile 幂等:重复 `meta-ready` 不重复建子任务(测试,P2)
- [ ] evaluator 为切片聚合(复用 Layer 2.5 oracle + DoD),**非整体 LLM judge**;每切片 `data_source: measured`(P3)
- [ ] P3→P4 ROI 闸门:measured 记录 replan 触发频率 + evaluator 切片与人工判断一致率(P3)
- [ ] 重放 TASK-46 自检:`loop-meta` 自行从"伪造结果计划"收敛到真实测量(P3/P4)
- [ ] `bash scripts/validate-plugin.sh`
