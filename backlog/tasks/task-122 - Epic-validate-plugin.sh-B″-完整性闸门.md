---
id: TASK-122
title: 'Epic: validate-plugin.sh B″ 完整性闸门'
status: 'Epic: Done'
assignee: []
created_date: '2026-06-21 09:16'
updated_date: '2026-06-21 09:33'
labels:
  - 'kind:epic'
dependencies: []
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Epic 目标
原 B″ 计划的 config.yml 状态校验用 grep 行数检查,与现行 inline 数组格式不兼容(会返回 0);且缺少防裸状态回归的守卫。本 Epic 把校验改为格式无关的 YAML parse,并补齐回归守卫。

## 拟拆分的 Basic 子任务(decompose 阶段细化)
1. 用 Python YAML parse 替换行数检查,断言 config.yml 恰含 14 个 Epic:/Basic: 状态(兼容 inline)
2. 加守卫:任何 SKILL.md body 含裸遗留状态串即 FAIL
3. (可选) 把 daemon pid/存活检查纳入 validate-plugin.sh

## 验收信号
bash scripts/validate-plugin.sh
python3 -c "import yaml;c=yaml.safe_load(open('backlog/config.yml'));assert len([s for s in c['statuses'] if s.startswith(('Epic:','Basic:')))==14"
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: validate-plugin.sh B″ 完整性闸门

两处真实缺口(已核实 validate-plugin.sh 现状):
- 无 config.yml 状态完整性检查(原 B″ 计划的 grep 行数检查从未落地,且与 inline 格式不兼容)
- 无对 SKILL body 裸状态写入的守卫(无法防 TASK-121 类回归)

## Child 1 (Basic): config.yml 14-状态完整性检查
在 validate-plugin.sh 增加:Python YAML parse 断言 config.yml 恰含 14 个 Epic:/Basic: 状态,且无 Meta-*/裸列。格式无关(兼容 inline 与 block)。
### DoD
- [ ] `grep -q "config.yml" scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh`

## Child 2 (Basic): SKILL body 裸状态守卫
在 validate-plugin.sh 增加:扫描所有 plugin/skills/*/SKILL.md,任何 --status 写入若不是 14 个 B″ 状态之一即 FAIL(防裸状态回归)。
### DoD
- [ ] `grep -qE "status.*guard|bare.?status" scripts/validate-plugin.sh`
- [ ] `bash scripts/validate-plugin.sh`

## Acceptance Gate (Epic)
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `python3 -c "import yaml;c=yaml.safe_load(open('backlog/config.yml'));assert len([s for s in c['statuses'] if s.startswith(('Epic:','Basic:')])==14"`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cap:propose=approved
epicReviewProposal: 两处缺口经核实属实(validate-plugin.sh 无 config 检查、无裸状态守卫)。APPROVED.

cap:plan=approved
epicReviewPlan: 2 独立子任务,DoD shell 可断言。APPROVED.

cap:decompose=done child_ids:[TASK-122.1, TASK-122.2]
epicDecompose: 2 kind:basic children, R1 DoD-gate PASS.

epicAwaitChildren: done=2/2 reconcileRunCount=1 — desired=created=done.
cap:await=done all_children_done:true

evaluator: Met | dod_aggregate=PASS(2/2) | acceptance_gate=PASS(validate-plugin.sh, config YAML assert) | needs_human=0 | data_source: measured
cap:evaluate=done verdict:Approved
terminal:TASK-122 Epic: Done
<!-- SECTION:NOTES:END -->
