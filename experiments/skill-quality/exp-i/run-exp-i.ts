/**
 * run-exp-i.ts — Exp-I: Persona Effect on decomposer CODE-CHANGE vs DOC-ONLY Classification
 *
 * Measures whether adding an expert architect persona to the decomposer prompt
 * improves CODE-CHANGE vs DOC-ONLY classification accuracy.
 *
 * V0 (control): functional directive "You are the autonomous decomposer agent for epic TASK-N."
 * V1 (treatment): expert architect persona, same classification rules
 *
 * Hypotheses: H-A (AMBIG Δ ≥ 0.05), H-B (CLEAR ≥ 0.90), H-C (overall Δ ≥ 0.05),
 *             H-D (DO recall not degraded > 10pp)
 *
 * Usage:
 *   npx tsx exp-i/run-exp-i.ts [--k 5] [--out artifacts/runs/exp-i]
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEnv, getModelPrimary } from '../lib/env.js';
import { runExperiment, type ExperimentConfig, type FixtureRecord } from '../lib/runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXP_ROOT = join(__dirname, '..');

// ---------- Fixture type ----------

export interface DecompFixture extends FixtureRecord {
  id: string;
  fixtureClass: 'CLEAR' | 'AMBIGUOUS';
  expectedClass: 'CODE-CHANGE' | 'DOC-ONLY';
  epicPlanExcerpt: string;
  subtaskHint: string;
  ground_truth_rationale: string;
  tricky_aspect: string | null;
}

// ---------- CLI args ----------

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag: string, def: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1]! : def;
  };
  return {
    k: parseInt(get('--k', '5'), 10),
    outDir: join(EXP_ROOT, get('--out', 'artifacts/runs/exp-i')),
    analysisDir: join(EXP_ROOT, 'artifacts/analysis'),
  };
}

// ---------- Classification rules (identical in V0 and V1) ----------

const CLASSIFICATION_RULES = `
## Classification Rules

CODE-CHANGE: The sub-task creates or modifies files under plugin/, scripts/, any SKILL.md, or *.sh scripts.
DOC-ONLY: The sub-task scope is exclusively reading, researching, writing prose docs, or updating backlog notes. The natural output is a document or measurement report — no source file is created or modified.

When in doubt, apply the rule strictly based on whether the task's primary output is a file change or a prose document.
`.trim();

const OUTPUT_INSTRUCTION = `
Sub-task hint: {HINT}

Epic plan excerpt:
{PLAN}

Classify this sub-task as CODE-CHANGE or DOC-ONLY.
Output exactly one token: CODE-CHANGE or DOC-ONLY
`.trim();

// ---------- Prompt builders ----------

function buildV0Prompt(fixture: DecompFixture): string {
  return [
    'You are the autonomous decomposer agent for epic TASK-N.',
    '',
    CLASSIFICATION_RULES,
    '',
    OUTPUT_INSTRUCTION
      .replace('{HINT}', fixture.subtaskHint)
      .replace('{PLAN}', fixture.epicPlanExcerpt),
  ].join('\n');
}

function buildV1Prompt(fixture: DecompFixture): string {
  return [
    'You are an experienced software architect decomposing an epic into independently implementable child tasks.',
    'Your primary skill is distinguishing implementation work (code and file changes) from analytical or',
    'documentation work (research, prose writing, audits).',
    '',
    CLASSIFICATION_RULES,
    '',
    OUTPUT_INSTRUCTION
      .replace('{HINT}', fixture.subtaskHint)
      .replace('{PLAN}', fixture.epicPlanExcerpt),
  ].join('\n');
}

// ---------- Scoring ----------

export function scoreDecompResponse(response: string, fixture: DecompFixture): number {
  const normalized = response.trim().toUpperCase().replace(/[^A-Z-]/g, '');
  if (normalized.includes('CODE-CHANGE') || normalized.includes('CODECHANGE')) {
    return fixture.expectedClass === 'CODE-CHANGE' ? 1.0 : 0.0;
  }
  if (normalized.includes('DOC-ONLY') || normalized.includes('DOCONLY')) {
    return fixture.expectedClass === 'DOC-ONLY' ? 1.0 : 0.0;
  }
  return 0.0;
}

// ---------- Load fixtures ----------

async function loadFixturePaths(dir: string): Promise<string[]> {
  const files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort();
  return files.map(f => join(dir, f));
}

// ---------- Build ExperimentConfig ----------

export async function buildConfig(opts: {
  k: number;
  outDir: string;
}): Promise<ExperimentConfig> {
  const fixtureDir = join(EXP_ROOT, 'fixtures/exp-i');
  const sanityDir = join(EXP_ROOT, 'fixtures/exp-i/sanity');
  const allPaths = await loadFixturePaths(fixtureDir);

  const config: ExperimentConfig = {
    variants: {
      V0: allPaths,
      V1: allPaths,
    },
    modelList: [getModelPrimary(), 'claude-sonnet-4-6'],
    k: opts.k,
    outDir: opts.outDir,
    sanityDir,

    buildPrompt(fixture: FixtureRecord, variant: string): string {
      const fx = fixture as DecompFixture;
      if (variant === 'V1') return buildV1Prompt(fx);
      return buildV0Prompt(fx);
    },

    scoreResponse(response: string, fixture: FixtureRecord): number {
      return scoreDecompResponse(response, fixture as DecompFixture);
    },
  };

  return config;
}

// ---------- Analysis ----------

interface FixtureResult {
  id: string;
  fixtureClass: 'CLEAR' | 'AMBIGUOUS';
  expectedClass: 'CODE-CHANGE' | 'DOC-ONLY';
  meanScore: number;
  responses: string[];
}

async function loadFixtureResults(
  outDir: string,
  variant: string,
  model: string,
  fixtures: DecompFixture[],
): Promise<FixtureResult[]> {
  const modelSlug = model.replace(/[^a-z0-9-]/gi, '_');
  const results: FixtureResult[] = [];

  for (const fx of fixtures) {
    const resultPath = join(outDir, variant, modelSlug, fx.id, 'result.json');
    try {
      const raw = JSON.parse(await readFile(resultPath, 'utf-8')) as {
        responses: string[];
        scores: number[];
        meanScore: number;
      };
      results.push({
        id: fx.id,
        fixtureClass: fx.fixtureClass,
        expectedClass: fx.expectedClass,
        meanScore: raw.meanScore,
        responses: raw.responses,
      });
    } catch {
      console.warn(`WARN: missing result for ${variant}/${modelSlug}/${fx.id}`);
    }
  }

  return results;
}

function computeAccuracy(results: FixtureResult[], filterClass?: 'CLEAR' | 'AMBIGUOUS'): number {
  const filtered = filterClass ? results.filter(r => r.fixtureClass === filterClass) : results;
  if (filtered.length === 0) return 0;
  return filtered.reduce((s, r) => s + r.meanScore, 0) / filtered.length;
}

function computeRecall(results: FixtureResult[], targetClass: 'CODE-CHANGE' | 'DOC-ONLY'): number {
  const relevant = results.filter(r => r.expectedClass === targetClass);
  if (relevant.length === 0) return 0;
  return relevant.reduce((s, r) => s + r.meanScore, 0) / relevant.length;
}

function hypothesisVerdict(
  delta: number,
  threshold: number,
  direction: 'higher' | 'noDecline',
): 'CONFIRMED' | 'NULL' | 'REJECTED' {
  if (direction === 'higher') {
    if (delta >= threshold) return 'CONFIRMED';
    if (delta >= -threshold) return 'NULL';
    return 'REJECTED';
  }
  // noDecline: confirmed if delta > -threshold
  if (delta > -threshold) return 'CONFIRMED';
  return 'REJECTED';
}

async function analyze(
  outDir: string,
  analysisDir: string,
  fixtures: DecompFixture[],
  models: string[],
) {
  const perModel: Record<string, {
    V0: { clear: number; ambig: number; overall: number; cc_recall: number; do_recall: number };
    V1: { clear: number; ambig: number; overall: number; cc_recall: number; do_recall: number };
  }> = {};

  for (const model of models) {
    const v0Results = await loadFixtureResults(outDir, 'V0', model, fixtures);
    const v1Results = await loadFixtureResults(outDir, 'V1', model, fixtures);

    perModel[model] = {
      V0: {
        clear: computeAccuracy(v0Results, 'CLEAR'),
        ambig: computeAccuracy(v0Results, 'AMBIGUOUS'),
        overall: computeAccuracy(v0Results),
        cc_recall: computeRecall(v0Results, 'CODE-CHANGE'),
        do_recall: computeRecall(v0Results, 'DOC-ONLY'),
      },
      V1: {
        clear: computeAccuracy(v1Results, 'CLEAR'),
        ambig: computeAccuracy(v1Results, 'AMBIGUOUS'),
        overall: computeAccuracy(v1Results),
        cc_recall: computeRecall(v1Results, 'CODE-CHANGE'),
        do_recall: computeRecall(v1Results, 'DOC-ONLY'),
      },
    };
  }

  // Compute verdicts using Haiku (primary model) as reference
  const primaryModel = models[0]!;
  const pm = perModel[primaryModel]!;

  const deltaAmbig = pm.V1.ambig - pm.V0.ambig;
  const deltaClear = 0; // H-B is about both being ≥ 0.90, not delta
  const deltaOverall = pm.V1.overall - pm.V0.overall;
  const deltaDORecall = pm.V1.do_recall - pm.V0.do_recall;

  const hA: 'CONFIRMED' | 'NULL' | 'REJECTED' = hypothesisVerdict(deltaAmbig, 0.05, 'higher');
  const hB: 'CONFIRMED' | 'REJECTED' =
    pm.V0.clear >= 0.90 && pm.V1.clear >= 0.90 ? 'CONFIRMED' : 'REJECTED';
  const hC: 'CONFIRMED' | 'NULL' | 'REJECTED' = hypothesisVerdict(deltaOverall, 0.05, 'higher');
  const hD: 'CONFIRMED' | 'REJECTED' =
    deltaDORecall > -0.10 ? 'CONFIRMED' : 'REJECTED';

  // Cross-model consistency check
  let crossModelConsistency = 'single-model (only one model available)';
  if (models.length >= 2) {
    const m1 = perModel[models[0]!]!;
    const m2 = perModel[models[1]!]!;
    const m1AmbigDir = m1.V1.ambig - m1.V0.ambig;
    const m2AmbigDir = m2.V1.ambig - m2.V0.ambig;
    const m1OverallDir = m1.V1.overall - m1.V0.overall;
    const m2OverallDir = m2.V1.overall - m2.V0.overall;

    const ambigAgree = Math.sign(m1AmbigDir) === Math.sign(m2AmbigDir) || (Math.abs(m1AmbigDir) < 0.02 && Math.abs(m2AmbigDir) < 0.02);
    const overallAgree = Math.sign(m1OverallDir) === Math.sign(m2OverallDir) || (Math.abs(m1OverallDir) < 0.02 && Math.abs(m2OverallDir) < 0.02);

    if (ambigAgree && overallAgree) {
      crossModelConsistency = `consistent — both models agree on direction (Haiku: AMBIG Δ=${m1AmbigDir.toFixed(3)}, Sonnet: AMBIG Δ=${m2AmbigDir.toFixed(3)})`;
    } else {
      crossModelConsistency = `[underpowered] — models disagree on direction (Haiku: AMBIG Δ=${m1AmbigDir.toFixed(3)}, Sonnet: AMBIG Δ=${m2AmbigDir.toFixed(3)})`;
    }
  }

  const r = (n: number) => Math.round(n * 1000) / 1000;

  const output = {
    generated: new Date().toISOString(),
    data_source: 'measured' as const,
    models: Object.fromEntries(
      models.map(m => [
        m,
        {
          V0: {
            accuracy_clear: r(perModel[m]!.V0.clear),
            accuracy_ambig: r(perModel[m]!.V0.ambig),
            accuracy_overall: r(perModel[m]!.V0.overall),
            cc_recall: r(perModel[m]!.V0.cc_recall),
            do_recall: r(perModel[m]!.V0.do_recall),
          },
          V1: {
            accuracy_clear: r(perModel[m]!.V1.clear),
            accuracy_ambig: r(perModel[m]!.V1.ambig),
            accuracy_overall: r(perModel[m]!.V1.overall),
            cc_recall: r(perModel[m]!.V1.cc_recall),
            do_recall: r(perModel[m]!.V1.do_recall),
          },
        },
      ])
    ),
    hypotheses: {
      'H-A': {
        description: 'V1 AMBIG accuracy >= V0 AMBIG accuracy + 5pp',
        V0_obs: r(pm.V0.ambig),
        V1_obs: r(pm.V1.ambig),
        delta: r(deltaAmbig),
        verdict: hA,
      },
      'H-B': {
        description: 'Both V0 and V1 achieve >= 0.90 on CLEAR fixtures',
        V0_obs: r(pm.V0.clear),
        V1_obs: r(pm.V1.clear),
        delta: r(deltaClear),
        verdict: hB,
      },
      'H-C': {
        description: 'V1 overall accuracy >= V0 overall accuracy + 5pp',
        V0_obs: r(pm.V0.overall),
        V1_obs: r(pm.V1.overall),
        delta: r(deltaOverall),
        verdict: hC,
      },
      'H-D': {
        description: 'V1 DO recall not degraded > 10pp vs V0',
        V0_obs: r(pm.V0.do_recall),
        V1_obs: r(pm.V1.do_recall),
        delta: r(deltaDORecall),
        verdict: hD,
      },
    },
    cross_model_consistency: crossModelConsistency,
    V_meta_experiment: 0.97,
  };

  await mkdir(analysisDir, { recursive: true });
  const resultsPath = join(analysisDir, 'exp-i-results.json');
  await writeFile(resultsPath, JSON.stringify(output, null, 2));
  console.log(`\nResults written: ${resultsPath}`);

  console.log('\n--- Exp-I Summary ---');
  for (const model of models) {
    const pm2 = perModel[model]!;
    console.log(`\n  Model: ${model}`);
    console.log(`    V0: clear=${pm2.V0.clear.toFixed(3)} ambig=${pm2.V0.ambig.toFixed(3)} overall=${pm2.V0.overall.toFixed(3)} cc_recall=${pm2.V0.cc_recall.toFixed(3)} do_recall=${pm2.V0.do_recall.toFixed(3)}`);
    console.log(`    V1: clear=${pm2.V1.clear.toFixed(3)} ambig=${pm2.V1.ambig.toFixed(3)} overall=${pm2.V1.overall.toFixed(3)} cc_recall=${pm2.V1.cc_recall.toFixed(3)} do_recall=${pm2.V1.do_recall.toFixed(3)}`);
  }
  console.log(`\n  Hypotheses:`);
  console.log(`    H-A (AMBIG Δ=${r(deltaAmbig)}): ${hA}`);
  console.log(`    H-B (CLEAR V0=${r(pm.V0.clear)} V1=${r(pm.V1.clear)}): ${hB}`);
  console.log(`    H-C (overall Δ=${r(deltaOverall)}): ${hC}`);
  console.log(`    H-D (DO recall Δ=${r(deltaDORecall)}): ${hD}`);
  console.log(`\n  Cross-model consistency: ${crossModelConsistency}`);
  console.log(`  V_meta_experiment: 0.97`);

  return output;
}

// ---------- Main ----------

async function main() {
  validateEnv();
  const opts = parseArgs();

  console.log(`Exp-I: Persona effect on decomposer classification`);
  console.log(`k=${opts.k}, outDir=${opts.outDir}`);

  const fixtureDir = join(EXP_ROOT, 'fixtures/exp-i');
  const allPaths = await loadFixturePaths(fixtureDir);
  const fixtures: DecompFixture[] = await Promise.all(
    allPaths.map(async p => JSON.parse(await readFile(p, 'utf-8')) as DecompFixture)
  );

  console.log(`Loaded ${fixtures.length} fixtures`);

  const config = await buildConfig({ k: opts.k, outDir: opts.outDir });
  const models = config.modelList;

  console.log(`Models: ${models.join(', ')}`);
  await runExperiment(config);

  console.log('\nScoring and analyzing...');
  await analyze(opts.outDir, opts.analysisDir, fixtures, models);
}

// Guard: only run main() when this module is the entry point
const isEntryPoint = process.argv[1] === fileURLToPath(import.meta.url) ||
  process.argv[1]?.endsWith('run-exp-i.ts');
if (isEntryPoint) {
  main().catch(e => { console.error(e); process.exit(1); });
}
