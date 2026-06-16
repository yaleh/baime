# Plan: 用 meta-cc 检查最近变更，审查并更新项目文档

## Context
baime 项目近期有若干提交（task-1 完成、backlog loop 新增、plugin distribution 相关规划）。项目文档分布于 README.md、CHANGELOG.md、docs/plans/、docs/proposals/ 以及 plugin/ 各 SKILL.md 文件。本任务通过 meta-cc 获取近期会话级变更摘要，对照实际文件状态，识别并修复文档滞后。

## Phase 1: 用 meta-cc 获取近期会话变更摘要
使用 meta-cc MCP 工具（`get_timeline`、`query_summaries`、`query_file_snapshots`）查询最近若干会话（至少覆盖最近 7 天）的活动，整理出：已修改/新增的文件列表、主要完成的功能或任务、尚未体现在文档中的变更点。将摘要写入 `docs/tasks/meta-cc-doc-audit-changes.md`，包含 `## 近期变更` 一节。

### DoD
- [ ] `test -s docs/tasks/meta-cc-doc-audit-changes.md`
- [ ] `grep -q '## 近期变更' docs/tasks/meta-cc-doc-audit-changes.md`

## Phase 2: 对照项目文件，识别文档缺口
读取以下文件：README.md、CHANGELOG.md、docs/plans/ 下所有计划、docs/proposals/ 下所有提案，以及 plugin/skills/ 各 SKILL.md（抽查新增或修改过的技能）。结合 `git log --oneline -20` 的提交历史与 Phase 1 产出，列出：哪些新功能/技能缺少文档描述、CHANGELOG 是否有缺失条目、README 是否反映当前 plugin 目录结构。将缺口分析写入 `docs/tasks/meta-cc-doc-audit-gaps.md`，包含 `## 文档缺口` 一节。

### DoD
- [ ] `test -s docs/tasks/meta-cc-doc-audit-gaps.md`
- [ ] `grep -q '## 文档缺口' docs/tasks/meta-cc-doc-audit-gaps.md`

## Phase 3: 按需更新项目文档
根据 Phase 2 的缺口分析，更新需要修改的文档文件。若某文档已是最新，在 `docs/tasks/meta-cc-doc-audit-gaps.md` 末尾追加 `## 无需更新` 一节并说明原因。所有更新完成后，在 gaps 文件末尾追加 `## 审查完成` 一节记录结果。

### DoD
- [ ] `grep -q '## 审查完成' docs/tasks/meta-cc-doc-audit-gaps.md`
- [ ] `test -s docs/tasks/meta-cc-doc-audit-changes.md`

## Constraints
- 不修改 backlog/ 目录下的任何文件
- 不创建新的 plugin/skills/ 技能目录，仅更新现有文档
- 若某技能的 SKILL.md 无需改动，记录原因在 gaps 文件的 `## 无需更新` 节而非强行修改
- 不执行 git push

## Acceptance Gate
- [ ] `test -s docs/tasks/meta-cc-doc-audit-changes.md`
- [ ] `grep -q '## 文档缺口' docs/tasks/meta-cc-doc-audit-gaps.md`
- [ ] `grep -q '## 审查完成' docs/tasks/meta-cc-doc-audit-gaps.md`
