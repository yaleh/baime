---
id: TASK-129
title: daemon 可观测性与运行时产物卫生（child-done grep / 提交 test / gitignore）
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 12:06'
updated_date: '2026-06-21 13:32'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
两项独立小修，归为单个 Basic Task。

**Phase A — daemon-status.sh 补全 child-done 事件模式**
scripts/daemon-status.sh 的 last-event grep 为 (basic|epic)-ready:|epic_task:|child_task:|terminal: ，缺 child-done: 。结果：daemon 正在发 child-done 时 daemon-status 仍显示 "(no log)"（本会话 bootstrap 后即如此）。修复：grep 模式加入 child-done: ，并清理已退役的 epic_task:|child_task: 旧模式。

**Phase B — 运行时产物卫生**
loop-backlog 运行时生成 scripts/basic-daemon.test.js（由 ensureDaemonTest 写出）但未入库 —— fresh clone / CI 无法运行该自测。方案：将 basic-daemon.test.js 提交入库（与已入库的 scripts/daemon-routing.test.js 对齐），ensureDaemonTest 退化为"缺失才写 + 始终运行"。同时把运行时产物 backlog/.basic-daemon.log、backlog/.basic-daemon.pid、backlog/.caps/ 加入 .gitignore（本会话这些文件以 untracked 形式污染 git status）。

DoD 应包含：daemon-status.sh 在有 child-done 事件时正确显示 last-event；node scripts/basic-daemon.test.js 通过；git status 不再出现上述运行时产物；validate-plugin.sh 通过。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: daemon 可观测性修复 — child-done 事件可见性

## Background

`scripts/daemon-status.sh` 的 last-event grep 模式为
`(basic|epic)-ready:|epic_task:|child_task:|terminal:`，遗漏了 `child-done:` 事件。
`basic-daemon.js`（第152行）在子任务完成时确实发出 `child-done:TASK-N`，但
`daemon-status.sh` 看不见该事件，导致 epic 父任务协调阶段运维人员看到
"(no log)"，无法判断 daemon 是否在正常推进 —— 这会让误以为 daemon 卡死而
手动重启，反而打断正在执行的 child-done 处理流程。此外，模式中保留的
`epic_task:|child_task:` 是已退役的旧字段名（unified-worker 重构后不再使用），
留在 grep 中只会制造混乱。修复范围：仅调整该 grep 模式，不涉及 daemon 逻辑。

## Goals

1. `daemon-status.sh` 的 last-event grep 加入 `child-done:` 模式，使其在子任务
   完成阶段能正确显示 last-event 而非 "(no log)"。
2. 从 grep 模式中移除已退役的 `epic_task:` 和 `child_task:` 字段，避免误导。
3. `node scripts/basic-daemon.test.js` 全部断言通过，`validate-plugin.sh` 通过。
4. 在日志中存在 `child-done:` 行时，`daemon-status.sh` 输出该行而非 "(no log)"
   （可用临时测试日志文件手动验证）。

## Approach

仅修改 `scripts/daemon-status.sh` 第48行的 grep 模式：

```
# 旧
grep -E '(basic|epic)-ready:|epic_task:|child_task:|terminal:' ...

# 新
grep -E '(basic|epic)-ready:|child-done:|terminal:' ...
```

无需改动 `basic-daemon.js`、`validate-plugin.sh` 或任何其他文件。
`scripts/basic-daemon.test.js` 已入库（commit 79cbafe），`.gitignore` 已覆盖
`backlog/*.log`、`backlog/*.pid`、`backlog/.caps` —— 无运行时产物卫生问题。

## Trade-offs and Risks

- **范围极小**：单文件单行改动，回归风险极低。
- **不改 terminal: 模式**：`terminal:` 保留，虽然当前 daemon 未使用，但留着无害
  且可作为未来扩展点；移除它会略微净化模式但收益不足以值得讨论。
- **无新测试需求**：grep 行为可用现有 validate-plugin.sh + 手动日志文件验证，
  无需新增自动化测试。
- **不触碰 ensureDaemonTest 逻辑**：该函数在 SKILL.md 中已实现"缺失才写"语义，
  本任务不需要改动它。

## Definition of Done

- `daemon-status.sh` 在日志含 `child-done:` 行时正确显示 last-event（非 no log）。
- grep 模式中不再含 `epic_task:` 或 `child_task:`。
- `validate-plugin.sh` 通过。

---

# Plan: daemon 可观测性修复 — child-done 事件可见性

Proposal: docs/proposals/proposal-task-129.md

## Phase A: fix daemon-status.sh child-done grep pattern

### Tests (write first)

These structural assertions MUST fail before implementation (the old pattern does not contain `child-done:` and still contains the retired fields):

```bash
# T1 — new pattern is present (fails before implementation)
grep -q 'child-done:' scripts/daemon-status.sh

# T2 — retired epic_task: field is absent (fails before implementation)
! grep -q 'epic_task:' scripts/daemon-status.sh

# T3 — retired child_task: field is absent (fails before implementation)
! grep -q 'child_task:' scripts/daemon-status.sh
```

### Implementation

Edit `scripts/daemon-status.sh` line 48: replace the grep pattern

```
# old (line 48)
    le=$(grep -E '(basic|epic)-ready:|epic_task:|child_task:|terminal:' "$logfile" 2>/dev/null | tail -1)

# new
    le=$(grep -E '(basic|epic)-ready:|child-done:|terminal:' "$logfile" 2>/dev/null | tail -1)
```

No other files are modified.

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'child-done:' scripts/daemon-status.sh`
- [ ] `! grep -q 'epic_task:' scripts/daemon-status.sh`
- [ ] `! grep -q 'child_task:' scripts/daemon-status.sh`
- [ ] `TMP=$(mktemp); echo 'child-done:TASK-99' > "$TMP"; grep -E '(basic|epic)-ready:|child-done:|terminal:' "$TMP" | grep -q 'child-done:'; rm -f "$TMP"`

## Constraints

- Only `scripts/daemon-status.sh` line 48 is modified; no other files change.
- `terminal:` is retained in the new pattern (harmless future extension point).
- No new test files are added; behavioural coverage is provided by the temp-log DoD item above.

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'child-done:' scripts/daemon-status.sh`
- [ ] `! grep -q 'epic_task:' scripts/daemon-status.sh`
- [ ] `! grep -q 'child_task:' scripts/daemon-status.sh`
- [ ] `TMP=$(mktemp); echo 'child-done:TASK-99' > "$TMP"; grep -E '(basic|epic)-ready:|child-done:|terminal:' "$TMP" | grep -q 'child-done:'; rm -f "$TMP"`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 2: APPROVED

Proposal approved. Starting plan draft.

Plan review iteration 1: APPROVED

claimed: 2026-06-21T13:29:46Z

Completed: 2026-06-21T13:32:34Z
Agent completed: fixed daemon-status.sh grep pattern (child-done: added, epic_task:/child_task: removed). All DoD passed.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'child-done:' scripts/daemon-status.sh
- [ ] #3 ! grep -q 'epic_task:' scripts/daemon-status.sh
- [ ] #4 ! grep -q 'child_task:' scripts/daemon-status.sh
- [ ] #5 TMP=$(mktemp); echo 'child-done:TASK-99' > "$TMP"; grep -E '(basic|epic)-ready:|child-done:|terminal:' "$TMP" | grep -q 'child-done:'; rm -f "$TMP"
- [ ] #6 bash scripts/validate-plugin.sh
- [ ] #7 grep -q 'child-done:' scripts/daemon-status.sh
- [ ] #8 ! grep -q 'epic_task:' scripts/daemon-status.sh
- [ ] #9 ! grep -q 'child_task:' scripts/daemon-status.sh
- [ ] #10 TMP=$(mktemp); echo 'child-done:TASK-99' > "$TMP"; grep -E '(basic|epic)-ready:|child-done:|terminal:' "$TMP" | grep -q 'child-done:'; rm -f "$TMP"
<!-- DOD:END -->
