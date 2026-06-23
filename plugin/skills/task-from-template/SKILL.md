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
  --status "Basic: Ready" \
  --label "kind:basic" \
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
