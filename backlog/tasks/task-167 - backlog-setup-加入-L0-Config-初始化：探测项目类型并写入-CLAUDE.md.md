---
id: TASK-167
title: backlog-setup 加入 L0 Config 初始化：探测项目类型并写入 CLAUDE.md
status: 'Basic: Backlog'
assignee: []
created_date: '2026-06-23 07:42'
updated_date: '2026-06-23 07:49'
labels:
  - 'kind:basic'
dependencies: []
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
在 backlog-setup skill 中加入 L0 Config 初始化步骤：探测项目类型（package.json / go.mod / Makefile 等），生成 ## L0 Config 草稿并写入 CLAUDE.md，幂等（已存在则跳过）。这样用户只需运行一次 backlog-setup，后续所有 skill（feature-to-backlog、task-to-backlog、loop-backlog）就能读到正确的 test-cmd / test-all，无需依赖 autoDetect 猜测。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: backlog-setup 加入 L0 Config 初始化：探测项目类型并写入 CLAUDE.md

## Background

BAIME skills (feature-to-backlog, task-to-backlog, loop-backlog) depend on the `## L0 Config` section in CLAUDE.md to know how to validate work: `test-cmd`, `test-all`, `doc-path`, and `worktree-symlinks`. When this section is absent, skills fall back to `autoDetect` — a heuristic that probes `package.json`, `go.mod`, and `Makefile` but frequently produces wrong or incomplete results. Skill-generated tasks then carry incorrect gates and worktrees break on missing symlinks, requiring the human to manually fix CLAUDE.md before any autonomous loop can run. Because `backlog-setup` is the designated "first thing you do in a new project" entry point, it is the natural place to resolve this gap.

## Goals

1. After `backlog-setup` completes, CLAUDE.md contains a `## L0 Config` block with at least `test-cmd`, `test-all`, `doc-path`, and `worktree-symlinks` keys.
2. The step is idempotent: if `## L0 Config` already exists, the step skips without modifying it.
3. The generated values are derived from project-type signals (`package.json`, `go.mod`, `Makefile`, `pyproject.toml`, `scripts/validate-plugin.sh`, etc.).
4. When no CLAUDE.md exists, the step creates one containing only the `## L0 Config` block.
5. When CLAUDE.md exists but has no `## L0 Config` section, the step appends the block without altering any existing content.

## Proposed Approach

Add `initL0Config()` as a new step in `backlogSetup()` (after `addColumns`, before `seedExamples`). It probes marker files in priority order (scripts/validate-plugin.sh → package.json → go.mod → Cargo.toml → pyproject.toml → Makefile → unknown), renders the L0 Config block, pauses for human confirmation, then appends to CLAUDE.md (or creates it). Single grep-based idempotency guard. New SKILL.md contract: `grep: "initL0Config"`.

## Trade-offs and Risks

- Detection ambiguity: resolved by fixed priority order + human confirmation pause.
- CLAUDE.md format drift: grep guard may miss non-standard heading variants.
- Scope creep: adds one confirmation pause to an otherwise non-interactive tool (acceptable — backlog-setup is human-initiated).
- CLAUDE.md ownership: no assumptions about git-tracked vs gitignored.

---

# Plan: backlog-setup 加入 L0 Config 初始化：探测项目类型并写入 CLAUDE.md

## Phase A: Add `initL0Config` function to SKILL.md Spec and Implementation

### Tests (write first)

Add contract grep rule to frontmatter — causes `validate-plugin.sh` to fail before implementation:
- `grep: "initL0Config"` — verifies the new step is present in SKILL.md

### Implementation

All changes in `plugin/skills/backlog-setup/SKILL.md`:

1. **Frontmatter**: add `- grep: "initL0Config"` contract rule
2. **Spec `backlogSetup()`**: insert `initL0Config()` call after `addColumns`, before `seedExamples`; add `initL0Config :: () → ()` and `detectProjectType :: () → ProjectType` signatures
3. **Implementation**: add `### initL0Config` bash block with idempotency guard, priority-ordered detection, rendered L0 block, human confirmation pause, and append/create logic
4. **`printSummary`**: remove manual L0 Config instructions from "Next steps" (now handled automatically)
5. **`## Notes`**: replace manual L0 Config sentence with description of the new auto-detection behavior

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'initL0Config' plugin/skills/backlog-setup/SKILL.md`
- [ ] `grep -q 'grep: "initL0Config"' plugin/skills/backlog-setup/SKILL.md`
- [ ] `grep -q 'L0 Config' plugin/skills/backlog-setup/SKILL.md`
- [ ] `grep -q 'scripts/validate-plugin.sh' plugin/skills/backlog-setup/SKILL.md`
- [ ] `grep -q 'detectProjectType' plugin/skills/backlog-setup/SKILL.md`
- [ ] `! grep -q 'Add an' plugin/skills/backlog-setup/SKILL.md`

## Constraints

- Change is entirely in `plugin/skills/backlog-setup/SKILL.md` — no other files modified
- Idempotency guard: `grep -q "## L0 Config" CLAUDE.md 2>/dev/null` (not a lock file)
- Detection priority order is fixed: scripts/validate-plugin.sh → package.json → go.mod → Cargo.toml → pyproject.toml → Makefile → unknown
- Step must pause for human confirmation before writing CLAUDE.md
- Appending must not alter existing content (prepend blank line before block)
- New contract `grep: "initL0Config"` must be in frontmatter

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'initL0Config' plugin/skills/backlog-setup/SKILL.md`
- [ ] `grep -q 'detectProjectType' plugin/skills/backlog-setup/SKILL.md`
- [ ] `grep -q 'grep: "initL0Config"' plugin/skills/backlog-setup/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal approved. Starting plan draft.

Plan review iteration 1: APPROVED
premise-ledger:
[E] Goal coverage: All 5 Goals (L0 block written, idempotency, project-type detection, create-if-absent, append-without-altering) are addressed by Phase A steps 2–5 and DoD/Acceptance Gate items.
[E] TDD structure: Phase A has ### Tests before ### Implementation.
[E] TDD order: First ### DoD item is `bash scripts/validate-plugin.sh`.
[E] Acceptance gate: First ## Acceptance Gate item is `bash scripts/validate-plugin.sh`.
[E] DoD executability: All DoD and Acceptance Gate items are shell commands.
[E] Absence checks: Uses `! grep -q` pattern (not `grep -qv`).
[E] Phase ordering: Single phase, no circular deps.
[E] Scope discipline: All Phase A steps are directly backed by Goals 1–5.
[E] File paths: plugin/skills/backlog-setup/SKILL.md and scripts/validate-plugin.sh both exist.
GCL-self-report: E=9 C=0 H=0
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q 'initL0Config' plugin/skills/backlog-setup/SKILL.md
- [ ] #3 grep -q 'grep: "initL0Config"' plugin/skills/backlog-setup/SKILL.md
- [ ] #4 grep -q 'L0 Config' plugin/skills/backlog-setup/SKILL.md
- [ ] #5 grep -q 'detectProjectType' plugin/skills/backlog-setup/SKILL.md
- [ ] #6 ! grep -q 'Add an' plugin/skills/backlog-setup/SKILL.md
<!-- DOD:END -->
