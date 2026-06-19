---
id: TASK-31
title: task-from-template 终点状态改为 Backlog + validate-plugin.sh 修复 contract grep -e
status: Backlog
assignee: []
created_date: '2026-06-18 09:51'
labels: []
dependencies: []
modified_files:
  - plugin/skills/task-from-template/SKILL.md
  - scripts/validate-plugin.sh
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Two related fixes identified via code review:

1. `task-from-template` 创建的 task 落地状态为 `Ready`，会被 `loop-backlog` 立即拾取执行，绕过人工审查窗口。应改为 `Backlog`，与 `feature-to-backlog` / `task-to-backlog` 保持一致。

2. `scripts/validate-plugin.sh` 的 contract 验证逻辑将 pattern 直接作为 `grep` 的第三个参数传入；当 pattern 以 `--` 开头时（如 `--status "Backlog"`），`grep` 将其解析为选项，返回 exit code 2（error），导致 contract 检查误报 FAIL。应改为 `grep -q -e <pattern>`。

两个问题合并实现：Phase A 改 SKILL.md，Phase B 改 validate-plugin.sh，Phase A 的 contracts 正好依赖 Phase B 的修复才能通过验证。

## Phase A: 修改 plugin/skills/task-from-template/SKILL.md

### Tests (write first)

```bash
# A1 — description 仍是 Ready-status（改前失败）
grep -q 'Ready-status' plugin/skills/task-from-template/SKILL.md

# A2 — 无 contracts 块（改前失败）
! grep -q 'contracts:' plugin/skills/task-from-template/SKILL.md

# A3 — Spec createTask 仍用 --status Ready（改前失败）
grep -q '"--status Ready"' plugin/skills/task-from-template/SKILL.md

# A4 — Step 5 bash 仍用 --status "Ready"（改前失败）
grep -q '--status "Ready"' plugin/skills/task-from-template/SKILL.md
```

改后上述检查全部取反（A1/A3/A4 变为不存在，A2 变为存在）。

### Implementation

File: `plugin/skills/task-from-template/SKILL.md`

**Change 1** — frontmatter description 字段：
- `"Creates a Ready-status backlog task` → `"Creates a Backlog-status backlog task`

**Change 2** — frontmatter 添加 contracts 块（紧接 `allowed-tools` 行之后，`---` 之前）：
```yaml
contracts:
  - grep: '--status "Backlog"'
    target: self
  - not-grep: '--status "Ready"'
    target: self
```

**Change 3** — Spec `createTask` 函数体：
- `" --status Ready"` → `" --status Backlog"`

**Change 4** — Spec `taskFromTemplate` 末尾注释：
- `return:   task   -- status: Ready` → `return:   task   -- status: Backlog`

**Change 5** — Step 5 bash 块：
- `--status "Ready" \` → `--status "Backlog" \`

**Change 6** — Step 6 echo 块，替换最后 4 行：
```bash
echo "✅ Task $TASK_ID created with status Backlog."
echo "   Template last-used updated to $TODAY."
echo ""
echo "Promote to Ready when you're ready to execute:"
echo "  backlog task edit $TASK_ID --status Ready"
echo "Then run /loop-backlog, or check status with:"
echo "  backlog task view $TASK_ID"
```

## Phase B: 修复 scripts/validate-plugin.sh contract grep 调用

### Tests (write first)

```bash
# B1 — grep 调用尚未加 -e（改前失败）
! grep -qF "'-e', pattern" scripts/validate-plugin.sh
```

改后 B1 取反（存在 `'-e', pattern`）。

### Implementation

File: `scripts/validate-plugin.sh`，`validate_contracts()` Python 内嵌脚本中两处：

将：
```python
result = subprocess.run(['grep', '-q', pattern, target_file], capture_output=True)
```
改为：
```python
result = subprocess.run(['grep', '-q', '-e', pattern, target_file], capture_output=True)
```

两处均需修改（`grep` 分支和 `not-grep` 分支）。

## Constraints

- 只修改 `plugin/skills/task-from-template/SKILL.md` 和 `scripts/validate-plugin.sh`
- 不修改其他 skill、agent 或 CI 文件
- Phase B 必须先于 Phase A 的 contract 验证（或同批提交后一起验证）
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'Backlog-status' plugin/skills/task-from-template/SKILL.md
- [ ] #3 grep -q 'contracts:' plugin/skills/task-from-template/SKILL.md
- [ ] #4 bash -c '! grep -qF -- "--status \"Ready\"" plugin/skills/task-from-template/SKILL.md'
- [ ] #5 grep -qF "'-e', pattern" scripts/validate-plugin.sh
<!-- DOD:END -->
