# gcl-events.jsonl Schema

**文件**：`docs/research/gcl-events.jsonl`  
**格式**：每行一个 JSON 对象（JSONL），append-only。  
**用途**：结构化 GCL gate 事件日志，支持 H5/H6/H7 假设验证和 drift 告警。

## 字段表

| 字段 | 类型 | 说明 | 允许值 |
|------|------|------|--------|
| task_id | string | 任务 ID | 如 "TASK-123"、"TASK-176.1" |
| gate_type | string | gate 类型 | "plan" \| "proposal" \| "epic-evaluate" |
| task_kind | string | 任务种类 | "basic" \| "epic" |
| timestamp | string | ISO 8601 UTC 时间戳 | 如 "2026-06-23T16:45:00Z" |
| E | integer | Explicit 分量（可从任务文件直接读到的前提数） | ≥ 0 |
| C | integer | Cross-boundary 分量（需跳转外部任务/文档才能确认的前提数） | ≥ 0 |
| H | integer | Hidden 分量（靠背景知识推断、无 artifact 支撑的前提数） | ≥ 0 |
| GCL | integer | 总认知负载，等于 E+C+H | ≥ 0 |
| reviewer_model | string | 执行 gate 的模型或 actor | 如 "claude-sonnet-4-6"、"human" |
| sample_run_id | string \| null | 可靠性采样的第二次运行 ID（176e 填充）；非采样 event 为 null | null 或 "TASK-N-r2" |
| evidence_independence | string | gate 证据来源与被审系统的独立程度（H6 字段） | "high" \| "low" \| "unknown" |
| gate_actor_type | string | gate 执行者类型（H7 字段） | "human" \| "llm" \| "hybrid" \| "tool" |
| premise_lines | integer \| null | premise-ledger 中的前提条目总数；未记录时为 null | null 或 ≥ 0 |

## 说明

- **evidence_independence**：若 gate 证据完全来自被审任务自身摘要（如 LLM 只读自己写的 plan），则为 "low"。若有独立测试输出、archguard 分析、meta-cc trace 等独立通道，则为 "high"。历史回填记录置 "unknown"。
- **gate_actor_type**：历史回填记录中 premise-ledger 由 LLM 执行，置 "llm"。未来若由人工审核，置 "human"。
- **sample_run_id**：176e 实现可靠性采样后，对同一 gate 内容做第二次 self-report，第二条记录的 sample_run_id 为 "TASK-N-r2"，与原始记录共享 task_id。

## 查询示例

```bash
# 统计各 gate_type 的 GCL 均值
python3 -c "
import json, statistics
recs = [json.loads(l) for l in open('docs/research/gcl-events.jsonl')]
by_type = {}
for r in recs:
    by_type.setdefault(r['gate_type'], []).append(r['GCL'])
for t, vals in sorted(by_type.items()):
    print(f'{t}: mean={statistics.mean(vals):.1f} n={len(vals)}')
"
```
