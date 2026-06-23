---
id: TASK-168
title: >-
  loop-backlog: use plugin-bundled daemon script instead of writing to target
  project scripts/
status: 'Basic: Done'
assignee: []
created_date: '2026-06-23 08:35'
updated_date: '2026-06-23 08:50'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
loop-backlog skill 的 ensureDaemonScript 将 basic-daemon.js 写入目标项目的 scripts/ 目录，但该文件已存在于 BAIME plugin 安装目录。应直接引用 plugin 里已有的脚本，不再写入目标项目。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: loop-backlog: use plugin-bundled daemon script instead of writing to target project scripts/

## Background

BAIME plugin 的多个 skill 将 `$REPO_ROOT/scripts/` 当作 plugin 基础设施脚本的安装目录，
但这些脚本全部已随 plugin 安装到用户的 plugin 目录（`~/.local/share/baime/scripts/`）。

具体问题分两类：

**类型 A — 主动写入目标项目**（最严重）：
- `loop-backlog` 的 `ensureDaemonScript` 将完整的 `basic-daemon.js`（~200 行）写入
  `$REPO_ROOT/scripts/`，`ensureDaemonTest` 同样写入 `basic-daemon.test.js`。

**类型 B — 假设目标项目已有文件**（隐性依赖）：
- `loop-backlog` 调用 `$REPO_ROOT/scripts/verify-subtask-dod.sh`（epic 评估）
- `feature-to-backlog`、`epic-to-backlog`、`task-to-backlog` 在 Phase 0
  调用 `$REPO_ROOT/scripts/skill-lint.sh`，在 finalise 调用 `$REPO_ROOT/scripts/validate-plugin.sh`
  并将其加入任务 DoD

所有这些脚本（`basic-daemon.js`、`verify-subtask-dod.sh`、`skill-lint.sh`、`validate-plugin.sh`）
都已存在于 plugin 安装目录。当 skill 在非 baime 项目（如 meta-cc）中运行时，
类型 A 产生污染，类型 B 导致静默失败或错误的 DoD 命令。

Claude Code plugin 支持 user scope（`~/.local/share/<plugin>/`）和 project scope
（`<project>/.claude/plugins/<plugin>/`）两种安装模式，路径不可硬编码。

## Goals

1. `loop-backlog` 启动时不向目标项目写入任何文件；`daemonBootstrap` 引用 plugin 安装目录中
   已有的 `basic-daemon.js`。
2. `loop-backlog` 中的 `verify-subtask-dod.sh` 引用改为 plugin 安装目录路径。
3. `feature-to-backlog`、`epic-to-backlog`、`task-to-backlog` 的 `skill-lint.sh` 调用
   和 `validate-plugin.sh` 调用改为 plugin 安装目录路径。
4. Plugin 路径解析支持 user scope 和 project scope 两种安装模式，解析失败时明确报错。
5. 已有旧版写入文件（`scripts/basic-daemon.js` 等）的目标项目中，skill 输出迁移提示。

## Proposed Approach

### BAIME_SCRIPTS 路径解析（共享逻辑，提取为 resolveBaimeScripts）

```bash
resolveBaimeScripts() {
  # 1. Project scope: <repo>/.claude/plugins/baime/scripts/
  if [ -f "${REPO_ROOT}/.claude/plugins/baime/scripts/basic-daemon.js" ]; then
    echo "${REPO_ROOT}/.claude/plugins/baime/scripts"; return 0
  fi
  # 2. User scope via Claude settings.json (支持自定义 marketplace 路径)
  SETTINGS_PATH=$(python3 -c "
import json, os, sys
for f in ['${HOME}/.claude/settings.json', '${HOME}/.claude/settings.local.json']:
    try:
        with open(f) as fh:
            s = json.load(fh)
        for mp in s.get('extraKnownMarketplaces', {}).values():
            p = mp.get('source', {}).get('path', '')
            if 'baime' in p.lower() and os.path.isfile(p + '/scripts/basic-daemon.js'):
                print(p + '/scripts'); sys.exit(0)
    except: pass
sys.exit(1)
" 2>/dev/null) && { echo "$SETTINGS_PATH"; return 0; }
  # 3. XDG standard fallback
  XDG_PATH="${XDG_DATA_HOME:-${HOME}/.local/share}/baime/scripts"
  [ -f "${XDG_PATH}/basic-daemon.js" ] && { echo "$XDG_PATH"; return 0; }
  # 4. Not found
  echo "ERROR: BAIME plugin scripts not found. Please reinstall the BAIME plugin." >&2
  return 1
}
BAIME_SCRIPTS=$(resolveBaimeScripts) || exit 1
```

### 修改点汇总

- **`loop-backlog` SKILL.md**：
  - `ensureDaemonScript`：替换为 `resolveBaimeScripts()`，设置 `DAEMON_SCRIPT`；
    不再内联脚本内容；检查旧版文件并打印迁移提示。
  - `ensureDaemonTest`：从 `workerLoop` 调用链删除（从 Spec 和 Implementation 全部移除）。
  - `daemonBootstrap`：`DAEMON_SCRIPT` 来自 `ensureDaemonScript` 设置的变量，不再赋值。
  - `epicDecompose` / `onChildDone`：`verify-subtask-dod.sh` 路径改为 `$BAIME_SCRIPTS/verify-subtask-dod.sh`。

- **`feature-to-backlog` SKILL.md**：
  - Phase 0 manifest validation：`skill-lint.sh` 路径改为 `$BAIME_SCRIPTS/skill-lint.sh`（或检查存在后跳过）。
  - finalise Step D：`validate-plugin.sh` 路径改为 `$BAIME_SCRIPTS/validate-plugin.sh`。
  - DoD 项：同上。

- **`epic-to-backlog` / `task-to-backlog` SKILL.md**：同 `feature-to-backlog`。

## Trade-offs and Risks

- **不做**：不修改 plugin 脚本本身内容；不修改 daemon CLI 参数接口。
- **风险**：`python3` 可能不可用（极少环境）→ 用 `jq` 或纯 shell 作备选。
  缓解：解析失败时跳到 XDG fallback，不 exit；仅在所有路径都失败时报错。
- **向后兼容**：已有 `scripts/basic-daemon.js` 的项目会收到打印提示，不会自动删除。
- **project scope 格式**：Claude Code 的 project scope plugin 实际存放路径待确认；
  解析逻辑按 `.claude/plugins/baime/` 设计，若格式不同需调整。

---

# Plan: loop-backlog: use plugin-bundled daemon script instead of writing to target project scripts/

Proposal: docs/proposals/proposal-loop-backlog-plugin-daemon.md

## Phase A: 添加 resolveBaimeScripts 并修复 loop-backlog 的 ensureDaemonScript

### Tests (write first)

```bash
grep -q "resolveBaimeScripts" plugin/skills/loop-backlog/SKILL.md
grep -q "BAIME_SCRIPTS" plugin/skills/loop-backlog/SKILL.md
! grep -q 'cat > "\$DAEMON_SCRIPT"' plugin/skills/loop-backlog/SKILL.md
! grep -q 'ensureDaemonTest' plugin/skills/loop-backlog/SKILL.md
grep -q "basic-daemon" plugin/skills/loop-backlog/SKILL.md
grep -q "scripts/basic-daemon.js is no longer needed" plugin/skills/loop-backlog/SKILL.md
```

### Implementation

修改 `plugin/skills/loop-backlog/SKILL.md`：

1. 在 `### ensureDaemonScript` section 将 Implementation 替换为：
   - `resolveBaimeScripts()` 函数（先检查 project scope `.claude/plugins/baime/scripts/`，
     再解析 `~/.claude/settings.json` extraKnownMarketplaces，再 XDG fallback，失败则 exit 1）
   - 调用 `BAIME_SCRIPTS=$(resolveBaimeScripts) || exit 1`
   - `DAEMON_SCRIPT="$BAIME_SCRIPTS/basic-daemon.js"`
   - 迁移提示：若 `$REPO_ROOT/scripts/basic-daemon.js` 存在则打印 Note
   - 删除约 170 行的 daemon JS 内联内容

2. 从 Spec 删除：`ensureDaemonTest :: () → ()` 声明，`workerLoop` 中的 `_: ensureDaemonTest()` 调用行

3. 删除整个 `### ensureDaemonTest` Implementation section（约 120 行）

4. `daemonBootstrap` 中删除 `DAEMON_SCRIPT=` 赋值行（现由 ensureDaemonScript 设置）

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "resolveBaimeScripts" plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q "BAIME_SCRIPTS" plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'cat > "\$DAEMON_SCRIPT"' plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'ensureDaemonTest' plugin/skills/loop-backlog/SKILL.md`

## Phase B: 修复 loop-backlog 中 verify-subtask-dod.sh 的路径引用

### Tests (write first)

```bash
! grep -q 'REPO_ROOT}/scripts/verify-subtask-dod' plugin/skills/loop-backlog/SKILL.md
grep -q 'BAIME_SCRIPTS.*verify-subtask-dod\|verify-subtask-dod.*BAIME_SCRIPTS' plugin/skills/loop-backlog/SKILL.md
```

### Implementation

修改 `plugin/skills/loop-backlog/SKILL.md` 中所有
`bash "${REPO_ROOT}/scripts/verify-subtask-dod.sh"` → `bash "$BAIME_SCRIPTS/verify-subtask-dod.sh"`

涉及位置：Spec 中的 `verifySubTaskDod`、`allDodPass` 定义，以及 Implementation 中
`epicDecompose` 的 STEP 6、`onChildDone` 的 DoD 重跑调用（共 4 处）。

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q 'REPO_ROOT}/scripts/verify-subtask-dod' plugin/skills/loop-backlog/SKILL.md`

## Phase C: 修复 feature-to-backlog / epic-to-backlog / task-to-backlog 的 skill-lint 和 validate-plugin 路径

### Tests (write first)

```bash
! grep -q 'REPO_ROOT}/scripts/skill-lint' plugin/skills/feature-to-backlog/SKILL.md
! grep -q 'REPO_ROOT}/scripts/skill-lint' plugin/skills/epic-to-backlog/SKILL.md
! grep -q 'REPO_ROOT}/scripts/skill-lint' plugin/skills/task-to-backlog/SKILL.md
! grep -q 'REPO_ROOT}/scripts/validate-plugin' plugin/skills/feature-to-backlog/SKILL.md
! grep -q 'REPO_ROOT}/scripts/validate-plugin' plugin/skills/epic-to-backlog/SKILL.md
! grep -q 'REPO_ROOT}/scripts/validate-plugin' plugin/skills/task-to-backlog/SKILL.md
grep -q "BAIME_SCRIPTS" plugin/skills/feature-to-backlog/SKILL.md
```

### Implementation

在 `feature-to-backlog`、`epic-to-backlog`、`task-to-backlog` 三个 SKILL.md 中：

1. 在 `### loadConfig` 或 Phase 0 开头添加相同的 `resolveBaimeScripts()` 函数调用，
   设置 `BAIME_SCRIPTS`（复用 Phase A 中定义的逻辑，以 bash 函数形式内联）

2. 将所有 `"${REPO_ROOT}/scripts/skill-lint.sh"` 替换为 `"$BAIME_SCRIPTS/skill-lint.sh"`
   （每个 SKILL.md 各 1 处，共 3 处）

3. 将所有 `"${REPO_ROOT}/scripts/validate-plugin.sh"` 替换为 `"$BAIME_SCRIPTS/validate-plugin.sh"`
   （feature-to-backlog: 2 处含 DoD 项；epic-to-backlog: 2 处；task-to-backlog: 3 处）

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q 'REPO_ROOT}/scripts/skill-lint' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q 'REPO_ROOT}/scripts/skill-lint' plugin/skills/epic-to-backlog/SKILL.md`
- [ ] `! grep -q 'REPO_ROOT}/scripts/skill-lint' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `! grep -q 'REPO_ROOT}/scripts/validate-plugin' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q 'REPO_ROOT}/scripts/validate-plugin' plugin/skills/task-to-backlog/SKILL.md`

## Constraints

- 不修改 `plugin/scripts/` 下任何脚本的内容
- 不修改 daemon CLI 参数接口（`--tasks-dir`、`--pid-file` 等不变）
- contracts 中的 `grep: "basic-daemon"` 仍需满足（文件路径引用中仍含此字符串）
- contracts 中的 `grep: ".daemon.pid"` 仍需满足（`daemonBootstrap` 中 PID_FILE 逻辑不变）
- `resolveBaimeScripts` 的 python3 依赖：若 python3 不可用，直接跳到 XDG fallback
  而非 exit（在函数内用 `python3 ... 2>/dev/null ||` 处理）

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "resolveBaimeScripts" plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'ensureDaemonTest' plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'REPO_ROOT}/scripts/verify-subtask-dod' plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'REPO_ROOT}/scripts/skill-lint' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q 'REPO_ROOT}/scripts/validate-plugin' plugin/skills/feature-to-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal approved. Starting plan draft.

claimed: 2026-06-23T08:43:09Z

Phase A ✓ 2026-06-23T00:00:00Z: Replaced ensureDaemonScript inline JS (~170 lines) with resolveBaimeScripts() function; removed ensureDaemonTest section (~120 lines) and its Spec declaration; BAIME_SCRIPTS now resolved from plugin install dir.

Phase B ✓ 2026-06-23T00:00:00Z: Replaced all 4 occurrences of ${REPO_ROOT}/scripts/verify-subtask-dod.sh with $BAIME_SCRIPTS/verify-subtask-dod.sh in loop-backlog/SKILL.md.

Phase C ✓ 2026-06-23T00:00:00Z: Added resolveBaimeScripts() to feature-to-backlog, epic-to-backlog, task-to-backlog loadConfig sections; replaced all skill-lint.sh and validate-plugin.sh REPO_ROOT paths with $BAIME_SCRIPTS.

Execution Summary 2026-06-23T00:00:00Z: All 6 DoD checks pass. validate-plugin.sh: 0 errors, 55 warnings. Committed as 085edc9 (4 files, 150 insertions, 332 deletions).

Completed: 2026-06-23T08:50:20Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'resolveBaimeScripts' plugin/skills/loop-backlog/SKILL.md
- [ ] #3 ! grep -q 'ensureDaemonTest' plugin/skills/loop-backlog/SKILL.md
- [ ] #4 ! grep -q 'REPO_ROOT}/scripts/verify-subtask-dod' plugin/skills/loop-backlog/SKILL.md
- [ ] #5 ! grep -q 'REPO_ROOT}/scripts/skill-lint' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #6 ! grep -q 'REPO_ROOT}/scripts/validate-plugin' plugin/skills/feature-to-backlog/SKILL.md
<!-- DOD:END -->
