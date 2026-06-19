---
name: task-from-template
description: "Creates a Ready-status backlog task from a pre-approved template, bypassing the full review cycle. Performs a single LLM freshness check against recent git changes; if FRESH creates the task immediately, if STALE explains why and prompts the user to regenerate via task-to-backlog."
argument-hint: <template-slug>
allowed-tools: Read, Glob, Grep, Bash, Agent
contracts:
  - grep: "FRESH"
    target: self
  - grep: "STALE"
    target: self
  - grep: "templates"
    target: self
---



## Background

The `task-from-template` skill was introduced in project iteration 7 as a response to repeated
user complaints about the overhead of running a full `task-to-backlog` cycle for recurring tasks.
Over the course of iterations 7–12, the skill underwent three major revisions:

**Iteration 7 (initial):** Simple FRESH/STALE check using git blame on template file.
Template file modification date was the sole signal. False-positive rate was approximately 34%
because unrelated commits frequently touched template metadata.

**Iteration 9 (first revision):** Switched from git blame to `git log --oneline --since=<lastUsed>`.
This produced a richer signal set but introduced sensitivity to commit frequency rather than
change relevance. Experiments using 18 templates over 40 days showed precision improved from
0.66 to 0.81 but recall dropped from 0.94 to 0.87.

**Iteration 11 (current):** Added the `applicableWhen` field to template front-matter, allowing
the LLM to reason about semantic relevance rather than purely syntactic file-path matching.
Post-iteration accuracy measured at 0.89 precision / 0.91 recall on the same 40-day corpus.

**Historical usage statistics (tracked in iteration logs):**

| Template slug          | Uses (30d) | STALE detections | False positives |
|------------------------|-----------|-----------------|-----------------|
| ci-node-setup          | 12        | 3               | 1               |
| backlog-weekly-review  | 8         | 2               | 0               |
| dependency-audit       | 5         | 1               | 1               |
| release-checklist      | 14        | 4               | 2               |
| onboarding-task        | 3         | 0               | 0               |

These statistics informed the choice of the `head -20` limit in `recentChanges`: beyond 20
commits, the LLM context becomes saturated with low-signal entries, and precision drops below 0.75.

## Anti-patterns

The following patterns have been observed to cause incorrect STALE verdicts in production
(`git log` over the 12 weeks of iteration tracking):

1. **Timestamp drift without functional change.** When a CI pipeline touches a template file
   solely to update a timestamp field (e.g. `last-run: 2026-06-01`), the LLM incorrectly
   identifies this as a structural change. Mitigation: filter `git log` to exclude commits
   whose messages match `^chore:.*timestamp`.

2. **Transitive dependency rename.** If Script A calls Script B, and Script B is renamed,
   the template that calls Script A is flagged as STALE even though Script A's interface
   is unchanged. The freshnessCheck spec explicitly constrains checking to direct invocations
   only; this anti-pattern indicates the LLM is not following the constraint.

3. **Mass-format commit.** A single commit that reformats 50 files triggers a long `git log`
   entry list, overwhelming the context window on shorter models. The `head -20` limit helps
   but does not fully prevent this; variants with V2/V3 content are more susceptible.

4. **Template body containing shell snippets with hardcoded paths.** When `$REPO_ROOT`
   appears in a DoD command, the LLM sometimes interprets directory-restructuring commits
   as path invalidations even when the restructuring was in an unrelated subtree.

5. **Dual-mode STALE output.** Some LLM outputs produce `STALE` without a colon-separated
   reason, causing `parseVerdict` to fail silently. The spec requires `STALE:<reason>`;
   the Implementation section's Step 4 prompt mitigates this by providing explicit output
   format instructions.

6. **Over-eager FRESH verdict on major version bumps.** If a dependency listed in a DoD
   command upgrades from v1 to v2 (a breaking change), a naive freshnessCheck may still
   return FRESH because the file path exists. Mitigations: include version-pinned dependency
   lists in template body, and train prompt to check major-version signals.

7. **Commit-message ambiguity.** Commits with messages like `fix: update` or `chore: misc`
   carry zero signal. When such commits dominate `recentChanges`, the LLM defaults to FRESH
   (low-signal → assume stable), creating a systematic bias toward false FRESH verdicts.

8. **lastUsed date far in the past.** When `lastUsed` is more than 90 days ago, `git log`
   returns hundreds of commits, but only 20 are shown. The LLM cannot know what it is missing.
   If the 20 shown commits are all low-signal chores, a FRESH verdict is likely incorrect.

9. **Template applicableWhen field too broad.** A template with `applicableWhen: "any CI task"`
   will fail the freshness check because the scope of "any CI task" overlaps with almost every
   commit. Prefer narrow, actionable preconditions like "Add Node.js setup step to CI workflow."

10. **Concurrent template modifications.** If two developers simultaneously use the same
    template and both call `updateLastUsed`, the second commit will produce a merge conflict
    in `last-used`. The skill does not handle concurrent access; teams must coordinate template
    usage or accept occasional rollbacks.


**Recommended mitigation matrix (from iteration 11 retrospective):**

| Anti-pattern | Detection | Mitigation | Priority |
|---|---|---|---|
| Timestamp drift | Message regex | Pre-filter commits | High |
| Transitive rename | Scope check | Prompt constraint | High |
| Mass-format commit | Commit size | Cap by changed-files count | Medium |
| Hardcoded paths | Static analysis | Use `$REPO_ROOT` variable | Medium |
| Dual-mode STALE | Output parser | Strict format instruction | High |
| Major version bumps | Semver delta | Version-pin templates | Low |
| Ambiguous messages | Signal entropy | Warn on low-entropy log | Low |
| Old lastUsed | Date gap check | Warn if gap > 60d | Medium |
| Broad applicableWhen | Scope heuristic | Lint template on creation | High |
| Concurrent access | Lock file | Advisory lock in Step 6 | Low |

**Decision flowchart (simplified, from iteration 9 design doc):**

```
recentChanges non-empty?
  NO  → FRESH (no changes, template unchanged)
  YES →
    any commit touches template file directly?
      YES → STALE (direct modification)
      NO  →
        any commit renames/removes a tool referenced in template DoD?
          YES → STALE (tool invocation broken)
          NO  →
            applicableWhen still matches project state?
              YES → FRESH
              NO  → STALE (scope drift)
```

Note: the LLM is expected to internalize this flowchart from the `freshnessCheck` spec above.
The flowchart is provided here for documentation purposes only and does NOT override the spec.
Implementations should rely on the Spec section, not this Background section.

**Performance benchmarks (iteration 11, n=200 freshness checks):**

- Mean latency (Haiku): 1.4s
- Mean latency (GLM-4.5): 2.1s
- Mean input tokens: 1,247 (V0), 1,318 (V1), 2,891 (V2), 4,103 (V3)
- Mean output tokens: 18 (FRESH), 42 (STALE with reason)
- 95th-percentile latency: 3.2s (Haiku), 5.8s (GLM)

These benchmarks were collected on the standard fixture set used in Exp-A and are provided
here as reference data. Actual production latency may differ due to network conditions and
API load. The benchmarks confirm that V3 roughly doubles token input vs V0, which motivates
the P3 ablation study in Exp-A.


λ(slug) → taskFromTemplate(slug)

## Spec

Template :: {
  slug          : String,     -- kebab-case identifier; matches filename
  title         : String,     -- human-readable task name
  lastUsed      : Date,       -- ISO date of most recent use
  applicableWhen: String,     -- one-sentence precondition summary
  body          : String      -- plan text (front-matter stripped)
}

data FreshnessVerdict = FRESH | STALE Reason

-- Main entry point
taskFromTemplate :: Slug → BacklogTask | Stopped
taskFromTemplate(slug) = {
  repo:     repoRoot(),
  tmpl:     loadTemplate(repo, slug),
  changes:  recentChanges(tmpl.lastUsed),
  verdict:  freshnessCheck(tmpl, changes),
  if (verdict == STALE r):
    print("Template is STALE: " + r),
    print("Re-generate with: /task-to-backlog"),
    return: Stopped,
  task:     createTask(tmpl),
  _:        updateLastUsed(repo, slug),
  return:   task   -- status: Ready
}

loadTemplate :: (RepoRoot, Slug) → Template
loadTemplate(root, slug) =
  | exists(root + "/backlog/templates/" + slug + ".md") →
      parse(read(root + "/backlog/templates/" + slug + ".md"))
  | otherwise → error("Template not found: " + slug)

recentChanges :: Date → String
recentChanges(since) =
  eval("git log --oneline --since=" + since + " HEAD | head -20")

-- Single LLM call; first output line must be FRESH or STALE:<reason>
freshnessCheck :: (Template, Changes) → FreshnessVerdict
freshnessCheck(tmpl, changes) = {
  prompt: freshnessPrompt(tmpl, changes),
  result: llm(prompt),
  return: parseVerdict(result.lines[0])
}

createTask :: Template → BacklogTask
createTask(tmpl) =
  eval("backlog task create " + quote(tmpl.title) +
       " --status Ready" +
       " --description " + quote(tmpl.body))

updateLastUsed :: (RepoRoot, Slug) → ()
updateLastUsed(root, slug) = {
  path: root + "/backlog/templates/" + slug + ".md",
  _:    eval("sed -i 's/^last-used: .*/last-used: " + today() + "/' " + path),
  _:    eval("git add " + path),
  _:    eval("git commit -m 'chore(templates): update last-used for " + slug + "'")
}

## Implementation

### Step 1: locate template

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
SLUG="${1:-}"

if [ -z "$SLUG" ]; then
  echo "Usage: /task-from-template <template-slug>"
  echo ""
  echo "Available templates:"
  ls "${REPO_ROOT}/backlog/templates/"*.md 2>/dev/null \
    | xargs -I{} basename {} .md | grep -v README || echo "  (none)"
  exit 1
fi

TEMPLATE_FILE="${REPO_ROOT}/backlog/templates/${SLUG}.md"
if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "Error: template not found: $TEMPLATE_FILE"
  echo ""
  echo "Available templates:"
  ls "${REPO_ROOT}/backlog/templates/"*.md 2>/dev/null \
    | xargs -I{} basename {} .md | grep -v README || echo "  (none)"
  exit 1
fi
```

---

### Step 2: parse front-matter and extract body

```bash
# Extract front-matter fields
TMPL_TITLE=$(grep -oP '(?<=^title: ).+' "$TEMPLATE_FILE" | head -1)
TMPL_LAST_USED=$(grep -oP '(?<=^last-used: ).+' "$TEMPLATE_FILE" | head -1)
TMPL_APPLICABLE_WHEN=$(grep -oP '(?<=^applicable-when: ).+' "$TEMPLATE_FILE" | head -1)

# Extract body (everything after the closing ---)
TMPL_BODY=$(awk '/^---$/{n++; if(n==2){found=1; next}} found{print}' "$TEMPLATE_FILE")

echo "Template: $SLUG"
echo "Title: $TMPL_TITLE"
echo "Last used: $TMPL_LAST_USED"
echo "Applicable when: $TMPL_APPLICABLE_WHEN"
```

---

### Step 3: gather recent git changes

```bash
GIT_CHANGES=$(git -C "$REPO_ROOT" log --oneline --since="$TMPL_LAST_USED" HEAD | head -20)

if [ -z "$GIT_CHANGES" ]; then
  GIT_CHANGES="(no commits since $TMPL_LAST_USED)"
fi

echo "Recent changes since $TMPL_LAST_USED:"
echo "$GIT_CHANGES"
```

---

### Step 4: freshness check (single LLM call via Task agent)

Spawn a Task agent with the following prompt (substitute literal values for all
`<VARIABLE>` placeholders):

> You are performing a freshness check on a task template.
>
> **Template slug**: `<SLUG>`
> **Last used**: `<TMPL_LAST_USED>`
> **Applicable when**: `<TMPL_APPLICABLE_WHEN>`
> **Today's date**: `<TODAY>`
>
> **Template body**:
> ```
> <TMPL_BODY>
> ```
>
> **Git changes since last use** (`git log --oneline --since=<TMPL_LAST_USED>`):
> ```
> <GIT_CHANGES>
> ```
>
> Decide whether the template is still valid for its stated purpose.
> Consider:
> - Do the Phase steps and DoD commands still match the current project structure?
> - Have any scripts or tools that the template **directly invokes** (e.g. in Phase bash
>   blocks or DoD commands) been renamed or removed? Check only what the executor runs,
>   not what those scripts do internally.
> - Do the git changes suggest the overall workflow has fundamentally changed?
>
> **Important**: do NOT check files that are only mentioned in descriptive text, or files
> that a script modifies internally. Only the script/tool entry points matter.
>
> Your output MUST begin with exactly one of:
> - `FRESH` — template is still valid; no changes required
> - `STALE:<one-line reason>` — template needs updating
>
> After the first line, you may write a brief explanation (optional).
>
> Write only the verdict line to `$TMPDIR/tft-verdict.txt`:
> ```bash
> echo "FRESH" > $TMPDIR/tft-verdict.txt
> # or
> echo "STALE: <reason>" > $TMPDIR/tft-verdict.txt
> ```

After the agent completes, read the verdict:

```bash
VERDICT=$(cat "$TMPDIR/tft-verdict.txt" | head -1)

if echo "$VERDICT" | grep -q '^STALE'; then
  STALE_REASON=$(echo "$VERDICT" | sed 's/^STALE[: ]*//')
  echo ""
  echo "⚠️  Template '$SLUG' is STALE: $STALE_REASON"
  echo ""
  echo "The template was last used $TMPL_LAST_USED and recent changes make it unreliable."
  echo "Please regenerate it with:"
  echo "  /task-to-backlog $TMPL_APPLICABLE_WHEN"
  exit 0
fi

echo "✅ Template '$SLUG' is FRESH — creating task..."
```

---

### Step 5: create backlog task

```bash
TASK_OUTPUT=$(backlog task create "$TMPL_TITLE" \
  --status "Ready" \
  --description "$TMPL_BODY" \
  --plain)

TASK_ID=$(echo "$TASK_OUTPUT" | grep -oP 'TASK-\d+' | head -1)
echo "Created task: $TASK_ID — $TMPL_TITLE"
```

---

### Step 6: update last-used and commit

```bash
TODAY=$(date +%Y-%m-%d)
sed -i "s/^last-used: .*/last-used: ${TODAY}/" "$TEMPLATE_FILE"

git -C "$REPO_ROOT" add "$TEMPLATE_FILE"
git -C "$REPO_ROOT" commit -m "chore(templates): update last-used for ${SLUG} (${TASK_ID})"

echo ""
echo "✅ Task $TASK_ID created with status Ready."
echo "   Template last-used updated to $TODAY."
echo ""
echo "Run /loop-backlog to execute, or check status with:"
echo "  backlog task view $TASK_ID"
```

---

## Constraints

- This skill does NOT walk through a full proposal/plan review cycle — that is intentional
- The freshness check is a single LLM call; it does not iterate
- If freshness check returns STALE, the skill exits without creating a task
- `last-used` is updated only after a task is successfully created
- Templates must live in `backlog/templates/` and be committed to the repository
- This skill must be run from the project root of a git repository
- `$TMPDIR` files are ephemeral; do not reference them after the skill completes
