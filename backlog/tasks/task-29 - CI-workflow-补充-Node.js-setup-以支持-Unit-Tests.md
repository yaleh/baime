---
id: TASK-29
title: CI workflow 补充 Node.js setup 以支持 Unit Tests
status: "Basic: Done"
assignee: []
created_date: '2026-06-18 06:41'
updated_date: '2026-06-18 06:52'
labels:
  - kind:basic
dependencies: []
ordinal: 3000
---

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Proposal: CI workflow 补充 Node.js setup 以支持 Unit Tests

## Background

TASK-25 added a "=== Unit Tests ===" section to `scripts/validate-plugin.sh` that discovers and runs all `scripts/*.test.js` files via Node.js. However, neither `ci.yml` nor `release.yml` include an explicit `actions/setup-node` step. Both workflows already pin Python to `3.11` via `actions/setup-python`, establishing the precedent that runtime versions must be explicitly locked. The `ubuntu-latest` runner ships a system Node.js whose version is uncontrolled and changes at GitHub's discretion. Without an explicit setup step, CI could silently execute unit tests against an unexpected Node.js version, undermining the reproducibility guarantees that pinned runtimes are meant to provide. As more `.test.js` files are added this gap becomes increasingly risky.

## Goals

1. Both `ci.yml` and `release.yml` explicitly pin Node.js to LTS 22 via `actions/setup-node@v4` so the version used in CI is deterministic and matches a well-supported LTS line.
2. The `setup-node` step is inserted immediately after the existing "Install PyYAML" step and before the `validate-plugin.sh` step in both workflow files, keeping the setup-then-validate ordering consistent.
3. Any future `scripts/*.test.js` file is automatically exercised in CI without additional workflow changes.

## Proposed Approach

Add the following step to both `ci.yml` and `release.yml`, after the "Install PyYAML" step and before the "Run plugin validation" / "Validate plugin" step:

```yaml
- name: Set up Node.js
  uses: actions/setup-node@v4
  with:
    node-version: "22"
```

Node.js 22 is the current Active LTS line (maintenance until April 2027), matching the version most developers are likely running locally. No `package.json` or `npm install` step is needed because the test files are plain Node.js scripts with no external npm dependencies.

## Trade-offs and Risks

- **Not pinning a patch version**: Using `"22"` (rather than e.g. `"22.x.x"`) allows patch-level updates automatically, which is the standard GitHub Actions convention for LTS Node.js and reduces maintenance overhead without meaningful reproducibility risk.
- **No npm dependency caching**: Because the test scripts have no `node_modules`, adding `cache: "npm"` would be misleading and is intentionally omitted.
- **Node.js version drift vs. developer machines**: If a developer's local Node.js version diverges significantly from LTS 22, test behavior could differ, but this is the same trade-off already accepted for Python 3.11.
- **Runner image already includes Node.js**: Adding an explicit setup step may slightly increase job startup time (~5–10 seconds), but this is negligible compared to the reproducibility benefit.

---

# Plan: CI workflow 补充 Node.js setup 以支持 Unit Tests

Proposal: docs/proposals/proposal-ci-nodejs-setup.md

## Phase A: 在 ci.yml 中添加 setup-node 步骤

### Tests (write first)
- `! grep -q "setup-node" .github/workflows/ci.yml`

### Implementation
File to modify: .github/workflows/ci.yml
Add after the "Install PyYAML" step:
```yaml
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
```

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "setup-node" .github/workflows/ci.yml`
- [ ] `grep -q "node-version" .github/workflows/ci.yml`

## Phase B: 在 release.yml 中添加 setup-node 步骤

### Tests (write first)
- `! grep -q "setup-node" .github/workflows/release.yml`

### Implementation
File to modify: .github/workflows/release.yml
Add the same step after "Install PyYAML"

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "setup-node" .github/workflows/release.yml`
- [ ] `grep -q "node-version" .github/workflows/release.yml`

## Constraints
- Node.js version pinned to "22" (current LTS)
- Step inserted after "Install PyYAML", before "Run plugin validation" in both files
- No npm install or cache configuration needed

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "setup-node" .github/workflows/ci.yml`
- [ ] `grep -q "setup-node" .github/workflows/release.yml`
- [ ] `grep -q 'node-version: "22"' .github/workflows/ci.yml`
- [ ] `grep -q 'node-version: "22"' .github/workflows/release.yml`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 2: APPROVED

Proposal approved. Starting plan draft.

Plan review iteration 1: APPROVED

claimed: 2026-06-18T06:50:52Z

workerLoop DoD verified: all 11 commands passed

Completed: 2026-06-18T06:52:47Z
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 grep -q "setup-node" .github/workflows/ci.yml
- [ ] #3 grep -q "node-version" .github/workflows/ci.yml
- [ ] #4 bash scripts/validate-plugin.sh
- [ ] #5 grep -q "setup-node" .github/workflows/release.yml
- [ ] #6 grep -q "node-version" .github/workflows/release.yml
- [ ] #7 bash scripts/validate-plugin.sh
- [ ] #8 grep -q "setup-node" .github/workflows/ci.yml
- [ ] #9 grep -q "setup-node" .github/workflows/release.yml
- [ ] #10 grep -q 'node-version: "22"' .github/workflows/ci.yml
- [ ] #11 grep -q 'node-version: "22"' .github/workflows/release.yml
<!-- DOD:END -->
