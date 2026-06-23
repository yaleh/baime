---
id: TASK-169
title: 为 loop-backlog skill 添加 stopStaleMon() 守卫：在进入 Monito
status: 'Basic: Done'
assignee: []
created_date: '2026-06-23 10:44'
updated_date: '2026-06-23 11:11'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
为 loop-backlog skill 添加 stopStaleMon() 守卫：在进入 Monitor 等待前停止孤儿 Monitor，防止 /clear 后产生重复 Monitor 实例
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: 为 loop-backlog skill 添加 stopStaleMon() 守卫

## Background

loop-backlog skill 在每次 workerLoop() 进入无任务可 claim 的 idle 分支时，都会无条件调用
`Monitor(persistent=true, ...)` 等待下一个 daemon 事件。Monitor task 绑定到当时的执行上下文；
`/clear` 命令销毁旧 transcript 但不杀死旧 Monitor——旧 Monitor 即使之后 fired，也只会把
事件送进已不存在的旧上下文，不会进入当前对话。

新的执行上下文必须建自己的 Monitor，但旧的孤儿 Monitor 仍然存活：两个 Monitor 同时监听同一
`.basic-daemon.log`，导致同一事件触发两次处理。根据用户在 archguard 项目中的实测观察，
这正是 bx8ee2vj3 和 btcms2kh5 并存的原因。

## Goals

1. 在 workerLoop() 进入 Monitor 等待前，先停止所有 description 含 "loop-backlog daemon
   notification" 的已有 Monitor task，保证任意时刻最多一个 Monitor 在运行。
2. loop-backlog SKILL.md 新增 `stopStaleMon()` spec 函数，在 idle 分支的 Monitor 调用前
   显式调用它。
3. `allowed-tools` 增加 `TaskList` 和 `TaskStop`，使 skill 内可执行上述操作。
4. 新增 contract `grep: "stopStaleMon"`，防止守卫被误删。
5. validate-plugin.sh 通过（现有 contract 均不被破坏）。

## Proposed Approach

仅修改 `plugin/skills/loop-backlog/SKILL.md`：

- 在 frontmatter `allowed-tools` 行末追加 `, TaskList, TaskStop`
- 在 Spec 段新增函数签名 `stopStaleMon :: () → ()`，定义为：调用 TaskList 枚举所有
  description 含 "loop-backlog daemon notification" 的运行中 task，逐一 TaskStop
- 在 `workerLoop()` idle 分支的 Monitor 调用前插入 `stopStaleMon()`（一行）
- 在 Implementation 段新增 `### stopStaleMon` 小节，给出 Claude 执行的自然语言指令
- 在 `contracts:` 块追加 `- grep: "stopStaleMon"`

不修改 basic-daemon.js、不改 daemonBootstrap、不添加文件、不改 validate-plugin.sh。

## Trade-offs and Risks

- **不覆盖的场景**：两个完全独立的 session（非同一 runtime）同时运行 /loop-backlog——此时
  两个 Monitor 属于不同 session，stopStaleMon 只能看到本 session 的 task，无法停掉跨 session
  的孤儿。但这是多进程并发问题，属于正常的"不要并发运行"约束，不在本修复范围内。
- **TaskList/TaskStop 工具依赖**：需要 Claude Code harness 暴露这两个工具给 skill。若目标
  项目的 Claude 实例未暴露这些工具，守卫会报错。可接受——这是配置问题，不是 skill 设计问题。
- **alternative 方案**（记录为已考虑但未选）：`.monitor.tid` 文件方案（文件 I/O 同步、可能
  残留脏文件）；bash 轮询替代 Monitor（违反现有 contract）；Monitor description 去重（无法
  从外部控制）。选择 TaskList+TaskStop 因为最直接、无副作用文件、幂等可重入。

---

# Plan: 为 loop-backlog skill 添加 stopStaleMon() 守卫

Proposal: docs/proposals/proposal-task-169.md

## Phase A: 修改 SKILL.md — 添加 stopStaleMon 守卫

### Tests (write first)
验证点（可通过 grep 脚本确认）：
- `grep -q 'TaskList' plugin/skills/loop-backlog/SKILL.md`
- `grep -q 'TaskStop' plugin/skills/loop-backlog/SKILL.md`
- `grep -q 'stopStaleMon' plugin/skills/loop-backlog/SKILL.md`
- `grep -q 'stopStaleMon' plugin/skills/loop-backlog/SKILL.md | wc -l` ≥ 3（spec签名、workerLoop调用、Implementation节）

### Implementation
文件：`plugin/skills/loop-backlog/SKILL.md`

1. **frontmatter `allowed-tools`**（第5行）：
   ```
   allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Monitor, Agent, TaskList, TaskStop
   ```

2. **Spec 段新增函数签名**（在 `stopSentinel` 签名后插入）：
   ```
   stopStaleMon :: () → ()  -- stop any orphaned Monitor tasks from prior /clear iterations
   ```

3. **`workerLoop()` idle 分支**（在 `event: Monitor(persistent=true,` 前插入一行）：
   ```
       _:      stopStaleMon(),
   ```

4. **contracts 块**（在末尾追加）：
   ```yaml
     - grep: "stopStaleMon"
       target: self
   ```

5. **Implementation 段新增 `### stopStaleMon` 小节**（在 `### daemonBootstrap` 前插入）：
   ```markdown
   ### stopStaleMon

   Before creating a new Monitor, stop any existing Monitor tasks from prior iterations
   (e.g., left over after a /clear). Use TaskList to find running tasks whose description
   starts with "loop-backlog daemon notification", then stop each with TaskStop.

   This prevents duplicate Monitor instances from watching the same daemon log concurrently.
   After TaskStop calls complete, proceed to the Monitor call immediately.
   ```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'TaskList, TaskStop' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -c 'stopStaleMon' plugin/skills/loop-backlog/SKILL.md | grep -qE '^[3-9]|^[0-9]{2}'`
- [ ] `grep -q 'stopStaleMon' plugin/skills/loop-backlog/SKILL.md`

## Constraints

- 仅修改 `plugin/skills/loop-backlog/SKILL.md`，不新建文件
- 不修改 basic-daemon.js、daemonBootstrap、validate-plugin.sh
- 不改变 Monitor 调用的 command 或 description 参数
- 现有 contracts 不得破坏（所有 grep 断言须仍然命中）

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'stopStaleMon' plugin/skills/loop-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal approved (self-review). Proceeding to plan draft.

claimed: 2026-06-23T11:07:35Z

Phase A ✓ 2026-06-23T00:00:00Z — Modified SKILL.md with stopStaleMon guard

Phase A ✓ 2026-06-23T11:09:00Z
Modified plugin/skills/loop-backlog/SKILL.md with stopStaleMon guard

DoD #1: PASS — bash scripts/validate-plugin.sh (ALL CHECKS PASSED, 0 errors)
DoD #2: PASS — grep -q 'TaskList, TaskStop' plugin/skills/loop-backlog/SKILL.md
DoD #3: PASS — grep -c 'stopStaleMon' ... | grep -qE '^[3-9]|^[0-9]{2}' (count: 4)
DoD #4: PASS — grep -q 'stopStaleMon' plugin/skills/loop-backlog/SKILL.md

## Execution Summary
Result: Done
Commit: 3beb9a5

Changes made to plugin/skills/loop-backlog/SKILL.md:
1. Added TaskList, TaskStop to allowed-tools frontmatter
2. Added stopStaleMon :: () → () spec signature after stopSentinel
3. Inserted stopStaleMon() call before Monitor in workerLoop() idle branch
4. Added contracts entry: grep: "stopStaleMon"
5. Added ### stopStaleMon Implementation subsection before ### daemonBootstrap

Completed: 2026-06-23T11:11:24Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'TaskList, TaskStop' plugin/skills/loop-backlog/SKILL.md
- [ ] #3 grep -c 'stopStaleMon' plugin/skills/loop-backlog/SKILL.md | grep -qE '^[3-9]|^[0-9]{2}'
- [ ] #4 grep -q 'stopStaleMon' plugin/skills/loop-backlog/SKILL.md
<!-- DOD:END -->
