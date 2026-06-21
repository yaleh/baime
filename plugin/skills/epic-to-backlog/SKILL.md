---
name: epic-to-backlog
description: "Seeds an epic task at Epic: Proposal status with kind:epic label. Creates the epic entry point for the B″ dual-state-machine workflow. Writes cap:propose=approved to task notes to signal the epic is ready for the epic worker (loop-meta). Use when you want to start a multi-child epic lifecycle."
argument-hint: [epic-description]
allowed-tools: Read, Glob, Grep, Bash
contracts:
  - grep: "Epic: Proposal"
    target: self
  - grep: "kind:epic"
    target: self
  - grep: "cap:propose=approved"
    target: self
---

λ(topic) → epicToBacklog(topic)

## Spec

-- see spec-stdlib § loadConfig

epicToBacklog :: Topic → EpicTask
epicToBacklog(T) = {
  cfg:  loadConfig(),
  task: createEpicTask(T),  -- status: Epic: Proposal, labels: [kind:epic]
  _:    appendNote(task, "cap:propose=approved"),
  return: task  -- status: Epic: Proposal, ready for epic worker
}

createEpicTask :: Topic → Task  -- creates with kind:epic label and Epic: Proposal status
createEpicTask(T) = backlogTaskCreate({
  title:       T,
  status:      "Epic: Proposal",
  labels:      ["kind:epic"],
  description: T
})

-- After calling epicToBacklog, the epic worker (loop-meta / epic-daemon) takes over.
-- The epic DAG: Epic: Proposal → Epic: Plan → Epic: Decomposing →
--   Epic: Awaiting Children → Epic: Evaluating → Epic: Done | Epic: Needs Human

## Implementation

### Step 1: Load config

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
```

### Step 2: Create epic task at Epic: Proposal

Use the `mcp__backlog__task_create` tool (or equivalent) to create a task with:
- `status`: `"Basic: Proposal"` mapped to `"Epic: Proposal"`
- `labels`: `["kind:epic"]`
- `title`: the provided topic/description

```
backlog task create "<topic>" --status "Epic: Proposal" --labels "kind:epic"
```

Note: The backlog tool may not natively support "Epic: Proposal" status without config.yml
having it listed. Since Phase B added this to config.yml, it should be accepted.

### Step 3: Append cap:propose=approved to task notes

```
backlog task edit <TASK-ID> --append-notes "cap:propose=approved"
```

### Step 4: Confirm and exit

Print confirmation:
```
Epic task <TASK-ID> created at Epic: Proposal with kind:epic label.
cap:propose=approved marker written.
The epic worker (epic-daemon + loop-meta) will pick this up and drive it forward.
```

Exit seed-only — do NOT proceed to plan, decompose, or evaluate stages. Those are
handled by the epic worker consuming the epic-ready event.
