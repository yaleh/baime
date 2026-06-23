---
id: TASK-174
title: 'P2: skill cap: 前置条件显式化，validate-plugin pre-check'
status: 'Basic: Proposal'
assignee: []
created_date: '2026-06-23 14:49'
labels:
  - 'kind:basic'
  - 'priority:p2'
  - 'component:skills'
  - 'component:validation'
dependencies: []
references:
  - plugin/skills/
  - plugin/scripts/validate-plugin.sh
  - docs/adr/ADR-005-task-creation-kind-label.md
  - plugin/skills/backlog-setup/SKILL.md
priority: medium
ordinal: 112000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
各 skill 的 SKILL.md 中存在隐含的宿主环境假设（CLAUDE.md 必须存在、backlog/ 目录已初始化、特定 MCP tool 版本等），这些假设未在 cap: 声明中体现，在新宿主项目安装时容易踩到。

改进方向：
1. 为每个 skill 在 SKILL.md 的 cap: 块中添加 requires: 声明（枚举前置条件：文件、目录、MCP tools）
2. validate-plugin.sh 中添加 pre-check 项：安装时验证前置条件是否满足，不满足时给出明确错误信息
3. backlog-setup skill 负责满足 loop-backlog 的前置条件，两者的 requires/provides 应显式对应
4. 参考 ADR-005（task-creation kind label）模式，为 requires/provides 制定统一格式规范
<!-- SECTION:DESCRIPTION:END -->
