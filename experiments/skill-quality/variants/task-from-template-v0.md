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
