#!/usr/bin/env node
/**
 * fetch-risk-context.js
 * Given a list of file paths, fetch archguard change-risk metrics and
 * return a Markdown block suitable for injection into a worker execute prompt.
 *
 * Export: fetchRiskContext(files: string[], repoRoot?: string) -> string
 *   - Returns a Markdown block ("## Archguard Risk Context") or empty string.
 *
 * Usage (CLI): node fetch-risk-context.js --self-test
 */

'use strict';

const fs = require('fs');
const path = require('path');

const METRICS_REL = '.archguard/query/git-history/file-metrics.json';
const COCHANGE_MIN_STRENGTH = 0.2;
// MCP fallback cap: max files per call to keep latency < 3s
const MAX_FILES_MCP = 3;

// Detect repo root
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
 * Load and index the file-metrics.json file.
 * Returns a Map<string, object> keyed by file path, or null if unavailable.
 *
 * @param {string} repoRoot
 * @returns {Map<string, object> | null}
 */
function loadMetricsIndex(repoRoot) {
  const metricsPath = path.join(repoRoot, METRICS_REL);
  if (!fs.existsSync(metricsPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(metricsPath, 'utf8');
    const data = JSON.parse(raw);
    const index = new Map();
    // Support both array of records and object-keyed formats
    const items = Array.isArray(data) ? data : Object.values(data);
    for (const item of items) {
      const key = item.filePath || item.path || item.file;
      if (key) {
        index.set(key, item);
      }
    }
    return index;
  } catch (e) {
    // Malformed JSON — treat as unavailable
    return null;
  }
}

/**
 * Format a single file's risk metrics as a Markdown table row.
 *
 * @param {string} filePath
 * @param {object} metrics
 * @returns {string}
 */
function formatFileRow(filePath, metrics) {
  const commitCount = metrics.commitCount != null ? metrics.commitCount : 'N/A';
  const activeDays = metrics.activeDays != null ? metrics.activeDays : 'N/A';
  const neighbors = (metrics.topCochangeNeighbors || [])
    .filter(n => (n.strength || 0) >= COCHANGE_MIN_STRENGTH)
    .slice(0, 3)
    .map(n => `${n.filePath || n.path || n.file} (${n.strength.toFixed(2)})`)
    .join(', ') || 'none';

  return `| \`${filePath}\` | ${commitCount} | ${activeDays} | ${neighbors} |`;
}

/**
 * Given a list of file paths, read archguard metrics and return a Markdown block.
 * Returns empty string when:
 *   - files list is empty
 *   - metrics file is unavailable (non-blocking / advisory)
 *   - no metrics found for any of the provided files
 *
 * @param {string[]} files - Relative file paths
 * @param {string} [repoRoot] - Override repo root for testing
 * @returns {string} - Markdown block or empty string
 */
function fetchRiskContext(files, repoRoot) {
  repoRoot = repoRoot || REPO_ROOT;

  if (!files || files.length === 0) {
    return '';
  }

  const index = loadMetricsIndex(repoRoot);
  if (index === null) {
    // Metrics file unavailable — advisory, non-blocking
    // Return empty so the caller can omit the block
    return '';
  }

  const rows = [];
  for (const filePath of files) {
    // Normalize: strip leading ./
    const normalized = filePath.replace(/^\.\//, '');
    const metrics = index.get(normalized) || index.get(filePath);
    if (metrics) {
      rows.push(formatFileRow(normalized, metrics));
    }
  }

  if (rows.length === 0) {
    return '';
  }

  const lines = [
    '## Archguard Risk Context',
    '',
    '> Source: `.archguard/query/git-history/file-metrics.json` (advisory, non-blocking)',
    '',
    '| File | Commits | Active Days | Top Co-change Neighbors (strength ≥ 0.2) |',
    '|------|---------|-------------|------------------------------------------|',
    ...rows,
    '',
  ];

  return lines.join('\n');
}

// ----------- Self-test -----------

function runSelfTest() {
  console.log('Running fetch-risk-context self-test...');
  console.log(`Repo root: ${REPO_ROOT}`);
  console.log('');

  let pass = 0;
  let fail = 0;

  // Test 1: empty file list always returns empty string
  {
    const result = fetchRiskContext([], REPO_ROOT);
    const ok = result === '';
    console.log(`[${ok ? 'PASS' : 'FAIL'}] Empty file list returns empty string`);
    if (ok) pass++; else { fail++; console.log(`       Got: ${JSON.stringify(result)}`); }
  }

  // Test 2: null/undefined file list returns empty string
  {
    const result = fetchRiskContext(null, REPO_ROOT);
    const ok = result === '';
    console.log(`[${ok ? 'PASS' : 'FAIL'}] Null file list returns empty string`);
    if (ok) pass++; else { fail++; console.log(`       Got: ${JSON.stringify(result)}`); }
  }

  // Test 3: when metrics file is missing, returns empty string (non-blocking)
  {
    const fakeRoot = '/tmp/baime-test-nonexistent-' + Date.now();
    const result = fetchRiskContext(['plugin/skills/loop-backlog/SKILL.md'], fakeRoot);
    const ok = result === '';
    console.log(`[${ok ? 'PASS' : 'FAIL'}] Missing metrics file returns empty string (non-blocking)`);
    if (ok) pass++; else { fail++; console.log(`       Got: ${JSON.stringify(result)}`); }
  }

  // Test 4: with synthetic metrics data
  {
    const tmpDir = '/tmp/baime-fetch-risk-test-' + Date.now();
    const archguardDir = path.join(tmpDir, '.archguard', 'query', 'git-history');
    fs.mkdirSync(archguardDir, { recursive: true });
    const metricsData = [
      {
        filePath: 'plugin/skills/loop-backlog/SKILL.md',
        commitCount: 42,
        activeDays: 15,
        topCochangeNeighbors: [
          { filePath: 'scripts/validate-plugin.sh', strength: 0.75 },
          { filePath: 'docs/adr/ADR-001.md', strength: 0.10 }, // below threshold, should be excluded
        ],
      },
    ];
    fs.writeFileSync(path.join(archguardDir, 'file-metrics.json'), JSON.stringify(metricsData));

    const result = fetchRiskContext(['plugin/skills/loop-backlog/SKILL.md'], tmpDir);
    const ok = result.includes('## Archguard Risk Context') &&
               result.includes('plugin/skills/loop-backlog/SKILL.md') &&
               result.includes('42') &&
               result.includes('15') &&
               result.includes('scripts/validate-plugin.sh') &&
               !result.includes('ADR-001.md'); // below 0.2 threshold
    console.log(`[${ok ? 'PASS' : 'FAIL'}] Synthetic metrics: correct block with co-change filter`);
    if (ok) pass++; else {
      fail++;
      console.log(`       Got:\n${result}`);
    }

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Test 5: no matching files in metrics returns empty string
  {
    const tmpDir = '/tmp/baime-fetch-risk-test2-' + Date.now();
    const archguardDir = path.join(tmpDir, '.archguard', 'query', 'git-history');
    fs.mkdirSync(archguardDir, { recursive: true });
    const metricsData = [
      {
        filePath: 'some/other/file.js',
        commitCount: 5,
        activeDays: 2,
        topCochangeNeighbors: [],
      },
    ];
    fs.writeFileSync(path.join(archguardDir, 'file-metrics.json'), JSON.stringify(metricsData));

    const result = fetchRiskContext(['plugin/skills/loop-backlog/SKILL.md'], tmpDir);
    const ok = result === '';
    console.log(`[${ok ? 'PASS' : 'FAIL'}] No matching files in metrics returns empty string`);
    if (ok) pass++; else {
      fail++;
      console.log(`       Got: ${JSON.stringify(result)}`);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Test 6: with real repo — metrics file is missing, but function is non-blocking
  {
    const result = fetchRiskContext(['plugin/skills/loop-backlog/SKILL.md'], REPO_ROOT);
    // Either empty (no metrics) or a valid block — both are acceptable
    const ok = typeof result === 'string';
    console.log(`[${ok ? 'PASS' : 'FAIL'}] Real repo call returns string (metrics=${result.length > 0 ? 'found' : 'not found'})`);
    if (ok) pass++; else { fail++; }
    if (result.length > 0) {
      console.log('       Archguard metrics available — block generated');
    }
  }

  console.log('');
  console.log(`Results: ${pass}/6 passed, ${fail} failed`);

  if (fail === 0) {
    console.log('PASS: all tests passed');
    process.exit(0);
  } else {
    console.log('FAIL: some tests failed');
    process.exit(1);
  }
}

// CLI entry point
if (require.main === module) {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
  } else {
    // Read JSON array of files from stdin or args
    const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
    const result = fetchRiskContext(files);
    process.stdout.write(result);
  }
}

module.exports = { fetchRiskContext, loadMetricsIndex };
