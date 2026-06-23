---
id: TASK-166
title: 改进 loop-backlog Monitor prompt 内嵌响应指令实现跨会话自恢复
status: 'Basic: Done'
assignee: []
created_date: '2026-06-23 06:58'
updated_date: '2026-06-23 07:29'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
改进 loop-backlog Monitor 的 prompt，在其 description/summary 中内嵌响应指令（收到通知后调用 /loop-backlog 处理事件），使 Monitor 在 /clear 或跨会话场景下仍能自恢复，无需依赖项目级 CLAUDE.md 配置。适用于 BAIME 跨项目使用场景。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Proposal: 改进 loop-backlog Monitor prompt 内嵌响应指令实现跨会话自恢复

### Background

The `/loop-backlog` skill starts a persistent Monitor that tails the daemon log file and dispatches events (`basic-ready`, `epic-ready`, `child-done`, etc.) to the worker loop. When the user runs `/clear` or starts a new session, the Monitor process continues running in the background, but the new Claude session has no memory of how to handle the next notification it receives.

This is a scalability problem, not just a UX inconvenience. BAIME is designed to be used across many projects. Requiring every project's `CLAUDE.md` to contain a rule like "when a Monitor fires, invoke `/loop-backlog`" places an operational burden on every adopter, defeats the framework's goal of zero-configuration reuse, and is easy to forget or misconfigure.

The root cause is that the Monitor's current call site passes no `description` or `summary` field. When a notification arrives in a fresh session, Claude receives a raw daemon log line (e.g. `basic-ready:TASK-42`) with no surrounding instruction. Without embedded guidance, the model cannot infer the correct action: re-invoking `/loop-backlog` to handle the event.

### Goals

1. Any Claude session that receives a `loop-backlog` Monitor notification — including sessions started after `/clear` — can determine the correct response action solely from the notification content, without relying on `CLAUDE.md` or prior conversation context.
2. The Monitor call in `loop-backlog/SKILL.md` is updated so that its `description` embeds an unambiguous instruction: "invoke `/loop-backlog` to handle this event."
3. The change is backward-compatible: existing running Monitor sessions and the daemon log format remain unchanged; only the notification payload seen by Claude is enriched.
4. No per-project `CLAUDE.md` configuration is required for cross-session recovery.

### Proposed Approach

Modify the `Monitor(persistent=true, ...)` call in `SKILL.md` to include a `description` field with a self-contained instruction block telling any new session to invoke `/loop-backlog`. Touches a single file: `plugin/skills/loop-backlog/SKILL.md`.

### Trade-offs and Risks

- Description field must stay under ~200 words to avoid Monitor tool truncation.
- If Monitor tool does not support `description`, alternative is wrapping the tail command in a shell script.
- Does not solve the broader BAIME plugin installation problem for new projects.
- Alternatives rejected: per-project CLAUDE.md rule (not scalable), watchdog cron job (too complex).

---

## Plan: Phase A — 在 Monitor 调用中添加 description 参数并更新 Spec 类型签名

### Tests (write first)

Add two contract grep rules to SKILL.md frontmatter — these cause `validate-plugin.sh` to fail before implementation:
- `grep: "description=\""` — verifies Monitor call includes description field
- `grep: "description : String"` — verifies Spec type signature is updated

### Implementation

File: `plugin/skills/loop-backlog/SKILL.md`

1. Frontmatter: add two new contract grep rules (write first)
2. Spec section (~line 54): extend Monitor type signature to include `description : String`
3. Pseudo-code idle branch (~line 110): add `description=` to Monitor call with self-recovery instruction
4. Implementation bash section (~line 958): update inline Monitor example with `description=` parameter
5. Commented-out Monitor reference (~line 1279): rewrite to multi-line form with description to avoid breaking absence DoD check
6. Implementation prose (~line 1653): document new `description` parameter and cross-session self-recovery purpose

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'description="' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'description : String' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q '/loop-backlog' plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'Monitor(persistent=true, command=' plugin/skills/loop-backlog/SKILL.md`

## Constraints

- Description field content must stay under 200 words to avoid Monitor tool truncation
- Daemon log format must not change
- `basic-daemon.js` must not be modified
- No project-level `CLAUDE.md` files should be added or changed
- Projects with existing `/loop-backlog` CLAUDE.md rules must continue to work

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'description="' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'description : String' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q '/loop-backlog' plugin/skills/loop-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal approved. Starting plan draft.

Plan review iteration 1: NEEDS_REVISION
Fix applied: Added Implementation Step 5 to update the commented-out Monitor call at line 1279 of SKILL.md. The old-form single-line comment `# Monitor(persistent=true, command=...)` would have caused the absence DoD check (`! grep -q 'Monitor(persistent=true, command='`) to always fail even after correct implementation. Step 5 instructs the implementer to rewrite that comment to the multi-line form, making the absence check passable.
premise-ledger:
E Goal coverage: all 4 Goals addressed by Phase A steps and Constraints.
E TDD structure: Phase A has Tests then Implementation in correct order.
E TDD order: first DoD item is `bash scripts/validate-plugin.sh`.
E Acceptance gate: first Acceptance Gate item is `bash scripts/validate-plugin.sh`.
E DoD executability: all DoD and Acceptance Gate items are shell commands.
E Absence checks: uses `! grep -q`, not `grep -qv`.
E Phase ordering: single phase, no circular deps.
E Scope discipline: all implementation backed by Goals.
C File paths: `plugin/skills/loop-backlog/SKILL.md` and `scripts/validate-plugin.sh` confirmed to exist.
H Absence DoD feasibility: line 1279 commented-out old Monitor form would have broken the absence check — fixed by adding Step 5.
GCL-self-report: E=8 C=1 H=1

Plan review iteration 2: APPROVED
premise-ledger:
[E] Goal coverage: All 4 proposal Goals are addressed by Phase A implementation steps and Constraints.
[E] TDD structure: Phase A has ### Tests before ### Implementation, correct order.
[E] TDD order: First ### DoD item is `bash scripts/validate-plugin.sh` (proves red→green).
[E] Acceptance gate: First ## Acceptance Gate item is `bash scripts/validate-plugin.sh`.
[E] DoD executability: All DoD and Acceptance Gate items are shell commands; no natural-language items.
[E] Absence checks: `! grep -q` pattern used (not `grep -qv`) on line 90.
[C] Phase ordering: Single phase, no circular deps possible.
[E] Scope discipline: All implementation steps map directly to Goals 1-3.
[E] File paths: `plugin/skills/loop-backlog/SKILL.md` and `scripts/validate-plugin.sh` both exist; proposal output path is a to-be-created file (acceptable forward reference).
GCL-self-report: E=7 C=1 H=0

claimed: 2026-06-23T07:19:50Z

Completed: 2026-06-23T07:29:09Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'description="' plugin/skills/loop-backlog/SKILL.md
- [ ] #3 grep -q 'description : String' plugin/skills/loop-backlog/SKILL.md
- [ ] #4 grep -q '/loop-backlog' plugin/skills/loop-backlog/SKILL.md
- [ ] #5 ! grep -q 'Monitor(persistent=true, command=' plugin/skills/loop-backlog/SKILL.md
- [ ] #6 bash scripts/validate-plugin.sh
<!-- DOD:END -->
