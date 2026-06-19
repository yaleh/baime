/**
 * run-exp-a.ts — Exp-A: P3 ablation on task-from-template freshnessCheck
 *
 * Usage:
 *   npx tsx scripts/run-exp-a.ts [--variants V0,V1,V2,V3] [--models <m1,m2>]
 *                                [--k 5] [--fixtures fixtures/exp-a]
 *                                [--out artifacts/runs/exp-a]
 *
 * Reads .env automatically via lib/env.ts.
 * Checkpoint/resume: skips (variant, model, fixtureId, k) combos with existing result.json.
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLlmClient } from '../lib/llm-client.js';
import { extractAnswer, scoreResponse } from '../lib/score.js';
import { validateEnv, getModelPrimary, getModelSecondary } from '../lib/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXP_ROOT = join(__dirname, '..');

// ── CLI arg parsing ───────────────────────────────────────────────────────────

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag: string, def: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1]! : def;
  };
  return {
    variants: get('--variants', 'V0,V1,V2,V3').split(','),
    models: get('--models', '').split(',').filter(Boolean),
    k: parseInt(get('--k', '5'), 10),
    fixturesDir: join(EXP_ROOT, get('--fixtures', 'fixtures/exp-a')),
    outDir: join(EXP_ROOT, get('--out', 'artifacts/runs/exp-a')),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface Fixture {
  id: string;
  taskClass: string;
  taskType: string;
  templateMeta: { slug: string; lastUsed: string; applicableWhen: string };
  recentChanges: string[];
  answer: string;
  answerType: 'exact' | 'set' | 'partial';
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function loadFixtures(dir: string): Promise<Fixture[]> {
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort();
  return Promise.all(
    files.map(async f => JSON.parse(await readFile(join(dir, f), 'utf-8')) as Fixture),
  );
}

async function loadVariant(variantId: string): Promise<string> {
  const path = join(EXP_ROOT, 'variants', `task-from-template-${variantId.toLowerCase()}.md`);
  return readFile(path, 'utf-8');
}

function buildPrompt(variantContent: string, fixture: Fixture): string {
  const { templateMeta, recentChanges } = fixture;
  const changesList = recentChanges.map(c => `  - ${c}`).join('\n');
  return [
    'You are executing the freshnessCheck step of task-from-template.',
    '',
    variantContent,
    '',
    'Template:',
    `  slug: ${templateMeta.slug}`,
    `  lastUsed: ${templateMeta.lastUsed}`,
    `  applicableWhen: ${templateMeta.applicableWhen}`,
    '',
    `Recent git changes since ${templateMeta.lastUsed}:`,
    changesList || '  (no changes)',
    '',
    'Based on the freshnessCheck spec above, output ONLY valid JSON:',
    '{"answer": "FRESH"} or {"answer": "STALE", "reason": "<one line>"}',
  ].join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  validateEnv();
  const opts = parseArgs();
  const models = opts.models.length > 0 ? opts.models : [getModelPrimary(), getModelSecondary()];
  const client = createLlmClient();
  const fixtures = await loadFixtures(opts.fixturesDir);

  console.log(`Exp-A: ${opts.variants.length} variants × ${fixtures.length} fixtures × ${models.length} models × k=${opts.k}`);
  console.log(`Total calls: ${opts.variants.length * fixtures.length * models.length * opts.k}`);
  console.log(`Output: ${opts.outDir}`);
  console.log('');

  let completed = 0;
  let skipped = 0;
  const total = opts.variants.length * fixtures.length * models.length * opts.k;

  for (const variant of opts.variants) {
    const variantContent = await loadVariant(variant);
    for (const fixture of fixtures) {
      for (const model of models) {
        const runDir = join(opts.outDir, variant, model.replace(/[^a-z0-9-]/gi, '_'), fixture.id);
        const resultPath = join(runDir, 'result.json');

        // Checkpoint/resume: load existing results if present
        let responses: string[] = [];
        if (await fileExists(resultPath)) {
          const existing = JSON.parse(await readFile(resultPath, 'utf-8')) as { responses: string[] };
          responses = existing.responses ?? [];
        }

        const needed = opts.k - responses.length;
        if (needed <= 0) {
          skipped += opts.k;
          continue;
        }

        const prompt = buildPrompt(variantContent, fixture);
        const isGlm = model.toLowerCase().includes('glm');
        const extra_body = isGlm ? { thinking: { type: 'disabled' } } : undefined;

        for (let i = 0; i < needed; i++) {
          try {
            const resp = await client.chat({
              model,
              messages: [{ role: 'user', content: prompt }],
              ...(extra_body ? { extra_body } : {}),
            });
            responses.push(resp.content);
            completed++;

            if (completed % 10 === 0) {
              const pct = Math.round((completed + skipped) / total * 100);
              process.stdout.write(`\r  [${pct}%] ${completed} calls done, ${skipped} skipped`);
            }
          } catch (err) {
            console.error(`\n  ERROR ${variant}/${model}/${fixture.id} run ${i}:`, (err as Error).message);
          }
        }

        // Save checkpoint after each (variant, model, fixture) batch
        await mkdir(runDir, { recursive: true });
        await writeFile(resultPath, JSON.stringify({
          variant,
          model,
          fixtureId: fixture.id,
          groundTruth: fixture.answer,
          responses,
        }, null, 2));

        // Save task metadata alongside result
        await writeFile(join(runDir, 'task.json'), JSON.stringify({ task: fixture }, null, 2));
      }
    }
  }

  console.log(`\n\nDone: ${completed} new calls, ${skipped} checkpointed.`);

  // ── Inline scoring ────────────────────────────────────────────────────────
  console.log('\nScoring results...');
  await scoreResults(opts.outDir, fixtures, opts.variants, models);
}

async function scoreResults(
  outDir: string,
  fixtures: Fixture[],
  variants: string[],
  models: string[],
) {
  const { readdir } = await import('node:fs/promises');

  type Acc = { sum: number; count: number };
  const variantModelAcc: Record<string, Record<string, Acc>> = {};

  for (const variant of variants) {
    variantModelAcc[variant] = {};
    for (const model of models) {
      const modelSlug = model.replace(/[^a-z0-9-]/gi, '_');
      variantModelAcc[variant]![modelSlug] = { sum: 0, count: 0 };

      for (const fixture of fixtures) {
        const runDir = join(outDir, variant, modelSlug, fixture.id);
        const resultPath = join(runDir, 'result.json');
        if (!(await fileExists(resultPath))) continue;

        const result = JSON.parse(await readFile(resultPath, 'utf-8')) as { responses: string[] };
        const scores = result.responses.map(r => {
          const extracted = extractAnswer(r);
          return scoreResponse(extracted, fixture.answer, fixture.answerType);
        });
        const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        variantModelAcc[variant]![modelSlug]!.sum += mean;
        variantModelAcc[variant]![modelSlug]!.count++;
      }
    }
  }

  // Build summary
  const variantAccuracy: Record<string, Record<string, number>> = {};
  for (const variant of variants) {
    variantAccuracy[variant] = {};
    for (const model of models) {
      const slug = model.replace(/[^a-z0-9-]/gi, '_');
      const acc = variantModelAcc[variant]![slug]!;
      variantAccuracy[variant]![slug] = acc.count > 0 ? acc.sum / acc.count : 0;
    }
  }

  // H-P3 direction check
  const v0v1Models = models.map(m => {
    const s = m.replace(/[^a-z0-9-]/gi, '_');
    return ((variantAccuracy['V0']?.[s] ?? 0) + (variantAccuracy['V1']?.[s] ?? 0)) / 2;
  });
  const v2v3Models = models.map(m => {
    const s = m.replace(/[^a-z0-9-]/gi, '_');
    return ((variantAccuracy['V2']?.[s] ?? 0) + (variantAccuracy['V3']?.[s] ?? 0)) / 2;
  });
  const v0v1Mean = v0v1Models.reduce((a, b) => a + b, 0) / v0v1Models.length;
  const v2v3Mean = v2v3Models.reduce((a, b) => a + b, 0) / v2v3Models.length;
  const directionCorrect = v0v1Mean > v2v3Mean;

  const hP3Verdict = directionCorrect ? 'DIRECTION_CONFIRMED_STAT_PENDING' : 'NULL';
  const implications = directionCorrect
    ? 'Direction supports H-P3. Run Friedman test with scipy for p-value.'
    : 'H-P3 direction not confirmed. §3.1 claim that P3 is actively harmful needs revision.';

  const results = {
    generated: new Date().toISOString(),
    variant_accuracy: variantAccuracy,
    summary: { v0v1_mean: v0v1Mean, v2v3_mean: v2v3Mean },
    hypotheses: {
      'H-P3': {
        verdict: hP3Verdict,
        p_value: null,
        notes: `V0/V1 mean=${v0v1Mean.toFixed(3)}, V2/V3 mean=${v2v3Mean.toFixed(3)}`,
      },
      'H-null': {
        verdict: directionCorrect ? 'NULL' : 'CONFIRMED',
        notes: '',
      },
    },
    implications,
  };

  const analysisDir = join(EXP_ROOT, 'artifacts', 'analysis');
  await mkdir(analysisDir, { recursive: true });
  const outPath = join(analysisDir, 'exp-a-results.json');
  await writeFile(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResults written to ${outPath}`);
  console.log(JSON.stringify(results.summary, null, 2));
  console.log('H-P3:', results.hypotheses['H-P3'].verdict);
}

main().catch(e => { console.error(e); process.exit(1); });
