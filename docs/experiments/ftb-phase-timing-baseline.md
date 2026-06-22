# feature-to-backlog / epic-to-backlog Phase Timing Baseline

**Date**: 2026-06-21
**Session**: 855161fb-c108-447a-bef2-66297524213d
**Data source**: session notification timestamps (ftb-timing-raw.txt)
**Method**: Timestamps extracted from JSONL; phase boundaries = Agent spawn → task-notification arrival

---

## Phase × Task Timing Table

| Phase | TASK-132 (ftb) | TASK-133 (ftb) | Mean (ftb) | TASK-134 (etb) |
|-------|---------------|---------------|------------|----------------|
| draftProposal | 201s | 105s | 153s | 136s |
| proposalLoop | 149s (1 iter) | 36s (1 iter) | 93s | 69s (1 iter) |
| draftPlan | 89s | 113s | 101s | 91s |
| planLoop | ~360s (2 iters) | 76s (1 iter) | ~218s* | 68s (1 iter) |
| finalise | 115s | 391s | 253s | 56s |
| **Total (serial)** | **~914s** | **721s** | **~818s** | **420s** |

\* TASK-132 planLoop total is estimated; iter 2 completion timestamp not captured (see Caveats).

---

## proposalLoop Iteration Rate

| Task | Iterations | Verdict sequence |
|------|-----------|-----------------|
| TASK-132 | 1 | APPROVED |
| TASK-133 | 1 | APPROVED |
| TASK-134 | 1 | APPROVED |

All three tasks were approved on the first proposalLoop iteration. The proposalLoop reviewer found no blockers in any case.

---

## planLoop Iteration Rate

| Task | Iterations | Verdict sequence |
|------|-----------|-----------------|
| TASK-132 | 2 | NEEDS_REVISION → APPROVED |
| TASK-133 | 1 | APPROVED |
| TASK-134 | 1 | APPROVED |

TASK-132 planLoop iter 1 found two issues: (1) a Goal 3 coverage gap in the DoD (missing `Epic: Needs Human` check), and (2) a `kind:basic` label not added. Both were fixed within iter 1 before spawning iter 2.

---

## Caveats

### TASK-132 planLoop iter 2 timing
The planLoop iter 2 was auto-spawned from within the iter 1 agent process at ~15:38:21. Its completion notification was never received in the main session — it was either delivered during a context compaction window (15:45–15:51) or queued but not processed because the main agent had transitioned. The APPROVED verdict was confirmed via a manual Bash file-system check at 15:54:56 (user requested at 15:54:45). The planLoop total (~360s) is a lower-bound estimate assuming iter 2 ran ~160-180s similar to iter 1 (166s). Confidence: medium.

### Parallelism and wall-clock
TASK-132 and TASK-133 were run in parallel by a single orchestrating agent. Some wall-clock delay in TASK-132 (e.g., its finalise not starting until 15:55:19, long after planLoop finished) reflects orchestrator attention being shared with TASK-133 and later TASK-134. The serial pipeline totals above represent only the time the respective agents were running, not wall-clock elapsed.

### TASK-134 finalise timing
TASK-134 finalise end time (15:59:00) is estimated from contextual evidence; no explicit completion notification was found in the analyzed portion of the session.

---

## Findings

### 1. finalise is the largest phase by variance

For the ftb runs, finalise ranged from 115s (TASK-132) to 391s (TASK-133). The TASK-133 finalise took 54% of its total serial pipeline time. The epic-to-backlog finalise was only 56s — suggesting that the ftb finalise implementation has significantly higher overhead than the etb equivalent, likely due to more complex DoD extraction and combined-document formatting.

The ASST's own analysis at 15:48:41 flagged this: "finalise agent 重新读取 proposal + plan，格式化合并文档，逐行提取 DoD 命令，最后调用多次 backlog task edit — 这些工作几乎没有 LLM 推理成分，大部分是 I/O."

### 2. proposalLoop is fast and always 1-iteration

Across all three tasks, proposalLoop was approved on the first iteration. Duration ranged from 36s (TASK-133) to 149s (TASK-132) for ftb, with 69s for etb. The high variance (36–149s) likely reflects context size differences: TASK-132's proposal was longer and the reviewer loaded more files.

Given the 100% first-pass approval rate, proposalLoop may be over-specified for well-defined tasks. This supports the hypothesis that proposalLoop can be compressed or merged into draftProposal as a self-review step.

### 3. planLoop is the highest-value phase (only one with NEEDS_REVISION)

planLoop was the only phase that detected real issues — TASK-132 iter 1 found two structural gaps. This is consistent with the hypothesis that planLoop should be retained at full fidelity while other phases are compressed. planLoop duration for single-iteration approvals ranged from 68s (etb) to 76s (ftb), which is fast.

### 4. draftProposal and draftPlan are consistent mid-range phases

draftProposal: 105–201s (ftb), 136s (etb). draftPlan: 89–113s (ftb), 91s (etb). Both phases show reasonable consistency across task types.

### 5. epic-to-backlog (etb) is significantly faster than feature-to-backlog (ftb)

etb total: 420s vs ftb mean ~818s (~50% faster). The dominant factor is finalise: etb finalise (56s) is 4-7x faster than ftb finalise (115–391s). This suggests etb has a lighter-weight finalise implementation and/or the epic-level documents require less post-processing.

### 6. Implications for experiments

- **Experiment A (finalise optimization)**: Replace ftb finalise LLM agent with a Bash script that directly concatenates proposal+plan and extracts DoD commands. Expected saving: 50–350s per run (median ~250s, or ~30–40% of total pipeline time).
- **Experiment B (proposalLoop compression)**: Merge draftProposal + proposalLoop into a single self-reviewing agent. Expected saving: ~90–200s, with low quality risk given 100% first-pass approval rate historically.
- **Experiment C (planLoop protection)**: Do not compress planLoop — it is the only phase that catches real issues (TASK-132 iter 1). Retain at current fidelity.
