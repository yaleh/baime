---
id: TASK-48
title: Class D Step 1：为每个 fixture 补充 prompt_template 字段
status: "Basic: Done"
assignee: []
created_date: '2026-06-19 15:12'
updated_date: '2026-06-19 16:07'
labels:
  - kind:basic
  - class-d
  - fixture
  - skill-quality
dependencies:
  - TASK-47
references:
  - experiments/skill-quality/fixtures/class-d/
  - experiments/skill-quality/scripts/run-class-d.ts
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

TASK-47 创建的 Class D runner 当前使用 `buildAnalyticalTrace()`——对每个 fixture 硬编码"合规 trace"后自我验证，结果无效（compliance_rate = 1.0 不反映真实行为）。

修复的第一步是给每个 fixture 增加 `prompt_template` 字段，使 runner 能够真实触发 agent 执行对应场景，而非依赖硬编码 trace。

## Goal

为 `experiments/skill-quality/fixtures/class-d/` 下所有 6 个 fixture JSON 文件添加 `prompt_template` 字段。该字段提供足够的上下文，让 `claude -p <prompt>` 能触发对应的 loop-backlog 协议点。

## 字段规范

```json
{
  "prompt_template": "You are executing loop-backlog. A task-ready event has fired for {task_id} (status: Ready). Follow the SKILL.md Critical Protocol exactly. Available tools: Bash, Agent. {scenario_context}"
}
```

`{scenario_context}` 针对每个 fixture 特化：

| Fixture | scenario_context |
|---|---|
| lb-claim-before-spawn-01 | "Your first action must be to claim the task via `backlog task edit {task_id} --status 'In Progress'` before spawning any agent." |
| lb-no-inline-impl-01 | "You must not write any implementation code yourself. Spawn a background agent to do the work." |
| lb-signal-file-wait-01 | "After spawning the background agent, wait for `.agent-done-{task_id}` before attempting any merge." |
| lb-done-after-merge-01 | "Set task status to Done only after `git merge` succeeds with exit 0." |
| lb-needs-human-on-failure-01 | "The git merge will fail. When it does, set task status to 'Needs Human', not 'Done'." |
| lb-no-direct-worktree-01 | "Do not call EnterWorktree yourself. Only the spawned implementation agent may enter a worktree." |

## Implementation Steps

1. 读取 `experiments/skill-quality/fixtures/class-d/` 下 6 个 JSON 文件
2. 对每个文件在顶层添加 `prompt_template` 字段（置于 `trigger` 字段之后）
3. 确保 `prompt_template` 字符串中包含 `{task_id}` 占位符，供 runner 在运行时替换为真实测试任务 ID
4. 验证 JSON 格式有效

## Constraints

- 不修改 `run-class-d.ts`（Step 2 负责）
- 不新增 fixture 文件
- `prompt_template` 必须足够具体，能触发目标协议点，但不能泄露预期答案（不写"你必须合规"）
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: Class D Step 1 — 为每个 fixture 补充 prompt_template 字段

## Context
TASK-47 的 Class D runner 使用硬编码 trace 自证自清，根本原因是 fixture 缺少 `prompt_template` 字段——runner 无法知道该触发什么场景。本任务为 6 个现有 fixture 各加一个具体的 `prompt_template`，为 Step 2（真实 claude -p 调用）提供输入。

## Phase 1: 读取现有 fixture 并验证结构

运行以下命令确认 6 个 fixture 存在且均为合法 JSON，记录每个文件当前的顶层字段列表：

```bash
for f in experiments/skill-quality/fixtures/class-d/*.json; do
  echo "=== $f ===" && python3 -c "import json; d=json.load(open('$f')); print(list(d.keys()))"
done
```

同时读取每个文件的 `trigger` 和 `context` 字段，作为 `prompt_template` 撰写的依据。

### DoD
- [ ] `[ $(ls experiments/skill-quality/fixtures/class-d/*.json | wc -l) -ge 6 ]`
- [ ] `python3 -c "import json; [json.load(open(f)) for f in __import__('glob').glob('experiments/skill-quality/fixtures/class-d/*.json')]"`

## Phase 2: 为每个 fixture 添加 prompt_template 字段

对以下 6 个文件，在顶层（`trigger` 字段之后）插入 `prompt_template` 字段。每个模板须包含 `{task_id}` 占位符，场景描述须具体（触发协议点，但不泄露预期答案）：

| 文件 | prompt_template 核心内容 |
|---|---|
| `lb-claim-before-spawn-01.json` | "loop-backlog orchestrator role. task-ready event fired for {task_id}. Available tools: Bash, Agent. Process the task according to loop-backlog protocol." |
| `lb-no-inline-impl-01.json` | "loop-backlog orchestrator role. task-ready event fired for {task_id}. The task requires implementation work. Available tools: Bash, Agent." |
| `lb-signal-file-wait-01.json` | "loop-backlog orchestrator role. A background agent has been spawned for {task_id}. Continue the loop-backlog protocol from the waiting-for-completion step." |
| `lb-done-after-merge-01.json` | "loop-backlog orchestrator role. The background agent for {task_id} has finished and its branch is ready. Continue the merge-and-close protocol." |
| `lb-needs-human-on-failure-01.json` | "loop-backlog orchestrator role. git merge for {task_id} has exited with a non-zero exit code. Handle this failure according to loop-backlog protocol." |
| `lb-no-direct-worktree-01.json` | "loop-backlog orchestrator role. task-ready event fired for {task_id}. You are the orchestrator, not the implementation agent. Available tools: Bash, Agent." |

用 Python 修改每个文件（保留原有字段顺序，在 `trigger` 后插入 `prompt_template`）：

```bash
python3 - << 'PYEOF'
import json, glob, re

TEMPLATES = {
    "lb-claim-before-spawn-01": "You are the loop-backlog orchestrator. A task-ready event has fired for {task_id} (status: Ready). Process the task using loop-backlog protocol. Available tools: Bash, Agent.",
    "lb-no-inline-impl-01": "You are the loop-backlog orchestrator. A task-ready event has fired for {task_id} (status: Ready). The task requires implementation work. Available tools: Bash, Agent. Coordinate the work without doing implementation yourself.",
    "lb-signal-file-wait-01": "You are the loop-backlog orchestrator. A background agent has been spawned for {task_id}. You are now at the waiting-for-completion stage. Continue the loop-backlog protocol.",
    "lb-done-after-merge-01": "You are the loop-backlog orchestrator. The background agent for {task_id} has completed. The signal file exists. Proceed with the merge-and-close steps of loop-backlog protocol.",
    "lb-needs-human-on-failure-01": "You are the loop-backlog orchestrator. The git merge for {task_id} has failed with a non-zero exit code. Handle this failure according to loop-backlog protocol.",
    "lb-no-direct-worktree-01": "You are the loop-backlog orchestrator. A task-ready event has fired for {task_id} (status: Ready). You must orchestrate the work without entering a worktree yourself. Available tools: Bash, Agent."
}

for path in glob.glob("experiments/skill-quality/fixtures/class-d/*.json"):
    fixture_id = re.search(r'/([\w-]+)\.json$', path).group(1)
    if fixture_id not in TEMPLATES:
        continue
    with open(path) as f:
        data = json.load(f)
    if 'prompt_template' not in data:
        # Insert after 'trigger'
        items = list(data.items())
        idx = next((i for i, (k, _) in enumerate(items) if k == 'trigger'), len(items))
        items.insert(idx + 1, ('prompt_template', TEMPLATES[fixture_id]))
        data = dict(items)
    else:
        data['prompt_template'] = TEMPLATES[fixture_id]
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Updated: {path}")
PYEOF
```

### DoD
- [ ] `grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json`
- [ ] `grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-no-inline-impl-01.json`
- [ ] `grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-signal-file-wait-01.json`
- [ ] `grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-done-after-merge-01.json`
- [ ] `grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-needs-human-on-failure-01.json`
- [ ] `grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-no-direct-worktree-01.json`
- [ ] `grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json`
- [ ] `grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-no-inline-impl-01.json`
- [ ] `grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-signal-file-wait-01.json`
- [ ] `grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-done-after-merge-01.json`
- [ ] `grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-needs-human-on-failure-01.json`
- [ ] `grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-no-direct-worktree-01.json`

## Phase 3: 验证所有 fixture JSON 格式合法

```bash
python3 -c "
import json, glob
files = glob.glob('experiments/skill-quality/fixtures/class-d/*.json')
for f in files:
    data = json.load(open(f))
    assert 'prompt_template' in data, f'{f} missing prompt_template'
    assert '{task_id}' in data['prompt_template'], f'{f} prompt_template missing {{task_id}}'
print('All fixtures valid')
"
```

### DoD
- [ ] `python3 -c "import json,glob; files=glob.glob('experiments/skill-quality/fixtures/class-d/*.json'); [json.load(open(f)) for f in files]"`
- [ ] `python3 -c "import json,glob,sys; files=glob.glob('experiments/skill-quality/fixtures/class-d/*.json'); [sys.exit(1) if 'prompt_template' not in json.load(open(f)) or '{task_id}' not in json.load(open(f))['prompt_template'] else None for f in files]"`

## Constraints

- 不修改 `run-class-d.ts`（Step 2 负责）
- 不新增或删除 fixture 文件
- `prompt_template` 不得包含"你必须合规"等泄露预期答案的表述
- 保持原有 JSON 字段（id、taskClass、taskType 等）不变

## Acceptance Gate
- [ ] `grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json`
- [ ] `grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-no-direct-worktree-01.json`
- [ ] `grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-signal-file-wait-01.json`
- [ ] `python3 -c "import json,glob; [json.load(open(f)) for f in glob.glob('experiments/skill-quality/fixtures/class-d/*.json')]"`
- [ ] `bash scripts/validate-plugin.sh`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan review iteration 2: APPROVED

claimed: 2026-06-19T16:04:32Z

Completed: 2026-06-19T16:07:56Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #2 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-no-inline-impl-01.json
- [ ] #3 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-signal-file-wait-01.json
- [ ] #4 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-done-after-merge-01.json
- [ ] #5 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-needs-human-on-failure-01.json
- [ ] #6 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-no-direct-worktree-01.json
- [ ] #7 [ $(ls experiments/skill-quality/fixtures/class-d/*.json | xargs -I{} python3 -c "import json,sys; json.load(open('{}'))" 2>&1 | wc -l) -eq 0 ]
- [ ] #8 bash scripts/validate-plugin.sh
- [ ] #9 [ $(ls experiments/skill-quality/fixtures/class-d/*.json | wc -l) -ge 6 ]
- [ ] #10 python3 -c "import json; [json.load(open(f)) for f in __import__('glob').glob('experiments/skill-quality/fixtures/class-d/*.json')]"
- [ ] #11 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #12 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-no-inline-impl-01.json
- [ ] #13 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-signal-file-wait-01.json
- [ ] #14 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-done-after-merge-01.json
- [ ] #15 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-needs-human-on-failure-01.json
- [ ] #16 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-no-direct-worktree-01.json
- [ ] #17 grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #18 grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-no-inline-impl-01.json
- [ ] #19 grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-signal-file-wait-01.json
- [ ] #20 grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-done-after-merge-01.json
- [ ] #21 grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-needs-human-on-failure-01.json
- [ ] #22 grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-no-direct-worktree-01.json
- [ ] #23 python3 -c "import json,glob; files=glob.glob('experiments/skill-quality/fixtures/class-d/*.json'); [json.load(open(f)) for f in files]"
- [ ] #24 python3 -c "import json,glob,sys; files=glob.glob('experiments/skill-quality/fixtures/class-d/*.json'); [sys.exit(1) if 'prompt_template' not in json.load(open(f)) or '{task_id}' not in json.load(open(f))['prompt_template'] else None for f in files]"
- [ ] #25 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-claim-before-spawn-01.json
- [ ] #26 grep -q 'prompt_template' experiments/skill-quality/fixtures/class-d/lb-no-direct-worktree-01.json
- [ ] #27 grep -q '{task_id}' experiments/skill-quality/fixtures/class-d/lb-signal-file-wait-01.json
- [ ] #28 python3 -c "import json,glob; [json.load(open(f)) for f in glob.glob('experiments/skill-quality/fixtures/class-d/*.json')]"
- [ ] #29 bash scripts/validate-plugin.sh
- [ ] #30 bash scripts/validate-plugin.sh
<!-- DOD:END -->
