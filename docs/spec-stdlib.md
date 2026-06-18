# Skill Spec Standard Library (spec-stdlib)

Canonical Haskell-style specifications for functions shared across multiple BAIME skills.
Skill SKILL.md files reference these definitions with `-- see spec-stdlib § <Function>`.

**Scope**: This file defines the specification layer only. Bash implementation code lives
in each skill's SKILL.md `## Implementation` section and is not duplicated here.

---

## detectLang

Detects the primary language of the repository.

```haskell
detectLang :: () → Lang

data Lang = Node | Go | Rust | Python | Unknown

detectLang() =
  | exists("package.json")                           → Node
  | exists("go.mod")                                 → Go
  | exists("Cargo.toml")                             → Rust
  | exists("pyproject.toml") ∨ exists("setup.py")   → Python
  | otherwise                                        → Unknown
```

**Used by**: `feature-to-backlog`, `loop-backlog`

---

## loadConfig

Loads per-skill configuration from CLAUDE.md or auto-detects from project files.

```haskell
loadConfig :: () → Config

-- Superset Config covering all skills; each skill narrows to the fields it uses.
data Config = Config
  { symlinks    : [Path]   -- dirs to symlink into worktree (loop-backlog)
  , maxParallel : Int      -- max concurrent agents (loop-backlog; default 2)
  , testCmd     : Cmd      -- single-test command (feature-to-backlog, task-to-backlog)
  , testAll     : Cmd      -- full-test command
  , docPath     : Path     -- documentation output path
  }

loadConfig() =
  | fromClaudeMd()   -- explicit: reads from "## L0 Config" section in CLAUDE.md
  | autoDetect()     -- implicit: probe package.json, go.mod, Cargo.toml, etc.

autoDetect :: () → Config
autoDetect() = case detectLang() of  -- see spec-stdlib § detectLang
  | Node    → { testCmd: "npm test", testAll: "npm test", symlinks: ["node_modules"] }
  | Go      → { testCmd: "go test ./...", testAll: "go test ./..." }
  | Rust    → { testCmd: "cargo test", testAll: "cargo test" }
  | Python  → { testCmd: "pytest", testAll: "pytest" }
  | _       → { }
```

**Skill-specific instantiations**:
| Skill | Fields used |
|-------|-------------|
| `feature-to-backlog` | `testCmd`, `testAll`, `docPath` |
| `task-to-backlog` | `docPath` |
| `loop-backlog` | `symlinks`, `maxParallel` |

---

## reviewLoop

Iterative review loop: presents a document to a reviewer agent until it is approved or
the round limit is reached.

```haskell
reviewLoop :: (Task, Doc, MaxRounds) → ApprovedDoc

data ReviewOutcome = Approved Doc | NeedsRevision Feedback | Escalated Reason

reviewLoop(task, doc, maxRounds) =
  | round > maxRounds → escalate(task, "review did not converge after " + maxRounds + " rounds")
  | otherwise →
      feedback: reviewAgent(task, doc),
      case feedback of
        | Approved d      → return d
        | NeedsRevision f → reviewLoop(task, revise(doc, f), maxRounds, round + 1)
        | Escalated r     → escalate(task, r)
```

**Skill-specific instantiations**:
| Skill | MaxRounds | Doc type |
|-------|-----------|----------|
| `feature-to-backlog` | 8 | Proposal / Plan |
| `task-to-backlog` | 4 | Plan |
