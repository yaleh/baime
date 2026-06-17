# Plan: 补全 loop-backlog spec 中的 undefined references

## Context

`loop-backlog` 的 Haskell-style spec（`plugin/skills/loop-backlog/SKILL.md`）在 `## Spec` 区块调用了大量未声明类型签名的函数，导致 spec 层与 Implementation 层之间存在不可见接口。其中部分是外部原语（`Monitor`、`exists`、`fromClaudeMd`），部分是实质性业务操作（`ensureDaemonScript`、`createWorktree` 等）。补全这些声明可让 spec 自成一体，便于后续审查和维护。

## Phase 1: 在 Spec 顶部声明外部原语

在 `## Spec` 块的开头（`Config ::` 之前）插入一个注释块，声明三个外部原语：`Monitor`、`exists`、`fromClaudeMd`。格式与 spec 中其他类型签名保持一致，并用注释标注来源（工具/系统）。

目标文件：`plugin/skills/loop-backlog/SKILL.md`

插入位置：`## Spec` 行之后、`Config ::` 行之前。

插入内容：

```
-- External primitives (provided by the Claude Code harness / shell environment;
-- not implemented in this skill)
Monitor      :: { persistent : Bool, command : String } → Event
exists       :: Path → Bool
fromClaudeMd :: () → RawText
```

### DoD
- [ ] `grep -q 'External primitives' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'Monitor.*Bool.*Event' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'exists.*Path.*Bool' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'fromClaudeMd.*RawText' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`

## Phase 2: 为业务逻辑函数补充类型签名

在 `## Spec` 区块中，为以下 11 个已被调用但无类型签名的函数各补一行签名，插入到它们被首次调用的上下文附近（或集中放在 Phase 1 注释块之后）。

签名列表（入参 / 返回类型参考 Implementation 区块的实现）：

```
ensureDaemonScript :: () → ()
daemonBootstrap    :: () → ()
inProgressTasks    :: () → [Task]
stopSentinel       :: () → Bool
createWorktree     :: Task → Path
readyTasks         :: () → [Task]
followDescription  :: (Description, Context) → ()
appendNote         :: (Task, String) → ()
reset              :: (Task, Status) → ()
removeWorktree     :: Task → ()
checkDod           :: (Task, Int) → ()
```

每条签名放在对应函数的首次调用前（或集中插入在外部原语块之后）。

### DoD
- [ ] `grep -q 'ensureDaemonScript :: () → ()' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'daemonBootstrap :: () → ()' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'inProgressTasks :: () → \[Task\]' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'stopSentinel :: () → Bool' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'createWorktree :: Task → Path' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'readyTasks :: () → \[Task\]' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'followDescription :: (Description, Context) → ()' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'appendNote :: (Task, String) → ()' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'reset :: (Task, Status) → ()' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'removeWorktree :: Task → ()' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'checkDod :: (Task, Int) → ()' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`

## Phase 3: 区分 intentional primitive 与 genuine spec gap

对 Phase 2 中添加的 11 条签名，在每条签名旁（或紧后一行）加上分类注释：
- `-- intentional primitive: implemented in Implementation section`（对应有 Implementation 实现的函数）
- `-- spec gap: no implementation body defined`（对应在 Implementation 区块中缺失实现的函数）

根据 SKILL.md 的 Implementation 区块，以下函数有对应实现节：`ensureDaemonScript`、`daemonBootstrap`（均有 ### 小节）。
以下函数无独立 Implementation 小节（属于 spec gap 或内联于其他函数）：`inProgressTasks`、`stopSentinel`、`createWorktree`（withWorktree 内）、`readyTasks`（claim 内）、`followDescription`、`appendNote`（reap/claim/execute 内）、`reset`（reap 内）、`removeWorktree`（reap/merge 内）、`checkDod`（verifyDod 内）。

### DoD
- [ ] `grep -q 'intentional primitive' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'spec gap' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`

## Constraints

- 不修改 Implementation 区块的任何 bash 代码。
- 不重命名已有的类型签名或函数名。
- 不添加新的业务逻辑或改变现有 spec 语义。
- 不删除任何现有内容。
- 仅修改 `plugin/skills/loop-backlog/SKILL.md` 一个文件。
- 验证命令运行后，脚本 `bash scripts/validate-plugin.sh` 须仍通过。

## Acceptance Gate

- [ ] `grep -q 'External primitives' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'ensureDaemonScript :: () → ()' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'intentional primitive' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'spec gap' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `bash /home/yale/work/baime/scripts/validate-plugin.sh`
