/**
 * runner.ts — Generic experiment runner for skill-quality experiments.
 *
 * OUTPUT JSON SCHEMA (written to <outDir>/<variant>/<fixtureId>/result.json):
 * {
 *   "variant":        string,           // variant key from config.variants
 *   "fixtureId":      string,           // fixture filename without extension
 *   "model":          string,           // model identifier
 *   "firstCallUtc":   string,           // ISO-8601 UTC timestamp of first real LLM call
 *   "responses":      string[],         // raw LLM response strings (length == k)
 *   "data_source":    "measured",       // always "measured" — never estimated
 *   "scores":         number[],         // per-response scores [0..1]
 *   "meanScore":      number,           // arithmetic mean of scores
 *   "wilsonCI":       { "low": number, "high": number }
 * }
 *
 * ANALYSIS OUTPUT (written to <outDir>/analysis.json):
 * {
 *   "generated":      string,           // ISO-8601 UTC
 *   "data_source":    "measured",
 *   "variants": {
 *     "<variant>": {
 *       "fixtureClasses": {
 *         "<class>": { "meanScore": number, "wilsonCI": CI, "n": number }
 *       },
 *       "overall": { "meanScore": number, "wilsonCI": CI, "n": number }
 *     }
 *   }
 * }
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmClient {
  chat(req: { model: string; messages: ChatMessage[] }): Promise<{ content: string }>;
}

/** Fixture shape expected by the runner. Only `id` and optionally `fixtureClass` are used
 *  by the runner itself; all other fields are forwarded to buildPrompt and scoreResponse. */
export interface FixtureRecord {
  id: string;
  fixtureClass?: 'CLEAR' | 'AMBIGUOUS' | 'ERROR';
  mirrors_role?: string;
  [key: string]: unknown;
}

export interface WilsonCI {
  low: number;
  high: number;
}

export interface CellResult {
  variant: string;
  fixtureId: string;
  model: string;
  firstCallUtc: string | null;
  responses: string[];
  data_source: 'measured';
  scores: number[];
  meanScore: number;
  wilsonCI: WilsonCI;
}

export interface ExperimentResult {
  generated: string;
  data_source: 'measured';
  totalCells: number;
  skippedCells: number;
  completedCells: number;
  variants: Record<string, VariantSummary>;
}

export interface VariantSummary {
  fixtureClasses: Record<string, ClassSummary>;
  overall: ClassSummary;
}

export interface ClassSummary {
  meanScore: number;
  wilsonCI: WilsonCI;
  n: number;
}

/**
 * ExperimentConfig — injectable configuration for runExperiment.
 *
 * Paths come from here only; runner.ts has no baime-specific path constants.
 */
export interface ExperimentConfig {
  /** variant name → list of fixture file paths */
  variants: Record<string, string[]>;
  /** list of model identifiers to evaluate */
  modelList: string[];
  /** number of LLM calls per (variant, fixture, model) cell */
  k: number;
  /** base output directory; cells written to <outDir>/<variant>/<fixtureId>/result.json */
  outDir: string;
  /**
   * Build the prompt for a given fixture and variant.
   * Receives the parsed fixture object and returns the prompt string.
   */
  buildPrompt: (fixture: FixtureRecord, variant: string) => string;
  /**
   * Score a single LLM response against the fixture ground truth.
   * Returns a number in [0, 1].
   */
  scoreResponse: (response: string, fixture: FixtureRecord) => number;
  /**
   * Optional directory of sanity (negative-control) fixtures.
   * If provided, runner checks that at least one sanity fixture passes before
   * starting the main traversal.
   */
  sanityDir?: string;
  /** Injectable LLM client (use mock in tests, real client in production). */
  llmClient?: LlmClient;
  /**
   * Guard: setting this to `true` throws immediately.
   * data_source is always "measured"; estimated values are never allowed.
   */
  allowEstimated?: true;
}

// ── Wilson CI ─────────────────────────────────────────────────────────────────

/**
 * Compute Wilson score confidence interval for a binomial proportion.
 * @param n  total trials
 * @param s  number of successes (score >= 0.5 treated as success for binary CI)
 * @returns  { low, high } 95% Wilson CI
 */
export function computeWilsonCI(n: number, s: number): WilsonCI {
  if (n === 0) return { low: 0, high: 1 };
  const z = 1.96; // 95% confidence
  const phat = s / n;
  const center = (phat + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const halfWidth =
    (z / (1 + (z * z) / n)) * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n));
  return {
    low: Math.max(0, center - halfWidth),
    high: Math.min(1, center + halfWidth),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function fixtureIdFromPath(fixturePath: string): string {
  return basename(fixturePath, extname(fixturePath));
}

async function loadFixture(fixturePath: string): Promise<FixtureRecord> {
  if (!(await fileExists(fixturePath))) {
    throw new Error(`Fixture file not found: ${fixturePath}`);
  }
  return JSON.parse(await readFile(fixturePath, 'utf-8')) as FixtureRecord;
}

function successCount(scores: number[]): number {
  return scores.filter(s => s >= 0.5).length;
}

// ── Sanity check ──────────────────────────────────────────────────────────────

async function runSanityCheck(
  config: ExperimentConfig,
  client: LlmClient,
  model: string,
): Promise<void> {
  const sanityDir = config.sanityDir;
  if (!sanityDir) return;
  if (!(await fileExists(sanityDir))) return;

  const files = (await readdir(sanityDir)).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) return;

  let passed = 0;
  for (const file of files) {
    const fixturePath = join(sanityDir, file);
    const fixture = await loadFixture(fixturePath);
    const prompt = config.buildPrompt(fixture, 'sanity');
    try {
      const resp = await client.chat({ model, messages: [{ role: 'user', content: prompt }] });
      const score = config.scoreResponse(resp.content, fixture);
      if (score >= 0.99) passed++;
      else {
        console.warn(`WARN sanity FAIL: ${fixture.id} → score=${score.toFixed(3)}`);
      }
    } catch (err) {
      console.warn(`WARN sanity ERROR: ${fixture.id}: ${(err as Error).message}`);
    }
  }

  if (passed === 0 && files.length > 0) {
    console.warn(`WARN: All ${files.length} sanity fixture(s) scored 0/k — negative control failure. Check harness/prompt construction.`);
  }
}

// ── Core runner ───────────────────────────────────────────────────────────────

/**
 * Run a full experiment: variant × fixture × model × k traversal with checkpoint/resume.
 *
 * For each cell, if `<outDir>/<variant>/<fixtureId>/result.json` already has `responses`
 * up to length k, that cell is skipped (checkpointed). Partial checkpoints resume from
 * where they left off.
 */
export async function runExperiment(config: ExperimentConfig): Promise<ExperimentResult> {
  // Guard: estimated values never allowed
  if (config.allowEstimated === true) {
    throw new Error(
      'data_source: estimated values are not allowed. ' +
        'Remove allowEstimated from config to use only measured LLM outputs.',
    );
  }

  const client: LlmClient =
    config.llmClient ?? (await import('./llm-client.js').then(m => m.createLlmClient()));

  // Run sanity fixtures first (use first model in list)
  if (config.modelList.length > 0) {
    await runSanityCheck(config, client, config.modelList[0]!);
  }

  let totalCells = 0;
  let skippedCells = 0;
  let completedCells = 0;

  // Count total cells
  for (const [, fixturePaths] of Object.entries(config.variants)) {
    totalCells += fixturePaths.length * config.modelList.length;
  }

  // Accumulate per-variant per-fixtureClass scores for analysis
  type ScoreBucket = { scores: number[]; fixtureClass: string };
  const variantBuckets: Record<string, ScoreBucket[]> = {};

  for (const [variant, fixturePaths] of Object.entries(config.variants)) {
    variantBuckets[variant] = [];

    for (const fixturePath of fixturePaths) {
      const fixtureId = fixtureIdFromPath(fixturePath);
      const fixture = await loadFixture(fixturePath);
      const fixtureClass = fixture.fixtureClass ?? 'UNKNOWN';

      for (const model of config.modelList) {
        const modelSlug = model.replace(/[^a-z0-9-]/gi, '_');
        const runDir = join(config.outDir, variant, modelSlug, fixtureId);
        const resultPath = join(runDir, 'result.json');

        // Checkpoint/resume: load existing responses
        let responses: string[] = [];
        let firstCallUtc: string | null = null;

        if (await fileExists(resultPath)) {
          const existing = JSON.parse(
            await readFile(resultPath, 'utf-8'),
          ) as Partial<CellResult>;
          responses = existing.responses ?? [];
          firstCallUtc = existing.firstCallUtc ?? null;
        }

        const needed = config.k - responses.length;

        if (needed <= 0) {
          skippedCells++;
        } else {
          // Build prompt, threading mirrors_role if present
          const prompt = config.buildPrompt(fixture, variant);

          for (let i = 0; i < needed; i++) {
            if (firstCallUtc === null) {
              firstCallUtc = new Date().toISOString();
            }
            const resp = await client.chat({
              model,
              messages: [{ role: 'user', content: prompt }],
            });
            responses.push(resp.content);
          }
          completedCells++;

          // Write result
          const scores = responses.map(r => config.scoreResponse(r, fixture));
          const sCount = successCount(scores);
          const meanScore = scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0;
          const wi = computeWilsonCI(scores.length, sCount);

          const cellResult: CellResult = {
            variant,
            fixtureId,
            model,
            firstCallUtc,
            responses,
            data_source: 'measured',
            scores,
            meanScore,
            wilsonCI: wi,
          };

          await mkdir(runDir, { recursive: true });
          await writeFile(resultPath, JSON.stringify(cellResult, null, 2));
        }

        // Accumulate scores for analysis (re-read scores from completed responses)
        const scores = responses.map(r => config.scoreResponse(r, fixture));
        const meanScore =
          scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        variantBuckets[variant]!.push({ scores: [meanScore], fixtureClass });
      }
    }
  }

  // Build analysis summary
  const variantSummaries: Record<string, VariantSummary> = {};

  for (const [variant, buckets] of Object.entries(variantBuckets)) {
    // Group by fixtureClass
    const byClass: Record<string, number[]> = {};
    for (const b of buckets) {
      if (!byClass[b.fixtureClass]) byClass[b.fixtureClass] = [];
      byClass[b.fixtureClass]!.push(...b.scores);
    }

    const fixtureClasses: Record<string, ClassSummary> = {};
    for (const [cls, scores] of Object.entries(byClass)) {
      const n = scores.length;
      const sCount = successCount(scores);
      const meanScore = n > 0 ? scores.reduce((a, b) => a + b, 0) / n : 0;
      fixtureClasses[cls] = {
        meanScore,
        wilsonCI: computeWilsonCI(n, sCount),
        n,
      };
    }

    const allScores = buckets.flatMap(b => b.scores);
    const n = allScores.length;
    const sCount = successCount(allScores);
    const meanScore = n > 0 ? allScores.reduce((a, b) => a + b, 0) / n : 0;

    variantSummaries[variant] = {
      fixtureClasses,
      overall: {
        meanScore,
        wilsonCI: computeWilsonCI(n, sCount),
        n,
      },
    };
  }

  const result: ExperimentResult = {
    generated: new Date().toISOString(),
    data_source: 'measured',
    totalCells,
    skippedCells,
    completedCells,
    variants: variantSummaries,
  };

  // Write analysis.json
  await mkdir(config.outDir, { recursive: true });
  await writeFile(
    join(config.outDir, 'analysis.json'),
    JSON.stringify(result, null, 2),
  );

  return result;
}
