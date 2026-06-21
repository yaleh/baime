---
id: TASK-55
title: 为 Class A/B 构建生产级 oracle runner 并接入 CI 发行门
status: Basic: Done
assignee: []
created_date: '2026-06-19'
updated_date: '2026-06-20 00:56'
labels:
  - kind:basic
  - skill-quality
  - layer-2.5
  - ci
dependencies:
  - TASK-40
  - TASK-41
references:
  - docs/skill-quality-experiments-summary.md
  - docs/skill-quality-engineering.md
  - experiments/skill-quality/scripts/run-exp-d.ts
  - experiments/skill-quality/scripts/run-exp-e.ts
  - experiments/skill-quality/scripts/run-oracle-class-c.ts
  - .github/workflows/oracle.yml
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Exp-D（TASK-40）与 Exp-E（TASK-41）已经证明：

| 类 | 决策类型 | Haiku 准确率 | 条件 | 建议 |
|---|---|---|---|---|
| **Class A** | binary-gate / freshnessCheck | **0.90** | P-full（完整 SKILL.md 注入） | auto-CI |
| **Class B** | invariant-check / reviewPlan | **1.00**（verdict-only） | scorer 修复后 | auto-CI |

Class C（branch-selection / verifyDod）已于 `oracle.yml` 接入 CI（TASK-47 前置工作）。

Class A/B 的阈值在 Exp-H（TASK-46）中跨 skill 得到验证（H-universal CONFIRMED，σ=0.020），全局阈值可用，无需 per-skill 标定。

**当前缺口**：`experiments/skill-quality/scripts/` 下只有实验用的 `run-exp-d.ts`、`run-exp-e.ts`，这两个脚本以探索为目的，参数硬编码，不适合作为生产 oracle runner。`oracle.yml` 只覆盖 Class C，Class A/B 没有对应的 CI workflow。这意味着：

- 修改 `task-from-template` 或 `task-to-backlog` 的 SKILL.md 时，freshnessCheck 和 reviewPlan 决策质量没有任何自动回归保护
- `skill-quality-engineering.md §5.2` 的 auto-CI 建议停在文档层面，未落地为实际检查

## Goal

为 Class A（binary-gate）和 Class B（invariant-check）分别构建可复用的生产级 oracle runner，接入 `oracle.yml` CI workflow，使三类决策的回归保护完整覆盖。

## Scope

### 1. Class A runner：`run-oracle-class-a.ts`

对标 `run-oracle-class-c.ts`，差异点：

- **Prompt 构建**：注入完整 SKILL.md（P-full），而非 specSection 片段（Exp-D H-prompt CONFIRMED，P-spec vs P-full 差距 +20pp）
- **阈值**：`--threshold 0.85`
- **Fixture 路径**：`experiments/skill-quality/fixtures/exp-b/class-a/`（现有 freshnessCheck fixtures）
- **输出**：`{verdict: "FRESH"|"STALE"}` JSON，exact match scoring
- **参数**：`--threshold <float>` `--k <int>` `--skill <path-to-SKILL.md>`（支持多 skill 覆盖）

### 2. Class B runner：`run-oracle-class-b.ts`

- **Prompt 构建**：P-full 注入
- **阈值**：`--threshold 0.70`（verdict-only；composite 同时输出但不作为通过门）
- **Scorer**：使用 `lib/score.ts` 中已修复的 partial scorer（n=0 → 1.0；token Jaccard ≥ 0.3 模糊匹配）
- **Fixture 路径**：`experiments/skill-quality/fixtures/exp-b/class-b/`（CLEAR 标注的 6 个 fixture；排除 2 个 AMBIGUOUS）
- **输出**：同时报告 composite 和 verdict-only，若 composite < verdict-only - 0.1 则输出 scorer-warning

### 3. `oracle.yml` 扩展

在现有 `oracle-class-c` job 之后追加 `oracle-class-a` 和 `oracle-class-b` job，trigger paths 分别覆盖相关 SKILL.md 和 fixture 目录：

```yaml
# oracle-class-a 触发路径（示例）
paths:
  - "plugin/skills/task-from-template/SKILL.md"
  - "plugin/skills/task-to-backlog/SKILL.md"
  - "experiments/skill-quality/fixtures/exp-b/class-a/**"
  - "experiments/skill-quality/scripts/run-oracle-class-a.ts"
```

### 4. Fixture 清单校验

确认 `exp-b/class-a/` 和 `exp-b/class-b/` 下的 fixture 文件通过 `fixture-lint.sh`（TASK-53 产出），且 Class B 的 AMBIGUOUS fixture 已标注排除。

## Out of Scope

- 新增 fixture（在现有 fixture 集上跑；新 fixture 属于独立 task）
- Class D（tool-invocation trace）— 已在 TASK-47/48/49 中独立处理
- OCA 收敛判据文档修订（TASK-54）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `experiments/skill-quality/scripts/run-oracle-class-a.ts` 存在，`--threshold 0.85 --k 5` 下在 Class A fixtures 上准确率 ≥ 0.85（P-full 注入）
- [ ] #2 `experiments/skill-quality/scripts/run-oracle-class-b.ts` 存在，`--threshold 0.70 --k 5` 下在 CLEAR Class B fixtures 上 verdict-only 准确率 ≥ 0.70；同时输出 composite
- [ ] #3 `oracle.yml` 新增 `oracle-class-a` 和 `oracle-class-b` job，trigger paths 覆盖相关 SKILL.md 和 fixture 目录
- [ ] #4 Class B runner 在 composite < verdict-only - 0.1 时输出 scorer-warning（提示 scorer 可能是瓶颈）
- [ ] #5 两个 runner 均使用 `check-provenance.sh` 校验输出 results.json 的 data_source 字段
- [ ] #6 `validate-plugin.sh` 运行通过（结构性 contracts 不受影响）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 为 Class A/B 构建生产级 oracle runner 并接入 CI 发行门

Proposal: TASK-55 — 为 Class A（binary-gate / freshnessCheck）和 Class B（invariant-check / reviewPlan）分别构建可复用的生产级 oracle runner，接入 oracle.yml CI workflow。

## Grounding (verified against codebase)
- Reference runner: `experiments/skill-quality/scripts/run-oracle-class-c.ts` (arg parsing via `getArg`, `createLlmClient` from `../lib/llm-client.js`, `scoreResponse`/`extractAnswer` from `../lib/score.js`, `validateEnv`/`getModelPrimary` from `../lib/env.js`, `process.exit(pass?0:1)`). NOTE: it only prints to console + `process.exit` — it does NOT persist a results.json, so Phases A/B must implement the results writer from scratch.
- Libs exist: `experiments/skill-quality/lib/{llm-client,score,env}.ts`. `score.ts` already has the fixed partial scorer (`scoreResponse(..., 'partial')`: n=0→1.0 on verdict match, else 0.5 verdict + token Jaccard≥0.3 item credit).
- Fixtures exist: `experiments/skill-quality/fixtures/exp-b/class-a/` (10 files: 5 fresh + 5 stale, `answerType:"exact"`, answers FRESH/STALE) and `.../class-b/` (8 files, `answerType:"partial"`, all CLEAR; NO AMBIGUOUS files present).
- P-full convention: read full SKILL.md and embed under `## SKILL.md (P-full injection)` (see `exp-h/run-exp-h.ts`). Class A skill = `plugin/skills/task-from-template/SKILL.md`; Class B skill = `plugin/skills/feature-to-backlog/SKILL.md`.
- `.github/workflows/oracle.yml` currently has one job `oracle-class-c` gated by `if: vars.ORACLE_ENABLED == 'true'`, with `paths:` trigger list and per-job npx tsx invocation.
- `scripts/check-provenance.sh` AND `scripts/fixture-lint.sh` BOTH ALREADY EXIST (TASK-52/TASK-53 already merged) — not a blocking dependency. `check-provenance.sh <file.json>` validates a single results.json `data_source` field. `fixture-lint.sh <dir>` lints `answerType:"exact"` fixtures only.
- Existing results artifacts in `experiments/skill-quality/artifacts/analysis/*-results.json` carry a top-level `data_source` field, but `run-oracle-class-c.ts` does NOT write one. Phases A/B implement `oracle-class-{a,b}-results.json` (with `"data_source":"measured"`) from scratch.
- tsx invoked via `npx tsx scripts/<file>.ts` with cwd `experiments/skill-quality`. Live LLM calls require `LLM_BASE_URL` + `LLM_API_KEY` (from `.env` locally, GitHub secrets in CI).

## Phase A: Class A runner (run-oracle-class-a.ts) — offline CLI contract + P-full injection
### Tests (write first)
- `experiments/skill-quality/scripts/run-oracle-class-a.test.sh` (new shell test, runnable offline):
  - `test_file_exists`: asserts `scripts/run-oracle-class-a.ts` exists — MUST FAIL before impl.
  - `test_help_no_api`: asserts running with `--help` (or default args without API key) does NOT throw on arg parsing and references `--threshold`, `--k`, `--skill` — MUST FAIL before impl.
  - `test_pfull_injection`: greps the runner source for `task-from-template/SKILL.md` and `P-full` — MUST FAIL before impl.
  - `test_exact_match_output`: greps the runner source for verdict normalization to `FRESH`/`STALE` and `answerType` `'exact'` scoring path — MUST FAIL before impl.
### Implementation
- Create `experiments/skill-quality/scripts/run-oracle-class-a.ts` modeled on `run-oracle-class-c.ts`:
  - args: `--threshold` (default `0.85`), `--k` (default `5`), `--skill` (default `task-from-template`).
  - FIXTURES_DIR = `fixtures/exp-b/class-a`; read all `*.json`.
  - P-full: `readFile(plugin/skills/<skill>/SKILL.md)`, embed under `## SKILL.md (P-full injection)` in prompt.
  - Prompt asks model to decide template freshness; output ONLY `{"verdict":"FRESH"}` or `{"verdict":"STALE"}`; extract via `extractAnswer` adapted to `verdict` key (or reuse `answer`); score with `scoreResponse(extracted, fixture.answer, 'exact')` (exact-match).
  - Write `artifacts/analysis/oracle-class-a-results.json` with top-level `"data_source": "measured"`, per-fixture means, overall accuracy, threshold.
  - `process.exit(accuracy >= threshold ? 0 : 1)`.
- Add `package.json` script: `"oracle-class-a": "npx tsx scripts/run-oracle-class-a.ts"`.
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f experiments/skill-quality/scripts/run-oracle-class-a.ts`
- [ ] `grep -q -- '--threshold' experiments/skill-quality/scripts/run-oracle-class-a.ts`
- [ ] `grep -q -- '--skill' experiments/skill-quality/scripts/run-oracle-class-a.ts`
- [ ] `grep -q 'task-from-template/SKILL.md' experiments/skill-quality/scripts/run-oracle-class-a.ts`
- [ ] `grep -q 'P-full' experiments/skill-quality/scripts/run-oracle-class-a.ts`
- [ ] `grep -Eq "FRESH|STALE" experiments/skill-quality/scripts/run-oracle-class-a.ts`
- [ ] `grep -q "'exact'" experiments/skill-quality/scripts/run-oracle-class-a.ts`
- [ ] `grep -q '"oracle-class-a"' experiments/skill-quality/package.json`
- [ ] `bash experiments/skill-quality/scripts/run-oracle-class-a.test.sh`

## Phase B: Class B runner (run-oracle-class-b.ts) — verdict-only + composite + scorer-warning
### Tests (write first)
- `experiments/skill-quality/scripts/run-oracle-class-b.test.sh` (new shell test, runnable offline):
  - `test_file_exists`: asserts `scripts/run-oracle-class-b.ts` exists — MUST FAIL before impl.
  - `test_pfull_injection`: greps source for `feature-to-backlog/SKILL.md` and `P-full` — MUST FAIL before impl.
  - `test_partial_scorer`: greps source for use of `scoreResponse` with `'partial'` and import from `../lib/score.js` — MUST FAIL before impl.
  - `test_composite_and_verdict_only`: greps source for both `verdict_only` (or `verdictOnly`) and `composite` output keys — MUST FAIL before impl.
  - `test_scorer_warning`: greps source for `scorer-warning` and the `- 0.1` threshold expression — MUST FAIL before impl.
  - `test_ambiguous_excluded`: greps source for an AMBIGUOUS exclusion guard (e.g. filter on `fixtureClass !== 'AMBIGUOUS'` / `CLEAR`) — MUST FAIL before impl.
### Implementation
- Create `experiments/skill-quality/scripts/run-oracle-class-b.ts` modeled on `run-oracle-class-c.ts` + `run-exp-b.ts` Class B path:
  - args: `--threshold` (default `0.70`), `--k` (default `5`), `--skill` (default `feature-to-backlog`).
  - FIXTURES_DIR = `fixtures/exp-b/class-b`; read `*.json`; EXCLUDE any fixture whose `fixtureClass === 'AMBIGUOUS'` (current set is all CLEAR — guard is defensive).
  - P-full: embed full `plugin/skills/feature-to-backlog/SKILL.md`.
  - Prompt: reviewPlan invariant check; output `{"verdict":"APPROVED"|"NEEDS_REVISION","failing_invariants":[...]}`.
  - Compute TWO accuracies per fixture set:
    - `verdict_only`: score on verdict match alone (1.0 if verdict matches else 0).
    - `composite`: `scoreResponse(extracted, {verdict, items: failing_invariants}, 'partial')` (the fixed partial scorer in `lib/score.ts`).
  - GATE on `verdict_only >= threshold` (0.70). Also output `composite` in results.
  - Emit `scorer-warning` (stderr + a `"scorer_warning": true` field) when `composite < verdict_only - 0.1`.
  - Write `artifacts/analysis/oracle-class-b-results.json` with top-level `"data_source": "measured"`, `verdict_only`, `composite`, `scorer_warning`, threshold.
  - `process.exit(verdict_only >= threshold ? 0 : 1)`.
- Add `package.json` script: `"oracle-class-b": "npx tsx scripts/run-oracle-class-b.ts"`.
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f experiments/skill-quality/scripts/run-oracle-class-b.ts`
- [ ] `grep -q 'feature-to-backlog/SKILL.md' experiments/skill-quality/scripts/run-oracle-class-b.ts`
- [ ] `grep -q 'P-full' experiments/skill-quality/scripts/run-oracle-class-b.ts`
- [ ] `grep -q "'partial'" experiments/skill-quality/scripts/run-oracle-class-b.ts`
- [ ] `grep -q "from '../lib/score.js'" experiments/skill-quality/scripts/run-oracle-class-b.ts`
- [ ] `grep -Eq "verdict_only|verdictOnly" experiments/skill-quality/scripts/run-oracle-class-b.ts`
- [ ] `grep -q 'composite' experiments/skill-quality/scripts/run-oracle-class-b.ts`
- [ ] `grep -q 'scorer-warning' experiments/skill-quality/scripts/run-oracle-class-b.ts`
- [ ] `grep -q -- '- 0.1' experiments/skill-quality/scripts/run-oracle-class-b.ts`
- [ ] `grep -q 'AMBIGUOUS' experiments/skill-quality/scripts/run-oracle-class-b.ts`
- [ ] `grep -q '"oracle-class-b"' experiments/skill-quality/package.json`
- [ ] `bash experiments/skill-quality/scripts/run-oracle-class-b.test.sh`

## Phase C: Fixture inventory check (lint passes, AMBIGUOUS excluded)
### Tests (write first)
- `experiments/skill-quality/scripts/run-oracle-fixture-inventory.test.sh` (new, offline):
  - `test_class_a_lint`: runs `fixture-lint.sh fixtures/exp-b/class-a` and asserts exit 0 — MUST FAIL before impl (class-a fixtures currently have NO `specSection` and NO `answer_vocab`, so fixture-lint exits 1 on all 10; turns green only after `answer_vocab` is added).
  - `test_class_b_no_ambiguous`: asserts no file under `fixtures/exp-b/class-b/` declares `"fixtureClass": "AMBIGUOUS"` — MUST FAIL only if an AMBIGUOUS fixture is later added without exclusion.
  - `test_class_a_count`: asserts class-a has the 10 expected fixtures (5 FRESH + 5 STALE).
### Implementation
- Add `"answer_vocab": ["FRESH","STALE"]` to each of the 10 `fixtures/exp-b/class-a/*.json` files. `fixture-lint.sh` checks `answer_vocab` before `specSection`, so this makes the exact-match answers lint-clean without inventing a specSection. (Verified: lint currently fails on these because both fields are absent.)
- Create `experiments/skill-quality/scripts/run-oracle-fixture-inventory.test.sh` wrapping `scripts/fixture-lint.sh` for class-a and a grep-based AMBIGUOUS-exclusion assertion for class-b; this script is the durable inventory gate.
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `bash experiments/skill-quality/scripts/fixture-lint.sh experiments/skill-quality/fixtures/exp-b/class-a`
- [ ] `! grep -rq '"fixtureClass": "AMBIGUOUS"' experiments/skill-quality/fixtures/exp-b/class-b/`
- [ ] `! grep -rq '"fixtureClass":"AMBIGUOUS"' experiments/skill-quality/fixtures/exp-b/class-b/`
- [ ] `test "$(ls experiments/skill-quality/fixtures/exp-b/class-a/*.json | wc -l)" -eq 10`
- [ ] `bash experiments/skill-quality/scripts/run-oracle-fixture-inventory.test.sh`

## Phase D: CI wiring — add oracle-class-a + oracle-class-b jobs to oracle.yml
### Tests (write first)
- `experiments/skill-quality/scripts/oracle-yml.test.sh` (new, offline; parses `.github/workflows/oracle.yml`):
  - `test_job_a_present`: asserts `oracle-class-a:` job exists — MUST FAIL before impl.
  - `test_job_b_present`: asserts `oracle-class-b:` job exists — MUST FAIL before impl.
  - `test_job_order`: asserts both new jobs appear AFTER `oracle-class-c:` in file order — MUST FAIL before impl.
  - `test_trigger_paths`: asserts `paths:` includes class-a + class-b fixture dirs, both runner scripts, and the two SKILL.md files — MUST FAIL before impl.
  - `test_invocations`: asserts `run-oracle-class-a.ts --threshold 0.85 --k 5` and `run-oracle-class-b.ts --threshold 0.70 --k 5` invocations present — MUST FAIL before impl.
### Implementation
- Edit `.github/workflows/oracle.yml`:
  - Extend `on.push.paths` to add: `plugin/skills/task-from-template/SKILL.md`, `plugin/skills/task-to-backlog/SKILL.md` (Class A freshnessCheck is shared by both), `plugin/skills/feature-to-backlog/SKILL.md`, `experiments/skill-quality/fixtures/exp-b/class-a/**`, `experiments/skill-quality/fixtures/exp-b/class-b/**`, `experiments/skill-quality/scripts/run-oracle-class-a.ts`, `experiments/skill-quality/scripts/run-oracle-class-b.ts`.
  - Add `oracle-class-a` job AFTER `oracle-class-c` (same `if: vars.ORACLE_ENABLED == 'true'`, checkout, setup-node 22, `npm install`, then `npx tsx scripts/run-oracle-class-a.ts --threshold 0.85 --k 5`, env LLM_BASE_URL/LLM_API_KEY/MODEL_PRIMARY).
  - Add `oracle-class-b` job AFTER `oracle-class-a` with `npx tsx scripts/run-oracle-class-b.ts --threshold 0.70 --k 5`.
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q 'oracle-class-a:' .github/workflows/oracle.yml`
- [ ] `grep -q 'oracle-class-b:' .github/workflows/oracle.yml`
- [ ] `grep -q 'run-oracle-class-a.ts --threshold 0.85 --k 5' .github/workflows/oracle.yml`
- [ ] `grep -q 'run-oracle-class-b.ts --threshold 0.70 --k 5' .github/workflows/oracle.yml`
- [ ] `grep -q 'fixtures/exp-b/class-a/' .github/workflows/oracle.yml`
- [ ] `grep -q 'fixtures/exp-b/class-b/' .github/workflows/oracle.yml`
- [ ] `grep -q 'task-from-template/SKILL.md' .github/workflows/oracle.yml`
- [ ] `grep -q 'task-to-backlog/SKILL.md' .github/workflows/oracle.yml`
- [ ] `grep -q 'feature-to-backlog/SKILL.md' .github/workflows/oracle.yml`
- [ ] `test "$(grep -n 'oracle-class-c:' .github/workflows/oracle.yml | head -1 | cut -d: -f1)" -lt "$(grep -n 'oracle-class-a:' .github/workflows/oracle.yml | head -1 | cut -d: -f1)"`
- [ ] `bash experiments/skill-quality/scripts/oracle-yml.test.sh`

## Phase E: Provenance validation of results.json (committed artifacts + check-provenance.sh)
### Tests (write first)
- `experiments/skill-quality/scripts/oracle-provenance.test.sh` (new, offline):
  - `test_results_a_provenance`: runs `check-provenance.sh artifacts/analysis/oracle-class-a-results.json` exit 0 — MUST FAIL until a results file with valid `data_source` exists.
  - `test_results_b_provenance`: same for `oracle-class-b-results.json` — MUST FAIL until present.
### Implementation
- Generate committed measured artifacts by running each runner WITH live API credentials (the executing agent runs these where `.env` / secrets are available):
  - `npx tsx scripts/run-oracle-class-a.ts --threshold 0.85 --k 5` → produces `artifacts/analysis/oracle-class-a-results.json` (`data_source:"measured"`).
  - `npx tsx scripts/run-oracle-class-b.ts --threshold 0.70 --k 5` → produces `artifacts/analysis/oracle-class-b-results.json`.
  - Commit both results.json so provenance + accuracy gates are reproducible offline.
- Both runners already write top-level `"data_source": "measured"` (added in Phase A/B); this phase verifies it via `check-provenance.sh` (already exists).
### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f experiments/skill-quality/artifacts/analysis/oracle-class-a-results.json`
- [ ] `test -f experiments/skill-quality/artifacts/analysis/oracle-class-b-results.json`
- [ ] `bash experiments/skill-quality/scripts/check-provenance.sh experiments/skill-quality/artifacts/analysis/oracle-class-a-results.json`
- [ ] `bash experiments/skill-quality/scripts/check-provenance.sh experiments/skill-quality/artifacts/analysis/oracle-class-b-results.json`
- [ ] `grep -q '"data_source": "measured"' experiments/skill-quality/artifacts/analysis/oracle-class-a-results.json`
- [ ] `grep -q '"data_source": "measured"' experiments/skill-quality/artifacts/analysis/oracle-class-b-results.json`
- [ ] `bash experiments/skill-quality/scripts/oracle-provenance.test.sh`

## Constraints
- **Live-accuracy criteria (#1, #2) require real LLM API calls** (`LLM_BASE_URL` + `LLM_API_KEY`). They CANNOT run in an offline CI test step without secrets. Strategy: each runner exits non-zero when accuracy < threshold, so the runner itself IS the accuracy gate; the committed `oracle-class-*-results.json` artifacts (Phase E) record the measured accuracy. The Acceptance Gate verifies accuracy via the committed results files (`data_source:"measured"`), which is reproducible offline. The CI jobs in `oracle.yml` re-run the live gate when `vars.ORACLE_ENABLED == 'true'` and secrets are present.
- The fixed partial scorer is reused as-is from `experiments/skill-quality/lib/score.ts` (`scoreResponse(..., 'partial')`: n=0→1.0 verdict-match, token Jaccard≥0.3 item credit). Do NOT fork or reimplement it.
- `check-provenance.sh` and `fixture-lint.sh` already exist (TASK-52/TASK-53 merged) — no blocking dependency. If for any reason `check-provenance.sh` were absent, substitute the self-contained check `grep -q '"data_source"' <results.json>` in Phase E / Acceptance Gate.
- Class B fixture set is currently all CLEAR (8 fixtures); no AMBIGUOUS files exist. The exclusion guard in the runner + the inventory test are defensive against future AMBIGUOUS additions.
- Class A "exact-match" output contract: the runner must normalize model output to exactly `FRESH` or `STALE` (fixture `answerType:"exact"`); partial credit is not applicable to Class A.
- Each phase change ≤200 LOC; runner files ~110-150 LOC each modeled on `run-oracle-class-c.ts`.

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f experiments/skill-quality/scripts/run-oracle-class-a.ts && grep -q -- '--threshold' experiments/skill-quality/scripts/run-oracle-class-a.ts && grep -q -- '--skill' experiments/skill-quality/scripts/run-oracle-class-a.ts`  # AC#1 file + CLI contract
- [ ] `python3 -c "import json,sys; d=json.load(open('experiments/skill-quality/artifacts/analysis/oracle-class-a-results.json')); a=d.get('accuracy', d.get('overall_accuracy', d.get('overallMean'))); sys.exit(0 if a is not None and float(a)>=0.85 else 1)"`  # AC#1 accuracy ≥0.85 (P-full, --threshold 0.85 --k 5)
- [ ] `test -f experiments/skill-quality/scripts/run-oracle-class-b.ts && grep -q 'composite' experiments/skill-quality/scripts/run-oracle-class-b.ts`  # AC#2 file + composite output
- [ ] `python3 -c "import json,sys; d=json.load(open('experiments/skill-quality/artifacts/analysis/oracle-class-b-results.json')); v=d.get('verdict_only', d.get('verdictOnly')); c=d.get('composite'); sys.exit(0 if v is not None and float(v)>=0.70 and c is not None else 1)"`  # AC#2 verdict-only ≥0.70 + composite present
- [ ] `grep -q 'oracle-class-a:' .github/workflows/oracle.yml && grep -q 'oracle-class-b:' .github/workflows/oracle.yml && grep -q 'fixtures/exp-b/class-a/' .github/workflows/oracle.yml && grep -q 'fixtures/exp-b/class-b/' .github/workflows/oracle.yml`  # AC#3 jobs + trigger paths
- [ ] `grep -q 'scorer-warning' experiments/skill-quality/scripts/run-oracle-class-b.ts && grep -q -- '- 0.1' experiments/skill-quality/scripts/run-oracle-class-b.ts`  # AC#4 scorer-warning when composite < verdict_only - 0.1
- [ ] `bash experiments/skill-quality/scripts/check-provenance.sh experiments/skill-quality/artifacts/analysis/oracle-class-a-results.json && bash experiments/skill-quality/scripts/check-provenance.sh experiments/skill-quality/artifacts/analysis/oracle-class-b-results.json`  # AC#5 data_source provenance both runners
- [ ] `! grep -rq 'AMBIGUOUS' experiments/skill-quality/fixtures/exp-b/class-b/ && bash experiments/skill-quality/scripts/fixture-lint.sh experiments/skill-quality/fixtures/exp-b/class-a`  # fixture inventory: AMBIGUOUS excluded + class-a lint
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
claimed: 2026-06-20T00:43:21Z

Completed: 2026-06-20T00:56:52Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 test -f experiments/skill-quality/scripts/run-oracle-class-a.ts
- [ ] #3 grep -q -- '--threshold' experiments/skill-quality/scripts/run-oracle-class-a.ts
- [ ] #4 grep -q -- '--skill' experiments/skill-quality/scripts/run-oracle-class-a.ts
- [ ] #5 grep -q 'task-from-template/SKILL.md' experiments/skill-quality/scripts/run-oracle-class-a.ts
- [ ] #6 grep -q 'P-full' experiments/skill-quality/scripts/run-oracle-class-a.ts
- [ ] #7 grep -Eq "FRESH|STALE" experiments/skill-quality/scripts/run-oracle-class-a.ts
- [ ] #8 grep -q "'exact'" experiments/skill-quality/scripts/run-oracle-class-a.ts
- [ ] #9 grep -q '"oracle-class-a"' experiments/skill-quality/package.json
- [ ] #10 bash experiments/skill-quality/scripts/run-oracle-class-a.test.sh
- [ ] #11 test -f experiments/skill-quality/scripts/run-oracle-class-b.ts
- [ ] #12 grep -q 'feature-to-backlog/SKILL.md' experiments/skill-quality/scripts/run-oracle-class-b.ts
- [ ] #13 grep -q 'P-full' experiments/skill-quality/scripts/run-oracle-class-b.ts
- [ ] #14 grep -q "'partial'" experiments/skill-quality/scripts/run-oracle-class-b.ts
- [ ] #15 grep -q "from '../lib/score.js'" experiments/skill-quality/scripts/run-oracle-class-b.ts
- [ ] #16 grep -Eq "verdict_only|verdictOnly" experiments/skill-quality/scripts/run-oracle-class-b.ts
- [ ] #17 grep -q 'composite' experiments/skill-quality/scripts/run-oracle-class-b.ts
- [ ] #18 grep -q 'scorer-warning' experiments/skill-quality/scripts/run-oracle-class-b.ts
- [ ] #19 grep -q -- '- 0.1' experiments/skill-quality/scripts/run-oracle-class-b.ts
- [ ] #20 grep -q 'AMBIGUOUS' experiments/skill-quality/scripts/run-oracle-class-b.ts
- [ ] #21 grep -q '"oracle-class-b"' experiments/skill-quality/package.json
- [ ] #22 bash experiments/skill-quality/scripts/run-oracle-class-b.test.sh
- [ ] #23 bash experiments/skill-quality/scripts/fixture-lint.sh experiments/skill-quality/fixtures/exp-b/class-a
- [ ] #24 ! grep -rq '"fixtureClass": "AMBIGUOUS"' experiments/skill-quality/fixtures/exp-b/class-b/
- [ ] #25 ! grep -rq '"fixtureClass":"AMBIGUOUS"' experiments/skill-quality/fixtures/exp-b/class-b/
- [ ] #26 test "$(ls experiments/skill-quality/fixtures/exp-b/class-a/*.json | wc -l)" -eq 10
- [ ] #27 bash experiments/skill-quality/scripts/run-oracle-fixture-inventory.test.sh
- [ ] #28 grep -q 'oracle-class-a:' .github/workflows/oracle.yml
- [ ] #29 grep -q 'oracle-class-b:' .github/workflows/oracle.yml
- [ ] #30 grep -q 'run-oracle-class-a.ts --threshold 0.85 --k 5' .github/workflows/oracle.yml
- [ ] #31 grep -q 'run-oracle-class-b.ts --threshold 0.70 --k 5' .github/workflows/oracle.yml
- [ ] #32 grep -q 'fixtures/exp-b/class-a/' .github/workflows/oracle.yml
- [ ] #33 grep -q 'fixtures/exp-b/class-b/' .github/workflows/oracle.yml
- [ ] #34 grep -q 'task-from-template/SKILL.md' .github/workflows/oracle.yml
- [ ] #35 grep -q 'task-to-backlog/SKILL.md' .github/workflows/oracle.yml
- [ ] #36 grep -q 'feature-to-backlog/SKILL.md' .github/workflows/oracle.yml
- [ ] #37 test "$(grep -n 'oracle-class-c:' .github/workflows/oracle.yml | head -1 | cut -d: -f1)" -lt "$(grep -n 'oracle-class-a:' .github/workflows/oracle.yml | head -1 | cut -d: -f1)"
- [ ] #38 bash experiments/skill-quality/scripts/oracle-yml.test.sh
- [ ] #39 test -f experiments/skill-quality/artifacts/analysis/oracle-class-a-results.json
- [ ] #40 test -f experiments/skill-quality/artifacts/analysis/oracle-class-b-results.json
- [ ] #41 bash experiments/skill-quality/scripts/check-provenance.sh experiments/skill-quality/artifacts/analysis/oracle-class-a-results.json
- [ ] #42 bash experiments/skill-quality/scripts/check-provenance.sh experiments/skill-quality/artifacts/analysis/oracle-class-b-results.json
- [ ] #43 grep -q '"data_source": "measured"' experiments/skill-quality/artifacts/analysis/oracle-class-a-results.json
- [ ] #44 grep -q '"data_source": "measured"' experiments/skill-quality/artifacts/analysis/oracle-class-b-results.json
- [ ] #45 bash experiments/skill-quality/scripts/oracle-provenance.test.sh
- [ ] #46 test -f experiments/skill-quality/scripts/run-oracle-class-a.ts && grep -q -- '--threshold' experiments/skill-quality/scripts/run-oracle-class-a.ts && grep -q -- '--skill' experiments/skill-quality/scripts/run-oracle-class-a.ts
- [ ] #47 python3 -c "import json,sys; d=json.load(open('experiments/skill-quality/artifacts/analysis/oracle-class-a-results.json')); a=d.get('accuracy', d.get('overall_accuracy', d.get('overallMean'))); sys.exit(0 if a is not None and float(a)>=0.85 else 1)"
- [ ] #48 test -f experiments/skill-quality/scripts/run-oracle-class-b.ts && grep -q 'composite' experiments/skill-quality/scripts/run-oracle-class-b.ts
- [ ] #49 python3 -c "import json,sys; d=json.load(open('experiments/skill-quality/artifacts/analysis/oracle-class-b-results.json')); v=d.get('verdict_only', d.get('verdictOnly')); c=d.get('composite'); sys.exit(0 if v is not None and float(v)>=0.70 and c is not None else 1)"
- [ ] #50 grep -q 'oracle-class-a:' .github/workflows/oracle.yml && grep -q 'oracle-class-b:' .github/workflows/oracle.yml && grep -q 'fixtures/exp-b/class-a/' .github/workflows/oracle.yml && grep -q 'fixtures/exp-b/class-b/' .github/workflows/oracle.yml
- [ ] #51 grep -q 'scorer-warning' experiments/skill-quality/scripts/run-oracle-class-b.ts && grep -q -- '- 0.1' experiments/skill-quality/scripts/run-oracle-class-b.ts
- [ ] #52 bash experiments/skill-quality/scripts/check-provenance.sh experiments/skill-quality/artifacts/analysis/oracle-class-a-results.json && bash experiments/skill-quality/scripts/check-provenance.sh experiments/skill-quality/artifacts/analysis/oracle-class-b-results.json
- [ ] #53 ! grep -rq 'AMBIGUOUS' experiments/skill-quality/fixtures/exp-b/class-b/ && bash experiments/skill-quality/scripts/fixture-lint.sh experiments/skill-quality/fixtures/exp-b/class-a
<!-- DOD:END -->
