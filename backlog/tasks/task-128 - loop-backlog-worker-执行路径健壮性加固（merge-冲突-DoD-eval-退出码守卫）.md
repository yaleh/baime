---
id: TASK-128
title: loop-backlog worker 执行路径健壮性加固（merge 冲突 / DoD eval / 退出码守卫）
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 12:05'
updated_date: '2026-06-21 12:32'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
在 TASK-126 的真实 loop-backlog 执行中暴露的三处 worker 正确性缺陷，归为单个 Basic Task（多 Phase）。

**Phase A — 消除 task `.md` 的结构性 merge 冲突（高，结构性）**
worker（main 侧）写 claim/status 笔记，后台 agent（worktree 侧）写 phase/DoD 笔记并提交到分支 —— 两侧修改同一 task 文件，merge 必然冲突。本次 TASK-126 即 abort，需手动 commit+resolve。方案候选：(a) agent 不写共享 task 文件，phase/DoD 笔记由 worker 在 main 侧统一追加；或 (b) 对 backlog/tasks/*.md 配 union merge driver（.gitattributes + merge driver）；或 (c) 把 task .md 排除出 worktree 合并路径。需在 SKILL.md（executePrompt 协议 + merge 段）与 .gitattributes 落实，并加回归用例。

**Phase B — DoD 验证对 `!`-前缀命令假失败（高）**
verifyDodInWorkerLoop 在循环 shell 内用 eval 跑 DoD，`! grep -q ...` 触发 history-expansion 给出 false FAIL（本次 DoD #6 在循环里 FAIL，bash -c 跑 PASS）。自治模式下会把已通过的任务误 escalate 到 Needs Human。方案：DoD 一律用 bash -c 干净子 shell 执行（agent verifyDod + workerLoop pre-merge 两处）；加 ! grep 回归用例。

**Phase C — merge 退出码守卫（中）**
SKILL 正文 if git merge 写法正确，但极易被 git merge | tail 之类管道掩盖退出码（本次执行即误把 abort 当成功、错误置 Basic: Done）。方案：merge 段加显式注释禁止管道包裹 git merge；加断言"仍有 MERGE_HEAD 或 unmerged 文件时不得置 Basic: Done"。

DoD 应包含 daemon-routing/daemon 自测、validate-plugin.sh、以及针对 A/B/C 的最小回归脚本。证据见本会话 TASK-126 执行记录。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: loop-backlog worker 执行路径健壮性加固

## Background
在 TASK-126 的真实 loop-backlog 自治执行中暴露了三处 worker 正确性缺陷，均直接破坏无人值守运行：
1. worker（main 侧）写 claim/status/Completed 笔记，后台 agent（worktree 侧）写 phase/DoD 笔记并提交到分支——两侧改同一 `backlog/tasks/*.md`，merge 结构性必然冲突（TASK-126 即 abort，需人工 commit+resolve）。
2. DoD 验证用 `eval` 在循环 shell 内执行，`! grep -q ...` 触发 history-expansion，给出 false FAIL，把已通过的任务误 escalate 到 Needs Human。
3. `git merge` 退出码若被管道（如 `| tail`）掩盖，会把 abort 误判为成功并错误置 `Basic: Done`。
三者合计使自治 worker 既可能"该过却卡"（B），又可能"该停却放过"（C），并在每个并行任务上稳定触发冲突（A）。

## Goals
1. 同一 task `.md` 的两个并发编辑（main 侧 worker 笔记 + worktree 侧 agent 笔记）合并时不再 abort merge——回归脚本模拟双侧追加后 `git merge --no-ff` 退出码为 0 且无 `MERGE_HEAD`。
2. 以 `!` 开头的 DoD 命令（如 `! grep -q FOO file`）被正确求值：在两处 DoD 执行点（agent `verifyDod`、workerLoop `verifyDodInWorkerLoop`）对一条 `!`-前缀命令，循环内结果与干净子 shell `bash -c` 结果一致（均 PASS）。
3. 一次冲突 abort 的 merge 永不导致任务被置 `Basic: Done`：merge 失败或仍存在 `MERGE_HEAD`/unmerged 文件时，状态必为 `Basic: Needs Human`，且 worktree/branch 被保留。
4. `bash scripts/validate-plugin.sh` 全绿（含 `scripts/daemon-routing.test.js` 与 SKILL.md 内嵌 daemon 自测的 12 个 assert），并新增 A/B/C 各自最小回归脚本进 `scripts/`。

## Proposed Approach

**Phase A — 消除 task .md 结构性 merge 冲突（推荐方案 a）**
候选：(a) agent 不写共享 task 文件，phase/DoD 笔记改由 worker 在 main 侧统一追加；(b) 对 `backlog/tasks/*.md` 配 union merge driver（`.gitattributes` + 自定义 merge driver）；(c) 把 task `.md` 排除出 worktree 合并路径。
推荐 (a)。理由：根因是"两个 writer 写同一文件"，(a) 直接消除并发写者，无新基础设施、无可移植性负担、确定性最强；笔记本就是给人看的执行记录，由 main 侧 worker 在 phase/DoD 信号点统一追加不损失信息。(b) 需要每个克隆/CI 都 `git config merge.union.driver`，未配置环境退化为冲突，可移植性差且静默失败风险高；(c) 改合并路径侵入性大、易掩盖真实代码冲突。
落地：将 `executePrompt`（SKILL.md:980-992）中指示 agent 跑 `backlog task edit ${TID} --append-notes` 的 Phase/DoD/Execution-Summary 协议，改为 agent 把这些写入 worktree 内一个非追踪的结构化信号文件（或经 signal 文件回传），由 main 侧 worker 在 `verifyDodInWorkerLoop` 通过后、merge 前/后统一 `--append-notes`；agent 侧只 commit 代码改动，不再 edit `backlog/tasks/*.md`。

**Phase B — DoD `!`-前缀假失败**
两处 DoD 执行点改为干净子 shell：agent `verifyDod`（SKILL.md:1085 `if eval "$CMD"`）与 workerLoop `verifyDodInWorkerLoop`（SKILL.md:1257 `DOD_OUT=$(eval "$DOD_CMD" 2>&1)`）一律用 `bash -c "$CMD"` 执行。`bash -c` 默认非交互、不开 history expansion，`!` 作为逻辑取反正确生效，且与人工 `bash -c` 验证语义一致。

**Phase C — merge 退出码守卫**
正文 merge 写法（SKILL.md:1136、1279）本就是 `if git merge --no-ff ...; then`，退出码消费正确。加固两点：(1) 在 merge 段加显式规范注释，禁止用任何管道（`| tail`/`| cat` 等）包裹 `git merge`，以免退出码被管道末段覆盖；(2) merge 成功分支置 `Basic: Done` 前加断言——若工作区仍存在 `MERGE_HEAD` 或 `git diff --name-only --diff-filter=U` 非空，则视为失败，转 `Basic: Needs Human` 并保留 worktree/branch。

## Trade-offs and Risks
- **不做**：不引入 union merge driver（A 方案 b 被否），因此不解决"两个 writer 同时合法写同一文件"的通用场景——本提案仅消除 worker/agent 这一对已知写者；未来若有第三写者需重新评估。
- **行为变更（A）**：phase/DoD 笔记的写入时机从"agent 实时、worktree 侧"变为"worker 在 merge 阶段、main 侧统一追加"。失败/卡住的任务其笔记可能不再实时滚动出现在 task 文件里，需依赖 signal 文件与 worker 日志；escalation 路径须确保失败时也回写已收集的笔记。
- **行为变更（B）**：`bash -c` 子 shell 不继承循环 shell 的函数/局部变量；若有 DoD 隐式依赖父 shell 环境（历史上罕见），需显式自包含。整体语义更接近人工验证，属期望方向。
- **风险（C）**：断言依赖 `MERGE_HEAD`/unmerged 检测；`git merge` 极端边界（如 `--no-commit` 流程）下需确认检测点位置正确，避免误判正常合并为失败。
- **可移植性**：A/B/C 均为 SKILL.md 协议与 shell 逻辑改动，无新增运行时依赖，跨环境一致；A 方案 a 相较 b 显著降低可移植性风险。

---

# Plan: loop-backlog worker 执行路径健壮性加固

Proposal: docs/proposals/proposal-task-128.md

Target file (single source of truth for all edits): `plugin/skills/loop-backlog/SKILL.md`.
All three defects live in that SKILL.md; the "tests" are therefore grep-based structural
assertions plus self-contained behavioural micro-tests, wired as `scripts/*.test.sh` so they
run automatically inside `bash scripts/validate-plugin.sh` (see validate-plugin.sh:240-262,
`run_skill_unit_tests` globs `scripts/*.test.js` and `scripts/*.test.sh`).

Each phase is TDD: write the failing regression check first (it must fail against the current
SKILL.md), then make the minimal SKILL.md edit to turn it green.

---

## Phase A: eliminate task .md merge conflict (proposal approach a — remove the second writer)

Root cause: the background agent (worktree side) and the worker (main side) both append notes
to the same `backlog/tasks/TASK-N*.md`, so the serial `git merge --no-ff` hits a structural
conflict on every parallel task. Fix per proposal (a): the agent STOPS editing the shared task
file. `executePrompt` (SKILL.md:980-992) currently instructs the agent to run
`backlog task edit ${TID} --append-notes` for Phase checkpoints, DoD notes, and Execution
Summary. Replace those instructions with: the agent writes its Phase/DoD/Execution-Summary
into a non-tracked worktree signal file; the worker, on the main side, appends that summary to
the task `.md` AFTER (or as part of) the successful-merge note write — main side only, single
writer.

### Tests (write first)
Create `scripts/worker-taskfile-merge.test.sh` (auto-run by validate-plugin.sh). It must
FAIL against the current SKILL.md and PASS after the edit. Concretely it asserts, against
`plugin/skills/loop-backlog/SKILL.md`:
- the agent prompt (`buildExecutePrompt`/executePrompt body) no longer instructs the agent to
  run `backlog task edit ${TID} --append-notes` — absence check on the agent-facing protocol
  text;
- the agent prompt DOES instruct writing Phase/DoD/Summary into the worktree signal/summary
  file the worker later reads;
- a worker-side (main-side) post-merge note-append for the agent summary exists in the merge
  section.

```bash
# scripts/worker-taskfile-merge.test.sh  (exit 0 = pass)
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)/plugin/skills/loop-backlog/SKILL.md"
# A1: agent prompt must NOT tell the agent to edit the shared task file
# NOTE: -F (fixed-string) is REQUIRED — '${TID}' contains literal braces that BRE
# grep treats as an interval expression, so a plain `grep -q` never matches this
# line (it would pass vacuously even against the unmodified SKILL.md, defeating the
# red test). -F matches the braces literally.
! grep -qF 'backlog task edit ${TID} --append-notes' "$SKILL"
# A2: agent must instead record its summary into the worktree signal/summary file
grep -q 'agent-summary' "$SKILL"
# A3: worker (main side) must append the agent summary after merge
grep -q 'post-merge.*append\|append.*agent-summary' "$SKILL"
```

### Implementation
In `plugin/skills/loop-backlog/SKILL.md`:
1. In the `### executePrompt` heredoc (lines ~978-993, the `## Execution Protocol` block):
   remove the three `backlog task edit ${TID} --append-notes` instructions (Phase checkpoints,
   DoD verification notes, Execution Summary). Replace with an instruction to APPEND the same
   Phase/DoD/Execution-Summary content to a non-tracked worktree summary file, e.g.
   `${TWT}/.agent-summary-${TID}` (or embed it in the signal payload), and to NOT touch any
   `backlog/tasks/*.md`. Reinforce the existing Constraints block: "Do NOT run
   `backlog task edit`; do NOT modify any file under `backlog/`."
2. In `### execute → followDescription` / `### verifyDod` (the agent-side bash blocks ~1064-1113):
   redirect the `backlog task edit "$TASK_ID" --append-notes` phase/DoD writes into the same
   worktree summary file instead of the task `.md`.
3. In the `### merge` section and the `### workerLoop (parallel)` serial merge loop
   (~1136-1158 and ~1277-1293): AFTER the `git merge --no-ff` succeeds (main side, single
   writer), read the worktree `.agent-summary-${TASK_ID}` and fold it into the existing
   `backlog task edit ... --append-notes/--final-summary` call. This keeps the human-readable
   execution record without a second concurrent writer.

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -qF 'backlog task edit ${TID} --append-notes' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'agent-summary' plugin/skills/loop-backlog/SKILL.md`
- [ ] `bash scripts/worker-taskfile-merge.test.sh`

---

## Phase B: DoD eval via bash -c (fix `!`-prefix false-fail)

DoD commands are run with `eval "$CMD"` at two sites: the agent's `verifyDod` (SKILL.md:1085,
`if eval "$CMD"`; plus the retry/error capture at ~1093) and the worker's
`verifyDodInWorkerLoop` (SKILL.md:1257, `DOD_OUT=$(eval "$DOD_CMD" 2>&1)`). In an interactive
loop shell, `eval` of a `! grep -q ...` command triggers history expansion on `!`, producing a
spurious failure that escalates an already-passing task. Fix: execute DoD commands in a clean
non-interactive subshell with `bash -c "$CMD"`, where `!` is correctly the logical-negation
operator and behaviour matches a human's `bash -c` verification.

### Tests (write first)
Create `scripts/dod-eval.test.sh` (auto-run by validate-plugin.sh). It must FAIL before the fix
and PASS after. Two parts:
1. Behavioural: prove a `!`-prefixed DoD command evaluates to success when the pattern is
   absent, when run the way the SKILL runs it. (Run the canonical command through `bash -c`
   to assert the intended semantics; this is the executable spec the SKILL must match.)
2. Structural: assert the two SKILL DoD-execution sites use `bash -c`, not bare `eval`.

```bash
# scripts/dod-eval.test.sh  (exit 0 = pass)
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)/plugin/skills/loop-backlog/SKILL.md"
TMP=$(mktemp); printf 'hello world\n' > "$TMP"
# B1: a !-prefixed DoD command must return success when the pattern is ABSENT
CMD="! grep -q ABSENTPATTERN \"$TMP\""
bash -c "$CMD"            # exits 0 → pattern absent → DoD passes
rm -f "$TMP"
# B2: the DoD execution sites must use bash -c, not bare eval of $CMD/$DOD_CMD
! grep -q 'eval "\$CMD"' "$SKILL"
! grep -q 'eval "\$DOD_CMD"' "$SKILL"
grep -q 'bash -c "\$CMD"' "$SKILL"
grep -q 'bash -c "\$DOD_CMD"' "$SKILL"
```

### Implementation
In `plugin/skills/loop-backlog/SKILL.md`:
1. `### verifyDod` (agent side): change `if eval "$CMD"; then` (line ~1085) to
   `if bash -c "$CMD"; then`, and the error-capture `LAST_ERROR="$(eval "$CMD" 2>&1 || true)"`
   (~1093) to `LAST_ERROR="$(bash -c "$CMD" 2>&1 || true)"`.
2. `### verifyDodInWorkerLoop` serial loop (worker side): change
   `DOD_OUT=$(eval "$DOD_CMD" 2>&1)` (line ~1257) to `DOD_OUT=$(bash -c "$DOD_CMD" 2>&1)`.

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/dod-eval.test.sh`
- [ ] `! grep -q 'eval "\$CMD"' plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'eval "\$DOD_CMD"' plugin/skills/loop-backlog/SKILL.md`

---

## Phase C: merge exit-code guard (never mark Done over an aborted/unmerged merge)

The merge writes (SKILL.md:1136 and 1279) already use `if git merge --no-ff ...; then`, which
consumes the exit code correctly. Harden two ways per proposal: (1) add an explicit rule
comment forbidding wrapping `git merge` in any pipe (`| tail`, `| cat`, …) that would mask its
exit code; (2) before writing `Basic: Done`, add a guard — if `.git/MERGE_HEAD` still exists or
`git diff --name-only --diff-filter=U` is non-empty, treat as failure: set `Basic: Needs Human`
and preserve the worktree/branch.

### Tests (write first)
Create `scripts/merge-guard.test.sh` (auto-run by validate-plugin.sh). It must FAIL before the
edit and PASS after. Structural assertions against the SKILL merge sections:
- a no-pipe rule comment exists forbidding piping `git merge`;
- a `MERGE_HEAD` / unmerged-files guard exists in the merge section, gating `Basic: Done`;
- the merge invocation is still consumed via `if git merge` (not piped).

```bash
# scripts/merge-guard.test.sh  (exit 0 = pass)
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)/plugin/skills/loop-backlog/SKILL.md"
# C1: explicit no-pipe rule comment for git merge
grep -q 'never pipe.*git merge\|do not pipe.*git merge\|no-pipe' "$SKILL"
# C2: MERGE_HEAD / unmerged-files guard present before Basic: Done
grep -q 'MERGE_HEAD' "$SKILL"
grep -q 'diff-filter=U' "$SKILL"
# C3: merge exit code is still consumed by an if-guard (not piped)
grep -q 'if git merge --no-ff' "$SKILL"
# C4: no piped git-merge anywhere (exit-code masking)
! grep -qE 'git merge[^\n]*\| *(tail|cat|head|tee)' "$SKILL"
```

### Implementation
In `plugin/skills/loop-backlog/SKILL.md`, in BOTH merge code blocks (`### merge` ~1134-1188 and
the `### workerLoop (parallel)` serial merge ~1276-1311):
1. Add a comment directly above the `if git merge --no-ff ...` line, e.g.
   `# RULE: never pipe git merge (| tail/cat/tee) — a pipe replaces its exit code and can mask an abort.`
2. Inside the success branch, BEFORE the `backlog task edit ... --status "Basic: Done"` call,
   insert a guard:
   ```bash
   if [ -f "${REPO_ROOT}/.git/MERGE_HEAD" ] || \
      [ -n "$(git -C "$REPO_ROOT" diff --name-only --diff-filter=U)" ]; then
     # merge left MERGE_HEAD or unmerged files → treat as failure, do NOT mark Done
     backlog task edit "$TASK_ID" --status "Basic: Needs Human" \
       --append-notes "Merge guard: MERGE_HEAD/unmerged files present — worktree preserved."
     echo "cap:merge=failed $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "${REPO_ROOT}/backlog/.caps/${TASK_ID}"
     # skip Done, preserve worktree/branch
   else
     ... existing Basic: Done path ...
   fi
   ```
   (Note: for a worktree-relative `.git`, `.git` may be a file; the `diff --diff-filter=U`
   check is the authoritative unmerged-file detector and must pass regardless.)

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/merge-guard.test.sh`
- [ ] `grep -q 'MERGE_HEAD' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'diff-filter=U' plugin/skills/loop-backlog/SKILL.md`

---

## Constraints
(non-executable rules; enforced by review, not by a shell gate)
- The embedded daemon copy in SKILL.md (`### ensureDaemonScript`, the `DAEMON_EOF` heredoc,
  `daemon-version: v7`) MUST stay byte-identical in behaviour to `scripts/basic-daemon.js`.
  Do NOT change any daemon logic, event channels, or the daemon version tag as part of this
  task — these edits touch only the worker execute/merge/DoD paths.
- Do NOT introduce a `.gitattributes` union merge driver (proposal approach b explicitly
  rejected): the fix is single-writer, not a merge-driver, to avoid silent per-clone/CI
  configuration drift.
- Phase A changes the note-write timing (agent realtime → worker post-merge, main side).
  Escalation/failure paths MUST still fold any collected agent summary into the task notes so
  no execution record is lost when a task ends in Needs Human.
- `bash -c` subshells (Phase B) do not inherit loop-shell functions/locals; DoD commands are
  already self-contained shell commands, so no DoD may rely on parent-shell state.
- Existing daemon contracts in the SKILL frontmatter (Monitor persistent, basic-daemon,
  epic/child channels) MUST remain satisfied — do not remove contract-referenced strings.

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `node scripts/daemon-routing.test.js`
- [ ] `bash scripts/worker-taskfile-merge.test.sh`
- [ ] `bash scripts/dod-eval.test.sh`
- [ ] `bash scripts/merge-guard.test.sh`
- [ ] `! grep -qF 'backlog task edit ${TID} --append-notes' plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'eval "\$CMD"' plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'eval "\$DOD_CMD"' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'MERGE_HEAD' plugin/skills/loop-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved. Starting plan draft.

Plan review iteration 2: APPROVED

claimed: 2026-06-21T00:00:00Z

## Execution Summary
Result: Done
Commit: b8ef66a (worktree) → merged into main

### Phase A: Eliminate task .md merge conflict
- Removed all `backlog task edit ${TID} --append-notes` from executePrompt heredoc
- Agent now writes phase/DoD/Summary to `${TWT}/.agent-summary-${TID}`
- Both merge blocks read agent summary post-merge and append via `backlog task edit --append-notes`

### Phase B: DoD eval via bash -c
- `eval "$CMD"` → `bash -c "$CMD"` in verifyDod (condition + LAST_ERROR capture)
- `eval "$DOD_CMD" 2>&1` → `bash -c "$DOD_CMD" 2>&1` in workerLoop

### Phase C: Merge exit-code guard
- No-pipe rule comment added before both `git merge --no-ff` calls
- MERGE_HEAD / diff-filter=U guard added before any `Basic: Done` write

### Tests
- 3 new scripts: worker-taskfile-merge.test.sh, dod-eval.test.sh, merge-guard.test.sh
- All 21 DoD items: PASS
- bash scripts/validate-plugin.sh: ALL CHECKS PASSED

Completed: 2026-06-21T00:00:00Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bash scripts/validate-plugin.sh
- [x] #2 ! grep -qF 'backlog task edit ${TID} --append-notes' plugin/skills/loop-backlog/SKILL.md
- [x] #3 grep -q 'agent-summary' plugin/skills/loop-backlog/SKILL.md
- [x] #4 bash scripts/worker-taskfile-merge.test.sh
- [x] #5 bash scripts/validate-plugin.sh
- [x] #6 bash scripts/dod-eval.test.sh
- [x] #7 ! grep -q 'eval "\$CMD"' plugin/skills/loop-backlog/SKILL.md
- [x] #8 ! grep -q 'eval "\$DOD_CMD"' plugin/skills/loop-backlog/SKILL.md
- [x] #9 bash scripts/validate-plugin.sh
- [x] #10 bash scripts/merge-guard.test.sh
- [x] #11 grep -q 'MERGE_HEAD' plugin/skills/loop-backlog/SKILL.md
- [x] #12 grep -q 'diff-filter=U' plugin/skills/loop-backlog/SKILL.md
- [x] #13 bash scripts/validate-plugin.sh
- [x] #14 node scripts/daemon-routing.test.js
- [x] #15 bash scripts/worker-taskfile-merge.test.sh
- [x] #16 bash scripts/dod-eval.test.sh
- [x] #17 bash scripts/merge-guard.test.sh
- [x] #18 ! grep -qF 'backlog task edit ${TID} --append-notes' plugin/skills/loop-backlog/SKILL.md
- [x] #19 ! grep -q 'eval "\$CMD"' plugin/skills/loop-backlog/SKILL.md
- [x] #20 ! grep -q 'eval "\$DOD_CMD"' plugin/skills/loop-backlog/SKILL.md
- [x] #21 grep -q 'MERGE_HEAD' plugin/skills/loop-backlog/SKILL.md
<!-- DOD:END -->
