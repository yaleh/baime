/**
 * run-oracle-class-b.ts — Layer 2.5 Oracle: reviewPlan invariant-check
 *
 * Runs the 8 Class B fixtures (invariant-check / reviewPlan) through the model
 * using P-full injection of the feature-to-backlog SKILL.md.
 * Exit 0 if verdict_only accuracy ≥ threshold, exit 1 if not.
 *
 * Usage:
 *   npx tsx scripts/run-oracle-class-b.ts [--threshold 0.70] [--k 5] [--skill feature-to-backlog]
 *
 * Returns exit code 0 (pass) or 1 (fail) — safe to use as a CI gate.
 */

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLlmClient } from '../lib/llm-client.js';
import { scoreResponse } from '../lib/score.js';
import { validateEnv, getModelPrimary } from '../lib/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXP_ROOT = join(__dirname, '..');
const FIXTURES_DIR = join(EXP_ROOT, 'fixtures', 'exp-b', 'class-b');

function getArg(flag: string, def: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : def;
}
const THRESHOLD = parseFloat(getArg('--threshold', '0.70'));
const K = parseInt(getArg('--k', '5'), 10);
const SKILL = getArg('--skill', 'feature-to-backlog');

interface FixtureAnswer {
  verdict: string;
  failing_invariants: string[];
}

interface Fixture {
  id: string;
  taskClass: string;
  taskType: string;
  fixtureClass?: string;
  specSection: string;
  plan: {
    phases: Array<{
      title: string;
      instructions: string;
      dod: string[];
    }>;
    constraints: string[];
    acceptance: string[];
  };
  answer: FixtureAnswer;
  answerType: 'exact' | 'set' | 'partial';
}

// Skill SKILL.md path (referenced for P-full injection):
// - feature-to-backlog/SKILL.md
async function loadSkillMd(skill: string): Promise<string> {
  // Only feature-to-backlog/SKILL.md is used for Class B
  const relPath = 'feature-to-backlog/SKILL.md';
  const skillPath = join(EXP_ROOT, '..', '..', 'plugin', 'skills', relPath);
  return readFile(skillPath, 'utf-8');
}

function buildPrompt(fixture: Fixture, skillMd: string): string {
  const planJson = JSON.stringify(fixture.plan, null, 2);
  return [
    '## SKILL.md (P-full injection)',
    '',
    skillMd,
    '',
    '---',
    '',
    'You are performing a reviewPlan invariant check.',
    '',
    'Spec:',
    fixture.specSection,
    '',
    'Plan to review:',
    '```json',
    planJson,
    '```',
    '',
    'Check each invariant in the spec against the plan.',
    'If all invariants pass, return APPROVED with an empty failing_invariants list.',
    'If any invariant fails, return NEEDS_REVISION and list the failing invariants.',
    '',
    'Output ONLY valid JSON:',
    '{"verdict":"APPROVED","failing_invariants":[]}',
    'or',
    '{"verdict":"NEEDS_REVISION","failing_invariants":["<invariant1>","<invariant2>"]}',
  ].join('\n');
}

function extractResponse(response: string): { verdict?: string; failing_invariants?: string[] } | null {
  // Try JSON with "verdict" key directly
  const jsonMatch = response.match(/\{[\s\S]*?"verdict"\s*:\s*"(?:APPROVED|NEEDS_REVISION)"[\s\S]*?\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }
  // Try code fence
  const fenceMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]!);
      if (parsed.verdict) return parsed;
    } catch {}
  }
  return null;
}

async function main() {
  validateEnv();
  const model = getModelPrimary();
  const client = createLlmClient();

  const skillMd = await loadSkillMd(SKILL);

  const files = (await readdir(FIXTURES_DIR)).filter(f => f.endsWith('.json')).sort();
  const allFixtures: Fixture[] = await Promise.all(
    files.map(async f => JSON.parse(await readFile(join(FIXTURES_DIR, f), 'utf-8'))),
  );

  // Defensive guard: exclude AMBIGUOUS fixtures
  const fixtures = allFixtures.filter(f => f.fixtureClass !== 'AMBIGUOUS');

  console.log(`Layer 2.5 Oracle — Class B (reviewPlan invariant-check)`);
  console.log(`Skill: ${SKILL}  |  Model: ${model}  |  Fixtures: ${fixtures.length}  |  k=${K}  |  Threshold: ${threshold}`);
  console.log('');

  const perFixture: Array<{
    id: string;
    verdictScores: number[];
    compositeScores: number[];
    verdict_only: number;
    composite: number;
    expected_verdict: string;
  }> = [];

  for (const fixture of fixtures) {
    const prompt = buildPrompt(fixture, skillMd);
    const verdictScores: number[] = [];
    const compositeScores: number[] = [];

    for (let i = 0; i < K; i++) {
      try {
        const resp = await client.chat({
          model,
          messages: [{ role: 'user', content: prompt }],
        });
        const extracted = extractResponse(resp.content);

        // verdict_only: 1.0 if verdict matches, else 0
        const verdictMatch =
          extracted?.verdict?.toUpperCase() === fixture.answer.verdict.toUpperCase() ? 1 : 0;
        verdictScores.push(verdictMatch);

        // composite: scoreResponse with 'partial' mode
        // Construct answer object for partial scoring
        const answerObj = extracted
          ? { verdict: extracted.verdict, items: extracted.failing_invariants ?? [] }
          : null;
        const groundTruth = {
          verdict: fixture.answer.verdict,
          items: fixture.answer.failing_invariants,
        };
        const compositeScore = scoreResponse(answerObj, groundTruth, 'partial');
        compositeScores.push(compositeScore);
      } catch (err) {
        console.error(`  ERROR ${fixture.id} run ${i}:`, (err as Error).message);
        verdictScores.push(0);
        compositeScores.push(0);
      }
    }

    const verdictOnly = verdictScores.reduce((a, b) => a + b, 0) / verdictScores.length;
    const composite = compositeScores.reduce((a, b) => a + b, 0) / compositeScores.length;
    perFixture.push({
      id: fixture.id,
      verdictScores,
      compositeScores,
      verdict_only: verdictOnly,
      composite,
      expected_verdict: fixture.answer.verdict,
    });

    const status = verdictOnly >= threshold ? '✓' : '✗';
    console.log(
      `  ${status} ${fixture.id}: verdict_only=${verdictOnly.toFixed(2)} composite=${composite.toFixed(2)} (expected: ${fixture.answer.verdict})`,
    );
  }

  const verdict_only =
    perFixture.reduce((a, r) => a + r.verdict_only, 0) / perFixture.length;
  const composite =
    perFixture.reduce((a, r) => a + r.composite, 0) / perFixture.length;
  const pass = verdict_only >= threshold;

  let scorer_warning = false;
  if (composite < verdict_only - 0.1) {
    console.error('scorer-warning: composite score is significantly lower than verdict_only score');
    scorer_warning = true;
  }

  console.log('');
  console.log(`verdict_only accuracy: ${verdict_only.toFixed(3)} (threshold: ${threshold})`);
  console.log(`composite accuracy:    ${composite.toFixed(3)}`);
  if (scorer_warning) console.log('⚠️  scorer-warning: composite diverges from verdict_only by > 0.1');
  console.log(pass ? '✅ PASS — Class B oracle verified' : '❌ FAIL — verdict_only below threshold');

  // Write results artifact
  const artifactsDir = join(EXP_ROOT, 'artifacts', 'analysis');
  await mkdir(artifactsDir, { recursive: true });
  const results = {
    data_source: 'measured',
    verdict_only,
    composite,
    scorer_warning,
    threshold,
    skill: SKILL,
    model,
    k: K,
    fixture_count: perFixture.length,
    pass,
    per_fixture: perFixture.map(r => ({
      id: r.id,
      expected_verdict: r.expected_verdict,
      verdict_only: r.verdict_only,
      composite: r.composite,
      verdictScores: r.verdictScores,
      compositeScores: r.compositeScores,
    })),
  };
  await writeFile(
    join(artifactsDir, 'oracle-class-b-results.json'),
    JSON.stringify(results, null, 2),
  );
  console.log('');
  console.log('Results written to artifacts/analysis/oracle-class-b-results.json');

  process.exit(pass ? 0 : 1);
}

// hoist threshold for use inside main
const threshold = THRESHOLD;
main().catch(e => { console.error(e); process.exit(1); });
