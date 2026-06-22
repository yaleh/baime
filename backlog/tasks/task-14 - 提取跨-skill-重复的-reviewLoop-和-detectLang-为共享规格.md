---
id: TASK-14
title: 提取跨 skill 重复的 reviewLoop 和 detectLang 为共享规格
status: "Basic: Done"
assignee: []
created_date: '2026-06-17 16:04'
updated_date: '2026-06-18 10:58'
labels:
  - kind:basic
  - spec-quality
  - deduplication
dependencies: []
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 问题

多个 skill 存在逐字或结构性重复的 spec 函数，当前已出现分歧：

**`detectLang`**：`loop-backlog` 与 `feature-to-backlog` 逐字相同，`task-to-backlog` 已删除。

**`loadConfig`**：三个 skill 签名相同（`() → Config`），但 `autoDetect` 实现各异（返回不同字段集），且注释已出现差异。

**`reviewLoop` / `reviewPlan`**：`feature-to-backlog` 和 `task-to-backlog` 结构几乎相同，仅 max rounds（8 vs 4）和类型别名不同。

## 建议方向

评估是否引入共享规格文档（如 `docs/spec-stdlib.md`），将 `detectLang`、`loadConfig` 的公共逻辑集中定义，各 skill spec 以 `-- see spec-stdlib` 引用。`reviewLoop` 可参数化 max rounds 后合并。需权衡"共享规格"与"每个 skill 自包含"之间的可读性 trade-off。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: Extract Shared Spec Functions into docs/spec-stdlib.md

## Background

Three skills (`feature-to-backlog`, `task-to-backlog`, `loop-backlog`) each contain inline
copies of `detectLang`, `loadConfig`, and `reviewLoop`/`reviewPlan`. Divergence has already
occurred: `task-to-backlog` dropped `detectLang` entirely; `loop-backlog`'s `loadConfig`
reads different fields (`worktree-symlinks`, `max-parallel`) with no shared type definition;
and the two `reviewLoop` implementations differ in `maxRounds` (8 vs 4) without explanation.
A fix to the `parse_cfg` bash idiom in one skill will not propagate to the others, a new
language added to `detectLang` requires two edits, and there is no canonical definition to
point reviewers at. Centralising the shared spec in `docs/spec-stdlib.md` eliminates this
duplication, establishes a single source of truth, and makes future changes atomic.

## Goals

1. A file `docs/spec-stdlib.md` exists and defines: `detectLang`, `loadConfig` (both the
   `Config` type and the `autoDetect` case expression), and `reviewLoop` with a `MaxRounds`
   parameter — verifiable by:
   `grep -q 'detectLang' docs/spec-stdlib.md && grep -q 'loadConfig' docs/spec-stdlib.md && grep -q 'reviewLoop' docs/spec-stdlib.md`

2. Each of the three skill SKILL.md files (`feature-to-backlog`, `task-to-backlog`,
   `loop-backlog`) contains a `-- see spec-stdlib` reference for every function it delegates
   to stdlib — verifiable by:
   `grep -ql '-- see spec-stdlib' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md plugin/skills/loop-backlog/SKILL.md`

3. Inline spec bodies for `detectLang` and `loadConfig` are removed from all three SKILL.md
   files (replaced by the `-- see spec-stdlib` stub), so they no longer contain duplicate
   definitions — verifiable by:
   `! grep -q 'detectLang() =' plugin/skills/feature-to-backlog/SKILL.md`
   `! grep -q 'detectLang() =' plugin/skills/loop-backlog/SKILL.md`

4. `reviewLoop` in `feature-to-backlog` and `task-to-backlog` is replaced by a call to the
   stdlib variant with an explicit `maxRounds` argument (8 and 4 respectively) — verifiable by
   reviewing that neither SKILL.md contains a standalone `reviewLoop` definition body but each
   contains a call site that passes `maxRounds`:
   `grep -q 'reviewLoop.*8' plugin/skills/feature-to-backlog/SKILL.md`
   `grep -q 'reviewLoop.*4' plugin/skills/task-to-backlog/SKILL.md`

5. `bash scripts/validate-plugin.sh` passes after all changes — verifiable by running it.

## Proposed Approach

Create `docs/spec-stdlib.md` with the canonical Haskell-style specs for the three shared
functions. For `detectLang` and `loadConfig`, copy the current `feature-to-backlog` version
as the reference (it is the most complete). For `reviewLoop`, define it with an explicit
`MaxRounds` parameter, mirroring the current signature already in both skills.

Update each SKILL.md's `## Spec` section: replace the full inline body of each shared function
with a one-line stub `-- see spec-stdlib § <FunctionName>` and a local type annotation showing
the concrete instantiation (e.g. `loadConfig :: () → Config` where `Config` for
`loop-backlog` has `symlinks` and `maxParallel` fields, not `testCmd`/`testAll`). The
Implementation sections (bash code) remain entirely inside each SKILL.md — stdlib defines
only the specification layer, not the implementation.

No runtime mechanism is introduced (skills are LLM-interpreted prompts, not compiled
modules). The `-- see spec-stdlib` comment is a documentation convention that tells the
agent where to find the canonical logic; it does not require a loader or import system.

## Trade-offs and Risks

**Self-contained vs. shared readability**: Currently each SKILL.md can be understood without
reading any other file. After this change, a reviewer must open `docs/spec-stdlib.md` to see
the full `detectLang` or `loadConfig` logic. Mitigation: stdlib stubs retain the type signature
and a one-line summary so common cases remain readable inline; only the full case expression
moves out.

**Transition divergence**: During the migration, if one SKILL.md is updated and another is
not, there will be a period where the spec is partially duplicated and partially referenced.
Mitigation: all three SKILL.md files must be updated atomically in a single commit; the DoD
requires `validate-plugin.sh` to pass before the task is considered Done.

**task-to-backlog loadConfig scope**: `task-to-backlog`'s `Config` type only has `docPath`,
not `testCmd`/`testAll`. The stdlib `loadConfig` must therefore be polymorphic or the skill
must override the return type. Preferred resolution: stdlib defines `autoDetect` as returning
a full `Config` and each skill narrows it to the fields it uses — the stub makes this explicit.

**Scope**: Implementation sections (bash code) are intentionally excluded from stdlib to
avoid the risk of a single bash change breaking all three skills simultaneously. Stdlib is
spec-only.

---

# Plan: Extract Shared Spec Functions into docs/spec-stdlib.md

Proposal: docs/proposals/proposal-extract-shared-spec-functions-into-docs-spec-stdlib-md.md

## Phase A: Create docs/spec-stdlib.md

### Tests (write first)

Before implementation these must fail (red):
```
! test -f docs/spec-stdlib.md
```

After implementation these must pass (green):
```
test -f docs/spec-stdlib.md
grep -q 'detectLang' docs/spec-stdlib.md
grep -q 'loadConfig' docs/spec-stdlib.md
grep -q 'reviewLoop' docs/spec-stdlib.md
```

### Implementation

Create `docs/spec-stdlib.md` (~80 lines). Extract verbatim from
`plugin/skills/feature-to-backlog/SKILL.md` (the most complete source) for `detectLang`,
`loadConfig`/`autoDetect`. Define `reviewLoop` with an explicit `MaxRounds` parameter drawn
from the shared shape present in both feature-to-backlog and task-to-backlog.

File to create: `docs/spec-stdlib.md`

Content outline:
- Header: purpose statement (stdlib is spec-only; no bash implementation)
- `## detectLang` — verbatim copy of the case expression from feature-to-backlog
- `## loadConfig` — superset `Config` type covering all three skills' fields, plus
  `loadConfig()` dispatch and `autoDetect()` case expression from feature-to-backlog
- `## reviewLoop` — parameterised definition with `MaxRounds`; table of instantiations
  (feature-to-backlog: 8, task-to-backlog: 4)

No other files are created or modified in this phase.

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f docs/spec-stdlib.md`
- [ ] `grep -q 'detectLang' docs/spec-stdlib.md && grep -q 'loadConfig' docs/spec-stdlib.md && grep -q 'reviewLoop' docs/spec-stdlib.md`

---

## Phase B: Add cross-reference comments to the three SKILL.md files

### Tests (write first)

Before implementation these must fail (red):
```
! grep -q '-- see spec-stdlib' plugin/skills/feature-to-backlog/SKILL.md
! grep -q '-- see spec-stdlib' plugin/skills/task-to-backlog/SKILL.md
! grep -q '-- see spec-stdlib' plugin/skills/loop-backlog/SKILL.md
```

After implementation these must pass (green):
```
grep -q '-- see spec-stdlib' plugin/skills/feature-to-backlog/SKILL.md
grep -q '-- see spec-stdlib' plugin/skills/task-to-backlog/SKILL.md
grep -q '-- see spec-stdlib' plugin/skills/loop-backlog/SKILL.md
grep -ql '-- see spec-stdlib' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md plugin/skills/loop-backlog/SKILL.md
grep -q 'reviewLoop.*8' plugin/skills/feature-to-backlog/SKILL.md
grep -q 'reviewLoop.*4' plugin/skills/task-to-backlog/SKILL.md
```

### Implementation

Three files to edit; each receives one-line comment insertions only (inline spec bodies are
not yet removed in this phase — removal happens in Phase C).

**`plugin/skills/feature-to-backlog/SKILL.md`**

Insert `-- see spec-stdlib § loadConfig` on the line immediately following the
`loadConfig() =` signature line (currently line ~19).

Insert `-- see spec-stdlib § detectLang` on the line immediately following the
`detectLang :: () → Lang` type signature line (currently line ~31).

Insert `-- see spec-stdlib § reviewLoop  (MaxRounds = 8)` on the line immediately following
the `reviewLoop :: (Task, Doc, MaxRounds) → ApprovedDoc` type signature line (currently line ~96).

**`plugin/skills/task-to-backlog/SKILL.md`**

Insert `-- see spec-stdlib § loadConfig` on the line immediately following the
`loadConfig() =` signature line (currently line ~17).

Insert `-- see spec-stdlib § reviewLoop  (MaxRounds = 4)` on the line immediately following
the `reviewLoop :: (Task, Plan, MaxRounds) → ApprovedPlan` type signature line (currently line ~68).

**`plugin/skills/loop-backlog/SKILL.md`**

Insert `-- see spec-stdlib § loadConfig` on the line immediately following the
`loadConfig() =` signature line (currently line ~34).

Insert `-- see spec-stdlib § detectLang` on the line immediately following the
`detectLang :: () → Lang` type signature line (currently line ~44).

All other content in every SKILL.md is unchanged at this point. Run `bash scripts/validate-plugin.sh`
after all three files are edited (atomicity: edit all three before running the validator).

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q '-- see spec-stdlib' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q '-- see spec-stdlib' plugin/skills/task-to-backlog/SKILL.md`
- [ ] `grep -q '-- see spec-stdlib' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -ql '-- see spec-stdlib' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'reviewLoop.*8' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'reviewLoop.*4' plugin/skills/task-to-backlog/SKILL.md`

---

## Phase C: Remove inline spec bodies and replace reviewLoop with call-site stubs

### Tests (write first)

Before implementation these must fail (red):
```
! grep -q 'detectLang() =' plugin/skills/feature-to-backlog/SKILL.md
! grep -q 'detectLang() =' plugin/skills/loop-backlog/SKILL.md
```

After implementation these must pass (green):
```
! grep -q 'detectLang() =' plugin/skills/feature-to-backlog/SKILL.md
! grep -q 'detectLang() =' plugin/skills/loop-backlog/SKILL.md
grep -q 'reviewLoop.*8' plugin/skills/feature-to-backlog/SKILL.md
grep -q 'reviewLoop.*4' plugin/skills/task-to-backlog/SKILL.md
```

### Implementation

**`plugin/skills/feature-to-backlog/SKILL.md`**

Remove the inline case-expression body of `detectLang` (all lines between the type signature
and the next function definition), replacing it with the stub `-- see spec-stdlib § detectLang`.

Remove the inline case-expression body of `loadConfig`/`autoDetect`, replacing it with
`-- see spec-stdlib § loadConfig`.

Replace the standalone `reviewLoop` definition body with a one-line call stub:
`reviewLoop task doc = reviewLoopStdlib task doc maxRounds  -- MaxRounds = 8`
(The type signature line is preserved; only the body lines are replaced.)

**`plugin/skills/task-to-backlog/SKILL.md`**

Remove the inline case-expression body of `loadConfig`, replacing it with
`-- see spec-stdlib § loadConfig`.

Replace the standalone `reviewLoop` definition body with a one-line call stub:
`reviewLoop task plan = reviewLoopStdlib task plan maxRounds  -- MaxRounds = 4`

**`plugin/skills/loop-backlog/SKILL.md`**

Remove the inline case-expression body of `detectLang`, replacing it with
`-- see spec-stdlib § detectLang`.

Remove the inline case-expression body of `loadConfig`, replacing it with
`-- see spec-stdlib § loadConfig`.

All three SKILL.md edits must land in a single commit. Run `bash scripts/validate-plugin.sh`
after all three files are edited.

### DoD

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `! grep -q 'detectLang() =' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q 'detectLang() =' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'reviewLoop.*8' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'reviewLoop.*4' plugin/skills/task-to-backlog/SKILL.md`

---

## Constraints

- Implementation sections (bash code) inside each SKILL.md are not touched
- docs/spec-stdlib.md defines the specification layer only — no bash code
- No new skills, no new scripts, no branch creation, no PRs
- All three SKILL.md edits in Phase C must land in a single commit (atomicity — no partial-migration state)
- Phase A must complete before Phase B begins; Phase B must complete before Phase C begins
- Natural-language criteria live here in Constraints, never in DoD sections

## Acceptance Gate

- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'detectLang' docs/spec-stdlib.md && grep -q 'loadConfig' docs/spec-stdlib.md && grep -q 'reviewLoop' docs/spec-stdlib.md`
- [ ] `grep -ql '-- see spec-stdlib' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md plugin/skills/loop-backlog/SKILL.md`
- [ ] `! grep -q 'detectLang() =' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `! grep -q 'detectLang() =' plugin/skills/loop-backlog/SKILL.md`
- [ ] `grep -q 'reviewLoop.*8' plugin/skills/feature-to-backlog/SKILL.md`
- [ ] `grep -q 'reviewLoop.*4' plugin/skills/task-to-backlog/SKILL.md`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 2: APPROVED

Proposal approved. Starting plan draft.

Plan review iteration 1: NEEDS_REVISION — Goals 3 and 4 (remove inline detectLang/loadConfig bodies; replace standalone reviewLoop bodies with call-site stubs) were not covered by any Phase. Phase B explicitly kept all bodies in place, contradicting both goals. Fixed: added Phase C to cover removal of inline spec bodies and replacement of reviewLoop definitions, and extended Acceptance Gate with the corresponding absence-check commands.

Plan review iteration 2: APPROVED

claimed: 2026-06-18T10:50:03Z

workerLoop DoD verified: 17/22 pass; 5 false negatives due to ugrep parsing '--' as long-option prefix — content confirmed correct via grep -e
Completed: 2026-06-18T10:58:38Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 test -f docs/spec-stdlib.md
- [ ] #3 grep -q 'detectLang' docs/spec-stdlib.md && grep -q 'loadConfig' docs/spec-stdlib.md && grep -q 'reviewLoop' docs/spec-stdlib.md
- [ ] #4 bash scripts/validate-plugin.sh
- [ ] #5 grep -q '-- see spec-stdlib' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #6 grep -q '-- see spec-stdlib' plugin/skills/task-to-backlog/SKILL.md
- [ ] #7 grep -q '-- see spec-stdlib' plugin/skills/loop-backlog/SKILL.md
- [ ] #8 grep -ql '-- see spec-stdlib' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md plugin/skills/loop-backlog/SKILL.md
- [ ] #9 grep -q 'reviewLoop.*8' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #10 grep -q 'reviewLoop.*4' plugin/skills/task-to-backlog/SKILL.md
- [ ] #11 bash scripts/validate-plugin.sh
- [ ] #12 ! grep -q 'detectLang() =' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #13 ! grep -q 'detectLang() =' plugin/skills/loop-backlog/SKILL.md
- [ ] #14 grep -q 'reviewLoop.*8' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #15 grep -q 'reviewLoop.*4' plugin/skills/task-to-backlog/SKILL.md
- [ ] #16 bash scripts/validate-plugin.sh
- [ ] #17 grep -q 'detectLang' docs/spec-stdlib.md && grep -q 'loadConfig' docs/spec-stdlib.md && grep -q 'reviewLoop' docs/spec-stdlib.md
- [ ] #18 grep -ql '-- see spec-stdlib' plugin/skills/feature-to-backlog/SKILL.md plugin/skills/task-to-backlog/SKILL.md plugin/skills/loop-backlog/SKILL.md
- [ ] #19 ! grep -q 'detectLang() =' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #20 ! grep -q 'detectLang() =' plugin/skills/loop-backlog/SKILL.md
- [ ] #21 grep -q 'reviewLoop.*8' plugin/skills/feature-to-backlog/SKILL.md
- [ ] #22 grep -q 'reviewLoop.*4' plugin/skills/task-to-backlog/SKILL.md
<!-- DOD:END -->
