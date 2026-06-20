/**
 * run-oracle-class-a.ts — Layer 2.5 Oracle: freshnessCheck binary-gate
 *
 * Runs the 10 Class A fixtures (binary-gate / FRESH|STALE) through the model
 * using P-full injection of the skill SKILL.md and reports accuracy.
 * Exit 0 if accuracy ≥ threshold, exit 1 if not.
 *
 * Usage:
 *   npx tsx scripts/run-oracle-class-a.ts [--threshold 0.85] [--k 5] [--skill task-from-template]
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
const FIXTURES_DIR = join(EXP_ROOT, 'fixtures', 'exp-b', 'class-a');

function getArg(flag: string, def: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : def;
}
const THRESHOLD = parseFloat(getArg('--threshold', '0.85'));
const K = parseInt(getArg('--k', '5'), 10);
const SKILL = getArg('--skill', 'task-from-template');

interface Fixture {
  id: string;
  taskClass: string;
  taskType: string;
  templateMeta: {
    slug: string;
    lastUsed: string;
    applicableWhen: string;
  };
  recentChanges: string[];
  answer: string;
  answerType: 'exact' | 'set' | 'partial';
}

// Skill SKILL.md paths (referenced for P-full injection):
// - task-from-template/SKILL.md
// - task-to-backlog/SKILL.md
async function loadSkillMd(skill: string): Promise<string> {
  let relPath: string;
  if (skill === 'task-from-template') {
    relPath = 'task-from-template/SKILL.md';
  } else if (skill === 'task-to-backlog') {
    relPath = 'task-to-backlog/SKILL.md';
  } else {
    throw new Error(`Unknown skill: ${skill}. Supported: task-from-template, task-to-backlog`);
  }
  const skillPath = join(EXP_ROOT, '..', '..', 'plugin', 'skills', relPath);
  return readFile(skillPath, 'utf-8');
}

function buildPrompt(fixture: Fixture, skillMd: string): string {
  const changesText = fixture.recentChanges.map(c => `  - ${c}`).join('\n');
  return [
    '## SKILL.md (P-full injection)',
    '',
    skillMd,
    '',
    '---',
    '',
    'You are evaluating whether a task-from-template invocation is FRESH or STALE.',
    '',
    'A template is FRESH if recent git changes do NOT touch the skill logic, fixtures, or',
    'core scripts that the template depends on. It is STALE if recent changes may have',
    'invalidated the template assumptions.',
    '',
    `Template slug: ${fixture.templateMeta.slug}`,
    `Applicable when: ${fixture.templateMeta.applicableWhen}`,
    `Last used: ${fixture.templateMeta.lastUsed}`,
    '',
    'Recent git changes:',
    changesText,
    '',
    'Based on the SKILL.md freshnessCheck specification and the recent changes above,',
    'is this template FRESH or STALE?',
    '',
    'Output ONLY valid JSON: {"verdict":"FRESH"} or {"verdict":"STALE"}',
  ].join('\n');
}

function extractVerdict(response: string): string | null {
  // Try JSON with "verdict" key
  const jsonMatch = response.match(/\{[^{}]*"verdict"\s*:\s*"([^"]+)"[^{}]*\}/);
  if (jsonMatch) return jsonMatch[1]!;
  // Try code fence
  const fenceMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]!);
      if (parsed.verdict) return parsed.verdict;
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
  const fixtures: Fixture[] = await Promise.all(
    files.map(async f => JSON.parse(await readFile(join(FIXTURES_DIR, f), 'utf-8'))),
  );

  console.log(`Layer 2.5 Oracle — Class A (freshnessCheck binary-gate)`);
  console.log(`Skill: ${SKILL}  |  Model: ${model}  |  Fixtures: ${fixtures.length}  |  k=${K}  |  Threshold: ${threshold}`);
  console.log('');

  const perFixture: Array<{ id: string; scores: number[]; mean: number; expected: string }> = [];

  for (const fixture of fixtures) {
    const prompt = buildPrompt(fixture, skillMd);
    const scores: number[] = [];

    for (let i = 0; i < K; i++) {
      try {
        const resp = await client.chat({
          model,
          messages: [{ role: 'user', content: prompt }],
        });
        const extracted = extractVerdict(resp.content);
        // Score using exact match: compare extracted verdict to expected answer
        const score = scoreResponse(extracted, fixture.answer, 'exact');
        scores.push(score);
      } catch (err) {
        console.error(`  ERROR ${fixture.id} run ${i}:`, (err as Error).message);
        scores.push(0);
      }
    }

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    perFixture.push({ id: fixture.id, scores, mean, expected: fixture.answer });

    const status = mean >= threshold ? '✓' : '✗';
    console.log(`  ${status} ${fixture.id}: ${mean.toFixed(2)} (expected: ${fixture.answer})`);
  }

  const accuracy = perFixture.reduce((a, r) => a + r.mean, 0) / perFixture.length;
  const pass = accuracy >= threshold;

  console.log('');
  console.log(`Overall accuracy: ${accuracy.toFixed(3)} (threshold: ${threshold})`);
  console.log(pass ? '✅ PASS — Class A oracle verified' : '❌ FAIL — accuracy below threshold');

  // Write results artifact
  const artifactsDir = join(EXP_ROOT, 'artifacts', 'analysis');
  await mkdir(artifactsDir, { recursive: true });
  const results = {
    data_source: 'measured',
    accuracy,
    threshold,
    skill: SKILL,
    model,
    k: K,
    fixture_count: perFixture.length,
    pass,
    per_fixture: perFixture.map(r => ({
      id: r.id,
      expected: r.expected,
      mean: r.mean,
      scores: r.scores,
    })),
  };
  await writeFile(
    join(artifactsDir, 'oracle-class-a-results.json'),
    JSON.stringify(results, null, 2),
  );
  console.log('');
  console.log('Results written to artifacts/analysis/oracle-class-a-results.json');

  process.exit(pass ? 0 : 1);
}

// hoist threshold for use inside main
const threshold = THRESHOLD;
main().catch(e => { console.error(e); process.exit(1); });
