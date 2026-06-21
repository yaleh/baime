---
id: TASK-6
title: 检查本项目最近一天的变更，确认文档是否已同步更新。
status: Basic: Done
assignee: []
created_date: '2026-06-17 05:47'
updated_date: '2026-06-17 07:51'
labels:
  - kind:basic
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
# Plan: 检查本项目最近一天的变更，确认文档是否已同步更新。

## Context
本项目（baime）近期有较频繁的功能迭代（TASK-5 loop-backlog daemon/Monitor 重构、v1.1.3 发布等），变更涉及 SKILL.md、脚本文件和版本清单等。文档同步检查旨在确认 CHANGELOG、README、docs/plans、docs/proposals 等文档是否及时反映了这些变更，避免文档与代码脱节。

## Phase 1: 收集最近一天的 Git 变更清单
运行 `git log --since="1 day ago" --oneline` 获取提交列表，再用 `git diff --name-status` 列出所有变更文件，分别归类为：代码/脚本变更、文档变更、配置变更。将结果写入 `docs/tasks/check-recent-changes-doc-sync-output.md`。

具体步骤：
1. `git log --since="1 day ago" --oneline` — 记录提交摘要
2. `git diff --name-status $(git log --since="1 day ago" --format="%H" | tail -1)^ HEAD` — 列出所有变更文件及状态（A=新增, M=修改, D=删除）
3. 将上述输出写入输出文件的 `## Changed Files` 段落，并按类别（Scripts / Docs / Config）分组标注

### DoD
- [ ] `test -f docs/tasks/check-recent-changes-doc-sync-output.md`
- [ ] `test -s docs/tasks/check-recent-changes-doc-sync-output.md`
- [ ] `grep -q '## Changed Files' docs/tasks/check-recent-changes-doc-sync-output.md`

## Phase 2: 逐项核查文档同步状态
针对 Phase 1 中识别的每项代码/脚本变更，逐一检查对应文档是否存在或已更新：

1. 检查 `.claude/skills/loop-backlog/SKILL.md` 变更是否在 CHANGELOG 中有记录：
   `grep -q "loop-backlog" CHANGELOG.md`
2. 检查新增脚本（`scripts/loop-backlog-daemon.py`、`scripts/test-loop-backlog-daemon.sh` 等）是否在 README 或 docs 中有说明
3. 检查版本号更新（`plugin/.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json`）是否与 CHANGELOG 中的版本一致：
   对比 `grep '"version"' plugin/.claude-plugin/plugin.json` 与 CHANGELOG 头部条目
4. 检查 `docs/plans/` 和 `docs/proposals/` 中是否有对应 TASK-5 的计划和提案文档
5. 将每项检查结果（同步/缺失/部分同步）写入输出文件的 `## Sync Status` 段落，每项注明状态标签 [OK] / [MISSING] / [PARTIAL]

### DoD
- [ ] `grep -q '## Sync Status' docs/tasks/check-recent-changes-doc-sync-output.md`
- [ ] `grep -q 'loop-backlog' CHANGELOG.md`
- [ ] `test -f docs/plans/105-loop-backlog-daemon-monitor-event-driven.md`
- [ ] `test -f docs/proposals/proposal-loop-backlog-daemon-monitor-event-driven.md`

## Phase 3: 生成文档同步差距报告与建议
根据 Phase 2 的检查结果，整理出文档缺口清单，并给出具体的补充建议，写入输出文件的 `## Gaps` 和 `## Recommendations` 段落。

若所有文档均已同步，则在 `## Gaps` 中写明"无文档缺口"；若有缺口，则列出具体缺失内容及建议操作（如"在 README 中补充 loop-backlog-daemon.py 的使用说明"）。每条建议须说明目标文件路径和建议补充内容的概要。

### DoD
- [ ] `grep -q '## Gaps' docs/tasks/check-recent-changes-doc-sync-output.md`
- [ ] `grep -q '## Recommendations' docs/tasks/check-recent-changes-doc-sync-output.md`
- [ ] `[ $(wc -l < docs/tasks/check-recent-changes-doc-sync-output.md) -ge 30 ]`

## Constraints
- 仅检查最近一天（24小时内）的 git 提交，不追溯更早历史
- 不修改任何现有文档，仅生成检查报告
- 不执行代码或运行测试，仅做文档比对分析
- 输出文件路径固定为 `docs/tasks/check-recent-changes-doc-sync-output.md`
- 如果 git log 返回空（无近期提交），在报告中注明"无近期变更"并结束任务

## Acceptance Gate
- [ ] `grep -q '## Recommendations' docs/tasks/check-recent-changes-doc-sync-output.md`
- [ ] `test -s docs/tasks/check-recent-changes-doc-sync-output.md`
- [ ] `[ $(wc -l < docs/tasks/check-recent-changes-doc-sync-output.md) -ge 30 ]`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 test -f docs/tasks/check-recent-changes-doc-sync-output.md
- [ ] #2 test -s docs/tasks/check-recent-changes-doc-sync-output.md
- [ ] #3 grep -q '## Changed Files' docs/tasks/check-recent-changes-doc-sync-output.md
- [ ] #4 grep -q '## Sync Status' docs/tasks/check-recent-changes-doc-sync-output.md
- [ ] #5 grep -q 'loop-backlog' CHANGELOG.md
- [ ] #6 test -f docs/plans/105-loop-backlog-daemon-monitor-event-driven.md
- [ ] #7 test -f docs/proposals/proposal-loop-backlog-daemon-monitor-event-driven.md
- [ ] #8 grep -q '## Gaps' docs/tasks/check-recent-changes-doc-sync-output.md
- [ ] #9 grep -q '## Recommendations' docs/tasks/check-recent-changes-doc-sync-output.md
- [ ] #10 [ $(wc -l < docs/tasks/check-recent-changes-doc-sync-output.md) -ge 30 ]
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan committed: docs/plans/106-check-recent-changes-doc-sync.md

claimed: 2026-06-17T06:43:30Z

Completed: 2026-06-17T06:44:44Z

claimed: 2026-06-17T06:47:30Z

Completed: 2026-06-17T06:48:18Z

claimed: 2026-06-17T07:48:28Z

Completed: 2026-06-17T07:51:43Z
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Execution Summary

**Result:** Done
**Commit:** 0ad90c8

### Key Findings
- All 10 DoD checks passed
- Documentation mostly in sync; two minor gaps noted:
  1. docs/proposals/proposal-rewrite-loop-backlog-daemon-nodejs.md missing (plan exists)
  2. Test scripts (test-loop-backlog-skill-*.sh) not mentioned in CHANGELOG or README
- Recommendation: cut v1.1.4 release (significant [Unreleased] changes accumulated)
- Report: docs/tasks/check-recent-changes-doc-sync-output.md (149 lines)
<!-- SECTION:FINAL_SUMMARY:END -->
