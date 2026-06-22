# Proposal: 清理 meta-task-to-backlog 死技能并更新 backlog-setup B″ 列配置

## Background

TASK-125 完成了 B″ 重构，将 loop-meta 工作流（Meta-Proposal、Meta-Plan 状态及 loop-meta worker）整体退役，切换为统一的 loop-backlog 双泳道架构（Epic/Basic 16 列）。该重构完成后，两处遗留物仍指向已退役的概念：

1. `.claude/skills/meta-task-to-backlog/` 是一个真实目录（非 plugin/skills/ 下的 symlink），其 SKILL.md 在 description、spec 和实现三处均硬引用了 Meta-Proposal 状态、Meta-Plan 状态以及 loop-meta worker 作为下游消费者。这些状态和 worker 在当前代码库中均不再存在，使该技能在语义上完全失效，且会在 validate-plugin.sh 的 symlink 一致性检查中产生 FAIL（脚本对 .claude/skills/ 下的真实目录报错）。

2. `plugin/skills/backlog-setup/SKILL.md` 中的 REQUIRED_COLUMNS 仅包含 7 个旧列（Proposal、Plan、Backlog、Ready、In Progress、Done、Needs Human），与 backlog/config.yml 已写入的 16 列 B″ 集合不符。在新环境中运行 /backlog-setup 会将 config.yml 中的 statuses 覆写回旧的 7 列，破坏双泳道看板。

## Goals

1. `.claude/skills/meta-task-to-backlog/` 目录被完全删除，`ls .claude/skills/meta-task-to-backlog/` 返回"No such file or directory"。
2. `validate-plugin.sh` 的 `.claude/skills` symlink 一致性检查不再产生关于 meta-task-to-backlog 的 FAIL 项。
3. `plugin/skills/backlog-setup/SKILL.md` 中的 REQUIRED_COLUMNS 列表（Spec 和 Implementation 两处）均替换为完整 16 列 B″ 集合：Epic: Proposal、Epic: Plan、Epic: Backlog、Epic: Ready、Epic: Decomposing、Epic: Awaiting Children、Epic: Evaluating、Epic: Done、Epic: Needs Human、Basic: Proposal、Basic: Plan、Basic: Backlog、Basic: Ready、Basic: In Progress、Basic: Done、Basic: Needs Human。
4. 在全新环境中运行 /backlog-setup 后，backlog/config.yml 的 statuses 字段与上述 16 列完全一致，default_status 为 "Basic: Proposal"。
5. `bash scripts/validate-plugin.sh` 全程通过（exit 0）。

## Proposed Approach

**Subject A — 删除 meta-task-to-backlog 技能目录**

直接删除 `.claude/skills/meta-task-to-backlog/`（整个目录）。由于该目录不在 `plugin/skills/` 下，validate-plugin.sh 的 EXPECTED_SKILLS 计数（25）不受影响；symlink 一致性检查仅遍历 `plugin/skills/*/` 的条目，因此删除后不会留下悬空检查。无需修改任何其他文件。

**Subject B — 更新 backlog-setup SKILL.md 的 REQUIRED_COLUMNS**

在 `plugin/skills/backlog-setup/SKILL.md` 中：
- Spec 部分：将 FEATURE_TO_BACKLOG_COLUMNS、LOOP_BACKLOG_COLUMNS、REQUIRED_COLUMNS 替换为完整 B″ 16 列的单一 REQUIRED_COLUMNS 定义，并更新 skill description 中的列描述。
- Implementation 部分：将 `REQUIRED_COLUMNS=(...)` bash 数组及 Python 脚本中的 REQUIRED 列表均替换为 16 列 B″ 集合，确保 default_status 写为 "Basic: Proposal"。

## Trade-offs and Risks

- **不迁移现有使用记录**：历史 backlog 任务中若有 Meta-Proposal/Meta-Plan 状态引用，不做批量更新；本提案只删除技能定义，不清理历史任务数据。
- **不在 plugin/skills/ 中保留存根**：meta-task-to-backlog 完全删除，不提供向后兼容包装器；B″ 架构下的对应功能由 epic-to-backlog 技能承担。
- **风险：backlog-setup 的 Python 正则**：实现中用正则重写 config.yml statuses 行；若 config.yml 格式在 CLI 版本升级后改变（如换用多行 YAML 序列），正则可能失效。但该风险已存在于当前实现，本提案不引入新风险。
- **不更新 backlog-setup 的 seedExamples 内容**：种子文档/决策的中文示例文本不在本次清理范围内。
