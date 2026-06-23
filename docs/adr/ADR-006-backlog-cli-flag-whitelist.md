# ADR-006: backlog CLI flag 白名单校验

**Status**: Accepted
**Date**: 2026-06-23
**Deciders**: Yale Huang
**Related tasks**: TASK-170（发现触发）

## Context

SKILL.md 文件中的 bash 命令块直接由 Claude 在运行时执行，但这些命令从未被验证过是否与真实 CLI 契合。

TASK-170 的 feature-to-backlog 执行中暴露了 `--planSet` 旗标不存在的问题（正确旗标为 `--plan`）。事后排查发现：

- **`--planSet`**（应为 `--plan`）：feature-to-backlog（4处，已修）、epic-to-backlog（6处，已修）、task-to-backlog（3处，已修）
- **`--set-field`**（backlog CLI 不支持）：loop-backlog epic 分解逻辑中的 `backlog task edit <CHILD_ID> --set-field parent_task_id ${EPIC_ID}`（已修，改为直接 frontmatter 文件修补）

失败之所以静默：`backlog task edit` 遇到未知 flag 时打印 "Did you mean...?" 后以 **exit 0** 退出，`validate-plugin.sh` 的 contract 测试只做 `grep` 字符串存在检查，无法感知。

## Decision

在 `validate-plugin.sh` 的 Layer 0 阶段新增 **CLI flag 白名单校验**：

1. 维护 `scripts/backlog-cli-contract.json`，记录 `backlog task create` 和 `backlog task edit` 的合法 flag 集合（从 `backlog <cmd> --help` 输出生成，手动维护）。

2. `validate-plugin.sh` 扫描所有 SKILL.md 中包含 `backlog task create` 或 `backlog task edit` 的代码行，提取其中的 `--flag` 旗标，与白名单比对，不在白名单内的旗标报 **ERROR**。

3. 扫描范围限于代码块内的实际命令行（含 `>` 引用块前缀），不包含注释行（`#` 开头）和禁止说明文本。

## Consequences

- 优：`--planSet` 类拼写/API 偏移错误在 validate 阶段即被捕获，不再等到运行时
- 优：`backlog-cli-contract.json` 成为 CLI 契约的显式文档，backlog 升级时强迫人工 diff
- 劣：白名单须手动维护；backlog 升级后若忘记更新，可能漏报新增/变更的 flag
- 劣：不覆盖 `backlog document`、`backlog milestone` 等其他子命令（范围决定只做 `task create/edit`，够用）

## Rejected alternatives

**运行时动态调用 `backlog --help` 解析**：依赖环境，CI 未必安装 backlog；输出格式改变会破坏解析。

**扫描所有 bash 命令的所有 flag**：范围过大，误报多，维护成本高。

**信任作者正确使用 CLI**：已被此次事件证伪——SKILL.md 文件量大、更新频繁，人工审查不可靠。

## 触发更新白名单的场景

以下任一情况发生时，须先更新 `scripts/backlog-cli-contract.json` 再提 PR：

- backlog CLI 版本升级
- SKILL.md 新增 `backlog task create/edit` 调用且使用了白名单中尚未包含的 flag
