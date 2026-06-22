---
id: TASK-150
title: 研究——定义并基线化 Gate 理解负载（GCL），验证「压缩所需理解表面积」方向
status: 'Basic: Backlog'
assignee: []
created_date: '2026-06-22 09:43'
updated_date: '2026-06-22 09:49'
labels:
  - research
  - methodology
  - gcl
  - 'kind:basic'
dependencies: []
references:
  - docs/baime-software-engineering-capability-analysis.md
  - docs/proposals/proposal-situational-awareness.md
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
随着 loop-backlog 自治深化，「可理解」与「可靠」必须解耦对待：可靠可经验确立，全局可理解有内生障碍（自指无稳定参照系、观察者在圈内、速率非平稳、叶子不透明）。由此推出工程方向：不追全局理解，转而压缩「人为了可靠 gate 所必须理解的量」。

本任务将该方向从论述变成可被数据推翻的主张：操作化 Gate 理解负载（GCL）并基线化，验证 H2（GCL 与 task 耦合度正相关）和 H4（隐性项不随增加 artifact 而缩小，只能靠收窄 gate 判断范围减少需求）。H4 是枢轴：若被证伪，「压缩表面积优于恢复理解」的建议需整体回退。

输出用于修正 proposal-situational-awareness.md 的使命设定，并为后续工具建设提供实证基础。

关联文档：docs/baime-software-engineering-capability-analysis.md §7.3、docs/proposals/proposal-situational-awareness.md
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 研究——定义并基线化 Gate 理解负载（GCL），验证「压缩所需理解表面积」方向

## Context

docs/baime-software-engineering-capability-analysis.md §7.3 提出：全局可理解有内生障碍，工程目标应从「恢复理解」转为「压缩人为了可靠 gate 所必须理解的量」。这个论点目前是论述，不是数据支撑的主张。本任务把它操作化：构造 Gate 理解负载（GCL）度量，基线化现有 gate 的 GCL，验证两个可证伪假设（H2、H4），并据此修正 proposal-situational-awareness.md 的使命设定。

---

## Phase 1：操作化 GCL 定义与测量程序

**目标**：把「人为了 gate 所必须理解的量」从概念变成可复现执行的测量步骤。

**步骤**：
1. 读 `docs/baime-software-engineering-capability-analysis.md` §7.3.1，提取 GCL 三分量定义（自包含项、跨界项、隐性项）。
2. 为每个分量指定可观测代理：
   - 自包含项：task `.md` 字节数 + 内联引用数（`[...](...)`、`` `path` `` 形式）
   - 跨界项：gate 判断前实际 consult 的外部文件数 × 跨 task 引用跳数（从 meta-cc session trace 提取）
   - 隐性项：判断中被援引但无 artifact 来源的事实计数（自报 + session trace 交叉验证）
3. 写测量程序：逐步说明如何从 meta-cc JSONL + backlog task `.md` 提取每个分量的原始值。
4. 输出 `docs/research/gcl-definition.md`：含三分量定义、可观测代理、测量程序、已知局限。

### DoD
- [ ] `test -f docs/research/gcl-definition.md`
- [ ] `grep -q '## 跨界项' docs/research/gcl-definition.md`
- [ ] `grep -q '## 隐性项' docs/research/gcl-definition.md`
- [ ] `grep -q '## 测量程序' docs/research/gcl-definition.md`

---

## Phase 2：语料构建——提取真实 gate 事件

**目标**：从近两周 session 历史中识别并标注真实 gate 事件，构建测量语料。

**步骤**：
1. 用 `mcp__plugin_meta-cc_meta-cc__get_timeline` 或 `query_tool_blocks` 定位近两周含人工判断的 session 段（关键词：approve、APPROVED、gate、DoD、escalat）。
2. 识别 gate 类型（proposal 批准、plan 批准、DoD 撰写、escalation 回复、merge 确认），每类至少 2 个事件，总计 ≥ 12 个。
3. 对每个事件记录：gate 类型、对应 TASK-ID、判断时刻（timestamp）、判断前 N 秒内实际被读取的文件列表（从 session trace Read/tool 调用序列提取）。
4. 输出 `docs/research/gcl-corpus.md`：逐事件表格，含 gate 类型、TASK-ID、timestamp、读取文件列表（原始，未分类）。

### DoD
- [ ] `test -f docs/research/gcl-corpus.md`
- [ ] `grep -c '| TASK-' docs/research/gcl-corpus.md | awk '{exit ($1 >= 12) ? 0 : 1}'`
- [ ] `grep -q 'proposal' docs/research/gcl-corpus.md`
- [ ] `grep -q 'merge' docs/research/gcl-corpus.md`

---

## Phase 3：基线化——逐事件测量 GCL 三分量

**目标**：对语料中每个 gate 事件，用 Phase 1 的测量程序分解 GCL 三分量，形成基线数据集。

**步骤**：
1. 对每个事件，执行 Phase 1 测量程序：
   - 自包含项：`wc -c <task.md>` + 引用计数
   - 跨界项：读取文件列表中不属于本 task artifact 的文件数 × 跳数
   - 隐性项：判断中援引但无 artifact 来源的事实数（标注 measured / estimated，estimation 须说明依据）
2. 每行必须带 provenance 戳（来源路径或 session timestamp），禁止无来源的估算值直接出现在数据列（[unvalidated] 须显式标注）。
3. 输出 `docs/research/gcl-baseline.md`：逐事件数据表（gate 类型 | 自包含 | 跨界 | 隐性 | provenance）+ 分量均值。

### DoD
- [ ] `test -f docs/research/gcl-baseline.md`
- [ ] `grep -q 'provenance' docs/research/gcl-baseline.md`
- [ ] `! grep -q '\[unvalidated\].*[0-9]' docs/research/gcl-baseline.md`
- [ ] `grep -q '## 分量均值' docs/research/gcl-baseline.md`

---

## Phase 4：驱动因素分析——验证 H2

**目标**：检验 H2（GCL 与 task 耦合度正相关：跨引用数越多，跨界项 GCL 越高）。

**步骤**：
1. 从语料提取每个 task 的耦合度代理：跨 task 引用数 + 共享文件编辑数（`git log --follow` 对 task artifact 中引用的外部文件）。
2. 对（耦合度, 跨界 GCL）做 Spearman 秩相关，计算 ρ 和 p 值（用 `python3 -c` 或 `awk`）。
3. 判决规则：ρ > 0.4 且 p < 0.10 → H2 confirmed；否则 null/refuted，说明原因。
4. 输出 `docs/research/gcl-drivers.md`：含原始（耦合度, 跨界 GCL）对、ρ/p 值、H2 判决、局限说明。

### DoD
- [ ] `test -f docs/research/gcl-drivers.md`
- [ ] `grep -qE 'H2.*(confirmed|refuted|null)' docs/research/gcl-drivers.md`
- [ ] `grep -q 'Spearman' docs/research/gcl-drivers.md`

---

## Phase 5：干预试验——验证 H4（枢轴假设）

**目标**：验证 H4——隐性项不随增加 artifact 而缩小，只能靠收窄 gate 判断范围减少需求。H4 是本任务的枢轴：若证伪，「压缩表面积优于恢复理解」的整条建议需回退。

**步骤**：
1. 从基线选 3 个隐性项 > 0 的 gate 事件（覆盖不同 gate 类型）。
2. 对每个事件，构造两个反事实情景：
   - Artifact+：假设 task 已有更完整文档（列出若补充什么 artifact）→ 预测隐性项变化
   - Scope−：假设 gate 判断范围收窄（去掉哪个子判断）→ 预测隐性项变化
3. 用实际 session trace 校验预测（或在无后续 session 时标为「方向性预测，需后续验证」）。
4. H4 判决规则：若 ≥ 2/3 事件中 Artifact+ 预测隐性项变化 ≤ 10%、而 Scope− 预测 ≥ 30% → H4 confirmed；若两个干预效果相当 → null；若 Artifact+ 效果明显更大 → H4 refuted。
5. 输出 `docs/research/gcl-intervention.md`：含 3 个事件的分析、预测值、校验结果、H4 判决。

### DoD
- [ ] `test -f docs/research/gcl-intervention.md`
- [ ] `grep -qE 'H4.*(confirmed|refuted|null)' docs/research/gcl-intervention.md`
- [ ] `[ $(grep -c 'Artifact+\|Scope−' docs/research/gcl-intervention.md) -ge 6 ]`

---

## Phase 6：综合与回灌

**目标**：汇总 H2/H4 判决，据此修正 proposal-situational-awareness.md 使命段，输出最终综合报告。

**步骤**：
1. 读 H2 判决（Phase 4）和 H4 判决（Phase 5）。
2. 按判决结果选择以下之一：
   - H4 confirmed → 修正 `proposal-situational-awareness.md` 使命段：将「帮人重建对系统的理解」改为「最小化人为了可靠 gate 所必须理解的表面积」，并在文件中注明依据（gcl-intervention.md H4 confirmed）。
   - H4 null/refuted → 在 `proposal-situational-awareness.md` 添加注记：§7.3 方向性建议因 H4 数据不支持需重新审视，原使命段暂时保留；在综合报告中说明回退路径。
3. 运行 `bash scripts/validate-plugin.sh`，确保全部定量主张通过 evidence/[unvalidated] meta-lint。
4. 输出 `docs/research/gcl-synthesis.md`：含 H2/H4 判决汇总、对 §7.3 论点的支持/回退评估、后续行动建议。

### DoD
- [ ] `test -f docs/research/gcl-synthesis.md`
- [ ] `grep -qE 'H2.*(confirmed|refuted|null)' docs/research/gcl-synthesis.md`
- [ ] `grep -qE 'H4.*(confirmed|refuted|null)' docs/research/gcl-synthesis.md`
- [ ] `grep -q 'situational-awareness' docs/research/gcl-synthesis.md`
- [ ] `bash scripts/validate-plugin.sh`

---

## Constraints

- 本任务仅产出研究文档，不建任何工具（`orient.sh` 等是后续实现任务，依赖本研究结论）
- 不试图证明「全局可理解不可能」哲学命题，只验证其可测推论 H4
- 单项目样本，泛化性显式列为 out of scope
- 全部定量主张必须带 provenance（measured 非 estimated）；estimation 须标注 [unvalidated] 并说明依据
- N 小（≥ 12 事件），Phase 4/5 结论按方向性而非结论性对待

## Acceptance Gate
- [ ] `test -f docs/research/gcl-definition.md && test -f docs/research/gcl-baseline.md && test -f docs/research/gcl-synthesis.md`
- [ ] `grep -qE 'H4.*(confirmed|refuted|null)' docs/research/gcl-synthesis.md`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 1: APPROVED

cap:propose=approved
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f docs/research/gcl-definition.md
- [ ] #2 grep -q '## 跨界项' docs/research/gcl-definition.md
- [ ] #3 grep -q '## 隐性项' docs/research/gcl-definition.md
- [ ] #4 grep -q '## 测量程序' docs/research/gcl-definition.md
- [ ] #5 test -f docs/research/gcl-corpus.md
- [ ] #6 grep -c '| TASK-' docs/research/gcl-corpus.md | awk '{exit ($1 >= 12) ? 0 : 1}'
- [ ] #7 grep -q 'proposal' docs/research/gcl-corpus.md
- [ ] #8 grep -q 'merge' docs/research/gcl-corpus.md
- [ ] #9 test -f docs/research/gcl-baseline.md
- [ ] #10 grep -q 'provenance' docs/research/gcl-baseline.md
- [ ] #11 ! grep -q '\[unvalidated\].*[0-9]' docs/research/gcl-baseline.md
- [ ] #12 grep -q '## 分量均值' docs/research/gcl-baseline.md
- [ ] #13 test -f docs/research/gcl-drivers.md
- [ ] #14 grep -qE 'H2.*(confirmed|refuted|null)' docs/research/gcl-drivers.md
- [ ] #15 grep -q 'Spearman' docs/research/gcl-drivers.md
- [ ] #16 test -f docs/research/gcl-intervention.md
- [ ] #17 grep -qE 'H4.*(confirmed|refuted|null)' docs/research/gcl-intervention.md
- [ ] #18 [ $(grep -c 'Artifact+\|Scope−' docs/research/gcl-intervention.md) -ge 6 ]
- [ ] #19 test -f docs/research/gcl-synthesis.md
- [ ] #20 grep -qE 'H2.*(confirmed|refuted|null)' docs/research/gcl-synthesis.md
- [ ] #21 grep -qE 'H4.*(confirmed|refuted|null)' docs/research/gcl-synthesis.md
- [ ] #22 grep -q 'situational-awareness' docs/research/gcl-synthesis.md
- [ ] #23 bash scripts/validate-plugin.sh
<!-- DOD:END -->
