/**
 * run-class-d.ts — Class D: Tool-Invocation Compliance Test Runner
 *
 * Validates that the loop-backlog orchestration skill follows required
 * tool-invocation sequences (e.g. claim before spawn, signal-file before merge).
 *
 * Approach:
 *   1. Load all Class D fixtures from fixtures/class-d/*.json
 *   2. For each fixture, run claude -p --output-format stream-json to get a live trace
 *   3. Validate required_sequence ordering and forbidden_before_step_1 constraints
 *   4. Run k=1 live pass per fixture (single run to validate end-to-end pipeline)
 *   5. Compute per-fixture compliance_rate and overall compliance_rate
 *   6. Write results to artifacts/analysis/exp-class-d-results.json
 *
 * Usage:
 *   npx tsx scripts/run-class-d.ts [--k 1] [--dry-run]
 *
 * --dry-run: Only prints the prompt, does not call claude.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXP_ROOT = join(__dirname, '..');

// ─── Types ────────────────────────────────────────────────────────────────────

interface SequenceStep {
  step: number;
  tool: string;
  pattern: string;
  description: string;
}

interface ForbiddenEntry {
  tool: string;
  pattern: string;
  description: string;
}

interface ClassDFixture {
  id: string;
  taskClass: 'D';
  taskType: 'tool-invocation-compliance';
  skill: string;
  trigger: string;
  context: Record<string, unknown>;
  prompt_template: string;
  required_sequence: SequenceStep[];
  forbidden_before_step_1: ForbiddenEntry[];
  answer: string;
  answerType: 'trace';
}

interface ToolBlock {
  tool_name: string;
  tool_input: Record<string, unknown>;
  position?: number;
  timestamp?: string;
}

interface FixtureResult {
  id: string;
  skill: string;
  protocol_point: string;
  passes: number;
  failures: number;
  compliance_rate: number | null;
  required_sequence_violations: string[];
  forbidden_violations: string[];
  notes: string;
}

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function getArg(flag: string, def: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : def;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const K = parseInt(getArg('--k', '1'), 10);
const DRY_RUN = hasFlag('--dry-run');

// ─── Load fixtures ────────────────────────────────────────────────────────────

async function loadClassDFixtures(dir: string): Promise<ClassDFixture[]> {
  const files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort();
  const fixtures = await Promise.all(
    files.map(async f => {
      const raw = await readFile(join(dir, f), 'utf-8');
      return JSON.parse(raw) as ClassDFixture;
    }),
  );
  return fixtures.filter(f => f.taskClass === 'D' && f.taskType === 'tool-invocation-compliance');
}

// ─── Live trace via claude -p --output-format stream-json ────────────────────

function runFixtureAndExtractTrace(fixture: ClassDFixture, testTaskId: string): ToolBlock[] {
  const prompt = fixture.prompt_template
    ? fixture.prompt_template.replaceAll('{task_id}', testTaskId)
    : `You are testing loop-backlog compliance for fixture ${fixture.id}. Trigger: ${fixture.trigger}`;

  if (DRY_RUN) {
    console.log(`  [dry-run] Would call: claude -p "${prompt.slice(0, 80)}..." --output-format stream-json --max-turns 8`);
    return [];
  }

  const result = spawnSync(
    'claude',
    ['-p', prompt, '--output-format', 'stream-json', '--max-turns', '8'],
    { encoding: 'utf-8', timeout: 120_000 },
  );

  if (result.status !== 0) {
    console.warn(`  [warn] claude exited ${result.status} for ${fixture.id}`);
  }

  return parseToolBlocks(result.stdout ?? '');
}

function parseToolBlocks(streamOutput: string): ToolBlock[] {
  return streamOutput
    .split('\n')
    .filter(Boolean)
    .flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } })
    .filter((e): e is { type: 'tool_use'; name: string; input: Record<string, unknown> } =>
      e.type === 'tool_use')
    .map((e, i) => ({ tool_name: e.name, tool_input: e.input, position: i }));
}

// ─── Compliance checking ──────────────────────────────────────────────────────

function matchesPattern(block: ToolBlock, entry: { tool: string; pattern: string }): boolean {
  // Check tool name match
  if (entry.tool !== '*' && block.tool_name !== entry.tool) {
    return false;
  }

  // Check pattern match against serialized input
  const inputStr = JSON.stringify(block.tool_input);
  try {
    const re = new RegExp(entry.pattern, 'i');
    return re.test(inputStr);
  } catch {
    return inputStr.includes(entry.pattern);
  }
}

interface ComplianceResult {
  compliant: boolean;
  required_sequence_violations: string[];
  forbidden_violations: string[];
}

function checkCompliance(fixture: ClassDFixture, trace: ToolBlock[]): ComplianceResult {
  const violations_seq: string[] = [];
  const violations_forbidden: string[] = [];

  // Check required_sequence: steps must appear in order
  let lastMatchedPosition = -1;

  for (const step of fixture.required_sequence) {
    const matchIndex = trace.findIndex((block, idx) =>
      idx > lastMatchedPosition && matchesPattern(block, step),
    );

    if (matchIndex === -1) {
      violations_seq.push(
        `Step ${step.step} not found in trace: ${step.description} (tool=${step.tool}, pattern=${step.pattern})`,
      );
    } else {
      lastMatchedPosition = matchIndex;
    }
  }

  // Check forbidden_before_step_1: find the position of step 1 in trace
  const step1 = fixture.required_sequence.find(s => s.step === 1);
  const step1Position = step1
    ? trace.findIndex(b => matchesPattern(b, step1))
    : trace.length;

  const step1Idx = step1Position === -1 ? trace.length : step1Position;

  for (const forbidden of fixture.forbidden_before_step_1) {
    // Check if forbidden tool appears before step 1
    for (let i = 0; i < step1Idx; i++) {
      if (matchesPattern(trace[i]!, forbidden)) {
        violations_forbidden.push(
          `Forbidden before step 1 at position ${i}: ${forbidden.description} (tool=${forbidden.tool}, pattern=${forbidden.pattern})`,
        );
        break;
      }
    }
  }

  return {
    compliant: violations_seq.length === 0 && violations_forbidden.length === 0,
    required_sequence_violations: violations_seq,
    forbidden_violations: violations_forbidden,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const fixturesDir = join(EXP_ROOT, 'fixtures', 'class-d');
  const analysisDir = join(EXP_ROOT, 'artifacts', 'analysis');

  console.log('Class D: Tool-Invocation Compliance Runner');
  console.log(`Fixtures: ${fixturesDir}`);
  console.log(`k=${K}  mode=${DRY_RUN ? 'dry-run' : 'live-trace'}`);
  console.log('');

  const fixtures = await loadClassDFixtures(fixturesDir);
  console.log(`Loaded ${fixtures.length} Class D fixtures\n`);

  // setup: create a live test task for use as {task_id} in prompts
  let testTaskId = 'TASK-TEST';
  if (!DRY_RUN) {
    const testTaskOut = execSync(
      'backlog task create "Class D live test task" --status "Ready" --plain',
      { encoding: 'utf-8' },
    );
    testTaskId = testTaskOut.match(/TASK-\d+/)?.[0] ?? 'TASK-TEST';
    console.log(`Test task: ${testTaskId}`);
  }

  const per_fixture: FixtureResult[] = [];
  let totalPasses = 0;
  let totalRuns = 0;

  try {
    for (const fixture of fixtures) {
      console.log(`  Running fixture: ${fixture.id}`);
      let passes = 0;
      let failures = 0;
      let lastViolationsSeq: string[] = [];
      let lastViolationsForbidden: string[] = [];

      for (let run = 0; run < K; run++) {
        const trace = runFixtureAndExtractTrace(fixture, testTaskId);

        if (DRY_RUN) {
          // In dry-run, skip compliance check — no actual trace available
          passes++;
        } else {
          const result = checkCompliance(fixture, trace);

          if (result.compliant) {
            passes++;
          } else {
            failures++;
            lastViolationsSeq = result.required_sequence_violations;
            lastViolationsForbidden = result.forbidden_violations;
          }
        }
      }

      const compliance_rate = DRY_RUN ? null : passes / K;
      const status = DRY_RUN ? '~' : (compliance_rate !== null && compliance_rate >= 0.9 ? '✓' : '✗');
      console.log(`    ${status} compliance_rate=${compliance_rate === null ? 'dry-run' : compliance_rate.toFixed(2)} (${passes}/${K})`);

      per_fixture.push({
        id: fixture.id,
        skill: fixture.skill,
        protocol_point: fixture.trigger,
        passes,
        failures,
        compliance_rate,
        required_sequence_violations: lastViolationsSeq,
        forbidden_violations: lastViolationsForbidden,
        notes: DRY_RUN
          ? 'dry-run: no claude call made'
          : failures === 0
            ? 'Fully compliant across all k runs'
            : `${failures}/${K} runs violated protocol`,
      });

      if (!DRY_RUN) {
        totalPasses += passes;
        totalRuns += K;
      }
    }
  } finally {
    if (!DRY_RUN && testTaskId !== 'TASK-TEST') {
      execSync(`backlog task edit ${testTaskId} --status "Done"`);
      console.log(`Test task ${testTaskId} cleaned up`);
    }
  }

  const overall_compliance_rate = DRY_RUN ? null : (totalRuns > 0 ? totalPasses / totalRuns : 0);
  const auto_ci_eligible = overall_compliance_rate !== null && overall_compliance_rate >= 0.90;

  console.log('');
  if (DRY_RUN) {
    console.log('Dry-run complete — no claude calls made');
  } else {
    console.log(`Overall compliance_rate: ${(overall_compliance_rate ?? 0).toFixed(3)}`);
    console.log(auto_ci_eligible ? '✅ PASS — auto_ci_eligible: true' : '❌ FAIL — below 0.90 threshold');
  }

  // Gather improvement suggestions for non-eligible fixtures
  const improvement_suggestions = per_fixture
    .filter(r => r.compliance_rate !== null && r.compliance_rate < 0.90)
    .map(r => ({
      fixture: r.id,
      compliance_rate: r.compliance_rate,
      suggestions: [
        ...r.required_sequence_violations.map(v => `Fix required sequence: ${v}`),
        ...r.forbidden_violations.map(v => `Fix forbidden call: ${v}`),
      ],
    }));

  // Detect git history context for traceability
  let gitContext = '';
  try {
    gitContext = execSync(
      'git -C "$(git rev-parse --show-toplevel)" log --oneline -5',
      { encoding: 'utf-8' },
    ).trim();
  } catch {
    gitContext = '(git log unavailable)';
  }

  const output = {
    generated: new Date().toISOString(),
    mode: 'live-trace',
    dry_run: DRY_RUN,
    skill: 'loop-backlog',
    k,
    fixtures_count: fixtures.length,
    per_fixture,
    compliance_rate: overall_compliance_rate,
    auto_ci_eligible,
    improvement_suggestions: improvement_suggestions.length > 0 ? improvement_suggestions : null,
    trace_source: 'claude -p --output-format stream-json',
    git_context: gitContext,
    methodology_notes: [
      'Class D fixtures validate tool-invocation sequence compliance for the loop-backlog orchestration skill.',
      'required_sequence: tool calls must appear in ascending step order in the trace.',
      'forbidden_before_step_1: listed tool patterns must NOT appear before step 1 in the trace.',
      'In live-trace mode, traces are extracted via claude -p --output-format stream-json.',
      'k=1 single run per fixture for end-to-end pipeline validation.',
      'compliance_rate = passes/k per fixture.',
    ],
  };

  await mkdir(analysisDir, { recursive: true });
  const outPath = join(analysisDir, 'exp-class-d-results.json');
  await writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(`\nResults written to ${outPath}`);
}

// hoist k for output object
const k = K;
main().catch(e => { console.error(e); process.exit(1); });
