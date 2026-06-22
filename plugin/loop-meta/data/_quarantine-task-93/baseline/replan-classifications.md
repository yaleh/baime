# Replan Classifications

Classification of all replan events found in `plugin/loop-meta/data/task-notes/`.
Each replan line has the format: `replan: <category> — <reason>`

---

## Replan Events

### 1. MT-07.md — `impl`

**File:** `plugin/loop-meta/data/task-notes/MT-07.md`
**Category:** `impl`
**Raw reason:** MT-07.2 implementation introduced a mutex that broke MT-07.3 test assumptions; rewrote drift-correction pass without mutex, using atomic status compare-swap instead

**Classification rationale:** The failure originated in the implementation itself — a low-level concurrency primitive (mutex) introduced during MT-07.2 was incompatible with the test harness expectations in MT-07.3. The fix was purely a code-level rewrite (mutex → atomic compare-swap), with no change to the sub-plan structure, meta-plan, or harness. This is a textbook `impl` root cause.

---

### 2. MT-08.md — `sub-plan`

**File:** `plugin/loop-meta/data/task-notes/MT-08.md`
**Category:** `sub-plan`
**Raw reason:** MT-08.3 sub-plan failed to account for schema lock dependency on MT-08.1; revised execution order to run architect review loop design before schema is finalised

**Classification rationale:** The replan was triggered by a missing dependency in the sub-task ordering — MT-08.3 had not accounted for a schema lock produced by MT-08.1. The resolution was to revise the execution order within the sub-plan. No implementation bug or harness constraint was involved; the defect was in how the sub-plan was structured. This is a `sub-plan` root cause.

---

### 3. MT-09.md — `harness`

**File:** `plugin/loop-meta/data/task-notes/MT-09.md`
**Category:** `harness`
**Raw reason:** fan-out requires concurrent Monitor subscriptions but harness enforces a Monitor singleton; no known workaround within current harness constraints; sub-tasks cannot proceed until harness is upgraded

**Classification rationale:** The blocker is an architectural constraint in the execution harness (Monitor singleton) that prevents the required concurrent subscriptions. The sub-tasks are correctly specified and the implementation approach is sound, but the harness cannot support it as currently built. This is a `harness` root cause, and sub-tasks are blocked pending a harness upgrade.

---

### 4. MT-10.md — `infeasible`

**File:** `plugin/loop-meta/data/task-notes/MT-10.md`
**Category:** `infeasible`
**Raw reason:** acceptance criteria require a machine-checked proof of full oracle correctness, but dynamic plugin dispatch makes this undecidable; no known path to complete formal verification without redesigning the oracle to eliminate dynamic dispatch; escalating to human

**Classification rationale:** The acceptance criteria demand formal verification (machine-checked proof) of a property that is undecidable given the current design (dynamic plugin dispatch). There is no implementation or planning fix that resolves this — the requirement itself is infeasible under the current architecture. The replan escalates to human decision. This is an `infeasible` root cause.

---

## Summary Table

| File   | Category   | Short Reason                                        |
|--------|------------|-----------------------------------------------------|
| MT-07  | impl       | Mutex introduced in impl broke test assumptions      |
| MT-08  | sub-plan   | Sub-plan missed schema lock dependency ordering      |
| MT-09  | harness    | Harness Monitor singleton blocks concurrent fan-out  |
| MT-10  | infeasible | Acceptance criteria require undecidable formal proof |

## Root-Cause Counts

| Category   | Count |
|------------|-------|
| impl       | 1     |
| sub-plan   | 1     |
| meta-plan  | 0     |
| harness    | 1     |
| infeasible | 1     |
| **Total**  | **4** |
