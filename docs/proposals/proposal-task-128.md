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
