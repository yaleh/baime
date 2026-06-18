# Skill Specification Standard

This document defines the minimum formal specification requirements for BAIME skills.

## Purpose

Skills without formal specifications behave unpredictably — their constraints are implicit, cannot be statically validated, and are hard to test. This standard establishes a minimum bar for all new skills and a target for existing skills.

## Minimum Standard

Every skill MUST have, in its `SKILL.md` frontmatter and body:

### Trigger

The `description:` frontmatter field must be specific enough that only one skill would match a given user input. Avoid broad terms that overlap with other skills.

### Failure behavior

Every skill MUST document what happens when it cannot complete successfully:
- What conditions cause failure
- What the skill outputs or signals on failure (e.g., escalate, write signal file, ask user)

### contracts:

Each SKILL.md MUST have a `contracts:` line (can be in frontmatter or as a standalone line in the `## Spec` section) listing the key invariants the skill upholds.

## Required Sections

A conforming SKILL.md must include:

1. **Frontmatter** with at minimum: `name`, `description`, `version`
2. **`## Spec`** section with:
   - `λ` entry point signature (the main function the skill exports)
   - Core data type definitions (inputs/outputs)
   - Main workflow function signatures
3. **`contracts:`** line listing behavioral invariants

## Example Spec Structure

```
## Spec

contracts:
  - never modifies files outside the designated output path
  - always writes a signal file on completion (done or needs-human)
  - idempotent: running twice produces the same result

λ(input: Input) → Output

data Input = Input { ... }
data Output = Done Result | NeedsHuman Reason

mainWorkflow :: Input → Output
mainWorkflow(i) = ...
```

## Spec Quality Levels

| Level | Criteria |
|-------|----------|
| 0 | No spec section at all |
| 1 | Has `## Spec` and `contracts:` but no type signatures |
| 2 | Has type signatures for inputs/outputs |
| 3 | Full Haskell-style spec with all major functions |

New skills must reach at least Level 2. Level 1 is the minimum acceptable for existing skills in this migration.
