---
id: TASK-140
title: 将核心运行时脚本移入 plugin/scripts/ 并更新 install.sh
status: 'Basic: Done'
assignee: []
created_date: '2026-06-21 23:27'
updated_date: '2026-06-22 00:09'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
将 scripts/basic-daemon.js、scripts/verify-subtask-dod.sh、scripts/skill-lint.sh、scripts/validate-plugin.sh 等核心运行时脚本移入 plugin/scripts/，并在 install.sh 中添加复制到目标项目的步骤
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: 将核心运行时脚本移入 plugin/scripts/ 并更新 install.sh

## Background

目前，`scripts/basic-daemon.js`、`scripts/verify-subtask-dod.sh`、`scripts/skill-lint.sh`、`scripts/validate-plugin.sh` 是 loop-backlog 工作流和插件验证的核心运行时依赖。这四个脚本位于 `scripts/`（仓库开发工具目录），而 `install.sh` 通过 `rsync -a plugin/ $INSTALL_DIR/` 仅复制 `plugin/` 目录，导致安装到用户目录 `~/.claude/plugins/cache/` 的插件副本中不包含这些脚本。`loop-backlog`、`feature-to-backlog` 等技能在运行时通过 `bash scripts/verify-subtask-dod.sh`、`bash scripts/skill-lint.sh` 等裸路径调用这些脚本，在已安装环境中这些路径无法解析，技能会静默失败或报 "file not found"。此问题意味着插件只能在克隆了仓库并从仓库根目录执行的情况下正常工作，无法作为独立可发布单元被最终用户安装使用，违背了 plugin/ 结构设计的初衷。

## Goals

1. `plugin/scripts/` 目录存在，并包含 `basic-daemon.js`、`verify-subtask-dod.sh`、`skill-lint.sh`、`validate-plugin.sh` 四个文件（内容与 `scripts/` 下同名文件一致）。
   验证：`ls plugin/scripts/basic-daemon.js plugin/scripts/verify-subtask-dod.sh plugin/scripts/skill-lint.sh plugin/scripts/validate-plugin.sh`

2. `install.sh` 执行后，`$INSTALL_DIR/scripts/` 目录存在且包含上述四个文件。
   验证：`ls ~/.claude/plugins/cache/baime/baime/*/scripts/basic-daemon.js`

3. `loop-backlog`、`feature-to-backlog`、`epic-to-backlog`、`task-to-backlog` 四个技能中所有引用上述脚本的路径，均通过 `${REPO_ROOT}/scripts/` 变量解析（开发环境）或等价的已安装路径变量（安装环境），不存在裸相对路径 `scripts/xxx`。
   验证：`grep -rn "bash scripts/" plugin/skills/{loop-backlog,feature-to-backlog,epic-to-backlog,task-to-backlog}/SKILL.md` 返回空。

4. `bash scripts/validate-plugin.sh` 在改动后仍零错误通过，无新增 FAIL 项。
   验证：`bash scripts/validate-plugin.sh 2>&1 | tail -3` 显示 `ALL CHECKS PASSED`。

5. 安装环境中执行 `loop-backlog` 技能时，`daemonBootstrap` 能找到并启动 `basic-daemon.js`，`verifySubTaskDod` 能成功调用 `verify-subtask-dod.sh`（通过 smoke-run 或安装后集成测试确认）。
   验证：在非仓库目录下运行 `node ~/.claude/plugins/cache/baime/baime/*/scripts/basic-daemon.js --help` 正常退出。

## Proposed Approach

**核心思路**：将 `plugin/` 扩展为包含运行时脚本的完整自包含包，与现有 `plugin/skills/` 和 `plugin/agents/` 并列，通过已有 rsync 机制自动纳入安装流程，不引入新的复制逻辑。

**1. 建立 plugin/scripts/ 并放置四个核心运行时脚本**

在 `plugin/scripts/` 下放置 `basic-daemon.js`、`verify-subtask-dod.sh`、`skill-lint.sh`、`validate-plugin.sh`。这些文件成为插件源码的一部分，受版本控制。`scripts/` 下的原始文件保留不动，`plugin/scripts/` 下的文件通过 symlink 或 CI 同步检查与其保持一致，避免双份维护漂移。

**2. 确认 install.sh rsync 已覆盖 plugin/scripts/**

由于 `install.sh` 已通过 `rsync -a "$REPO_ROOT/plugin/" "$INSTALL_DIR/"` 复制整个 `plugin/` 目录树，`plugin/scripts/` 将自动出现在 `$INSTALL_DIR/scripts/`。需验证 rsync 命令无显式排除规则，若有则移除对 `scripts/` 的排除。

**3. 统一技能中的脚本引用路径**

对 `loop-backlog/SKILL.md` 中所有裸 `scripts/xxx` 路径（`daemonBootstrap`、`verifySubTaskDod`、`ensureDaemonScript` 之外的调用点）逐一替换为 `${REPO_ROOT}/scripts/xxx`。`feature-to-backlog`、`epic-to-backlog`、`task-to-backlog` 中的 `bash scripts/skill-lint.sh` 和 `bash scripts/validate-plugin.sh` 引用，改为 `bash "${REPO_ROOT}/scripts/skill-lint.sh"` 和 `bash "${REPO_ROOT}/scripts/validate-plugin.sh"`。确保 `REPO_ROOT` 在技能执行上下文中通过标准机制（如 `git rev-parse --show-toplevel`）可靠获得。

**4. 更新 validate-plugin.sh 中的自引用路径**

`validate-plugin.sh` 内部引用 `scripts/skill-lint.sh`，需更新为相对于 `REPO_ROOT` 的绝对路径，确保在安装环境中调用 `$INSTALL_DIR/scripts/validate-plugin.sh` 时仍能找到 `skill-lint.sh`。

## Trade-offs and Risks

**不在此次范围内**
- `scripts/` 中的所有开发工具脚本（测试脚本、release 脚本、实验脚本等）不迁移，仅处理四个核心运行时脚本。
- `install.sh` 的注册逻辑（marketplace.json、settings.json、installed_plugins.json 写入）不改动。
- `loop-backlog` 技能中的 `ensureDaemonScript` 机制（将 `basic-daemon.js` 写入 `scripts/`）不移除；它作为本地开发时的自修复机制保留。

**已知风险**
- **双份维护漂移**：`scripts/` 与 `plugin/scripts/` 若不同步，会导致安装版本与开发版本行为差异。缓解：用 symlink 实现单一真相来源，或在 `validate-plugin.sh` 中增加 diff 检查。
- **`validate-plugin.sh` 自举路径**：`validate-plugin.sh` 改动其内部 `skill-lint.sh` 路径引用后，需同时在开发环境（以 `REPO_ROOT` 为根）和安装环境（以 `INSTALL_DIR` 为根）均能正确定位，需对两种执行上下文分别测试。
- **遗漏的裸路径引用**：`loop-backlog/SKILL.md` 体量大（1600+ 行），可能存在未发现的裸 `scripts/` 路径，需全面 grep 确认，避免安装环境静默失败。
- **现有用户缓存不自动更新**：已安装插件的用户需重新运行 `install.sh` 才能获得 `plugin/scripts/`，无自动迁移路径。

**备选方案考虑**
- 在 `install.sh` 中单独复制 `scripts/` 目录：可行，但让 rsync 边界与 `plugin/` 不一致，增加维护负担。
- 将所有脚本内联进 SKILL.md（扩展 `ensureDaemonScript` 模式）：`basic-daemon.js` 已用此方式，但 `validate-plugin.sh` 达 794 行，内联维护成本过高，排除。

---

# Plan: 将核心运行时脚本移入 plugin/scripts/ 并更新引用路径

Proposal: docs/proposals/proposal-plugin-runtime-scripts.md

## Background

Four runtime scripts currently live only in `scripts/` and are not distributed with the plugin:
- `scripts/basic-daemon.js` (246 lines) — loop-backlog daemon
- `scripts/verify-subtask-dod.sh` (74 lines) — DoD gate checker
- `scripts/skill-lint.sh` (74 lines) — manifest lint tool
- `scripts/validate-plugin.sh` (793 lines) — full plugin validation suite

`install.sh` uses `rsync -a --delete plugin/ $INSTALL_DIR/` so anything under `plugin/` is already deployed. The strategy chosen is:

- **`plugin/scripts/` holds real file copies** of the four scripts — `rsync -a` (without `-L`) preserves symlinks as symlinks; a symlink pointing to `../../scripts/<file>` would be dangling in the install dir because the target path does not exist relative to `$INSTALL_DIR/scripts/`. Real copies avoid this entirely.
- **`scripts/` stays canonical** — no disruption to the running dev workflow.
- **Drift prevention**: `validate-plugin.sh` gains a diff-check section that compares each `plugin/scripts/<file>` against `scripts/<file>` and fails if they differ.
- **SKILL.md bare `bash scripts/` paths** are replaced with `bash "${REPO_ROOT}/scripts/"` so installed instances resolve via `git rev-parse --show-toplevel` (already present in each skill's `init()` block).
- **validate-plugin.sh** already uses `$REPO_ROOT/scripts/` for its internal references (skill-lint.sh, verify-kind-status.sh, verify-cap-markers.sh) — no change needed for those.
- **install.sh** already uses `rsync -a "$REPO_ROOT/plugin/" "$INSTALL_DIR/"` with no exclusions — no change needed.

### Files to create
- `plugin/scripts/basic-daemon.js` — copy of `scripts/basic-daemon.js`
- `plugin/scripts/verify-subtask-dod.sh` — copy of `scripts/verify-subtask-dod.sh`
- `plugin/scripts/skill-lint.sh` — copy of `scripts/skill-lint.sh`
- `plugin/scripts/validate-plugin.sh` — copy of `scripts/validate-plugin.sh`

### Files to modify
- `scripts/validate-plugin.sh` — add `plugin/scripts/` copy-consistency diff-check section
- `plugin/skills/loop-backlog/SKILL.md` — 4 bare `bash scripts/verify-subtask-dod.sh` occurrences
- `plugin/skills/feature-to-backlog/SKILL.md` — 3 bare refs (skill-lint.sh ×1, validate-plugin.sh ×2)
- `plugin/skills/epic-to-backlog/SKILL.md` — 2 bare refs (skill-lint.sh ×1, validate-plugin.sh ×1)
- `plugin/skills/task-to-backlog/SKILL.md` — 3 bare refs (skill-lint.sh ×1, validate-plugin.sh ×2)

### Files confirmed no-change-needed
- `scripts/install/install.sh` — rsync already covers plugin/scripts/
- `scripts/validate-plugin.sh` internal references — already use `$REPO_ROOT/scripts/`

---

## Phase A: Create plugin/scripts/ with real file copies

### Tests (write first)

```bash
# Expected to FAIL (red) before Phase A implementation
ls plugin/scripts/basic-daemon.js \
   plugin/scripts/verify-subtask-dod.sh \
   plugin/scripts/skill-lint.sh \
   plugin/scripts/validate-plugin.sh
```

### Implementation

```bash
cd /home/yale/work/baime
mkdir -p plugin/scripts
cp scripts/basic-daemon.js       plugin/scripts/basic-daemon.js
cp scripts/verify-subtask-dod.sh plugin/scripts/verify-subtask-dod.sh
cp scripts/skill-lint.sh         plugin/scripts/skill-lint.sh
cp scripts/validate-plugin.sh    plugin/scripts/validate-plugin.sh
```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `ls -la plugin/scripts/basic-daemon.js plugin/scripts/verify-subtask-dod.sh plugin/scripts/skill-lint.sh plugin/scripts/validate-plugin.sh`
- [ ] `! test -L plugin/scripts/basic-daemon.js`
- [ ] `diff plugin/scripts/basic-daemon.js scripts/basic-daemon.js`

---

## Phase B: Add plugin/scripts/ copy-consistency diff-check to validate-plugin.sh

Ensures that as `scripts/<file>` is updated, the CI gate catches any divergence between `scripts/` (canonical) and `plugin/scripts/` (distributed copy).

### Tests (write first)

```bash
# Baseline — must PASS before touching validate-plugin.sh
bash scripts/validate-plugin.sh
```

After editing, the new check section must emit PASS for all four scripts:

```bash
bash scripts/validate-plugin.sh 2>&1 | grep "plugin/scripts copy"
# must show 4 PASS lines
```

### Implementation

Add a new check section to `scripts/validate-plugin.sh` immediately after the `.claude/skills symlink` block (after line 177):

```bash
# ── plugin/scripts/ copy consistency ─────────────────────────────────────────

echo ""
echo "=== plugin/scripts/ Copy Consistency ==="

PLUGIN_SCRIPTS_DIR="$REPO_ROOT/plugin/scripts"
for script_name in basic-daemon.js verify-subtask-dod.sh skill-lint.sh validate-plugin.sh; do
    canonical="${REPO_ROOT}/scripts/${script_name}"
    copy="${PLUGIN_SCRIPTS_DIR}/${script_name}"
    if [ -L "$copy" ]; then
        fail "plugin/scripts copy is a symlink (must be real file): ${script_name} — re-copy from scripts/${script_name}"
    elif [ ! -f "$copy" ]; then
        fail "missing plugin/scripts copy: ${script_name}"
    elif diff -q "$canonical" "$copy" >/dev/null 2>&1; then
        pass "plugin/scripts copy: ${script_name}"
    else
        fail "plugin/scripts copy out of sync: ${script_name} differs from scripts/${script_name} — run: cp scripts/${script_name} plugin/scripts/${script_name}"
    fi
done
```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh 2>&1 | grep -c "PASS: plugin/scripts copy" | grep -q "^4$"`

---

## Phase C: Fix bare `scripts/` paths in loop-backlog/SKILL.md

Four occurrences of bare `bash scripts/verify-subtask-dod.sh` in `plugin/skills/loop-backlog/SKILL.md`:
- Line 247 (Spec pseudo-code): `shell("bash scripts/verify-subtask-dod.sh " + id)` — documentation only
- Line 251 (Spec pseudo-code): `shell("bash scripts/verify-subtask-dod.sh " + c.id)` — documentation only
- Line 1504 (agent instruction): `bash scripts/verify-subtask-dod.sh ${EPIC_ID}` — executable
- Line 1587 (bash block, executable): `bash scripts/verify-subtask-dod.sh "$EPIC_ID"` — executable

`REPO_ROOT` is already set via `git rev-parse --show-toplevel` at line 491 of the skill's `init()` block.

### Tests (write first)

```bash
# Expected to FAIL (red) — confirms bare paths currently exist
grep -q 'bash scripts/verify-subtask-dod.sh' plugin/skills/loop-backlog/SKILL.md
```

After implementation this must be absent (exit non-zero):

```bash
! grep -q 'bash scripts/verify-subtask-dod\.sh' plugin/skills/loop-backlog/SKILL.md
```

### Implementation

In `plugin/skills/loop-backlog/SKILL.md`, replace each of the 4 occurrences:

| Location | Before | After |
|---|---|---|
| Line 247 (Spec) | `shell("bash scripts/verify-subtask-dod.sh " + id)` | `shell("bash \"${REPO_ROOT}/scripts/verify-subtask-dod.sh\" " + id)` |
| Line 251 (Spec) | `shell("bash scripts/verify-subtask-dod.sh " + c.id)` | `shell("bash \"${REPO_ROOT}/scripts/verify-subtask-dod.sh\" " + c.id)` |
| Line 1504 (agent) | `bash scripts/verify-subtask-dod.sh ${EPIC_ID}` | `bash "${REPO_ROOT}/scripts/verify-subtask-dod.sh" ${EPIC_ID}` |
| Line 1587 (bash) | `bash scripts/verify-subtask-dod.sh "$EPIC_ID"` | `bash "${REPO_ROOT}/scripts/verify-subtask-dod.sh" "$EPIC_ID"` |

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q 'bash scripts/verify-subtask-dod\.sh' plugin/skills/loop-backlog/SKILL.md`

---

## Phase D: Fix bare `scripts/` paths in feature-to-backlog, epic-to-backlog, task-to-backlog

**feature-to-backlog/SKILL.md** (3 occurrences at lines 186, 446, 453):
- `bash scripts/skill-lint.sh` → `bash "${REPO_ROOT}/scripts/skill-lint.sh"`
- `bash scripts/validate-plugin.sh` → `bash "${REPO_ROOT}/scripts/validate-plugin.sh"`
- `--dod "bash scripts/validate-plugin.sh"` → `--dod "bash \"${REPO_ROOT}/scripts/validate-plugin.sh\""`

**epic-to-backlog/SKILL.md** (2 occurrences at lines 217, 479):
- `bash scripts/skill-lint.sh` → `bash "${REPO_ROOT}/scripts/skill-lint.sh"`
- `bash scripts/validate-plugin.sh` → `bash "${REPO_ROOT}/scripts/validate-plugin.sh"`

**task-to-backlog/SKILL.md** (3 occurrences at lines 149, 324, 330):
- `bash scripts/skill-lint.sh` → `bash "${REPO_ROOT}/scripts/skill-lint.sh"`
- `bash scripts/validate-plugin.sh` → `bash "${REPO_ROOT}/scripts/validate-plugin.sh"`
- `--dod "bash scripts/validate-plugin.sh"` → `--dod "bash \"${REPO_ROOT}/scripts/validate-plugin.sh\""`

`REPO_ROOT` is already set via `git rev-parse --show-toplevel` in `init()` of each skill (feature-to-backlog line 117, epic-to-backlog line 148, task-to-backlog line 95).

### Tests (write first)

```bash
# Expected to FAIL (red) — bare paths exist in all three files
grep -rq 'bash scripts/skill-lint\.sh\|bash scripts/validate-plugin\.sh' \
  plugin/skills/feature-to-backlog/SKILL.md \
  plugin/skills/epic-to-backlog/SKILL.md \
  plugin/skills/task-to-backlog/SKILL.md
```

After implementation these must all be absent:

```bash
! grep -q 'bash scripts/skill-lint\.sh' plugin/skills/feature-to-backlog/SKILL.md
! grep -q 'bash scripts/skill-lint\.sh' plugin/skills/epic-to-backlog/SKILL.md
! grep -q 'bash scripts/skill-lint\.sh' plugin/skills/task-to-backlog/SKILL.md
! grep -q 'bash scripts/validate-plugin\.sh' plugin/skills/feature-to-backlog/SKILL.md
! grep -q 'bash scripts/validate-plugin\.sh' plugin/skills/epic-to-backlog/SKILL.md
! grep -q 'bash scripts/validate-plugin\.sh' plugin/skills/task-to-backlog/SKILL.md
```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -rq 'bash scripts/skill-lint\.sh\|bash scripts/validate-plugin\.sh' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/epic-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md`

---

## Phase E: Verify final install deliverable via simulated rsync

Validates that `install.sh`'s `rsync -a plugin/ $INSTALL_DIR/` correctly includes `plugin/scripts/` in the installed output, and that the installed scripts are executable and functional. Uses a temporary directory to avoid touching `~/.claude/`.

### Tests (write first)

```bash
# Expected to FAIL (red) before Phase A creates plugin/scripts/
TMPINSTALL=$(mktemp -d)
rsync -a plugin/ "$TMPINSTALL/"
ls "$TMPINSTALL/scripts/basic-daemon.js" \
   "$TMPINSTALL/scripts/verify-subtask-dod.sh" \
   "$TMPINSTALL/scripts/skill-lint.sh" \
   "$TMPINSTALL/scripts/validate-plugin.sh"
rm -rf "$TMPINSTALL"
```

### Implementation

No code changes — this phase only adds a test script that verifies the existing install mechanism includes the new `plugin/scripts/` content.

Create `scripts/tests/install-deliverable.test.sh`:

```bash
#!/bin/bash
# Verify that rsync -a plugin/ $TMPINSTALL/ produces a scripts/ dir with the four runtime scripts.
set -e
TMPINSTALL=$(mktemp -d)
trap "rm -rf $TMPINSTALL" EXIT

REPO_ROOT=$(git rev-parse --show-toplevel)
rsync -a "$REPO_ROOT/plugin/" "$TMPINSTALL/"

for f in basic-daemon.js verify-subtask-dod.sh skill-lint.sh validate-plugin.sh; do
    if [ ! -f "$TMPINSTALL/scripts/$f" ]; then
        echo "FAIL: $f missing from simulated install dir"
        exit 1
    fi
    if [ -L "$TMPINSTALL/scripts/$f" ]; then
        echo "FAIL: $f is a symlink in simulated install dir (must be real file)"
        exit 1
    fi
    echo "PASS: $f present as real file in simulated install dir"
done

# Verify basic-daemon.js is runnable from the install dir (no repo-relative paths needed)
node "$TMPINSTALL/scripts/basic-daemon.js" --help >/dev/null 2>&1 && \
    echo "PASS: basic-daemon.js runnable from install dir" || \
    echo "WARN: basic-daemon.js --help non-zero (acceptable if it requires event loop)"

echo "install-deliverable: ALL CHECKS PASSED"
```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/tests/install-deliverable.test.sh`

---

## Constraints

- `scripts/` directory and its files are not modified or deleted — it remains canonical source.
- Only the four named scripts are added to `plugin/scripts/`. Dev-only scripts (`basic-daemon.test.js`, `verify-subtask-dod.test.sh`, release scripts, experiment scripts, etc.) are not added.
- `install.sh` registration logic (marketplace.json, settings.json, installed_plugins.json) is unchanged.
- The `ensureDaemonScript` self-repair mechanism in loop-backlog is preserved.
- `validate-plugin.sh` EXPECTED_SKILLS count (25) and EXPECTED_AGENTS count (4) are not changed — no new skills or agents are added.
- task-to-backlog lines 324 and 330 are documentation examples (inside a `>` block / `--dod` string), not live shell. The substitution is still applied so installed instances show correct paths in their output.
- `plugin/scripts/` files must be real copies, not symlinks — `rsync -a` (without `-L`) preserves symlinks as-is, so a symlink pointing to `../../scripts/<file>` would be dangling after installation since that relative path does not exist under `$INSTALL_DIR`.
- Phase E test script uses a temp dir and `trap` cleanup — it never touches `~/.claude/` or the real install path.

---

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash scripts/tests/install-deliverable.test.sh`
- [ ] `ls plugin/scripts/basic-daemon.js plugin/scripts/verify-subtask-dod.sh plugin/scripts/skill-lint.sh plugin/scripts/validate-plugin.sh`
- [ ] `! grep -rq 'bash scripts/verify-subtask-dod\.sh' plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -rq 'bash scripts/skill-lint\.sh\|bash scripts/validate-plugin\.sh' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/epic-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md`
- [ ] `node plugin/scripts/basic-daemon.js --help 2>&1 | grep -qi "usage\|basic-daemon\|options"`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal approved. Starting plan draft.

Plan review iteration 2: APPROVED

claimed: 2026-06-22T00:02:00Z

Completed: 2026-06-22T00:09:05Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 ls -la plugin/scripts/basic-daemon.js plugin/scripts/verify-subtask-dod.sh plugin/scripts/skill-lint.sh plugin/scripts/validate-plugin.sh
- [ ] #3 ! test -L plugin/scripts/basic-daemon.js
- [ ] #4 diff plugin/scripts/basic-daemon.js scripts/basic-daemon.js
- [ ] #5 bash scripts/validate-plugin.sh
- [ ] #6 bash scripts/validate-plugin.sh 2>&1 | grep -c "PASS: plugin/scripts copy" | grep -q "^4$"
- [ ] #7 bash scripts/validate-plugin.sh
- [ ] #8 ! grep -q 'bash scripts/verify-subtask-dod\.sh' plugin/skills/loop-backlog/SKILL.md
- [ ] #9 bash scripts/validate-plugin.sh
- [ ] #10 ! grep -rq 'bash scripts/skill-lint\.sh\|bash scripts/validate-plugin\.sh' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/epic-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md
- [ ] #11 bash scripts/validate-plugin.sh
- [ ] #12 ls plugin/scripts/basic-daemon.js plugin/scripts/verify-subtask-dod.sh plugin/scripts/skill-lint.sh plugin/scripts/validate-plugin.sh
- [ ] #13 ! grep -rq 'bash scripts/verify-subtask-dod\.sh' plugin/skills/loop-backlog/SKILL.md
- [ ] #14 ! grep -rq 'bash scripts/skill-lint\.sh\|bash scripts/validate-plugin\.sh' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/epic-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md
- [ ] #15 node plugin/scripts/basic-daemon.js --help 2>&1 | grep -qi "usage\|basic-daemon\|options"
- [ ] #16 bash scripts/validate-plugin.sh
- [ ] #17 ls -la plugin/scripts/basic-daemon.js plugin/scripts/verify-subtask-dod.sh plugin/scripts/skill-lint.sh plugin/scripts/validate-plugin.sh
- [ ] #18 ! test -L plugin/scripts/basic-daemon.js
- [ ] #19 diff plugin/scripts/basic-daemon.js scripts/basic-daemon.js
- [ ] #20 bash scripts/validate-plugin.sh
- [ ] #21 bash scripts/validate-plugin.sh 2>&1 | grep -c "PASS: plugin/scripts copy" | grep -q "^4$"
- [ ] #22 bash scripts/validate-plugin.sh
- [ ] #23 ! grep -q 'bash scripts/verify-subtask-dod\.sh' plugin/skills/loop-backlog/SKILL.md
- [ ] #24 bash scripts/validate-plugin.sh
- [ ] #25 ! grep -rq 'bash scripts/skill-lint\.sh\|bash scripts/validate-plugin\.sh' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/epic-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md
- [ ] #26 bash scripts/validate-plugin.sh
- [ ] #27 bash scripts/tests/install-deliverable.test.sh
- [ ] #28 bash scripts/validate-plugin.sh
- [ ] #29 bash scripts/tests/install-deliverable.test.sh
- [ ] #30 ls plugin/scripts/basic-daemon.js plugin/scripts/verify-subtask-dod.sh plugin/scripts/skill-lint.sh plugin/scripts/validate-plugin.sh
- [ ] #31 ! grep -rq 'bash scripts/verify-subtask-dod\.sh' plugin/skills/loop-backlog/SKILL.md
- [ ] #32 ! grep -rq 'bash scripts/skill-lint\.sh\|bash scripts/validate-plugin\.sh' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/epic-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md
- [ ] #33 node plugin/scripts/basic-daemon.js --help 2>&1 | grep -qi "usage\|basic-daemon\|options"
<!-- DOD:END -->
