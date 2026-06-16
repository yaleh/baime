# meta-cc 文档审查：文档缺口分析

生成时间：2026-06-16

## 文档缺口

### 1. README.md — Agents 数量与列表错误

**当前状态**：标注 "6 Agents"，列出 `stage-executor`、`project-planner`、`iteration-executor`、`iteration-prompt-designer`、`knowledge-extractor`、`workflow-coach`

**实际状态**：`plugin/agents/` 仅含 4 个文件（`iteration-executor`、`iteration-prompt-designer`、`knowledge-extractor`、`workflow-coach`）

**缺口**：
- 标题 "6 Agents" → 应为 "4 Agents"
- 表格中 `stage-executor`、`project-planner` 已删除（commit `3c0393e`），需从表格移除

### 2. README.md — Skills 数量与列表错误

**当前状态**：标注 "19 Skills"，列出 19 行，包含已删除的 `error-recovery`、`retrospective-validation`，缺少新增的 5 个技能

**实际状态**：`plugin/skills/` 含 22 个目录

**缺口**：
- 标题 "19 Skills" → 应为 "22 Skills"
- 应删除：`error-recovery`、`retrospective-validation`（commit `3c0393e` 已删除）
- 应新增：`backlog-setup`、`feature-developer`、`feature-to-backlog`、`task-to-backlog`、`loop-backlog`（commit `5fb79a6`/`ef83319` 新增）

### 3. CHANGELOG.md — 缺少 [Unreleased] 节

**当前状态**：最新条目为 `[1.1.0] - 2026-06-16`，无 Unreleased 节

**缺口**：v1.1.0 发布后有两项实质性变更未记录：
- `loop-backlog`：新增执行日志（EXECUTION_LOG、结构化 phase checkpoint、final-summary）
- `loop-backlog`：Idle 轮询间隔 270s → 120s

### 4. README.md — 简介行 skill 数量过时

**当前状态**：`baime provides 19 validated skills and 6 specialized agents`

**缺口**：应更新为 `22 validated skills and 4 specialized agents`

### 无需更新

- `docs/plans/` 下各计划文档：均为任务执行规划，内容已完整，无需修改
- `docs/proposals/` 下各提案文档：历史提案，已归档，无需修改
- `plugin/skills/` 各 SKILL.md：新增技能的 SKILL.md 在新增时已包含完整说明，无文档缺失
- `.claude/skills/loop-backlog/SKILL.md`：本会话中已更新至最新状态
- `.claude/skills/backlog-setup/SKILL.md`：内容已完整

## 审查完成

审查时间：2026-06-16

已修复以下文档：

| 文件 | 修改内容 |
|------|----------|
| `README.md` | 简介行：19 skills/6 agents → 22 skills/4 agents |
| `README.md` | Agents 表：移除 `stage-executor`、`project-planner`，标题 "6 Agents" → "4 Agents" |
| `README.md` | Skills 表：移除 `error-recovery`、`retrospective-validation`，新增 5 个 backlog/loop 技能，标题 "19 Skills" → "22 Skills" |
| `CHANGELOG.md` | 新增 `[Unreleased]` 节，记录 `loop-backlog` 执行日志和轮询间隔变更 |
