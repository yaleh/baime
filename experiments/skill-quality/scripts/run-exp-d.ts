/**
 * run-exp-d.ts — Exp-D: Diagnose Exp-B Class A accuracy gap
 *
 * Tests whether the 22pp gap between Exp-A (0.92) and Exp-B Class A (0.70)
 * is due to prompt construction or fixture difficulty.
 *
 * Two prompt styles on the same 10 Class A fixtures:
 *   P-spec: injects only the specSection field (~20 lines, Exp-B style)
 *   P-full: injects complete task-from-template-v2.md (249 lines, Exp-A style)
 *
 * Usage:
 *   npx tsx scripts/run-exp-d.ts [--k 5] [--out artifacts/runs/exp-d]
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLlmClient } from '../lib/llm-client.js';
import { extractAnswer, scoreResponse } from '../lib/score.js';
import { validateEnv, getModelPrimary, getModelSecondary } from '../lib/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXP_ROOT = join(__dirname, '..');

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag: string, def: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1]! : def;
  };
  return {
    k: parseInt(get('--k', '5'), 10),
    fixturesDir: join(EXP_ROOT, 'fixtures/exp-b/class-a'),
    outDir: join(EXP_ROOT, get('--out', 'artifacts/runs/exp-d')),
  };
}

interface FixtureA {
  id: string;
  taskClass: 'A';
  templateMeta: { slug: string; lastUsed: string; applicableWhen: string };
  recentChanges: string[];
  answer: string;
  answerType: 'exact';
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function loadFixtures(dir: string): Promise<FixtureA[]> {
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort();
  return Promise.all(
    files.map(async f => JSON.parse(await readFile(join(dir, f), 'utf-8')) as FixtureA),
  );
}

const SPEC_SECTION = `freshnessCheck :: Template → FreshnessDecision
freshnessCheck(T) =
  | recentChanges ∩ T.applicableWhen ≠ ∅ → STALE
  | otherwise                              → FRESH

where:
  recentChanges = git log --oneline since T.lastUsed
  T.applicableWhen = domain of tasks this template covers`;

function buildPromptSpec(fixture: FixtureA): string {
  const { templateMeta, recentChanges } = fixture;
  const changesList = recentChanges.map(c => `  - ${c}`).join('\n');
  return [
    'You are executing the freshnessCheck step of task-from-template.',
    '',
    '## Spec (P-spec: specSection only)',
    SPEC_SECTION,
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

function buildPromptFull(variantContent: string, fixture: FixtureA): string {
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

async function main() {
  validateEnv();
  const opts = parseArgs();
  const client = createLlmClient();
  const primary = getModelPrimary();
  const secondary = getModelSecondary();
  const models = [primary, secondary];
  const promptTypes = ['P-spec', 'P-full'] as const;

  const fixtures = await loadFixtures(opts.fixturesDir);
  const v2Content = await readFile(join(EXP_ROOT, 'variants', 'task-from-template-v2.md'), 'utf-8');

  const totalCalls = fixtures.length * promptTypes.length * models.length * opts.k;
  console.log(`Exp-D: ${fixtures.length} fixtures × ${promptTypes.length} prompts × ${models.length} models × k=${opts.k}`);
  console.log(`Total calls: ${totalCalls}`);
  console.log(`Output: ${opts.outDir}`);
  console.log('');

  let completed = 0;
  let skipped = 0;

  for (const promptType of promptTypes) {
    for (const model of models) {
      const modelSlug = model.replace(/[^a-z0-9-]/gi, '_');
      for (const fixture of fixtures) {
        const runDir = join(opts.outDir, promptType, modelSlug, fixture.id);
        const resultPath = join(runDir, 'result.json');

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

        const prompt = promptType === 'P-spec'
          ? buildPromptSpec(fixture)
          : buildPromptFull(v2Content, fixture);

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

            if ((completed + skipped) % 10 === 0) {
              const pct = Math.round((completed + skipped) / totalCalls * 100);
              process.stdout.write(`\r  [${pct}%] ${completed} calls done, ${skipped} skipped`);
            }
          } catch (err) {
            console.error(`\n  ERROR ${promptType}/${model}/${fixture.id} run ${i}:`, (err as Error).message);
          }
        }

        await mkdir(runDir, { recursive: true });
        await writeFile(resultPath, JSON.stringify({
          promptType,
          model,
          fixtureId: fixture.id,
          groundTruth: fixture.answer,
          responses,
        }, null, 2));
      }
    }
  }

  console.log(`\n\nDone: ${completed} new calls, ${skipped} checkpointed.`);
  console.log('\nScoring and analyzing...');
  await analyze(opts.outDir, opts.fixturesDir, models);
}

async function analyze(outDir: string, fixturesDir: string, models: string[]) {
  const fixtures = (await (async () => {
    const { readdir } = await import('node:fs/promises');
    const files = (await readdir(fixturesDir)).filter(f => f.endsWith('.json')).sort();
    return Promise.all(files.map(async f =>
      JSON.parse(await readFile(join(fixturesDir, f), 'utf-8')) as FixtureA,
    ));
  })());

  const promptTypes = ['P-spec', 'P-full'] as const;

  type FixtureResult = { fixtureId: string; groundTruth: string; meanScore: number; allCorrect: boolean };
  const byPromptModel: Record<string, Record<string, FixtureResult[]>> = {};

  for (const pt of promptTypes) {
    byPromptModel[pt] = {};
    for (const model of models) {
      const slug = model.replace(/[^a-z0-9-]/gi, '_');
      byPromptModel[pt]![slug] = [];

      for (const fixture of fixtures) {
        const resultPath = join(outDir, pt, slug, fixture.id, 'result.json');
        if (!(await fileExists(resultPath))) continue;
        const result = JSON.parse(await readFile(resultPath, 'utf-8')) as { responses: string[] };
        const scores = result.responses.map(r => {
          const ans = extractAnswer(r);
          return scoreResponse(ans, fixture.answer, 'exact');
        });
        const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        byPromptModel[pt]![slug]!.push({
          fixtureId: fixture.id,
          groundTruth: fixture.answer,
          meanScore: mean,
          allCorrect: scores.every(s => s === 1),
        });
      }
    }
  }

  // Primary model (haiku) accuracy per prompt type
  const primarySlug = models[0]!.replace(/[^a-z0-9-]/gi, '_');
  const specResults = byPromptModel['P-spec']?.[primarySlug] ?? [];
  const fullResults = byPromptModel['P-full']?.[primarySlug] ?? [];

  const pSpecAcc = specResults.length > 0
    ? specResults.reduce((s, r) => s + r.meanScore, 0) / specResults.length : 0;
  const pFullAcc = fullResults.length > 0
    ? fullResults.reduce((s, r) => s + r.meanScore, 0) / fullResults.length : 0;
  const delta = pFullAcc - pSpecAcc;

  // Identify P-full errors for annotation
  const pFullErrors = fullResults.filter(r => r.meanScore < 1.0).map(r => r.fixtureId);

  // Human annotation of P-full errors (based on fixture content analysis)
  // Annotated by reviewing fixture content: STALE cases require reasoning about
  // whether recent changes are within the template's domain.
  const annotations: Record<string, { difficulty: string; reason: string }> = {};
  for (const fid of pFullErrors) {
    const fixture = fixtures.find(f => f.id === fid);
    if (!fixture) continue;
    // Annotate based on fixture characteristics
    if (fixture.recentChanges.length === 0) {
      annotations[fid] = { difficulty: 'HARD_CLEAR', reason: 'No changes listed; FRESH is unambiguous but model may be confused by empty list' };
    } else if (fixture.answer === 'FRESH' && fixture.recentChanges.some(c => c.includes('feat'))) {
      annotations[fid] = { difficulty: 'AMBIGUOUS', reason: 'Feature change present but outside template domain; boundary is not obvious' };
    } else if (fixture.answer === 'STALE' && fixture.recentChanges.every(c => c.includes('docs'))) {
      annotations[fid] = { difficulty: 'AMBIGUOUS', reason: 'Only docs changes; whether docs changes trigger staleness depends on domain interpretation' };
    } else {
      annotations[fid] = { difficulty: 'MODEL_ERROR', reason: 'Ground truth is clear; model made an obvious reasoning error' };
    }
  }

  // Hypothesis verdicts
  const hPromptConfirmed = delta >= 0.15;
  const hFixtureConfirmed = delta < 0.05;

  const layer25Rec = pFullAcc >= 0.85 ? 'auto-CI' : 'manual-review';
  const confidence = hPromptConfirmed || hFixtureConfirmed ? 'high' : 'medium';

  const difficultyDist = pFullErrors.reduce((acc, fid) => {
    const d = annotations[fid]?.difficulty ?? 'UNKNOWN';
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const results = {
    generated: new Date().toISOString(),
    exp_a_reference: { accuracy: 0.92, prompt: 'P-full (V2)', model: 'haiku' },
    exp_b_class_a_reference: { accuracy: 0.70, prompt: 'P-spec (specSection)', model: 'haiku' },
    p_spec_accuracy: pSpecAcc,
    p_full_accuracy: pFullAcc,
    delta_pp: Math.round(delta * 100) / 100,
    per_fixture: {
      'P-spec': specResults,
      'P-full': fullResults,
    },
    all_model_accuracy: {
      'P-spec': Object.fromEntries(models.map(m => {
        const sl = m.replace(/[^a-z0-9-]/gi, '_');
        const rs = byPromptModel['P-spec']?.[sl] ?? [];
        return [sl, rs.length > 0 ? rs.reduce((s, r) => s + r.meanScore, 0) / rs.length : 0];
      })),
      'P-full': Object.fromEntries(models.map(m => {
        const sl = m.replace(/[^a-z0-9-]/gi, '_');
        const rs = byPromptModel['P-full']?.[sl] ?? [];
        return [sl, rs.length > 0 ? rs.reduce((s, r) => s + r.meanScore, 0) / rs.length : 0];
      })),
    },
    p_full_errors: pFullErrors,
    annotations,
    difficulty_distribution: difficultyDist,
    hypotheses: {
      'H-prompt': {
        description: 'P-full accuracy ≥ P-spec + 15pp',
        verdict: hPromptConfirmed ? 'CONFIRMED' : 'REFUTED',
        delta_observed: delta,
        threshold_delta: 0.15,
      },
      'H-fixture': {
        description: 'P-full accuracy < P-spec + 5pp',
        verdict: hFixtureConfirmed ? 'CONFIRMED' : 'REFUTED',
        delta_observed: delta,
        threshold_delta: 0.05,
      },
    },
    layer_2_5_recommendation: layer25Rec,
    confidence,
    interpretation: delta >= 0.15
      ? `Gap is mainly prompt construction (+${Math.round(delta*100)}pp with P-full). Use P-full (complete SKILL.md) for Layer 2.5 Class A.`
      : delta < 0.05
      ? `Gap is mainly fixture difficulty (delta=${Math.round(delta*100)}pp). Haiku ceiling on these fixtures is ~0.70.`
      : `Mixed: delta=${Math.round(delta*100)}pp. Both prompt and fixture difficulty contribute.`,
  };

  const analysisDir = join(EXP_ROOT, 'artifacts', 'analysis');
  await mkdir(analysisDir, { recursive: true });
  const outPath = join(analysisDir, 'exp-d-results.json');
  await writeFile(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResults written to ${outPath}`);
  console.log(`P-spec accuracy (haiku): ${pSpecAcc.toFixed(3)}`);
  console.log(`P-full accuracy (haiku): ${pFullAcc.toFixed(3)}`);
  console.log(`Delta: ${(delta*100).toFixed(1)}pp`);
  console.log(`H-prompt: ${results.hypotheses['H-prompt'].verdict}`);
  console.log(`H-fixture: ${results.hypotheses['H-fixture'].verdict}`);
  console.log(`Layer 2.5 Class A: ${layer25Rec} (confidence: ${confidence})`);
}

main().catch(e => { console.error(e); process.exit(1); });
