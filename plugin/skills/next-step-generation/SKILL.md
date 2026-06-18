---
name: next-step-generation
description: Generate ready-to-use, context-aware prompts for the most natural next steps based on recent conversation activity. Pure reasoning skill — no MCP tool calls. Infers completion state, suggests primary continuation, and offers 2-3 ranked alternatives.
---

## Spec

contracts:
  - reads conversation context without modifying any files
  - produces a single prioritized recommendation with 2-3 ranked alternatives
  - pure reasoning only; no external tool calls or MCP server invocations

λ(context: ConversationContext) → NextStepRecommendation

# Next-Step Generation

**Infer what comes next from conversation context and generate immediately executable prompts.**

---

## When to Apply This Skill

Use this skill after any significant action completes:

- A file was edited and tests have not yet run
- Tests passed and changes have not been committed
- A plan was written and Stage 1 has not started
- An error occurred and a fix has not been applied
- A stage completed and the next stage is ready

---

## Step 1: Assess Completion State

Read the last 5–10 messages and classify the current state:

| State | Signal |
|-------|--------|
| `fully_complete` | Task finished with confirmation; natural handoff point |
| `partially_complete` | Task started but not done; continuation obvious |
| `blocked` | Waiting for user decision or missing information |
| `error_state` | Last action failed; fix is the immediate priority |

---

## Step 2: Infer the Primary Next Step

Apply the following inference rules in priority order:

```
error_occurred          → fix_the_error (include error message in prompt)
file_edited             → run_tests (name the test command if known)
tests_passed            → commit_changes (suggest commit message)
plan_written            → execute_stage_1
stage_N_complete        → execute_stage_N+1
implementation_done     → write_tests
tests_written           → run_tests
build_failed            → fix_build_error
docs_outdated           → update_docs
pr_ready                → create_pull_request
```

For the inferred primary step, craft a complete, copy-pasteable prompt that includes:

- The specific action to take
- Any `@file` references relevant to the context
- The expected outcome
- No unfilled placeholders

---

## Step 3: Generate Alternatives

Suggest 2–3 ranked alternative next steps for situations where the primary path is not the only valid option. Rank by likelihood of user intent. Common alternative clusters:

- `tests_passing` → [refactor, update_docs, optimize, create_pr]
- `planning_phase` → [start_implementation, review_plan, gather_more_requirements]
- `implementation_done` → [write_tests, update_docs, request_review]

---

## Step 4: Format Output

Present results in this structure:

```
## Recommended Next Step

**[Action label]**
[Ready-to-use prompt — complete, no placeholders]

Rationale: [1-sentence justification from recent context]
Estimated time: [< 5 min | 15–30 min | 1+ hour]

---

## Alternatives

1. **[Alternative 1]** — [one-line prompt or action description]
2. **[Alternative 2]** — [one-line prompt or action description]
3. **[Alternative 3 — optional]** — [one-line prompt or action description]
```

---

## Constraints

- `context_only`: infer from conversation; do not call any external tools
- `ready_to_use`: every prompt must be complete and copy-pasteable
- `concise`: primary recommendation + at most 3 alternatives
- `non_executable`: suggest ∧ ¬implement
- `evidence_based`: every suggestion must be grounded in recent context
- `file_aware`: include `@file` references when files are clearly relevant
