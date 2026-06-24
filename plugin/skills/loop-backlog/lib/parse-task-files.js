#!/usr/bin/env node
/**
 * parse-task-files.js
 * Extract file paths from a task description string.
 *
 * Export: parseTaskFiles(description: string) -> string[]
 *   - Returns verified file paths that exist under repoRoot.
 *
 * Usage (CLI): node parse-task-files.js --self-test
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Detect repo root: walk up from __dirname until we find CLAUDE.md or .git
function findRepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'CLAUDE.md')) || fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

const REPO_ROOT = findRepoRoot(path.join(__dirname, '..', '..'));

/**
 * Extract file path candidates from a description string.
 * Matches tokens that start with known prefixes: plugin/, scripts/, docs/,
 * .archguard/, .claude/, experiments/, backlog/
 *
 * @param {string} description - Task description text
 * @param {string} [repoRoot] - Override repo root for testing
 * @returns {string[]} - Array of relative paths that exist on disk
 */
function parseTaskFiles(description, repoRoot) {
  repoRoot = repoRoot || REPO_ROOT;

  // Match path-like tokens starting with known prefixes
  // Allow slashes, dots, hyphens, underscores, alphanumeric, brackets in filename portion
  const PATH_RE = /\b((?:plugin|scripts|docs|\.archguard|\.claude|experiments|backlog)\/[^\s`'"(){},\[\]\\]+)/g;

  const candidates = new Set();
  let m;
  while ((m = PATH_RE.exec(description)) !== null) {
    let candidate = m[1];
    // Strip trailing punctuation that is unlikely part of a path
    candidate = candidate.replace(/[.,;:!?]+$/, '');
    // Strip trailing closing brackets/parens
    candidate = candidate.replace(/[)>\]]+$/, '');
    if (candidate.length > 0) {
      candidates.add(candidate);
    }
  }

  // Verify existence
  const found = [];
  for (const candidate of candidates) {
    const abs = path.join(repoRoot, candidate);
    if (fs.existsSync(abs)) {
      found.push(candidate);
    }
  }

  return found;
}

// ----------- Self-test -----------

const SELF_TEST_CASES = [
  {
    label: 'TASK-183 description (this task)',
    description: `Inject archguard change-risk context into the worker execute prompt at claim time.
Phase 1: create scripts/lib/parse-task-files.js — extract file paths.
Phase 2: create scripts/lib/fetch-risk-context.js — given file list.
Phase 3: integrate into plugin/skills/loop-backlog/SKILL.md.
Phase 4: write docs/research/gcl-predispatch-impact.md.`,
    expectNonEmpty: true,
  },
  {
    label: 'TASK-149 style (loop-backlog notes improvement)',
    description: `loop-backlog 的 executePrompt 位于 plugin/skills/loop-backlog/SKILL.md。
修复三层问题：(A) workerLoop 逐条写 DoD；(B) 放开 --append-notes；
(C) agent-summary 缺失写 WARNING。脚本在 scripts/validate-plugin.sh。`,
    expectNonEmpty: true,
  },
  {
    label: 'TASK-176 style (GCL logging)',
    description: `GCL 完整观测机制。
Phase 1: create docs/research/gcl-events.jsonl schema and append hook.
Phase 2: update scripts/gcl-report.sh to read the jsonl.
Phase 3: integrate into plugin/skills/loop-backlog/SKILL.md gate section.`,
    expectNonEmpty: true,
  },
  {
    label: 'TASK-129 style (daemon hygiene)',
    description: `Daemon 可观测性修复。scripts/daemon-status.sh 检测陈旧 pid。
改动涉及 scripts/loop-backlog-daemon.js 和 docs/adr/ADR-002.md。`,
    expectNonEmpty: true,
  },
  {
    label: 'TASK with .archguard reference',
    description: `Read .archguard/query/git-history/file-metrics.json to build risk index.
See also scripts/lib/fetch-risk-context.js for context injection.`,
    expectNonEmpty: true,
  },
  {
    label: 'TASK-20 style (skill lint)',
    description: `为 plugin/skills/loop-backlog/SKILL.md 实现两阶段校验。
scripts/skill-lint.sh 执行前 manifest 检查，docs/adr/ADR-001.md 记录决策。`,
    expectNonEmpty: true,
  },
  {
    label: 'TASK-27 style (executePrompt)',
    description: `强化 loop-backlog executePrompt 注入执行协议。
目标文件: plugin/skills/loop-backlog/SKILL.md。
验证: bash scripts/validate-plugin.sh。`,
    expectNonEmpty: true,
  },
  {
    label: 'No path references (pure prose)',
    description: `This task is about improving team communication. No specific files are involved.
The team should have a standup every morning.`,
    expectNonEmpty: false,
  },
  {
    label: 'Experiments path reference',
    description: `Run quantitative experiment stored in experiments/skill-quality/exp-h.
Results go to docs/research/exp-h-results.md.`,
    expectNonEmpty: true,
  },
  {
    label: 'Mixed valid and non-existent paths',
    description: `Update plugin/skills/loop-backlog/SKILL.md and scripts/validate-plugin.sh.
Also mention docs/nonexistent-file.md and scripts/does-not-exist.sh.`,
    expectNonEmpty: true, // plugin and scripts paths exist
  },
];

function runSelfTest() {
  console.log('Running parse-task-files self-test...');
  console.log(`Repo root: ${REPO_ROOT}`);
  console.log('');

  let pass = 0;
  let fail = 0;

  for (const tc of SELF_TEST_CASES) {
    const result = parseTaskFiles(tc.description, REPO_ROOT);
    const nonEmpty = result.length > 0;
    const ok = nonEmpty === tc.expectNonEmpty;
    const status = ok ? 'PASS' : 'FAIL';
    if (ok) pass++; else fail++;
    console.log(`[${status}] ${tc.label}`);
    if (result.length > 0) {
      console.log(`       Found: ${result.join(', ')}`);
    } else {
      console.log('       Found: (none)');
    }
    if (!ok) {
      console.log(`       Expected non-empty=${tc.expectNonEmpty}, got non-empty=${nonEmpty}`);
    }
  }

  console.log('');
  console.log(`Results: ${pass}/${SELF_TEST_CASES.length} passed, ${fail} failed`);

  const MIN_PASS = 6;
  if (pass >= MIN_PASS) {
    console.log(`PASS: ${pass} >= ${MIN_PASS} required`);
    process.exit(0);
  } else {
    console.log(`FAIL: ${pass} < ${MIN_PASS} required`);
    process.exit(1);
  }
}

// CLI entry point
if (require.main === module) {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
  } else {
    // Read description from stdin or first arg
    const desc = process.argv[2] || '';
    const files = parseTaskFiles(desc);
    console.log(JSON.stringify(files));
  }
}

module.exports = { parseTaskFiles };
