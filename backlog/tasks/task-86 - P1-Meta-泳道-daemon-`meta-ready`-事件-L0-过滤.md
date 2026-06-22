---
id: TASK-86
title: 'P1: Meta 泳道 + daemon `meta-ready` 事件 + L0 过滤'
status: "Basic: Done"
assignee: []
created_date: '2026-06-20 06:03'
updated_date: '2026-06-20 06:44'
labels:
  - kind:basic
  - loop-meta
  - daemon
  - infrastructure
dependencies:
  - TASK-85
references:
  - docs/proposals/loop-meta-architecture.md
modified_files:
  - backlog/config.yml
  - scripts/loop-backlog-daemon.js
  - scripts/loop-backlog-daemon.test.js
  - scripts/test-daemon-meta-filter.sh
  - plugin/skills/loop-backlog/SKILL.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

loop-meta（L1）与 loop-backlog（L0）共用同一 backlog 黑板，必须通过状态泳道物理隔离：L0 永远不拾取 Meta 任务；L1 只响应 `meta-ready` 事件。当前 daemon 只有 `task-ready` 一种事件类型，backlog config.yml 也没有 Meta 状态。

P1 是 loop-meta 的基础设施层，后续 P2/P3/P4/P5 均依赖它。

## Goals

1. `backlog/config.yml` 中新增 Meta 泳道状态：`Meta-Proposal`、`Meta-Plan`、`Meta-Active`、`Meta-Done`（`Needs Human` 已存在）。
2. `scripts/loop-backlog-daemon.js` 扩展：对处于 Meta 泳道且需要 L1 拾取的任务发出 `meta-ready:TASK-N` 事件。
3. daemon 对 `task-ready` 的 emit **排除** Meta 泳道任务（防止 L0 误消费）。
4. L0 的 Monitor 过滤逻辑确认只订阅 `task-ready`（代码层面已是如此，需有回归测试）。
5. 新增 daemon 单元测试：给定一个 `status: Meta-Plan` 的任务，断言 daemon emit `meta-ready:TASK-N` 而非 `task-ready:TASK-N`。

## Proposed Approach

直接编辑 `backlog/config.yml`（仿 backlog-setup 现有做法，不用已废弃 CLI）。扩展 daemon.js 的扫描逻辑，增加 Meta 泳道判定与第二事件类型。为 daemon 新增单元测试脚本。

## Trade-offs and Risks

- config.yml 新增状态对现有 leaf 任务零影响（Backlog→Done 泳道不变）。
- 若 backlog.md 不支持 config.yml 自定义状态，退化为 `meta` label + 视图过滤（记录在约束中）。

## References

- docs/proposals/loop-meta-architecture.md（§1 Meta 泳道、§2 daemon 扩展）
- scripts/loop-backlog-daemon.js
- backlog/config.yml
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 backlog/config.yml 含 Meta-Proposal、Meta-Plan、Meta-Active、Meta-Done 状态
- [ ] #2 grep -q 'meta-ready' scripts/loop-backlog-daemon.js
- [ ] #3 Meta 泳道任务不产生 task-ready 事件（daemon 单元测试通过）
- [ ] #4 bash scripts/validate-plugin.sh 通过
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: P1: Meta 泳道 + daemon `meta-ready` 事件 + L0 过滤

## Background

loop-meta（L1）与 loop-backlog（L0）共用同一 backlog 黑板，必须通过状态泳道物理隔离：L0 永远不拾取 Meta 任务；L1 只响应 `meta-ready` 事件。当前 daemon（`scripts/loop-backlog-daemon.js`）只有 `task-ready` 一种事件类型；`backlog/config.yml` 的 `statuses` 数组中也没有任何 Meta 状态。没有这层隔离，L0 会误消费 Meta 任务，导致 L1 永远收不到信号——这是 loop-meta 整体架构（P2/P3/P4/P5）的基础设施前提。

## Goals

1. `backlog/config.yml` 中新增 Meta 泳道状态：`Meta-Proposal`、`Meta-Plan`、`Meta-Active`、`Meta-Done`（`Needs Human` 已存在）。
2. `scripts/loop-backlog-daemon.js` 扩展：对处于 Meta 泳道（`Meta-Proposal` 或 `Meta-Plan`）且需要 L1 拾取的任务发出 `meta-ready:TASK-N` 事件。
3. daemon 对 `task-ready` 的 emit **排除** Meta 泳道任务（防止 L0 误消费）。
4. L0 的 Monitor 过滤逻辑确认只订阅 `task-ready`（代码层面已是如此，需有回归测试覆盖）。
5. 新增 daemon 单元测试脚本 `scripts/test-daemon-meta-filter.sh`：给定一个 `status: Meta-Plan` 的任务，断言 daemon emit `meta-ready:TASK-N` 而非 `task-ready:TASK-N`。

## Proposed Approach

直接编辑 `backlog/config.yml` 的 `statuses` 数组，追加四个 Meta 状态（仿 backlog-setup 现有做法，不用已废弃 CLI）。扩展 `scripts/loop-backlog-daemon.js` 的扫描逻辑：新增 `isMetaReady(filepath)` 函数判断文件状态是否属于 Meta 泳道，将其从 `task-ready` 路径剔除，改为 emit `meta-ready:TASK-N`。新增 `scripts/test-daemon-meta-filter.sh` 单元测试脚本，用临时目录构造最小 fixture，运行 daemon 若干轮后断言输出。

## Trade-offs and Risks

- **零影响**：config.yml 新增状态不影响现有 Backlog→Done 泳道的任务。
- **退化方案**：若 backlog.md 不支持 config.yml 自定义状态，退化为 `meta` label + 视图过滤；daemon 的事件类型仍可独立实现。
- **测试稳定性**：单元测试使用 `--interval 0.1` 降低等待时间，并设置超时防止悬挂。
- **L0 兼容**：L0 的 Monitor 已只订阅 `task-ready`，新事件类型对其透明；回归测试显式覆盖该假设。

---

# Plan: P1: Meta 泳道 + daemon `meta-ready` 事件 + L0 过滤

Proposal: docs/proposals/loop-meta-architecture.md

## Phase A: 扩展 backlog/config.yml — 新增 Meta 泳道状态

### Tests (write first)

以下断言在当前代码库上为 RED：

```bash
! grep -q 'Meta-Proposal' backlog/config.yml
! grep -q 'Meta-Plan' backlog/config.yml
! grep -q 'Meta-Active' backlog/config.yml
! grep -q 'Meta-Done' backlog/config.yml
```

### Implementation

修改 `backlog/config.yml`：将 `statuses` 数组扩展，追加四个 Meta 状态：

```yaml
statuses: ["Proposal", "Plan", "Backlog", "Ready", "In Progress", "Done", "Needs Human", "Meta-Proposal", "Meta-Plan", "Meta-Active", "Meta-Done"]
```

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'Meta-Proposal' backlog/config.yml`
- [ ] `grep -q 'Meta-Plan' backlog/config.yml`
- [ ] `grep -q 'Meta-Active' backlog/config.yml`
- [ ] `grep -q 'Meta-Done' backlog/config.yml`

---

## Phase B: 扩展 daemon — 增加 meta-ready 事件 + 排除 Meta 任务的 task-ready

### Tests (write first)

以下断言在当前代码库上为 RED：

```bash
! grep -q 'meta-ready' scripts/loop-backlog-daemon.js
! grep -q 'META_STATUSES' scripts/loop-backlog-daemon.js
```

### Implementation

修改 `scripts/loop-backlog-daemon.js`：新增 `META_STATUSES` 常量、`isMetaReady(filepath)` 函数、`scanMetaReadyIds(tasksDir)` 函数；修改 `scanReadyIds` 排除 Meta 任务；在 `setInterval` 回调中新增 `meta-ready` emit 块，使用独立的 `metaNotified` Set。

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'meta-ready' scripts/loop-backlog-daemon.js`
- [ ] `grep -q 'META_STATUSES' scripts/loop-backlog-daemon.js`
- [ ] `grep -q 'isMetaReady' scripts/loop-backlog-daemon.js`

---

## Phase C: 新增 daemon 单元测试脚本 scripts/test-daemon-meta-filter.sh

### Tests (write first)

以下断言在当前代码库上为 RED：

```bash
! test -f scripts/test-daemon-meta-filter.sh
```

### Implementation

创建 `scripts/test-daemon-meta-filter.sh`（`chmod +x`）。脚本创建临时 tasks 目录，写入三个 fixture 文件（Meta-Plan、Ready、Meta-Active），后台启动 daemon 并收集输出，断言 meta-ready 与 task-ready 事件路由正确，清理并 exit 0/1。

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f scripts/test-daemon-meta-filter.sh`
- [ ] `bash scripts/test-daemon-meta-filter.sh`

---

## Constraints

- `isMetaReady` 必须与 `isReady` 互斥：同一文件不能同时产生两种事件。
- config.yml 的改动不得删除或改变现有 statuses（只追加）。
- 测试脚本不依赖外部 npm 包，只使用 Node.js stdlib 和 bash 基础工具。
- 若 backlog.md 不接受 config.yml 自定义状态，退化为 `meta` label + daemon 读取 label 字段判定（记录为已知限制，不阻塞本 PR）。

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'Meta-Proposal' backlog/config.yml`
- [ ] `grep -q 'meta-ready' scripts/loop-backlog-daemon.js`
- [ ] `test -f scripts/test-daemon-meta-filter.sh`
- [ ] `bash scripts/test-daemon-meta-filter.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal approved. Starting plan draft.

Plan review iteration 1: APPROVED

Phase A ✓ 2026-06-20T06:50:00Z
Added Meta-Proposal, Meta-Plan, Meta-Active, Meta-Done to backlog/config.yml statuses

Phase B ✓ 2026-06-20T06:50:00Z
Daemon v4: META_STATUSES, isMetaReady, scanMetaReadyIds, meta-ready events, L0 exclusion. Updated SKILL.md embedded template to v4.

Phase C ✓ 2026-06-20T06:50:00Z
Created scripts/test-daemon-meta-filter.sh — 9 assertions, all pass

## Execution Summary
Result: Done
Commit: 61f74c6
All 14 DoD items PASS. 25/25 unit tests pass, 9/9 integration tests pass.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 grep -q 'meta-ready' scripts/loop-backlog-daemon.js
- [x] #2 grep -q 'Meta-Proposal' backlog/config.yml
- [x] #3 test -f scripts/test-daemon-meta-filter.sh
- [x] #4 bash scripts/test-daemon-meta-filter.sh
- [x] #5 bash scripts/validate-plugin.sh
- [x] #6 bash scripts/validate-plugin.sh
- [x] #7 grep -q 'Meta-Proposal' backlog/config.yml
- [x] #8 grep -q 'Meta-Plan' backlog/config.yml
- [x] #9 grep -q 'Meta-Active' backlog/config.yml
- [x] #10 grep -q 'Meta-Done' backlog/config.yml
- [x] #11 grep -q 'meta-ready' scripts/loop-backlog-daemon.js
- [x] #12 grep -q 'META_STATUSES' scripts/loop-backlog-daemon.js
- [x] #13 grep -q 'isMetaReady' scripts/loop-backlog-daemon.js
- [x] #14 test -f scripts/test-daemon-meta-filter.sh
- [x] #15 bash scripts/test-daemon-meta-filter.sh
<!-- DOD:END -->
