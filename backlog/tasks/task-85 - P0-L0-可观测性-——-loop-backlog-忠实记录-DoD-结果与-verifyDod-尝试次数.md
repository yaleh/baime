---
id: TASK-85
title: 'P0: L0 可观测性 —— loop-backlog 忠实记录 DoD 结果与 verifyDod 尝试次数'
status: Basic: Done
assignee: []
created_date: '2026-06-20 06:01'
updated_date: '2026-06-20 06:39'
labels:
  - kind:basic
  - loop-meta
  - observability
  - loop-backlog
dependencies: []
references:
  - docs/proposals/loop-meta-architecture.md
modified_files:
  - scripts/check-l0-observability.sh
  - plugin/skills/loop-backlog/SKILL.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

loop-meta（L1）的 evaluator 依赖 L0（loop-backlog）把子任务执行的真相写回 backlog notes，才能做实质评价。但当前 notes 里 0 条 "DoD #N FAIL" 记录——尽管 verifyDod fix-retry-3 已存在——说明 L0 当前结果记录可能不完整或格式不统一，evaluator 若读取这些 notes 会瞎判。

P0 是 loop-meta 整体 rollout 的前置条件：无 P0，则 P3 evaluator 无法可靠运转。

## Goals

1. loop-backlog 每个 DoD 项的 PASS/FAIL 状态必须写入对应任务的 notes，格式可被脚本解析。
2. verifyDod 的 attempt 次数（首次 / 重试 N 次 / 最终结果）写入 notes。
3. 提供检查脚本，可随机抽查 Done 任务 notes 并验证上述两条格式满足。
4. 检查脚本对现有近期 Done 任务的抽查结果形成书面报告（放行证据）。

## Proposed Approach

审计 `loop-backlog` 和 `scripts/loop-backlog-daemon.js` 中的 notes 写入逻辑；补充 DoD-level 写入（每条 DoD PASS/FAIL）和 verifyDod attempt 计数写入；新增 `scripts/check-l0-observability.sh` 抽查脚本；生成放行证据报告。

## Trade-offs and Risks

- loop-backlog 的 notes 写入量增加，但仍是文本追加，不影响执行语义。
- 仅改 L0 notes 写入逻辑和新增检查脚本；不改 verifyDod 核心判定逻辑。

## References

- docs/proposals/loop-meta-architecture.md（Rollout P0 节）
- plugin/skills/loop-backlog/SKILL.md
- scripts/loop-backlog-daemon.js
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 loop-backlog 每个 DoD 项执行后写入可解析的 PASS/FAIL notes 条目
- [ ] #2 verifyDod attempt 次数（含重试）写入 notes
- [ ] #3 check-l0-observability.sh 对近期 Done 任务抽查输出放行证据报告
- [ ] #4 bash scripts/validate-plugin.sh 通过
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: P0: L0 可观测性 —— loop-backlog 忠实记录 DoD 结果与 verifyDod 尝试次数

## Background

loop-meta（L1）的 evaluator 依赖 L0（loop-backlog）把子任务执行的真相写回 backlog notes，才能做实质评价。但当前 notes 里 0 条 "DoD #N FAIL" 记录——尽管 verifyDod fix-retry-3 已存在——说明 L0 当前结果记录可能不完整或格式不统一，evaluator 若读取这些 notes 会瞎判。

P0 是 loop-meta 整体 rollout 的前置条件：无 P0，则 P3 evaluator 无法可靠运转。

## Goals

1. loop-backlog 每个 DoD 项的 PASS/FAIL 状态必须写入对应任务的 notes，格式可被脚本解析。
2. verifyDod 的 attempt 次数（首次 / 重试 N 次 / 最终结果）写入 notes。
3. 提供检查脚本，可随机抽查 Done 任务 notes 并验证上述两条格式满足。
4. 检查脚本对现有近期 Done 任务的抽查结果形成书面报告（放行证据）。

## Proposed Approach

审计 `plugin/skills/loop-backlog/SKILL.md` 中的 notes 写入逻辑（`appendDodNote`、`verifyDod`、`executePrompt` 各节）；`scripts/loop-backlog-daemon.js` 仅做任务队列轮询，不负责 notes 写入，无需修改。补充 DoD-level 写入（每条 DoD PASS/FAIL）和 verifyDod attempt 计数写入；新增 `scripts/check-l0-observability.sh` 抽查脚本；生成放行证据报告。

## Trade-offs and Risks

- loop-backlog 的 notes 写入量增加，但仍是文本追加，不影响执行语义。
- 仅改 L0 notes 写入逻辑和新增检查脚本；不改 verifyDod 核心判定逻辑或通过/失败判定。
- check-l0-observability.sh 仅抽查历史 Done 任务，不需要重新执行任务。
- 风险：现有 Done 任务的 notes 格式为旧格式，历史记录中 DoD 条目可能为零，导致 Goal 4 报告样本为空或仅能验证新格式任务。需在报告中明确说明抽查基线时间范围及可用样本数，若样本不足则记录为"历史任务无可用记录——格式改动将从此次后生效"。

---

# Plan: P0: L0 可观测性 —— loop-backlog 忠实记录 DoD 结果与 verifyDod 尝试次数

Proposal: docs/proposals/loop-meta-architecture.md

## Phase A: 创建 scripts/check-l0-observability.sh 抽查脚本

### Tests (write first)

RED: Script does not exist yet — any invocation fails immediately.

```bash
# This command MUST fail (exit non-zero) before Phase A implementation:
bash scripts/check-l0-observability.sh
# Expected: "bash: scripts/check-l0-observability.sh: No such file or directory"
```

Verify absence before writing:
```bash
! test -f /home/yale/work/baime/scripts/check-l0-observability.sh
```

GREEN target after implementation:
```bash
bash scripts/check-l0-observability.sh
# Expected: exits 0, prints audit report to stdout (may note zero parseable samples for historical tasks)
```

### Implementation

Create `/home/yale/work/baime/scripts/check-l0-observability.sh`.

The script must:
1. Find all Done task files in `backlog/tasks/` (files with `status: Done` in frontmatter).
2. For each Done task, read its Implementation Notes section.
3. Check for parseable DoD lines matching the pattern: `DoD #N: PASS` or `DoD #N: FAIL`.
4. Check for parseable verifyDod attempt lines matching the pattern: `DoD #N attempt N` or `DoD #N ✗ attempt`.
5. Emit a report summarising:
   - Total Done tasks sampled
   - Tasks with at least one DoD PASS/FAIL line (G1 compliant)
   - Tasks with at least one attempt-count line (G2 compliant)
   - Sample size and baseline timestamp
   - If zero parseable samples: explicit statement "历史任务无可用记录——格式改动将从此次后生效"
6. Exit 0 always (audit script; non-zero only on script errors).

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f /home/yale/work/baime/scripts/check-l0-observability.sh`
- [ ] `bash /home/yale/work/baime/scripts/check-l0-observability.sh`

---

## Phase B: 更新 plugin/skills/loop-backlog/SKILL.md — 补充 DoD PASS/FAIL 与 attempt 计数写入规格

### Tests (write first)

RED tests (patterns that must fail before Phase B implementation):

```bash
# Gap 1: contracts frontmatter does not yet enforce DoD PASS format
! grep -q '"DoD #.*: PASS"' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
```

```bash
# Gap 2: contracts frontmatter does not yet enforce DoD FAIL format
! grep -q '"DoD #.*: FAIL"' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
```

```bash
# Gap 3: verifyDod bash block success path does not yet call --append-notes with DoD PASS
! grep -q 'DoD #\${N}: PASS' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
```

GREEN target after Phase B (these must all exit 0):

```bash
grep -q '"DoD #.*: PASS"' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
grep -q '"DoD #.*: FAIL"' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
grep -q 'DoD #\${N}: PASS' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
```

### Implementation

Modify `plugin/skills/loop-backlog/SKILL.md` in four locations:

**Location 1** — `### verifyDod` bash block: add `appendDodNote` / `backlog task edit --append-notes` calls recording PASS on success and FAIL with attempt count on retry/stuck paths.

**Location 2** — `### executePrompt` bash block: update DoD verification notes instruction to specify exact parseable format.

**Location 3** — `appendDodNote` pseudocode: add comment clarifying parseable contract.

**Location 4** — SKILL.md `contracts` frontmatter: add grep assertions for `"DoD #.*: PASS"`, `"DoD #.*: FAIL"`, and `attempt`.

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q '"DoD #.*: PASS"' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q '"DoD #.*: FAIL"' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'DoD #\${N}: PASS' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `bash /home/yale/work/baime/scripts/check-l0-observability.sh`

---

## Constraints

- Do not modify `verifyDod` core pass/fail logic — only add `appendNote` calls.
- Do not modify `scripts/loop-backlog-daemon.js`; it handles queue polling only, not notes writing.
- The check script must exit 0 even when historical tasks have no parseable records (report the absence, don't error).
- Historical Done tasks pre-dating this change will show G1:NO / G2:NO; the report must say so explicitly rather than failing.
- Phase B must not rename or restructure existing SKILL.md sections; only extend content within existing `### verifyDod` and `### executePrompt` blocks.
- Phase A (script creation) must be completed before Phase B (SKILL.md update) because Phase B's DoD calls the script.

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f /home/yale/work/baime/scripts/check-l0-observability.sh`
- [ ] `bash /home/yale/work/baime/scripts/check-l0-observability.sh`
- [ ] `grep -q '"DoD #.*: PASS"' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q '"DoD #.*: FAIL"' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'DoD #\${N}: PASS' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 3: APPROVED

Plan review iteration 1: NEEDS_REVISION — fixed Phase B RED/GREEN tests and DoD/Acceptance Gate items. Original Phase B RED test used `grep -q 'DoD #.*PASS\|DoD #.*FAIL'` which already passes in current SKILL.md (appendDodNote pseudocode on lines 174–175 already contains those strings). Replaced with three tests targeting actual gaps: (1) contracts frontmatter missing `"DoD #.*: PASS"` enforcement, (2) contracts frontmatter missing `"DoD #.*: FAIL"` enforcement, (3) verifyDod bash block missing `--append-notes.*DoD.*PASS` call. Updated Phase B DoD and Acceptance Gate to use the same corrected patterns. All other checks passed.

Plan review iteration 2: APPROVED

One issue fixed: Phase B Gap 3 RED test used `! grep -q 'append-notes.*DoD.*PASS'` which was not truly RED because line 697 of SKILL.md already contains `--append-notes "DoD #N: PASS|FAIL — <cmd>`. Replaced with `! grep -q 'DoD #\${N}: PASS'` (and matching GREEN / DoD / Acceptance Gate occurrences) — this pattern is absent before Phase B and present after, making it a true RED→GREEN gate. All other checks pass: goal coverage G1–G4 complete, TDD structure correct in both phases, first DoD item in each phase is `bash scripts/validate-plugin.sh`, Acceptance Gate first item is `bash scripts/validate-plugin.sh`, absence checks use `! grep -q` not `grep -qv`, Phase A → Phase B ordering correct, no out-of-scope phases, all file paths verified.

Phase A ✓ 2026-06-20T06:35:00Z
Created scripts/check-l0-observability.sh — audits Done tasks for DoD PASS/FAIL and attempt-count notes, exits 0 always

DoD #1: PASS — test -f scripts/check-l0-observability.sh

DoD #2: PASS — bash scripts/check-l0-observability.sh

DoD #3: PASS — bash scripts/validate-plugin.sh

Phase B ✓ 2026-06-20T06:35:00Z
Updated plugin/skills/loop-backlog/SKILL.md: added DOD_PASS_NOTE/DOD_FAIL_NOTE variable pattern in verifyDod bash block; added two contract assertions

DoD #8: PASS — grep -q '"DoD #.*: PASS"' SKILL.md

DoD #9: PASS — grep -q '"DoD #.*: FAIL"' SKILL.md

DoD #10: PASS — grep -q 'DoD #\${N}: PASS' SKILL.md

## Execution Summary
Result: Done
Commit: 2e5e186
All 17 DoD items PASS. Historical audit baseline: 1/47 Done tasks had parseable DoD notes (pre-change). New format active from TASK-85.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 test -f scripts/check-l0-observability.sh
- [x] #2 bash scripts/check-l0-observability.sh
- [x] #3 bash scripts/validate-plugin.sh
- [x] #4 bash scripts/validate-plugin.sh
- [x] #5 test -f /home/yale/work/baime/scripts/check-l0-observability.sh
- [x] #6 bash /home/yale/work/baime/scripts/check-l0-observability.sh
- [x] #7 bash scripts/validate-plugin.sh
- [x] #8 grep -q '"DoD #.*: PASS"' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
- [x] #9 grep -q '"DoD #.*: FAIL"' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
- [x] #10 grep -q 'DoD #\${N}: PASS' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
- [x] #11 bash /home/yale/work/baime/scripts/check-l0-observability.sh
- [x] #12 bash scripts/validate-plugin.sh
- [x] #13 test -f /home/yale/work/baime/scripts/check-l0-observability.sh
- [x] #14 bash /home/yale/work/baime/scripts/check-l0-observability.sh
- [x] #15 grep -q '"DoD #.*: PASS"' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
- [x] #16 grep -q '"DoD #.*: FAIL"' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
- [x] #17 grep -q 'DoD #\${N}: PASS' /home/yale/work/baime/plugin/skills/loop-backlog/SKILL.md
<!-- DOD:END -->
