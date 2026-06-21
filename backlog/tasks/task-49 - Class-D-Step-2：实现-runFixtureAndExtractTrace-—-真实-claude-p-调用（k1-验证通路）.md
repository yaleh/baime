---
id: TASK-49
title: Class D Step 2：实现 runFixtureAndExtractTrace — 真实 claude -p 调用（k=1 验证通路）
status: Basic: Done
assignee: []
created_date: '2026-06-19 15:12'
updated_date: '2026-06-19 16:13'
labels:
  - kind:basic
  - class-d
  - runner
  - skill-quality
dependencies:
  - TASK-47
references:
  - experiments/skill-quality/scripts/run-class-d.ts
  - experiments/skill-quality/fixtures/class-d/
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

TASK-47 的 `run-class-d.ts` 中 `extractToolTrace()` 始终 fallback 到 `buildAnalyticalTrace()`，用硬编码数据自证自清。Step 1 为 fixture 补充了 `prompt_template`，本步骤将 runner 改造为真实触发 `claude -p --output-format stream-json` 并解析 tool call trace。

k 先设为 1（每个 fixture 执行 1 次），目标是验证端到端通路（触发→解析→合规检查→写结果）可用，而不追求统计稳定性。

## Goal

替换 `buildAnalyticalTrace()` 为真实的 `claude -p` 调用 + stream-json 解析，使 runner 输出 `mode: "live-trace"` 而非 `"analytical"`。

## Implementation

### 替换 `extractToolTrace()`

```typescript
import { spawnSync } from 'node:child_process';

function runFixtureAndExtractTrace(fixture: ClassDFixture, testTaskId: string): ToolBlock[] {
  const prompt = fixture.prompt_template.replaceAll('{task_id}', testTaskId);
  const result = spawnSync(
    'claude',
    ['-p', prompt, '--output-format', 'stream-json', '--max-turns', '8'],
    { encoding: 'utf-8', timeout: 120_000 }
  );
  if (result.status !== 0) {
    console.warn(`  [warn] claude exited ${result.status} for ${fixture.id}`);
  }
  return parseToolBlocks(result.stdout);
}

function parseToolBlocks(streamOutput: string): ToolBlock[] {
  return streamOutput
    .split('\n')
    .filter(Boolean)
    .flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } })
    .filter((e): e is { type: 'tool_use'; name: string; input: Record<string, unknown> } =>
      e.type === 'tool_use')
    .map((e, i) => ({ tool_name: e.name, tool_input: e.input, position: i }));
}
```

### 测试任务生命周期

runner 在启动时创建一个测试用任务（状态 Ready），运行结束后清理：

```typescript
// setup
const testTaskOut = execSync('backlog task create "Class D test task" --status "Ready" --plain', { encoding: 'utf-8' });
const testTaskId = testTaskOut.match(/TASK-\d+/)?.[0] ?? 'TASK-TEST';

// teardown（所有 fixture 跑完后）
execSync(`backlog task edit ${testTaskId} --status "Done"`);
```

### CLI 参数

- `--k 1`（默认，本步骤固定）
- 移除 `--session-id` 参数（不再需要）
- 新增 `--dry-run` flag：仅打印 prompt，不实际调用 claude

### 结果字段

写入结果时：
- `mode: "live-trace"`（不再是 `"analytical"`）
- `trace_source: "claude -p --output-format stream-json"`
- `k: 1`

## Constraints

- 本步骤不追求 compliance_rate 的统计意义（k=1 仅验证通路）
- 不修改 fixture 文件（Step 1 负责）
- 不修改 `checkCompliance()` 逻辑
- 测试任务必须在 runner 结束时清理（无论成功还是失败）
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Class D Step 2 — 实现 runFixtureAndExtractTrace（真实 claude -p 调用，k=1）

## Context
TASK-47 的 `run-class-d.ts` 从未真实触发 agent 执行——`extractToolTrace()` 直接调用 `buildAnalyticalTrace()` 返回手工构造的合规数据。TASK-48 为 fixture 补充了 `prompt_template`，本任务将 runner 改为真实调用 `claude -p --output-format stream-json` 并从 stdout 解析 tool_use 事件，输出 `mode: "live-trace"` 结果。k=1 用于先验证通路，不追求统计意义。

## Phase 1: 替换 buildAnalyticalTrace 为真实 claude -p 调用

修改 `experiments/skill-quality/scripts/run-class-d.ts`：

1. 删除 `buildAnalyticalTrace()` 函数及其所有 case 分支
2. 删除 `extractToolTrace()` 中的 analytical fallback 路径
3. 实现 `runFixtureAndExtractTrace(fixture, testTaskId)` 和 `parseToolBlocks(stdout)`：

```typescript
import { spawnSync } from 'node:child_process';

function runFixtureAndExtractTrace(fixture: ClassDFixture, testTaskId: string): ToolBlock[] {
  const prompt = fixture.prompt_template.replaceAll('{task_id}', testTaskId);
  const result = spawnSync(
    'claude',
    ['-p', prompt, '--output-format', 'stream-json', '--max-turns', '8'],
    { encoding: 'utf-8', timeout: 120_000 }
  );
  if (result.status !== 0) {
    console.warn(`  [warn] claude exited ${result.status} for ${fixture.id}`);
  }
  return parseToolBlocks(result.stdout);
}

function parseToolBlocks(streamOutput: string): ToolBlock[] {
  return streamOutput
    .split('\n')
    .filter(Boolean)
    .flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } })
    .filter((e): e is { type: 'tool_use'; name: string; input: Record<string, unknown> } =>
      e.type === 'tool_use')
    .map((e, i) => ({ tool_name: e.name, tool_input: e.input, position: i }));
}
```

4. 在 `main()` 中：
   - 移除 `--session-id` CLI 参数
   - 添加 `--dry-run` flag（仅打印 prompt，不调用 claude）
   - 将 `K` 默认值改为 1
   - 将 `extractToolTrace(fixture, SESSION_ID)` 替换为 `runFixtureAndExtractTrace(fixture, testTaskId)`

### DoD
- [ ] `grep -q 'parseToolBlocks' experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `grep -q 'stream-json' experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `! grep -q 'buildAnalyticalTrace' experiments/skill-quality/scripts/run-class-d.ts`

## Phase 2: 添加测试任务生命周期管理

在 `main()` 开头（fixture 加载之后、循环之前）添加测试任务创建逻辑；在循环结束后（无论成功还是异常）清理：

```typescript
// setup
const testTaskOut = execSync(
  'backlog task create "Class D live test task" --status "Ready" --plain',
  { encoding: 'utf-8' }
);
const testTaskId = testTaskOut.match(/TASK-\d+/)?.[0] ?? 'TASK-TEST';
console.log(`Test task: ${testTaskId}`);

try {
  // ... fixture loop ...
} finally {
  execSync(`backlog task edit ${testTaskId} --status "Done"`);
  console.log(`Test task ${testTaskId} cleaned up`);
}
```

### DoD
- [ ] `grep -q 'finally' experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `grep -q 'Class D live test task' experiments/skill-quality/scripts/run-class-d.ts`

## Phase 3: 更新结果字段并运行验证

修改结果对象中 `mode` 和 `trace_source` 字段：

```typescript
const output = {
  ...
  mode: 'live-trace',
  trace_source: 'claude -p --output-format stream-json',
  k,
  ...
};
```

然后用 `--dry-run` 验证 prompt 输出正常（不触发真实调用），再以 k=1 执行一次完整 run，确认结果文件写入 `mode: "live-trace"`：

```bash
npx tsx experiments/skill-quality/scripts/run-class-d.ts --dry-run
npx tsx experiments/skill-quality/scripts/run-class-d.ts --k 1
```

### DoD
- [ ] `grep -q '"mode": "live-trace"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`
- [ ] `grep -q 'stream-json' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`

## Constraints

- 不修改 `checkCompliance()` 函数逻辑
- 不修改 fixture 文件（TASK-48 负责）
- k=1 是本步骤的固定值；统计意义（k=5）由 TASK-50 负责
- 测试任务必须在 finally 块中清理，不得遗留在 backlog 中
- `--dry-run` flag 不得实际调用 claude

## Acceptance Gate
- [ ] `grep -q 'parseToolBlocks' experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `grep -q 'stream-json' experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `! grep -q 'buildAnalyticalTrace' experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `grep -q 'finally' experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `grep -q 'Class D live test task' experiments/skill-quality/scripts/run-class-d.ts`
- [ ] `grep -q '"mode": "live-trace"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`
- [ ] `grep -q 'stream-json' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 2: APPROVED

claimed: 2026-06-19T16:09:38Z

Completed: 2026-06-19T16:13:18Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'parseToolBlocks' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #2 grep -q 'stream-json' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #3 ! grep -q 'buildAnalyticalTrace' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #4 grep -q 'finally' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #5 grep -q 'Class D live test task' experiments/skill-quality/scripts/run-class-d.ts
- [ ] #6 grep -q '"mode": "live-trace"' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #7 grep -q 'stream-json' experiments/skill-quality/artifacts/analysis/exp-class-d-results.json
- [ ] #8 bash scripts/validate-plugin.sh
<!-- DOD:END -->
