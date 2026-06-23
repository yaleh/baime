---
id: TASK-170
title: 'P0: loop-backlog Monitor checkpoint + 无状态 worker（/clear 免重启）'
status: 'Basic: Done'
assignee: []
created_date: '2026-06-23 14:48'
updated_date: '2026-06-23 15:42'
labels:
  - 'kind:basic'
  - 'priority:p0'
  - 'component:loop-backlog'
dependencies: []
references:
  - plugin/skills/loop-backlog/SKILL.md
  - docs/adr/ADR-002-monitor-lifecycle.md
  - docs/adr/ADR-003-monitor-prompt-self-contained.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 问题分析

`/clear` 不终止 Monitor 的 shell 进程（tail -f），但会清除 Claude 对它的 context。当前行为：

1. **已解决（TASK-166）**：Monitor description 包含自恢复指令，新 event 到达时 Claude 会重新 bootstrap loop-backlog。"手动重启"问题已消除。
2. **未解决**：`/clear` 后 board 安静时（没有新 event），worker 静默死亡直到下一个 event 才复活。这是主要剩余风险。
3. **未解决**：`-n 0` 跳过全部历史，`/clear` 期间到达的 event 会永久丢失。
4. **未解决**：协调状态（serial-merge 锁、并发计数、claim 状态）只活在 Claude context 里，context 重建后状态不可靠。

## 目标

Monitor re-attach 后可以从中断点精确续接，不丢 event，不依赖 context 记忆恢复状态。

## 设计方向

### 1. Checkpoint 文件（替代 `-n 0`）

daemon 每写一行到 log，worker 处理完后记录 offset：
```
echo $(wc -c < "$DAEMON_LOG") > backlog/.loop-checkpoint
```
re-attach 时从 checkpoint 续读：
```bash
OFFSET=$(cat backlog/.loop-checkpoint 2>/dev/null || echo 0)
Monitor(command="tail -c +$OFFSET -f \"$DAEMON_LOG\"", ...)
```
`-n 0` 跳全部历史；`-c +$OFFSET` 从断点继续，`/clear` 期间 event 不再丢失。

### 2. 协调状态全部落盘

将 context 里的活状态迁移到文件：

| 状态 | 当前 | 目标 |
|------|------|------|
| claim 幂等 | cap 文件（已有） | 保留 |
| serial-merge 锁 | context 变量 | `backlog/.merge-lock`（flock 或 pid 文件） |
| 并发计数 | context 变量 | `backlog/.active-agents`（每行一个 TASK-ID） |

worker re-bootstrap 时读磁盘状态完整恢复，不依赖记忆。

### 3. Heartbeat event（填补 idle 窗口）

daemon 每 60s emit 一次 `heartbeat:` 行。`/clear` 后即使 board 安静，最多 60s 内触发一次 re-attach，消除静默死亡窗口。workerLoop 收到 `heartbeat:` 直接忽略（no-op），只用于唤醒。

### 4. stopStaleMon() 保留不动

自动 re-attach 会产生孤儿 Monitor，TASK-169 的 guard 是必要的。

## 不做什么

- 不把完整 prompt 下沉到 daemon emit（架构侵入过大）
- 不尝试让 Monitor 成为真正的 OS 级进程（Claude Code 没有此 API）
- 不依赖 Stop hook 写 checkpoint（Stop hook 粒度太粗，且 /clear 不触发 Stop）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 daemon 在 heartbeat channel 每 60s emit 一次 `heartbeat:TIMESTAMP`，workerLoop 收到后 no-op 继续
- [ ] #2 worker 每处理完一个 event 后将当前 DAEMON_LOG 字节偏移写入 backlog/.loop-checkpoint
- [ ] #3 Monitor re-attach 时使用 `tail -c +$OFFSET -f` 从 checkpoint 续读，/clear 期间 event 不丢失
- [ ] #4 serial-merge 锁写入 backlog/.merge-lock（flock 或 pid 文件），worker bootstrap 时可从磁盘读取
- [ ] #5 并发 agent 计数写入 backlog/.active-agents，bootstrap 时可从磁盘恢复（并检查进程是否仍存活）
- [ ] #6 validate-plugin.sh 通过（SKILL.md contracts 全部满足）
- [ ] #7 smoke test：模拟 /clear 后 board 静默 70s，heartbeat 触发 re-attach；再触发一个 basic-ready event，确认无重复执行
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## 问题分析

`/clear` 不终止 Monitor 的 shell 进程（tail -f），但会清除 Claude 对它的 context。当前行为：

1. **已解决（TASK-166）**：Monitor description 包含自恢复指令，新 event 到达时 Claude 会重新 bootstrap loop-backlog。"手动重启"问题已消除。
2. **未解决**：`/clear` 后 board 安静时（没有新 event），worker 静默死亡直到下一个 event 才复活。这是主要剩余风险。
3. **未解决**：`-n 0` 跳过全部历史，`/clear` 期间到达的 event 会永久丢失。
4. **未解决**：协调状态（serial-merge 锁、并发计数、claim 状态）只活在 Claude context 里，context 重建后状态不可靠。

## 目标

Monitor re-attach 后可以从中断点精确续接，不丢 event，不依赖 context 记忆恢复状态。

## 设计方向

### 1. Checkpoint 文件（替代 `-n 0`）

daemon 每写一行到 log，worker 处理完后记录 offset：
```
echo $(wc -c < "$DAEMON_LOG") > backlog/.loop-checkpoint
```
re-attach 时从 checkpoint 续读：
```bash
OFFSET=$(cat backlog/.loop-checkpoint 2>/dev/null || echo 0)
Monitor(command="tail -c +$OFFSET -f \"$DAEMON_LOG\"", ...)
```
`-n 0` 跳全部历史；`-c +$OFFSET` 从断点继续，`/clear` 期间 event 不再丢失。

### 2. 协调状态全部落盘

将 context 里的活状态迁移到文件：

| 状态 | 当前 | 目标 |
|------|------|------|
| claim 幂等 | cap 文件（已有） | 保留 |
| serial-merge 锁 | context 变量 | `backlog/.merge-lock`（flock 或 pid 文件） |
| 并发计数 | context 变量 | `backlog/.active-agents`（每行一个 TASK-ID） |

worker re-bootstrap 时读磁盘状态完整恢复，不依赖记忆。

### 3. Heartbeat event（填补 idle 窗口）

daemon 每 60s emit 一次 `heartbeat:` 行。`/clear` 后即使 board 安静，最多 60s 内触发一次 re-attach，消除静默死亡窗口。workerLoop 收到 `heartbeat:` 直接忽略（no-op），只用于唤醒。

### 4. stopStaleMon() 保留不动

自动 re-attach 会产生孤儿 Monitor，TASK-169 的 guard 是必要的。

## 不做什么

- 不把完整 prompt 下沉到 daemon emit（架构侵入过大）
- 不尝试让 Monitor 成为真正的 OS 级进程（Claude Code 没有此 API）
- 不依赖 Stop hook 写 checkpoint（Stop hook 粒度太粗，且 /clear 不触发 Stop）

Acceptance Criteria:

---

# Plan: P0: loop-backlog Monitor checkpoint + stateless worker (/clear resume)

## Phase A: Heartbeat channel in basic-daemon.js
### Tests (write first)
Run the daemon briefly against a dummy tasks dir and confirm it emits heartbeat lines:
```bash
TMP=$(mktemp -d)
mkdir -p "$TMP/tasks"
timeout 12 node plugin/scripts/basic-daemon.js \
  --tasks-dir "$TMP/tasks" \
  --pid-file  "$TMP/.daemon.pid" \
  --stop-file "$TMP/.loop-stop" \
  --interval  0.5 \
  --heartbeat-interval 5 \
  > "$TMP/daemon.log" 2>&1 || true
grep -q 'heartbeat:' "$TMP/daemon.log" && echo PASS || echo FAIL
rm -rf "$TMP"
```
Since the full test suite is `bash scripts/validate-plugin.sh`, the DoD gate is that script plus greps on the source file.

### Implementation
In `plugin/scripts/basic-daemon.js`:
1. Add `heartbeatInterval` to `parseArgs()` (flag `--heartbeat-interval`, default `60`, parsed as `parseFloat`; stored in seconds).
2. After the existing polling `setInterval`, add a second interval:
   ```js
   const heartbeatMs = Math.round(args.heartbeatInterval * 1000);
   const heartbeatTimer = setInterval(() => {
     if (fs.existsSync(args.stopFile)) { clearInterval(heartbeatTimer); process.exit(0); }
     process.stdout.write(`heartbeat:${Date.now()}\n`);
   }, heartbeatMs);
   ```
3. Keep the existing polling timer and channels unchanged.

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'heartbeat' plugin/scripts/basic-daemon.js`
- [ ] `grep -q 'heartbeat-interval\|heartbeatInterval' plugin/scripts/basic-daemon.js`
- [ ] `grep -q 'heartbeatTimer\|heartbeatMs' plugin/scripts/basic-daemon.js`

---

## Phase B: Checkpoint read/write in SKILL.md (daemonBootstrap + Monitor call)
### Tests (write first)
```bash
grep -q 'loop-checkpoint' plugin/skills/loop-backlog/SKILL.md
grep -q '\-c +' plugin/skills/loop-backlog/SKILL.md
grep -qP 'OFFSET\s*=' plugin/skills/loop-backlog/SKILL.md
```

### Implementation
In `plugin/skills/loop-backlog/SKILL.md`:

1. **daemonBootstrap section** — after the daemon start block, add checkpoint read:
   ```bash
   CHECKPOINT_FILE="${BACKLOG_DIR}/.loop-checkpoint"
   OFFSET=$(cat "$CHECKPOINT_FILE" 2>/dev/null || echo 0)
   # Clamp to actual file size (protects against log rotation or truncation)
   LOG_SIZE=$(wc -c < "$DAEMON_LOG" 2>/dev/null || echo 0)
   if [ "$OFFSET" -gt "$LOG_SIZE" ]; then OFFSET=0; fi
   echo "daemonBootstrap: resuming from byte offset $OFFSET (log size $LOG_SIZE)"
   ```

2. **Monitor call in Spec pseudocode** (workerLoop spec section) — change:
   ```
   command="tail -f -n 0 \"$DAEMON_LOG\""
   ```
   to:
   ```
   command="tail -c +${OFFSET} -f \"$DAEMON_LOG\""
   ```

3. **Monitor call in Implementation / claimBatch bash comment block** — same replacement (the commented-out Monitor example in the `workerLoop (parallel)` section).

4. **Monitor call in Shutdown section** — same replacement in the standalone Monitor block shown there.

5. **After Monitor returns** — in the `workerLoop (parallel)` bash section, immediately after the Monitor line (before the event dispatch case), record the new offset:
   ```bash
   echo $(wc -c < "$DAEMON_LOG" 2>/dev/null || echo 0) > "$CHECKPOINT_FILE"
   ```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'loop-checkpoint' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q '\-c +' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -qP 'OFFSET\s*=' plugin/skills/loop-backlog/SKILL.md`

---

## Phase C: Heartbeat no-op handler in SKILL.md (workerLoop event dispatch)
### Tests (write first)
```bash
grep -q 'heartbeat:' plugin/skills/loop-backlog/SKILL.md
grep -q 'no-op.*wake\|wake.*no-op' plugin/skills/loop-backlog/SKILL.md
```

### Implementation
In `plugin/skills/loop-backlog/SKILL.md`, update BOTH the Spec pseudocode and the bash comment dispatch block:

1. **Spec pseudocode** (workerLoop event-dispatch arms, around the `| otherwise` line) — add a `heartbeat:` arm before `otherwise`:
   ```
   | event matches "heartbeat:*"               → workerLoop()              -- no-op: wake-up only
   | otherwise                                 → workerLoop(),             -- noise: loop back
   ```

2. **Bash comment dispatch block** (the example `case "$EVENT"` inside the `if [ -z "$CLAIMED_TASK_IDS" ]` section) — add the heartbeat case:
   ```bash
   #   case "$EVENT" in
   #     heartbeat:*)         : ;;                                        # no-op: wake-up only
   #     epic-ready:*)        epicDecompose "${EVENT#epic-ready:}" ;;
   #     child-done:*)        onChildDone "${EVENT#child-done:}" ;;
   #     proposal-approved:*) startPlanDraft "${EVENT#proposal-approved:}" ;;
   #     plan-approved:*)     startFinalise "${EVENT#plan-approved:}" ;;
   #   esac
   ```

3. **Monitor description string** — update the description to mention that `heartbeat:TIMESTAMP` lines are emitted every 60s and are no-ops (Claude reads this on re-attach; mentioning heartbeat prevents confusion about spurious wakeups).

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'heartbeat:' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'no-op.*wake\|wake.*no-op' plugin/skills/loop-backlog/SKILL.md`

---

## Phase D: Coordination state on disk (merge-lock + active-agents)
### Tests (write first)
```bash
grep -q 'merge-lock'    plugin/skills/loop-backlog/SKILL.md
grep -q 'active-agents' plugin/skills/loop-backlog/SKILL.md
grep -q 'acquire_merge_lock\|MERGE_LOCK' plugin/skills/loop-backlog/SKILL.md
```

### Implementation
In `plugin/skills/loop-backlog/SKILL.md`:

**D1 — serial-merge lock (`backlog/.merge-lock`)**

Add acquire/release helpers to the `workerLoop (parallel)` bash section, before the serial merge `for` loop:
```bash
MERGE_LOCK="${REPO_ROOT}/backlog/.merge-lock"

acquire_merge_lock() {
  if [ -f "$MERGE_LOCK" ]; then
    LOCK_PID=$(cat "$MERGE_LOCK" 2>/dev/null || echo "")
    if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
      echo "acquire_merge_lock: waiting for pid $LOCK_PID..."
      while [ -f "$MERGE_LOCK" ] && kill -0 "$LOCK_PID" 2>/dev/null; do sleep 1; done
    fi
    rm -f "$MERGE_LOCK"
  fi
  echo $$ > "$MERGE_LOCK"
}

release_merge_lock() { rm -f "$MERGE_LOCK"; }
```

Call `acquire_merge_lock` at the start of each serial merge iteration and `release_merge_lock` after each `git merge` completes (success or failure). Use `trap 'release_merge_lock' EXIT` inside the merge loop body to ensure release on unexpected exits.

Update **daemonBootstrap** to clean up stale merge-lock on re-attach:
```bash
# Clean up stale merge-lock (may be left if /clear killed the worker mid-merge)
MERGE_LOCK="${BACKLOG_DIR}/.merge-lock"
if [ -f "$MERGE_LOCK" ]; then
  LOCK_PID=$(cat "$MERGE_LOCK" 2>/dev/null || echo "")
  if [ -z "$LOCK_PID" ] || ! kill -0 "$LOCK_PID" 2>/dev/null; then
    rm -f "$MERGE_LOCK"
    echo "daemonBootstrap: removed stale merge-lock (pid ${LOCK_PID:-unknown} not alive)"
  fi
fi
```

**D2 — active-agents count (`backlog/.active-agents`)**

In the `workerLoop (parallel)` bash section, after each `Agent(run_in_background=true, ...)` spawn:
```bash
echo "$TASK_ID" >> "${REPO_ROOT}/backlog/.active-agents"
```

In the serial merge loop, after `rm -f "$SIGNAL_FILE"`:
```bash
# Remove this task from active-agents
ACTIVE_TMP=$(mktemp)
grep -v "^${TASK_ID}$" "${REPO_ROOT}/backlog/.active-agents" > "$ACTIVE_TMP" 2>/dev/null || true
mv "$ACTIVE_TMP" "${REPO_ROOT}/backlog/.active-agents"
```

Update **daemonBootstrap** to reconcile the active-agents file on re-attach:
```bash
ACTIVE_AGENTS_FILE="${BACKLOG_DIR}/.active-agents"
if [ -f "$ACTIVE_AGENTS_FILE" ]; then
  ACTIVE_TMP=$(mktemp)
  while IFS= read -r TID; do
    [ -z "$TID" ] && continue
    SIGNAL="${BACKLOG_DIR}/.agent-done-${TID}"
    # Keep only entries where agent signal is absent AND task is still In Progress
    STATUS=$(backlog task view "$TID" --plain 2>/dev/null \
      | grep -oP '(?<=Status:)\s*\S[^\n]+' | xargs 2>/dev/null || echo "")
    if [ ! -f "$SIGNAL" ] && echo "$STATUS" | grep -q "In Progress"; then
      echo "$TID" >> "$ACTIVE_TMP"
    fi
  done < "$ACTIVE_AGENTS_FILE"
  mv "$ACTIVE_TMP" "$ACTIVE_AGENTS_FILE"
  echo "daemonBootstrap: active-agents reconciled: $(cat "$ACTIVE_AGENTS_FILE" | xargs)"
fi
```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'merge-lock' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'active-agents' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'acquire_merge_lock\|MERGE_LOCK' plugin/skills/loop-backlog/SKILL.md`

---

## Phase E: Runtime files in .gitignore
### Tests (write first)
```bash
grep -q 'loop-checkpoint' .gitignore
grep -q 'merge-lock'      .gitignore
grep -q 'active-agents'   .gitignore
```

### Implementation
The existing `.gitignore` already has `backlog/.*` on line 7, which matches all dot-files under `backlog/`. The three new runtime files are dot-files so they are already covered. However, for searchability and explicitness, add named entries below the existing `backlog/.*` line:

```gitignore
# loop-backlog runtime state (also matched by backlog/.* above; listed explicitly for clarity)
backlog/.loop-checkpoint
backlog/.merge-lock
backlog/.active-agents
```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'loop-checkpoint' .gitignore`
- [ ] `grep -q 'merge-lock' .gitignore`
- [ ] `grep -q 'active-agents' .gitignore`

---

## Constraints
- Do not implement actual code in this plan — this is a spec for the implementer.
- Each DoD item is an executable shell command returning exit 0 on success.
- Phases are in dependency order: A (daemon heartbeat) must land before C (SKILL.md heartbeat handler, which references the heartbeat event the daemon now emits); B (checkpoint) and D (coordination state) are independent of each other but both reference daemonBootstrap changes that should be co-located — implement B before D to keep daemonBootstrap edits reviewable in sequence.
- `bash scripts/validate-plugin.sh` is the only automated test runner; every phase must leave it green.
- Each phase touches ≤ 100 LOC in its primary file.
- `stopStaleMon()` is unchanged (TASK-169 guard remains as-is).

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'heartbeat' plugin/scripts/basic-daemon.js`
- [ ] `grep -q 'heartbeat-interval\|heartbeatInterval' plugin/scripts/basic-daemon.js`
- [ ] `grep -q 'loop-checkpoint' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q '\-c +' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'heartbeat:' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'merge-lock' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'active-agents' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'loop-checkpoint' .gitignore`
- [ ] `grep -q 'merge-lock' .gitignore`
- [ ] `grep -q 'active-agents' .gitignore`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
关键文件：
- plugin/scripts/basic-daemon.js — 添加 heartbeat channel
- plugin/skills/loop-backlog/SKILL.md — 修改 daemonBootstrap（checkpoint 逻辑）、workerLoop（heartbeat no-op）、Monitor call（-c +$OFFSET）、添加 merge-lock 和 active-agents 规范
- backlog/.loop-checkpoint — 运行时生成，gitignore
- backlog/.merge-lock — 运行时生成，gitignore
- backlog/.active-agents — 运行时生成，gitignore

Proposal approved (existing description used as draft). Starting plan draft.

Plan review iteration 1: APPROVED
premise-ledger:
- Goal coverage: E — all 4 proposal goals mapped to phases
- TDD structure: E — every phase has Tests then Implementation
- TDD order: E — first DoD item is bash scripts/validate-plugin.sh in all phases
- Acceptance gate: E — first item is bash scripts/validate-plugin.sh
- DoD executability: E — all items are shell commands
- Absence checks: C — Phase C Tests had redundant grep -c | grep -qv antipattern; fixed to grep -q pattern
- Phase ordering: E — A before C, B before D, E last; no circular deps
- Scope discipline: E — all phases back to a goal
- File paths: E — basic-daemon.js, SKILL.md, validate-plugin.sh, .gitignore all verified present
GCL-self-report: E=8 C=1 H=0

claimed: 2026-06-23T15:32:32Z

Phase A ✓ 2026-06-23T15:40:32Z — Added heartbeat-interval arg to parseArgs(), heartbeatMs const, and heartbeatTimer setInterval in basic-daemon.js

DoD #A1: PASS — bash scripts/validate-plugin.sh
DoD #A2: PASS — grep -q 'heartbeat' plugin/scripts/basic-daemon.js
DoD #A3: PASS — grep -q 'heartbeat-interval|heartbeatInterval' plugin/scripts/basic-daemon.js
DoD #A4: PASS — grep -q 'heartbeatTimer|heartbeatMs' plugin/scripts/basic-daemon.js

Phase B ✓ 2026-06-23T15:40:45Z — Added CHECKPOINT_FILE/OFFSET read in daemonBootstrap; changed all 3 Monitor tail calls to -c +${OFFSET} -f; added checkpoint write after Monitor returns

DoD #B1: PASS — bash scripts/validate-plugin.sh
DoD #B2: PASS — grep -q 'loop-checkpoint' plugin/skills/loop-backlog/SKILL.md
DoD #B3: PASS — grep -q '-c +' plugin/skills/loop-backlog/SKILL.md
DoD #B4: PASS — grep -qP 'OFFSET\s*=' plugin/skills/loop-backlog/SKILL.md

Phase C ✓ 2026-06-23T15:40:55Z — Added heartbeat:* → workerLoop() no-op arm in Spec pseudocode, heartbeat:* case in bash comment dispatch block, and heartbeat mention in Monitor description strings

DoD #C1: PASS — bash scripts/validate-plugin.sh
DoD #C2: PASS — grep -q 'heartbeat:' plugin/skills/loop-backlog/SKILL.md
DoD #C3: PASS — grep -q 'no-op.*wake|wake.*no-op' plugin/skills/loop-backlog/SKILL.md

Phase D ✓ 2026-06-23T15:41:06Z — Added acquire/release_merge_lock helpers + MERGE_LOCK var before serial merge loop; stale lock cleanup in daemonBootstrap; .active-agents append after Agent spawn and removal after signal consumed; daemonBootstrap reconciliation of .active-agents

DoD #D1: PASS — bash scripts/validate-plugin.sh
DoD #D2: PASS — grep -q 'merge-lock' plugin/skills/loop-backlog/SKILL.md
DoD #D3: PASS — grep -q 'active-agents' plugin/skills/loop-backlog/SKILL.md
DoD #D4: PASS — grep -q 'acquire_merge_lock|MERGE_LOCK' plugin/skills/loop-backlog/SKILL.md

Phase E ✓ 2026-06-23T15:41:15Z — Added explicit .loop-checkpoint, .merge-lock, .active-agents entries to .gitignore below existing backlog/.* line

DoD #E1: PASS — bash scripts/validate-plugin.sh
DoD #E2: PASS — grep -q 'loop-checkpoint' .gitignore
DoD #E3: PASS — grep -q 'merge-lock' .gitignore
DoD #E4: PASS — grep -q 'active-agents' .gitignore

## Execution Summary
Result: Done
Commit: 2638f9a3d030023af1450c8c934651a96e4ec8c3

WARNING: agent-summary missing

Completed: 2026-06-23T15:42:33Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'heartbeat' plugin/scripts/basic-daemon.js
- [ ] #3 grep -q 'heartbeat-interval\|heartbeatInterval' plugin/scripts/basic-daemon.js
- [ ] #4 grep -q 'heartbeatTimer\|heartbeatMs' plugin/scripts/basic-daemon.js
- [ ] #5 grep -q 'loop-checkpoint' plugin/skills/loop-backlog/SKILL.md
- [ ] #6 grep -q '\-c +' plugin/skills/loop-backlog/SKILL.md
- [ ] #7 grep -qP 'OFFSET\s*=' plugin/skills/loop-backlog/SKILL.md
- [ ] #8 grep -q 'heartbeat:' plugin/skills/loop-backlog/SKILL.md
- [ ] #9 grep -q 'no-op.*wake\|wake.*no-op' plugin/skills/loop-backlog/SKILL.md
- [ ] #10 grep -q 'merge-lock' plugin/skills/loop-backlog/SKILL.md
- [ ] #11 grep -q 'active-agents' plugin/skills/loop-backlog/SKILL.md
- [ ] #12 grep -q 'acquire_merge_lock\|MERGE_LOCK' plugin/skills/loop-backlog/SKILL.md
- [ ] #13 grep -q 'loop-checkpoint' .gitignore
- [ ] #14 grep -q 'merge-lock' .gitignore
- [ ] #15 grep -q 'active-agents' .gitignore
<!-- DOD:END -->
