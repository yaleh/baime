---
id: TASK-123
title: 'Epic: daemon 可观测性'
status: 'Epic: Done'
assignee: []
created_date: '2026-06-21 09:16'
updated_date: '2026-06-21 09:36'
labels:
  - 'kind:epic'
dependencies: []
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Epic 目标
basic-daemon.js / epic-daemon.js 作为后台进程运行,但缺乏运行态可观测性(存活、最近事件、日志轮转、崩溃恢复)。本 Epic 补齐 daemon 运维能力。

## 拟拆分的 Basic 子任务(decompose 阶段细化)
1. scripts/daemon-status.sh 报告两个 daemon 的 pid/存活/最近事件
2. 两个 daemon 的结构化日志 + 轮转
3. 陈旧/崩溃 daemon 检测与重启提示

## 验收信号
bash scripts/daemon-status.sh (exit 0)
bash scripts/validate-plugin.sh
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: daemon 可观测性

通过一个独立只读脚本 scripts/daemon-status.sh 提供 daemon 运维可观测性,
不改动 daemon JS(避免 daemon-version 三处同步churn)。结构化日志改造作为后续延期项。

## Child 1 (Basic): scripts/daemon-status.sh 报告两 daemon 状态
对 basic/epic 两个 daemon:读 .pid 文件 → kill -0 判活 → 打印 RUNNING/DOWN + 最近事件行 + 日志 mtime。exit 0。
### DoD
- [ ] `test -x scripts/daemon-status.sh || test -f scripts/daemon-status.sh`
- [ ] `bash scripts/daemon-status.sh`

## Child 2 (Basic): 陈旧检测 + 重启提示
daemon-status.sh --check:pid 文件存在但进程已死 → 标 STALE 并 exit 非零,打印重启命令。
### DoD
- [ ] `grep -qE "STALE|--check" scripts/daemon-status.sh`
- [ ] `bash scripts/daemon-status.sh`

## Acceptance Gate (Epic)
- [ ] `bash scripts/daemon-status.sh`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:propose=approved
epicReviewProposal: 范围收敛为独立只读脚本(不动 daemon JS),结构化日志延期。APPROVED.

cap:plan=approved
epicReviewPlan: 2 独立子任务,DoD shell 可断言。APPROVED.

cap:decompose=done child_ids:[TASK-123.1, TASK-123.2]
epicDecompose: 2 kind:basic children, R1 DoD-gate PASS.

epicAwaitChildren: done=2/2 reconcileRunCount=1 — desired=created=done.
cap:await=done all_children_done:true

evaluator: Met | dod_aggregate=PASS(2/2) | acceptance_gate=PASS(daemon-status.sh, validate-plugin.sh) | needs_human=0 | data_source: measured
cap:evaluate=done verdict:Approved
terminal:TASK-123 Epic: Done
NOTE: in-daemon structured logging deferred (would trigger daemon-version 3-file churn) — candidate follow-up.
<!-- SECTION:NOTES:END -->
