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
 * Design:
 *   - P-full prompt injection (complete SKILL.md content per Exp-D/F recommendation)
 *   - Model: Haiku (MODEL_PRIMARY), k=5
 *   - Reports both composite score and verdict-only accuracy per skill
 *   - ≥6 CLEAR fixtures per skill required; otherwise: defer (not counted)
 *
 * Usage:
 *   npx tsx exp-h/run-exp-h.ts [--k 5] [--out artifacts/runs/exp-h]
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLlmClient } from '../lib/llm-client.js';
import { extractAnswer, scoreResponse } from '../lib/score.js';
import { validateEnv, getModelPrimary } from '../lib/env.js';

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

interface BaseFixture {
  id: string;
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

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function loadFixtures(dir: string): Promise<BaseFixture[]> {
  const files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort();
  const all = await Promise.all(
    files.map(async f => JSON.parse(await readFile(join(dir, f), 'utf-8')) as BaseFixture),
  );
  return all.filter(f => f.fixtureClass === 'CLEAR');
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
  const planObj = (fixture as BaseFixture & { plan?: unknown; config?: unknown }).plan ?? {};
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

function buildPrompt(skillContent: string, fixture: BaseFixture): string {
  if (fixture.answerType === 'exact') return buildPromptExact(skillContent, fixture);
  if (fixture.answerType === 'set') return buildPromptSet(skillContent, fixture);
  if (fixture.answerType === 'partial') return buildPromptPartial(skillContent, fixture);
  return buildPromptExact(skillContent, fixture);
}

// ---------- Answer extraction per type ----------

function extractAnswerForFixture(response: string, fixture: BaseFixture): unknown {
  if (fixture.answerType === 'partial') {
    // Extract verdict + failing_invariants
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
    // Look for {"answer": [...]}
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

  // exact
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

// Verdict-only score: for partial fixtures only check the verdict field
function verdictOnlyScore(extracted: unknown, fixture: BaseFixture): number {
  if (fixture.answerType === 'partial') {
    const gt = fixture.answer as { verdict: string; failing_invariants: string[] };
    const ans = extracted as { verdict?: string } | null;
    if (!ans || !ans.verdict) return 0;
    return ans.verdict.toLowerCase() === gt.verdict.toLowerCase() ? 1 : 0;
  }
  // For exact/set, verdict-only == composite
  return scoreForFixture(extracted, fixture);
}

// ---------- Main ----------

async function main() {
  validateEnv();
  const opts = parseArgs();
  const client = createLlmClient();
  const model = getModelPrimary();

  const skillNames = Object.keys(FIXTURE_DIRS);
  const allFixtures: Record<string, BaseFixture[]> = {};
  const skillContents: Record<string, string> = {};

  // Load fixtures and skill content
  for (const skill of skillNames) {
    const fixtures = await loadFixtures(FIXTURE_DIRS[skill]!);
    allFixtures[skill] = fixtures;

    const skillPath = SKILL_PATHS[skill]!;
    skillContents[skill] = await readFile(skillPath, 'utf-8');

    const eligible = fixtures.length >= 6;
    console.log(`${skill}: ${fixtures.length} CLEAR fixtures — ${eligible ? 'ELIGIBLE' : 'DEFERRED (< 6)'}`);
  }

  const eligibleSkills = skillNames.filter(s => (allFixtures[s]?.length ?? 0) >= 6);
  const totalCalls = eligibleSkills.reduce((sum, s) => sum + (allFixtures[s]?.length ?? 0), 0) * opts.k;

  console.log(`\nModel: ${model} | k=${opts.k} | Total calls: ${totalCalls}`);
  console.log('');

  let completed = 0;
  let skipped = 0;

  // ---------- Run LLM calls ----------
  for (const skill of eligibleSkills) {
    const fixtures = allFixtures[skill]!;
    const content = skillContents[skill]!;

    for (const fixture of fixtures) {
      const runDir = join(opts.outDir, skill, fixture.id);
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

      const prompt = buildPrompt(content, fixture);

      for (let i = 0; i < needed; i++) {
        try {
          const resp = await client.chat({
            model,
            messages: [{ role: 'user', content: prompt }],
          });
          responses.push(resp.content);
          completed++;

          if ((completed + skipped) % 5 === 0) {
            const pct = Math.round((completed + skipped) / totalCalls * 100);
            process.stdout.write(`\r  [${pct}%] ${completed} done, ${skipped} skipped`);
          }
        } catch (err) {
          console.error(`\n  ERROR ${skill}/${fixture.id} run ${i}:`, (err as Error).message);
        }
      }

      await mkdir(runDir, { recursive: true });
      await writeFile(resultPath, JSON.stringify({
        skill,
        model,
        fixtureId: fixture.id,
        taskClass: fixture.taskClass,
        answerType: fixture.answerType,
        groundTruth: fixture.answer,
        responses,
      }, null, 2));
    }
  }

  if (totalCalls > 0) {
    console.log(`\n\nDone: ${completed} new calls, ${skipped} checkpointed.`);
  }

  console.log('\nScoring and analyzing...');
  await analyze(opts.outDir, opts.analysisDir, allFixtures, model, eligibleSkills);
}

// ---------- Analysis ----------

async function analyze(
  outDir: string,
  analysisDir: string,
  allFixtures: Record<string, BaseFixture[]>,
  model: string,
  eligibleSkills: string[],
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

  for (const skill of eligibleSkills) {
    const fixtures = allFixtures[skill]!;
    const perFixture: FixtureScore[] = [];

    for (const fixture of fixtures) {
      const resultPath = join(outDir, skill, fixture.id, 'result.json');
      if (!(await fileExists(resultPath))) {
        throw new Error(
          `Missing result for ${skill}/${fixture.id} — run the LLM pass before analyzing. ` +
          `(Provenance guard: analysis requires measured data, not estimated values.)`
        );
      }

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

  // Raw output
  const raw = {
    generated: new Date().toISOString(),
    model,
    k: 5,
    prompt_style: 'P-full',
    eligible_skills: eligibleSkills,
    'feature-to-backlog': perSkill['feature-to-backlog'] ?? null,
    'backlog-setup': perSkill['backlog-setup'] ?? null,
    per_skill: perSkill,
  };

  await mkdir(analysisDir, { recursive: true });
  const rawPath = join(analysisDir, 'exp-h-raw.json');
  await writeFile(rawPath, JSON.stringify(raw, null, 2));
  console.log(`Raw results: ${rawPath}`);

  // ---------- Cross-skill variance analysis ----------
  const verdictOnlyValues = eligibleSkills.map(s => perSkill[s]?.verdict_only ?? 0);
  const mean = verdictOnlyValues.reduce((a, b) => a + b, 0) / verdictOnlyValues.length;
  const variance = verdictOnlyValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / verdictOnlyValues.length;
  const sigma = Math.sqrt(variance);

  const hUniversal = sigma < 0.10;
  const hypothesis = hUniversal ? 'H-universal CONFIRMED' : 'H-per-skill CONFIRMED';
  const recommendation = hUniversal ? 'global-threshold'
    : sigma < 0.15 ? 'hybrid'
    : 'per-skill-calibration';

  // Reference accuracies from Exp-B/D/E (loop-backlog / task-from-template skills)
  const refSkills = {
    'loop-backlog': { verdict_only: 0.92, source: 'Exp-D P-full' },
    'task-from-template': { verdict_only: 0.92, source: 'Exp-D P-full' },
    'task-to-backlog': { verdict_only: 0.667, source: 'Exp-E CLEAR subset' },
  };

  const results = {
    generated: new Date().toISOString(),
    data_source: 'measured',
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
    mean_verdict_only: Math.round(mean * 1000) / 1000,
    hypothesis,
    threshold_sigma: 0.10,
    recommendation,
    interpretation: hUniversal
      ? `Cross-skill σ=${sigma.toFixed(3)} < 0.10. Oracle thresholds generalize across skills. Global threshold table is valid.`
      : `Cross-skill σ=${sigma.toFixed(3)} ≥ 0.10. Skill-specific calibration recommended. Per-skill thresholds should be measured.`,
    layer25_threshold_table: {
      'Class A': { threshold: 0.85, condition: 'P-full injection' },
      'Class B': { threshold: 0.70, condition: 'verdict-only, scorer pre-validated' },
      'Class C': { threshold: 0.80, condition: 'verdict-only' },
      status: hUniversal ? 'CONFIRMED universal' : 'REQUIRES per-skill calibration',
    },
  };

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
}

main().catch(e => { console.error(e); process.exit(1); });
