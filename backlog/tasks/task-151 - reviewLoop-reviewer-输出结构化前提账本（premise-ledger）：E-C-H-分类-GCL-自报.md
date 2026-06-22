---
id: TASK-151
title: reviewLoop reviewer 输出结构化前提账本（premise-ledger）：E/C/H 分类 + GCL 自报
status: 'Basic: Done'
assignee: []
created_date: '2026-06-22 10:29'
updated_date: '2026-06-22 10:39'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
在 feature-to-backlog 和 epic-to-backlog 的 reviewLoop reviewer agent 裁决时，除写 verdict 外，emit 一条结构化前提账本（premise-ledger）：对其检查的每条 criterion，记录所用前提及其 E/C/H 分类（E=本任务 artifact 可读；C=需跳转外部 artifact；H=无 artifact 靠推断），并自报 GCL=E+C+H。目的：把 Gate 理解负载（GCL）中的 H 分量从事后负空间估算变成 gate 时刻的实测字段，使其始终可被 git/meta-cc 机械追踪，无需 forensic 重建。依据 TASK-150 GCL 研究（docs/research/gcl-synthesis.md、gcl-intervention.md）。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: reviewLoop reviewer 输出结构化前提账本（premise-ledger）

## Background

TASK-150 的 GCL 研究证明：gate 判断的隐性项（H，无 artifact 支撑、靠判断者记忆的前提）是认知负荷中最难压缩、也最缺测量的分量。当前 H 只能事后用"负空间估算法"重建（gcl-corpus.md，置信度中低、单人偏差）。根因是 reviewer 的推理从未被 instrument：feature-to-backlog 和 epic-to-backlog 的 reviewLoop agent 裁决时只写 `Plan review iteration N: APPROVED`，记录"裁决"而不记录"前提"。git、task Notes、meta-cc 主 session 都只能查到 APPROVED，查不到判断凭据；reviewer 的真实推理跑在后台子 agent 里，不回灌主 session。结果：H 永远查不到，与查询时机无关。本任务把 reviewer 的判断前提变成 gate 时刻自报的结构化字段，让 H 从估算变实测、始终可机械追踪。

## Goals

1. feature-to-backlog 的 plan reviewLoop agent 在 APPROVED 时，向 task Notes 追加一条结构化 premise-ledger：每条已检查 criterion 对应一行 `[E|C|H] <criterion>: <premise>`，并含一行 `GCL-self-report: E=<n> C=<n> H=<n>`。可验证：SKILL.md Phase 4 reviewer prompt 含 `premise-ledger` 与 `GCL-self-report` 指令。
2. epic-to-backlog 的 proposal 与 plan reviewLoop agent 对称加入同一 premise-ledger 指令。可验证：SKILL.md 两处 reviewer 段均含 `premise-ledger`。
3. premise-ledger 的格式（E/C/H 定义 + GCL-self-report 行）在两个 SKILL.md 中作为统一规范出现，措辞一致。
4. scripts/feature-to-backlog.test.sh 与 scripts/epic-to-backlog.test.sh 各加 ≥1 个断言，验证 premise-ledger 规范存在于对应 SKILL.md；`bash scripts/validate-plugin.sh` 退出 0。

## Proposed Approach

在两个 skill 的 reviewLoop reviewer prompt 的 APPROVED 分支（feature-to-backlog Phase 4 line ~391；epic-to-backlog proposal line ~304 与 plan line ~432）插入 premise-ledger 生成指令。reviewer 本就逐条检查 criteria，复用其推理，零额外 LLM 轮次：在写 `append-notes "... APPROVED"` 时，把 verdict 行扩展为多行账本。E/C/H 的判定标准用一段统一规范文字定义（E=本任务 task 文件可直接读到；C=须跳转外部 task/doc/parent；H=任何 artifact 都没有、靠背景知识）。两个 SKILL.md 的现有 `*.test.sh` 是 grep 式 spec 测试，新增断言检查规范文本存在即可，无需 LLM、无需网络。

## Trade-offs and Risks

**不做**：不改人类 gate（Backlog→Ready）——人不会写账本，且那道闸应靠 Scope− 压缩而非 instrument；不建新的 meta-cc 查询管道（本任务只产数据，消费是后续任务）；不改 loop-backlog worker 的 DoD 记录（TASK-149 已覆盖）。

**风险——自报盲点**：reviewer 可能漏报它没意识到在用的隐性前提，故账本降低而非消除 H 测量偏差。已在 Goals 中限定为"自报"，交叉验证留待后续 meta-cc 比对。

**风险——Notes 体积**：每次 gate 多若干行。可接受（与 TASK-149 同理，Notes 为 append-only prose）。

**风险——E/C/H 判定主观**：靠 reviewer 一致应用规范定义。通过在两个 skill 中用同一段定义文字缓解，并在 test 中断言定义存在。

---

# Plan: reviewLoop reviewer 输出结构化前提账本（premise-ledger）

Proposal: (embedded above)

## Phase A: 在 feature-to-backlog plan reviewLoop 注入 premise-ledger

### Tests (write first)
- 扩展 `scripts/feature-to-backlog.test.sh`：新增断言
  - `grep -q 'premise-ledger' plugin/skills/feature-to-backlog/SKILL.md`（账本指令存在）
  - `grep -q 'GCL-self-report' plugin/skills/feature-to-backlog/SKILL.md`（自报行存在）
  - 红基线：编辑前两断言失败（当前 SKILL.md 无此文本）。

### Implementation
- File: `plugin/skills/feature-to-backlog/SKILL.md`
- 在 Phase 4 reviewLoop reviewer prompt 的 APPROVED 分支（line ~391，`--append-notes "Plan review iteration <N>: APPROVED"` 处）后插入 premise-ledger 生成指令：
  ```
  在写 APPROVED 时，把 verdict 扩展为结构化前提账本（premise-ledger）：
  对你检查的每条 criterion，追加一行 `[E|C|H] <criterion>: <你判断所凭的前提>`，
  分类规则：E=该前提可直接从本任务 task 文件读到；C=须跳转外部 task/doc/parent 才能确认；
  H=任何 artifact 都没有、靠背景知识或记忆推断。
  末尾追加一行 `GCL-self-report: E=<n> C=<n> H=<n>`（各类计数）。
  写法示例（单次 append-notes 多行）：
    backlog task edit <TASK_ID> --append-notes "Plan review iteration <N>: APPROVED
    premise-ledger:
    [E] goal coverage: 3 goals 映射到 Phase A/B/C
    [C] file paths exist: 引用的外部文件经 search 确认
    [H] DoD 充分性基准: 何为'足够'凭背景判断
    GCL-self-report: E=2 C=1 H=1"
  ```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'premise-ledger' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'GCL-self-report' plugin/skills/feature-to-backlog/SKILL.md`

## Phase B: 在 epic-to-backlog 两处 reviewLoop 对称注入 premise-ledger

### Tests (write first)
- 扩展 `scripts/epic-to-backlog.test.sh`：新增断言
  - `grep -q 'premise-ledger' plugin/skills/epic-to-backlog/SKILL.md`
  - `grep -q 'GCL-self-report' plugin/skills/epic-to-backlog/SKILL.md`
  - `[ $(grep -c 'premise-ledger' plugin/skills/epic-to-backlog/SKILL.md) -ge 2 ]`（proposal + plan 两处）
  - 红基线：编辑前失败。

### Implementation
- File: `plugin/skills/epic-to-backlog/SKILL.md`
- 在 proposal self-review APPROVED 分支（line ~304）与 plan reviewLoop APPROVED 分支（line ~432）各插入与 Phase A 相同措辞的 premise-ledger 指令（保持跨 skill 一致）。

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `[ $(grep -c 'premise-ledger' plugin/skills/epic-to-backlog/SKILL.md) -ge 2 ]`
- [ ] `grep -q 'GCL-self-report' plugin/skills/epic-to-backlog/SKILL.md`

## Phase C: 统一 E/C/H 规范定义与一致性断言

### Tests (write first)
- `scripts/feature-to-backlog.test.sh` 与 `scripts/epic-to-backlog.test.sh` 各加断言：E/C/H 定义文本存在（`grep -q 'H=.*靠背景' <skill>` 或等价分类定义关键词）。
- 一致性：两个 SKILL.md 中 premise-ledger 段落的分类定义关键词一致（同一断言模式在两文件均通过）。

### Implementation
- 复核 Phase A/B 插入文本，确保 E/C/H 三类定义在两个 SKILL.md 中措辞一致（同一段规范）。
- 若 validate-plugin.sh 的 contracts-density 或 meta-lint 对新增定量字样（如 `E=<n>`）报 WARN，按需为示例数字加 evidence/[unvalidated] 标注或改为占位符 `E=<n>` 形式避免裸数字。

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q '靠背景' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q '靠背景' plugin/skills/epic-to-backlog/SKILL.md`

## Constraints
- 只改两个 SKILL.md 和两个对应 `*.test.sh`；不碰 loop-backlog、不碰人类 gate 流程
- 不建 meta-cc 消费管道（后续任务）
- premise-ledger 必须在单次 `--append-notes` 调用内多行写出（避免多次 edit）
- 两个 skill 的 premise-ledger 措辞保持一致（统一规范）
- 示例中的 GCL 数字仅为格式示例，不得作为定量主张（避免 meta-lint 误判）

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'premise-ledger' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `[ $(grep -c 'premise-ledger' plugin/skills/epic-to-backlog/SKILL.md) -ge 2 ]`
- [ ] `grep -q 'GCL-self-report' plugin/skills/feature-to-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal drafted and self-reviewed: APPROVED (motivation/goals/feasibility/completeness/consistency all pass). Starting plan draft.

claimed: 2026-06-22T10:35:50Z

## Execution Summary
Result: done
Phases completed: A (ftb SKILL.md), B (etb SKILL.md x2), C (test scripts)
Commit: b11cb45844436c7633469bc271f772402220b591

Completed: 2026-06-22T10:39:37Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'premise-ledger' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #3 grep -q 'GCL-self-report' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #4 bash scripts/validate-plugin.sh
- [ ] #5 [ $(grep -c 'premise-ledger' plugin/skills/epic-to-backlog/SKILL.md) -ge 2 ]
- [ ] #6 grep -q 'GCL-self-report' plugin/skills/epic-to-backlog/SKILL.md
- [ ] #7 bash scripts/validate-plugin.sh
- [ ] #8 grep -q '靠背景' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #9 grep -q '靠背景' plugin/skills/epic-to-backlog/SKILL.md
- [ ] #10 bash scripts/validate-plugin.sh
- [ ] #11 grep -q 'premise-ledger' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #12 [ $(grep -c 'premise-ledger' plugin/skills/epic-to-backlog/SKILL.md) -ge 2 ]
- [ ] #13 grep -q 'GCL-self-report' plugin/skills/feature-to-backlog/SKILL.md
<!-- DOD:END -->
