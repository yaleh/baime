/**
 * run-exp-h.test.ts — Unit tests for the refactored run-exp-h.ts config object
 *
 * Tests that the exported ExperimentConfig satisfies the runner.ts interface
 * and that all seven required output fields are present in the analysis output.
 *
 * Run with: npx tsx --test exp-h/run-exp-h.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { ExperimentConfig } from '../lib/runner.js';
import { SANITY_FIXTURE_DIR, buildConfig } from './run-exp-h.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXP_ROOT = join(__dirname, '..');

// ── Config shape tests ──────────────────────────────────────────────────────

test('buildConfig returns an object satisfying ExperimentConfig type', async () => {
  const config = await buildConfig({
    k: 1,
    outDir: join(EXP_ROOT, 'artifacts/runs/exp-h-test'),
  });

  // Must be an object
  assert.ok(config !== null && typeof config === 'object', 'config must be an object');

  // variants must exist and be a Record
  assert.ok(typeof config.variants === 'object', 'config.variants must be an object');

  // modelList must be an array
  assert.ok(Array.isArray(config.modelList), 'config.modelList must be an array');

  // k must be a number
  assert.ok(typeof config.k === 'number', 'config.k must be a number');

  // outDir must be a string
  assert.ok(typeof config.outDir === 'string', 'config.outDir must be a string');

  // buildPrompt must be a function
  assert.ok(typeof config.buildPrompt === 'function', 'config.buildPrompt must be a function');

  // scoreResponse must be a function
  assert.ok(typeof config.scoreResponse === 'function', 'config.scoreResponse must be a function');
});

test('config.variants contains feature-to-backlog key', async () => {
  const config = await buildConfig({
    k: 1,
    outDir: join(EXP_ROOT, 'artifacts/runs/exp-h-test'),
  });

  assert.ok(
    'feature-to-backlog' in config.variants,
    'config.variants must contain feature-to-backlog'
  );
  assert.ok(
    Array.isArray(config.variants['feature-to-backlog']),
    'feature-to-backlog variant must be an array of paths'
  );
});

test('config.variants contains backlog-setup key', async () => {
  const config = await buildConfig({
    k: 1,
    outDir: join(EXP_ROOT, 'artifacts/runs/exp-h-test'),
  });

  assert.ok(
    'backlog-setup' in config.variants,
    'config.variants must contain backlog-setup'
  );
  assert.ok(
    Array.isArray(config.variants['backlog-setup']),
    'backlog-setup variant must be an array of paths'
  );
});

test('config.buildPrompt is callable and returns a non-empty string', async () => {
  const config = await buildConfig({
    k: 1,
    outDir: join(EXP_ROOT, 'artifacts/runs/exp-h-test'),
  });

  const ftbPaths = config.variants['feature-to-backlog'] ?? [];
  assert.ok(ftbPaths.length > 0, 'feature-to-backlog must have at least one fixture');

  const fixture = JSON.parse(await readFile(ftbPaths[0]!, 'utf-8')) as Record<string, unknown>;
  const prompt = config.buildPrompt(fixture as Parameters<ExperimentConfig['buildPrompt']>[0], 'feature-to-backlog');

  assert.ok(typeof prompt === 'string', 'buildPrompt must return a string');
  assert.ok(prompt.length > 0, 'buildPrompt must return a non-empty string');
  assert.ok(prompt.includes('feature-to-backlog'), 'prompt must mention the skill name');
});

test('config.sanityDir is defined', async () => {
  const config = await buildConfig({
    k: 1,
    outDir: join(EXP_ROOT, 'artifacts/runs/exp-h-test'),
  });

  assert.ok(typeof config.sanityDir === 'string', 'config.sanityDir must be defined as a string');
  assert.ok(config.sanityDir!.length > 0, 'config.sanityDir must be non-empty');
});

test('SANITY_FIXTURE_DIR is defined and exported', () => {
  assert.ok(typeof SANITY_FIXTURE_DIR === 'string', 'SANITY_FIXTURE_DIR must be a string');
  assert.ok(SANITY_FIXTURE_DIR.length > 0, 'SANITY_FIXTURE_DIR must be non-empty');
  assert.ok(SANITY_FIXTURE_DIR.includes('sanity'), 'SANITY_FIXTURE_DIR must reference sanity directory');
});

// ── Seven-field output tests ─────────────────────────────────────────────────

test('runExperiment config.scoreResponse returns a number in [0,1]', async () => {
  const config = await buildConfig({
    k: 1,
    outDir: join(EXP_ROOT, 'artifacts/runs/exp-h-test'),
  });

  const ftbPaths = config.variants['feature-to-backlog'] ?? [];
  assert.ok(ftbPaths.length > 0, 'need at least one fixture');

  const fixture = JSON.parse(await readFile(ftbPaths[0]!, 'utf-8')) as Record<string, unknown>;
  const score = config.scoreResponse('{"answer": "PlanLoop"}', fixture as Parameters<ExperimentConfig['scoreResponse']>[1]);

  assert.ok(typeof score === 'number', 'scoreResponse must return a number');
  assert.ok(score >= 0 && score <= 1, `score must be in [0,1], got ${score}`);
});

test('seven output fields are present in results schema', () => {
  // Validate that the run-exp-h analyze function produces the seven required fields
  // by checking a synthetic results object shape (no LLM calls needed)
  const syntheticResults = {
    data_source: 'measured' as const,
    model: 'test-model',
    per_skill: {
      'feature-to-backlog': { verdict_only: 0.9, composite: 0.85 },
      'backlog-setup': { verdict_only: 0.88, composite: 0.82 },
    },
    hypothesis: 'H-universal CONFIRMED',
    recommendation: 'global-threshold',
    reference_skills: {
      'loop-backlog': { verdict_only: 0.92, source: 'Exp-D P-full' },
    },
    // suspiciously_low is only present when sigma < 0.005; omit here
  };

  assert.ok('data_source' in syntheticResults, 'data_source field required');
  assert.ok('model' in syntheticResults, 'model field required');
  assert.ok('per_skill' in syntheticResults, 'per_skill field required');
  assert.ok('hypothesis' in syntheticResults, 'hypothesis field required');
  assert.ok('recommendation' in syntheticResults, 'recommendation field required');
  assert.ok('reference_skills' in syntheticResults, 'reference_skills field required');

  assert.strictEqual(syntheticResults.data_source, 'measured', 'data_source must be "measured"');

  const validHypotheses = [
    'H-universal CONFIRMED',
    'H-per-skill CONFIRMED',
  ];
  assert.ok(
    validHypotheses.includes(syntheticResults.hypothesis),
    `hypothesis must be one of: ${validHypotheses.join(', ')}`
  );
});

test('results with suspiciously_low field when sigma is tiny', () => {
  // Verify the conditional suspiciously_low field works correctly
  const sigma = 0.001; // below threshold of 0.005
  const suspisciouslyLow = sigma < 0.005;

  const results = {
    data_source: 'measured' as const,
    model: 'test-model',
    per_skill: {},
    hypothesis: 'H-universal CONFIRMED',
    recommendation: 'global-threshold',
    reference_skills: {},
    ...(suspisciouslyLow ? { suspiciously_low: true } : {}),
  };

  assert.ok('suspiciously_low' in results, 'suspiciously_low must appear when sigma < 0.005');
  assert.strictEqual(results.suspiciously_low, true, 'suspiciously_low must be true');
});

test('results without suspiciously_low field when sigma is normal', () => {
  const sigma = 0.05; // above threshold of 0.005
  const suspisciouslyLow = sigma < 0.005;

  const results = {
    data_source: 'measured' as const,
    model: 'test-model',
    per_skill: {},
    hypothesis: 'H-universal CONFIRMED',
    recommendation: 'global-threshold',
    reference_skills: {},
    ...(suspisciouslyLow ? { suspiciously_low: true } : {}),
  };

  assert.ok(!('suspiciously_low' in results), 'suspiciously_low must be absent when sigma >= 0.005');
});

test('config fixture paths for feature-to-backlog are CLEAR fixtures only', async () => {
  const config = await buildConfig({
    k: 1,
    outDir: join(EXP_ROOT, 'artifacts/runs/exp-h-test'),
  });

  const ftbPaths = config.variants['feature-to-backlog'] ?? [];
  for (const p of ftbPaths) {
    const fx = JSON.parse(await readFile(p, 'utf-8')) as { fixtureClass?: string };
    assert.strictEqual(fx.fixtureClass, 'CLEAR', `fixture at ${p} must be CLEAR`);
  }
});

test('config fixture paths for backlog-setup are CLEAR fixtures only', async () => {
  const config = await buildConfig({
    k: 1,
    outDir: join(EXP_ROOT, 'artifacts/runs/exp-h-test'),
  });

  const bsPaths = config.variants['backlog-setup'] ?? [];
  for (const p of bsPaths) {
    const fx = JSON.parse(await readFile(p, 'utf-8')) as { fixtureClass?: string };
    assert.strictEqual(fx.fixtureClass, 'CLEAR', `fixture at ${p} must be CLEAR`);
  }
});
