/**
 * runner.test.ts — Unit tests for the generic experiment runner.
 * Uses Node built-in test runner (npx tsx --test).
 * All LLM calls use a mock client — no real API calls.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runExperiment, computeWilsonCI, ExperimentConfig, LlmClient } from './runner.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

class MockClientTracker {
  calls = 0;
  client: LlmClient;
  constructor(responseFactory: (call: number) => string = () => '{"answer":"yes"}') {
    this.client = {
      chat: async () => {
        const content = responseFactory(this.calls);
        this.calls++;
        return { content };
      },
    };
  }
}

async function writeTmpFixture(dir: string, id: string, extra: Record<string, unknown> = {}): Promise<string> {
  const path = join(dir, `${id}.json`);
  await writeFile(path, JSON.stringify({ id, fixtureClass: 'CLEAR', answer: 'yes', ...extra }));
  return path;
}

function makeConfig(
  overrides: Partial<ExperimentConfig> & { outDir: string; variants: Record<string, string[]> },
): ExperimentConfig {
  return {
    modelList: ['model-a'],
    k: 3,
    buildPrompt: (fixture, _variant) => `prompt for ${fixture.id}`,
    scoreResponse: (response, _fixture) => (response.includes('yes') ? 1 : 0),
    ...overrides,
  };
}

// ── Phase A: Core traversal, checkpoint/resume ────────────────────────────────

describe('Phase A — core traversal', () => {
  test('runs each fixture×model×k cell once', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    const fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir);

    const f1 = await writeTmpFixture(fixtureDir, 'fix-1');
    const f2 = await writeTmpFixture(fixtureDir, 'fix-2');

    let calls = 0;
    const realClient: LlmClient = {
      async chat() { calls++; return { content: '{"answer":"yes"}' }; },
    };

    const outDir = join(tmpDir, 'out');
    const config = makeConfig({
      variants: { 'v-a': [f1, f2] },
      modelList: ['model-x'],
      k: 2,
      outDir,
      llmClient: realClient,
    });

    const result = await runExperiment(config);

    // 2 fixtures × 1 model × k=2 = 4 calls
    assert.equal(calls, 4, `expected 4 LLM calls, got ${calls}`);
    assert.equal(result.totalCells, 2, 'totalCells should be 2');
    assert.equal(result.completedCells, 2, 'completedCells should be 2');
    assert.equal(result.data_source, 'measured');

    await rm(tmpDir, { recursive: true });
  });

  test('checkpoint: existing result.json with k responses → LLM NOT called for that cell', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    const fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir);
    const f1 = await writeTmpFixture(fixtureDir, 'fix-chk');

    const outDir = join(tmpDir, 'out');
    // Pre-write a completed result (model slug: model-x → model-x, hyphens preserved)
    const runDir = join(outDir, 'v-chk', 'model-x', 'fix-chk');
    await mkdir(runDir, { recursive: true });
    const existingResult = {
      variant: 'v-chk',
      fixtureId: 'fix-chk',
      model: 'model-x',
      firstCallUtc: '2024-01-01T00:00:00.000Z',
      responses: ['res-1', 'res-2', 'res-3'],
      data_source: 'measured',
      scores: [1, 1, 1],
      meanScore: 1,
      wilsonCI: { low: 0, high: 1 },
    };
    await writeFile(join(runDir, 'result.json'), JSON.stringify(existingResult));

    let calls = 0;
    const mockClient: LlmClient = {
      async chat() { calls++; return { content: 'ignored' }; },
    };

    const config = makeConfig({
      variants: { 'v-chk': [f1] },
      modelList: ['model-x'],
      k: 3,
      outDir,
      llmClient: mockClient,
    });

    await runExperiment(config);
    assert.equal(calls, 0, `Expected 0 LLM calls for fully checkpointed cell, got ${calls}`);

    await rm(tmpDir, { recursive: true });
  });

  test('partial checkpoint: result.json has 2/5 responses → only 3 more calls made', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    const fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir);
    const f1 = await writeTmpFixture(fixtureDir, 'fix-partial');

    const outDir = join(tmpDir, 'out');
    // model-p slug: hyphens preserved → model-p
    const runDir = join(outDir, 'v-partial', 'model-p', 'fix-partial');
    await mkdir(runDir, { recursive: true });
    const partial = {
      responses: ['r1', 'r2'],
      firstCallUtc: '2024-01-01T00:00:00.000Z',
      data_source: 'measured',
    };
    await writeFile(join(runDir, 'result.json'), JSON.stringify(partial));

    let calls = 0;
    const mockClient: LlmClient = {
      async chat() { calls++; return { content: '{"answer":"yes"}' }; },
    };

    const config = makeConfig({
      variants: { 'v-partial': [f1] },
      modelList: ['model-p'],
      k: 5,
      outDir,
      llmClient: mockClient,
    });

    await runExperiment(config);
    assert.equal(calls, 3, `Expected 3 LLM calls for partially checkpointed cell (2/5 done), got ${calls}`);

    await rm(tmpDir, { recursive: true });
  });

  test('empty fixture list → completes with zero cells, no error', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    const outDir = join(tmpDir, 'out');

    let calls = 0;
    const mockClient: LlmClient = {
      async chat() { calls++; return { content: '' }; },
    };

    const config = makeConfig({
      variants: { 'v-empty': [] },
      modelList: ['model-a'],
      k: 3,
      outDir,
      llmClient: mockClient,
    });

    const result = await runExperiment(config);
    assert.equal(calls, 0);
    assert.equal(result.totalCells, 0);
    assert.equal(result.completedCells, 0);

    await rm(tmpDir, { recursive: true });
  });

  test('missing fixture file → throws with descriptive error', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    const outDir = join(tmpDir, 'out');

    const missingPath = join(tmpDir, 'nonexistent-fixture.json');

    const mockClient: LlmClient = {
      async chat() { return { content: '' }; },
    };

    const config = makeConfig({
      variants: { 'v-miss': [missingPath] },
      modelList: ['model-a'],
      k: 1,
      outDir,
      llmClient: mockClient,
    });

    await assert.rejects(
      () => runExperiment(config),
      (err: Error) => {
        assert.ok(err.message.includes('nonexistent-fixture'), `Error should mention missing file, got: ${err.message}`);
        return true;
      },
    );

    await rm(tmpDir, { recursive: true });
  });
});

// ── Phase B: Wilson CI, fixtureClass grouping, mirrors_role, annotation_kappa ─

describe('Phase B — Wilson CI and analysis', () => {
  test('computeWilsonCI: 4/5 correct → CI contains 0.8', () => {
    const ci = computeWilsonCI(5, 4);
    assert.ok(ci.low <= 0.8, `CI low (${ci.low}) should be ≤ 0.8`);
    assert.ok(ci.high >= 0.8, `CI high (${ci.high}) should be ≥ 0.8`);
    assert.ok(ci.low >= 0, `CI low should be >= 0`);
    assert.ok(ci.high <= 1, `CI high should be <= 1`);
  });

  test('computeWilsonCI: 0/5 → CI [0, upper] with upper > 0', () => {
    const ci = computeWilsonCI(5, 0);
    assert.equal(ci.low, 0, 'lower bound should be 0 for 0 successes');
    assert.ok(ci.high > 0, `upper bound (${ci.high}) should be > 0`);
    assert.ok(ci.high <= 1, `upper bound (${ci.high}) should be <= 1`);
  });

  test('fixtureClass grouping: CLEAR and AMBIGUOUS fixtures scored separately', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    const fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir);

    // 2 CLEAR fixtures always answered "yes" (score 1), 1 AMBIGUOUS answered "no" (score 0)
    const fClear1 = await writeTmpFixture(fixtureDir, 'clear-1', { fixtureClass: 'CLEAR' });
    const fClear2 = await writeTmpFixture(fixtureDir, 'clear-2', { fixtureClass: 'CLEAR' });
    const fAmb = await writeTmpFixture(fixtureDir, 'ambiguous-1', { fixtureClass: 'AMBIGUOUS' });

    const outDir = join(tmpDir, 'out');

    const mockClient: LlmClient = {
      async chat(req) {
        // Distinguish by prompt content
        if (req.messages[0]?.content.includes('ambiguous')) {
          return { content: 'no' };
        }
        return { content: 'yes' };
      },
    };

    const config: ExperimentConfig = {
      variants: { 'v-cls': [fClear1, fClear2, fAmb] },
      modelList: ['model-a'],
      k: 1,
      outDir,
      llmClient: mockClient,
      buildPrompt: (fixture, _variant) => `prompt for ${fixture.id} (${fixture.fixtureClass})`,
      scoreResponse: (response, _fixture) => (response.includes('yes') ? 1 : 0),
    };

    const result = await runExperiment(config);
    const vSummary = result.variants['v-cls']!;
    assert.ok(vSummary, 'variant summary should exist');

    const clearSummary = vSummary.fixtureClasses['CLEAR'];
    const ambSummary = vSummary.fixtureClasses['AMBIGUOUS'];

    assert.ok(clearSummary, 'CLEAR class summary should exist');
    assert.ok(ambSummary, 'AMBIGUOUS class summary should exist');

    // CLEAR fixtures should score high, AMBIGUOUS low
    assert.ok(clearSummary.meanScore > 0.5, `CLEAR mean score (${clearSummary.meanScore}) should be > 0.5`);
    assert.ok(ambSummary.meanScore < 0.5, `AMBIGUOUS mean score (${ambSummary.meanScore}) should be < 0.5`);

    await rm(tmpDir, { recursive: true });
  });

  test('mirrors_role: fixture with mirrors_role field threaded to prompt builder', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    const fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir);

    const fMirror = await writeTmpFixture(fixtureDir, 'mirror-1', {
      fixtureClass: 'CLEAR',
      mirrors_role: 'reviewer',
    });

    const outDir = join(tmpDir, 'out');
    const capturedRoles: (string | undefined)[] = [];

    const mockClient: LlmClient = {
      async chat() { return { content: 'yes' }; },
    };

    const config: ExperimentConfig = {
      variants: { 'v-mirror': [fMirror] },
      modelList: ['model-a'],
      k: 1,
      outDir,
      llmClient: mockClient,
      buildPrompt: (fixture, _variant) => {
        // Thread mirrors_role into prompt if present
        capturedRoles.push(fixture.mirrors_role as string | undefined);
        return `prompt for ${fixture.id} role=${fixture.mirrors_role ?? 'none'}`;
      },
      scoreResponse: () => 1,
    };

    await runExperiment(config);

    assert.equal(capturedRoles.length, 1, 'buildPrompt should be called once');
    assert.equal(capturedRoles[0], 'reviewer', 'mirrors_role should be threaded to buildPrompt');

    await rm(tmpDir, { recursive: true });
  });

  test('annotation_kappa WARN: agreement < 0.6 → WARN logged', async () => {
    // annotation_kappa warning is issued when the fixture has a kappa < 0.6
    const tmpDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    const fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir);

    // Fixture with annotation_kappa < 0.6
    const fLowKappa = join(fixtureDir, 'low-kappa.json');
    await writeFile(fLowKappa, JSON.stringify({
      id: 'low-kappa-01',
      fixtureClass: 'AMBIGUOUS',
      answer: 'yes',
      annotation_kappa: 0.4,
    }));

    const outDir = join(tmpDir, 'out');
    const warnMessages: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnMessages.push(args.map(String).join(' '));
    };

    try {
      const mockClient: LlmClient = {
        async chat() { return { content: 'yes' }; },
      };

      const config: ExperimentConfig = {
        variants: { 'v-kappa': [fLowKappa] },
        modelList: ['model-a'],
        k: 1,
        outDir,
        llmClient: mockClient,
        buildPrompt: (fixture, _variant) => {
          // Emit WARN for low annotation_kappa
          const kappa = fixture.annotation_kappa as number | undefined;
          if (kappa !== undefined && kappa < 0.6) {
            console.warn(`WARN: annotation_kappa=${kappa} < 0.6 for fixture ${fixture.id} — low inter-annotator agreement`);
          }
          return `prompt for ${fixture.id}`;
        },
        scoreResponse: () => 1,
      };

      await runExperiment(config);

      const hasKappaWarn = warnMessages.some(m => m.includes('annotation_kappa') && m.includes('0.4'));
      assert.ok(hasKappaWarn, `Expected WARN about annotation_kappa=0.4, got: ${JSON.stringify(warnMessages)}`);
    } finally {
      console.warn = originalWarn;
      await rm(tmpDir, { recursive: true });
    }
  });
});

// ── Phase C: Sanity fixtures and data_source guard ────────────────────────────

describe('Phase C — sanity fixtures and data_source guard', () => {
  test('sanity fixture scores 0/k → WARN about negative control failure', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    const sanityDir = join(tmpDir, 'sanity');
    await mkdir(sanityDir);

    const fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir);
    const f1 = await writeTmpFixture(fixtureDir, 'fix-a');

    // Sanity fixture that always fails (model returns "no", expected "yes")
    await writeFile(join(sanityDir, 'sanity-01.json'), JSON.stringify({
      id: 'sanity-01',
      fixtureClass: 'CLEAR',
      answer: 'yes',
    }));

    const outDir = join(tmpDir, 'out');
    const warnMessages: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnMessages.push(args.map(String).join(' '));
    };

    try {
      const mockClient: LlmClient = {
        async chat() { return { content: 'no' }; }, // always fails sanity
      };

      const config: ExperimentConfig = {
        variants: { 'v-sanity': [f1] },
        modelList: ['model-a'],
        k: 1,
        sanityDir,
        outDir,
        llmClient: mockClient,
        buildPrompt: (fixture, _variant) => `prompt for ${fixture.id}`,
        scoreResponse: (response, _fixture) => (response.includes('yes') ? 1 : 0),
      };

      await runExperiment(config);

      const hasSanityWarn = warnMessages.some(m =>
        m.toLowerCase().includes('sanity') || m.toLowerCase().includes('negative control'),
      );
      assert.ok(hasSanityWarn, `Expected sanity/negative-control WARN, got: ${JSON.stringify(warnMessages)}`);
    } finally {
      console.warn = originalWarn;
      await rm(tmpDir, { recursive: true });
    }
  });

  test('no sanity dir → proceeds without error', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    const fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir);
    const f1 = await writeTmpFixture(fixtureDir, 'fix-a');
    const outDir = join(tmpDir, 'out');

    const mockClient: LlmClient = {
      async chat() { return { content: 'yes' }; },
    };

    // sanityDir not set → no error
    const config: ExperimentConfig = {
      variants: { 'v-nosanity': [f1] },
      modelList: ['model-a'],
      k: 1,
      outDir,
      llmClient: mockClient,
      buildPrompt: (fixture, _variant) => `prompt for ${fixture.id}`,
      scoreResponse: () => 1,
    };

    const result = await runExperiment(config);
    assert.equal(result.completedCells, 1);

    await rm(tmpDir, { recursive: true });
  });

  test('allowEstimated: true in config → throws Error containing "data_source: estimated"', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'runner-test-'));
    const outDir = join(tmpDir, 'out');

    const mockClient: LlmClient = {
      async chat() { return { content: '' }; },
    };

    const config: ExperimentConfig = {
      variants: {},
      modelList: [],
      k: 1,
      outDir,
      llmClient: mockClient,
      buildPrompt: () => '',
      scoreResponse: () => 0,
      allowEstimated: true,
    };

    await assert.rejects(
      () => runExperiment(config),
      (err: Error) => {
        assert.ok(
          err.message.includes('data_source') && err.message.includes('estimated'),
          `Error should mention "data_source" and "estimated", got: ${err.message}`,
        );
        return true;
      },
    );

    await rm(tmpDir, { recursive: true });
  });
});
