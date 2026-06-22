/**
 * run-exp-h.ts — Exp-H: Validate Layer 2.5 Oracle threshold cross-skill generalization
 *
 * Tests whether the Layer 2.5 oracle thresholds (Class A ≥ 0.85, Class B ≥ 0.70 verdict-only,
 * Class C ≥ 0.80) calibrated on loop-backlog / task-from-template / task-to-backlog (Exp-B/D/E)
 * also hold for other operator skills: feature-to-backlog and backlog-setup.
 *
 * H-universal: σ(verdict_only across skills) < 0.10 → global thresholds are valid
 * H-per-skill: σ(verdict_only across skills) ≥ 0.10 → per-skill calibration required
 *
 * Usage:
 *   npx tsx exp-h/run-exp-h.ts [--k 5] [--out artifacts/runs/exp-h]
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractAnswer, scoreResponse } from '../lib/score.js';
import { validateEnv, getModelPrimary } from '../lib/env.js';
import { runExperiment, type ExperimentConfig, type FixtureRecord } from '../lib/runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXP_ROOT = join(__dirname, '..');

// Skill SKILL.md paths for P-full injection
const SKILL_PATHS: Record<string, string> = {
  'feature-to-backlog': join(EXP_ROOT, '../../plugin/skills/feature-to-backlog/SKILL.md'),
  'backlog-setup': join(EXP_ROOT, '../../plugin/skills/backlog-setup/SKILL.md'),
};

const FIXTURE_DIRS: Record<string, string> = {
  'feature-to-backlog': join(EXP_ROOT, 'fixtures/exp-h/feature-to-backlog'),
  'backlog-setup': join(EXP_ROOT, 'fixtures/exp-h/backlog-setup'),
};

// Sanity (negative control) fixture directory
export const SANITY_FIXTURE_DIR = join(EXP_ROOT, 'fixtures/sanity');

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag: string, def: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1]! : def;
  };
  return {
    k: parseInt(get('--k', '5'), 10),
    outDir: join(EXP_ROOT, get('--out', 'artifacts/runs/exp-h')),
    analysisDir: join(EXP_ROOT, 'artifacts/analysis'),
  };
}

// ---------- Fixture types ----------

interface BaseFixture extends FixtureRecord {
  skill: string;
  taskClass: 'A' | 'B' | 'C';
  taskType: string;
  decisionPoint: string;
  specSection: string;
  answer: unknown;
  answerType: 'exact' | 'set' | 'partial';
  fixtureClass: 'CLEAR' | 'AMBIGUOUS' | 'ERROR';
  ground_truth_rationale: string;
}

// ---------- Prompt builders ----------

function buildPromptExact(skillContent: string, fixture: BaseFixture): string {
  const stateObj = (fixture as BaseFixture & { state?: unknown }).state;
  const inputObj = (fixture as BaseFixture & { input?: unknown }).input;
  const lines: string[] = [
    `You are executing a decision step in the ${fixture.skill} skill.`,
    '',
    '## SKILL.md (P-full injection)',
    skillContent,
    '',
    `## Decision Point: ${fixture.decisionPoint}`,
    '',
    '## Spec (excerpt)',
    fixture.specSection,
    '',
    '## Input',
    '```json',
    JSON.stringify(inputObj ?? {}, null, 2),
    '```',
  ];
  if (stateObj !== undefined) {
    lines.push('');
    lines.push('## Environment State');
    lines.push('```json');
    lines.push(JSON.stringify(stateObj, null, 2));
    lines.push('```');
  }
  lines.push('');
  lines.push(`Given the spec and input above, what is the result of ${fixture.decisionPoint}?`);
  lines.push('Output ONLY valid JSON: {"answer": "<result>"}');
  lines.push('Where <result> is one of the possible output values defined in the spec.');
  return lines.join('\n');
}

function buildPromptSet(skillContent: string, fixture: BaseFixture): string {
  const stateObj = (fixture as BaseFixture & { state?: unknown }).state ?? {};
  return [
    `You are executing a decision step in the ${fixture.skill} skill.`,
    '',
    '## SKILL.md (P-full injection)',
    skillContent,
    '',
    `## Decision Point: ${fixture.decisionPoint}`,
    '',
    '## Spec (excerpt)',
    fixture.specSection,
    '',
    '## Current State',
    '```json',
    JSON.stringify(stateObj, null, 2),
    '```',
    '',
    `Given the spec and state above, what does ${fixture.decisionPoint}() return?`,
    'Output ONLY valid JSON: {"answer": ["item1", "item2", ...]}',
    'List all missing/required items as an array. Use empty array [] if none.',
  ].join('\n');
}

function buildPromptPartial(skillContent: string, fixture: BaseFixture): string {
  const planObj = (fixture as BaseFixture & { plan?: unknown }).plan ?? {};
  const configObj = (fixture as BaseFixture & { config?: unknown }).config ?? {};
  return [
    `You are reviewing a plan against the ${fixture.skill} skill's invariants.`,
    '',
    '## SKILL.md (P-full injection)',
    skillContent,
    '',
    `## Decision Point: ${fixture.decisionPoint}`,
    '',
    '## Spec (excerpt)',
    fixture.specSection,
    '',
    '## Config',
    '```json',
    JSON.stringify(configObj, null, 2),
    '```',
    '',
    '## Plan to Review',
    '```json',
    JSON.stringify(planObj, null, 2),
    '```',
    '',
    `Check whether this plan satisfies all invariants in the spec for ${fixture.decisionPoint}.`,
    'Output ONLY valid JSON:',
    '{"verdict": "APPROVED" | "NEEDS_REVISION", "failing_invariants": ["<invariant>", ...]}',
    '',
    'If APPROVED, "failing_invariants" must be []. For NEEDS_REVISION, list each violated invariant.',
  ].join('\n');
}

// ---------- Answer extraction and scoring ----------

function extractAnswerForFixture(response: string, fixture: BaseFixture): unknown {
  if (fixture.answerType === 'partial') {
    const tryParse = (s: string) => {
      try {
        const obj = JSON.parse(s);
        if (obj && typeof obj === 'object' && 'verdict' in obj) {
          return {
            verdict: obj.verdict,
            items: Array.isArray(obj.failing_invariants) ? obj.failing_invariants : [],
          };
        }
      } catch {}
      return null;
    };
    const fenceMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (fenceMatch) { const r = tryParse(fenceMatch[1]!); if (r) return r; }
    const jsonMatch = response.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
    if (jsonMatch) { const r = tryParse(jsonMatch[0]); if (r) return r; }
    return null;
  }
  if (fixture.answerType === 'set') {
    const jsonMatch = response.match(/\{[^{}]*"answer"\s*:\s*\[[^\]]*\][^{}]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]).answer; } catch {}
    }
    const fenceMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (fenceMatch) {
      try { return JSON.parse(fenceMatch[1]!).answer; } catch {}
    }
    return null;
  }
  return extractAnswer(response);
}

function scoreForFixture(extracted: unknown, fixture: BaseFixture): number {
  if (fixture.answerType === 'partial') {
    const gt = fixture.answer as { verdict: string; failing_invariants: string[] };
    return scoreResponse(
      extracted,
      { verdict: gt.verdict, items: gt.failing_invariants },
      'partial',
    );
  }
  return scoreResponse(extracted, fixture.answer, fixture.answerType);
}

function verdictOnlyScore(extracted: unknown, fixture: BaseFixture): number {
  if (fixture.answerType === 'partial') {
    const gt = fixture.answer as { verdict: string; failing_invariants: string[] };
    const ans = extracted as { verdict?: string } | null;
    if (!ans || !ans.verdict) return 0;
    return ans.verdict.toLowerCase() === gt.verdict.toLowerCase() ? 1 : 0;
  }
  return scoreForFixture(extracted, fixture);
}

// ---------- Load fixture file paths for a skill directory ----------

async function loadFixturePaths(dir: string): Promise<string[]> {
  const files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort();
  const paths = files.map(f => join(dir, f));
  // Filter to CLEAR fixtures only (matches original logic)
  const cleared: string[] = [];
  for (const p of paths) {
    const fx = JSON.parse(await readFile(p, 'utf-8')) as { fixtureClass?: string };
    if (fx.fixtureClass === 'CLEAR') cleared.push(p);
  }
  return cleared;
}

// ---------- Build ExperimentConfig (exported for tests) ----------

export async function buildConfig(opts: {
  k: number;
  outDir: string;
}): Promise<ExperimentConfig> {
  const skillNames = Object.keys(FIXTURE_DIRS);
  const variants: Record<string, string[]> = {};
  const skillContents: Record<string, string> = {};

  for (const skill of skillNames) {
    const paths = await loadFixturePaths(FIXTURE_DIRS[skill]!);
    variants[skill] = paths;
    skillContents[skill] = await readFile(SKILL_PATHS[skill]!, 'utf-8');
  }

  const config: ExperimentConfig = {
    variants,
    modelList: [getModelPrimary()],
    k: opts.k,
    outDir: opts.outDir,
    sanityDir: SANITY_FIXTURE_DIR,

    buildPrompt(fixture: FixtureRecord, variant: string): string {
      const fx = fixture as BaseFixture;
      const content = skillContents[variant] ?? skillContents[fx.skill] ?? '';
      if (fx.answerType === 'exact') return buildPromptExact(content, fx);
      if (fx.answerType === 'set') return buildPromptSet(content, fx);
      if (fx.answerType === 'partial') return buildPromptPartial(content, fx);
      return buildPromptExact(content, fx);
    },

    scoreResponse(response: string, fixture: FixtureRecord): number {
      const fx = fixture as BaseFixture;
      const extracted = extractAnswerForFixture(response, fx);
      return scoreForFixture(extracted, fx);
    },
  };

  return config;
}

// ---------- Cross-skill variance analysis (Exp-H specific) ----------

async function analyze(
  outDir: string,
  analysisDir: string,
  eligibleSkills: string[],
  allFixtures: Record<string, BaseFixture[]>,
  model: string,
) {
  type FixtureScore = {
    fixtureId: string;
    taskClass: string;
    composite: number;
    verdict_only: number;
  };

  const perSkill: Record<string, {
    verdict_only: number;
    composite: number;
    n_fixtures: number;
    per_fixture: FixtureScore[];
  }> = {};

  const modelSlug = model.replace(/[^a-z0-9-]/gi, '_');

  for (const skill of eligibleSkills) {
    const fixtures = allFixtures[skill]!;
    const perFixture: FixtureScore[] = [];

    for (const fixture of fixtures) {
      const resultPath = join(outDir, skill, modelSlug, fixture.id, 'result.json');
      const result = JSON.parse(await readFile(resultPath, 'utf-8')) as { responses: string[] };

      const compositeScores = result.responses.map(r => {
        const extracted = extractAnswerForFixture(r, fixture);
        return scoreForFixture(extracted, fixture);
      });
      const verdictScores = result.responses.map(r => {
        const extracted = extractAnswerForFixture(r, fixture);
        return verdictOnlyScore(extracted, fixture);
      });

      const meanComposite = compositeScores.length > 0
        ? compositeScores.reduce((a, b) => a + b, 0) / compositeScores.length : 0;
      const meanVerdict = verdictScores.length > 0
        ? verdictScores.reduce((a, b) => a + b, 0) / verdictScores.length : 0;

      perFixture.push({
        fixtureId: fixture.id,
        taskClass: fixture.taskClass,
        composite: Math.round(meanComposite * 1000) / 1000,
        verdict_only: Math.round(meanVerdict * 1000) / 1000,
      });
    }

    const composite = perFixture.length > 0
      ? perFixture.reduce((s, f) => s + f.composite, 0) / perFixture.length : 0;
    const verdict_only = perFixture.length > 0
      ? perFixture.reduce((s, f) => s + f.verdict_only, 0) / perFixture.length : 0;

    perSkill[skill] = {
      verdict_only: Math.round(verdict_only * 1000) / 1000,
      composite: Math.round(composite * 1000) / 1000,
      n_fixtures: perFixture.length,
      per_fixture: perFixture,
    };
  }

  // Cross-skill variance analysis
  const verdictOnlyValues = eligibleSkills.map(s => perSkill[s]?.verdict_only ?? 0);
  const mean = verdictOnlyValues.reduce((a, b) => a + b, 0) / verdictOnlyValues.length;
  const variance = verdictOnlyValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / verdictOnlyValues.length;
  const sigma = Math.sqrt(variance);

  const hUniversal = sigma < 0.10;
  const hypothesis = hUniversal ? 'H-universal CONFIRMED' : 'H-per-skill CONFIRMED';
  const recommendation = hUniversal ? 'global-threshold'
    : sigma < 0.15 ? 'hybrid'
    : 'per-skill-calibration';

  const SUSPICIOUSLY_LOW_SIGMA_THRESHOLD = 0.005;
  const suspisciouslyLow = sigma < SUSPICIOUSLY_LOW_SIGMA_THRESHOLD;
  if (suspisciouslyLow) {
    console.warn(
      `\nWARNING: suspiciously_low σ detected: σ=${sigma.toFixed(6)} < ${SUSPICIOUSLY_LOW_SIGMA_THRESHOLD}.\n` +
      `  This may indicate anchored/estimated data. Verify real LLM responses.\n`
    );
  }

  const refSkills = {
    'loop-backlog': { verdict_only: 0.92, source: 'Exp-D P-full' },
    'task-from-template': { verdict_only: 0.92, source: 'Exp-D P-full' },
    'task-to-backlog': { verdict_only: 0.667, source: 'Exp-E CLEAR subset' },
  };

  const results = {
    generated: new Date().toISOString(),
    data_source: 'measured' as const,
    data_source_note: `Real LLM calls: ${eligibleSkills.length} skills × fixtures × k=5. Run artifacts in artifacts/runs/exp-h/.`,
    model,
    reference_skills: refSkills,
    per_skill: Object.fromEntries(
      eligibleSkills.map(s => [s, {
        verdict_only: perSkill[s]?.verdict_only ?? 0,
        composite: perSkill[s]?.composite ?? 0,
      }]),
    ),
    sigma: Math.round(sigma * 1000) / 1000,
    ...(suspisciouslyLow ? { suspiciously_low: true } : {}),
    mean_verdict_only: Math.round(mean * 1000) / 1000,
    hypothesis,
    threshold_sigma: 0.10,
    recommendation,
    interpretation: hUniversal
      ? `Cross-skill σ=${sigma.toFixed(3)} < 0.10. Oracle thresholds generalize across skills. Global threshold table is valid.`
      : `Cross-skill σ=${sigma.toFixed(3)} ≥ 0.10. Skill-specific calibration recommended.`,
    layer25_threshold_table: {
      'Class A': { threshold: 0.85, condition: 'P-full injection' },
      'Class B': { threshold: 0.70, condition: 'verdict-only, scorer pre-validated' },
      'Class C': { threshold: 0.80, condition: 'verdict-only' },
      status: hUniversal ? 'CONFIRMED universal' : 'REQUIRES per-skill calibration',
    },
  };

  await mkdir(analysisDir, { recursive: true });
  const resultsPath = join(analysisDir, 'exp-h-results.json');
  await writeFile(resultsPath, JSON.stringify(results, null, 2));
  console.log(`Results: ${resultsPath}`);

  console.log('\n--- Exp-H Summary ---');
  for (const skill of eligibleSkills) {
    const s = perSkill[skill]!;
    console.log(`  ${skill}: verdict_only=${s.verdict_only.toFixed(3)} composite=${s.composite.toFixed(3)}`);
  }
  console.log(`  σ(verdict_only) = ${sigma.toFixed(3)}`);
  console.log(`  Hypothesis: ${hypothesis}`);
  console.log(`  Recommendation: ${recommendation}`);

  return results;
}

// ---------- Main ----------

async function main() {
  validateEnv();
  const opts = parseArgs();
  const model = getModelPrimary();

  const config = await buildConfig({ k: opts.k, outDir: opts.outDir });

  // Filter to eligible skills (≥ 6 CLEAR fixtures)
  const skillNames = Object.keys(FIXTURE_DIRS);
  const eligibleSkills = skillNames.filter(s => (config.variants[s]?.length ?? 0) >= 6);
  const allFixtures: Record<string, BaseFixture[]> = {};

  for (const skill of skillNames) {
    const paths = config.variants[skill] ?? [];
    const eligible = paths.length >= 6;
    console.log(`${skill}: ${paths.length} CLEAR fixtures — ${eligible ? 'ELIGIBLE' : 'DEFERRED (< 6)'}`);
    if (eligible) {
      allFixtures[skill] = await Promise.all(
        paths.map(async p => JSON.parse(await readFile(p, 'utf-8')) as BaseFixture)
      );
    }
  }

  // Filter config variants to eligible skills only
  const eligibleConfig: ExperimentConfig = {
    ...config,
    variants: Object.fromEntries(
      eligibleSkills.map(s => [s, config.variants[s] ?? []])
    ),
  };

  console.log(`\nModel: ${model} | k=${opts.k}`);
  await runExperiment(eligibleConfig);

  console.log('\nScoring and analyzing...');
  await analyze(opts.outDir, opts.analysisDir, eligibleSkills, allFixtures, model);
}

// Guard: only run main() when this module is the entry point (not when imported by tests)
const isEntryPoint = process.argv[1] === fileURLToPath(import.meta.url) ||
  // tsx resolves .ts → .js; also handle tsx stripping the extension
  process.argv[1]?.endsWith('run-exp-h.ts');
if (isEntryPoint) {
  main().catch(e => { console.error(e); process.exit(1); });
}
