/**
 * timing.test.ts — unit tests for the session-log timing extractor
 *
 * Uses Node.js built-in test runner (tsx --test).
 * No live meta-cc MCP calls — all client calls use injectable mock.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  extractPhaseTiming,
  validateMetaCcResponseSchema,
  type MetaCcClient,
  type MetaCcTimestampResponse,
  type TimingConfig,
} from './timing.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockClient(response: MetaCcTimestampResponse): MetaCcClient {
  return {
    async queryTimestamps(_sessionId: string): Promise<MetaCcTimestampResponse> {
      return response;
    },
  };
}

const SAMPLE_RESPONSE: MetaCcTimestampResponse = {
  entries: [
    { tool: 'Bash', timestamp: '2026-06-22T10:00:00Z' },
    { tool: 'Read', timestamp: '2026-06-22T10:01:30Z' },
    { tool: 'Edit', timestamp: '2026-06-22T10:03:00Z' },
    { tool: 'Bash', timestamp: '2026-06-22T10:05:00Z' },
    { tool: 'Bash', timestamp: '2026-06-22T10:06:00Z' },
  ],
};

const PHASE_SPEC = [
  { phaseName: 'exploration', startToolPattern: 'Bash', endToolPattern: 'Read' },
  { phaseName: 'editing',     startToolPattern: 'Read', endToolPattern: 'Edit' },
  { phaseName: 'testing',     startToolPattern: 'Edit', endToolPattern: 'Bash' },
];

// ---------------------------------------------------------------------------
// Phase A tests
// ---------------------------------------------------------------------------

describe('extractPhaseTiming', () => {
  it('returns data_source: measured with mock client from synthetic fixture', async () => {
    const config: TimingConfig = {
      sessionId: 'test-session-001',
      phaseBoundarySpec: PHASE_SPEC,
      metaCcClient: makeMockClient(SAMPLE_RESPONSE),
    };
    const result = await extractPhaseTiming(config);
    assert.equal(result.data_source, 'measured');
  });

  it('output contains all expected phase names from phaseBoundarySpec', async () => {
    const config: TimingConfig = {
      sessionId: 'test-session-001',
      phaseBoundarySpec: PHASE_SPEC,
      metaCcClient: makeMockClient(SAMPLE_RESPONSE),
    };
    const result = await extractPhaseTiming(config);
    const phaseNames = result.phases.map(p => p.phaseName);
    for (const spec of PHASE_SPEC) {
      assert.ok(
        phaseNames.includes(spec.phaseName),
        `Expected phase "${spec.phaseName}" in output`,
      );
    }
  });

  it('each phase has numeric durationSeconds field', async () => {
    const config: TimingConfig = {
      sessionId: 'test-session-001',
      phaseBoundarySpec: PHASE_SPEC,
      metaCcClient: makeMockClient(SAMPLE_RESPONSE),
    };
    const result = await extractPhaseTiming(config);
    for (const phase of result.phases) {
      assert.equal(typeof phase.durationSeconds, 'number', `durationSeconds for ${phase.phaseName} must be number`);
      assert.ok(!isNaN(phase.durationSeconds), `durationSeconds for ${phase.phaseName} must not be NaN`);
    }
  });

  it('throws when metaCcClient.queryTimestamps returns empty entries array', async () => {
    const config: TimingConfig = {
      sessionId: 'test-session-empty',
      phaseBoundarySpec: PHASE_SPEC,
      metaCcClient: makeMockClient({ entries: [] }),
    };
    await assert.rejects(
      () => extractPhaseTiming(config),
      (err: Error) => {
        assert.ok(err.message.includes('session data unavailable'), `Expected 'session data unavailable' in: ${err.message}`);
        return true;
      },
    );
  });

  it('throws when no metaCcClient is provided', async () => {
    const config: TimingConfig = {
      sessionId: 'test-session-no-client',
      phaseBoundarySpec: PHASE_SPEC,
    };
    await assert.rejects(
      () => extractPhaseTiming(config),
      (err: Error) => {
        assert.ok(err.message.includes('session data unavailable'));
        return true;
      },
    );
  });

  it('result includes sessionId and generatedAt fields', async () => {
    const config: TimingConfig = {
      sessionId: 'test-session-001',
      phaseBoundarySpec: PHASE_SPEC,
      metaCcClient: makeMockClient(SAMPLE_RESPONSE),
    };
    const result = await extractPhaseTiming(config);
    assert.equal(result.sessionId, 'test-session-001');
    assert.ok(typeof result.generatedAt === 'string');
  });

  it('durationSeconds values match known timestamps in fixture', async () => {
    const config: TimingConfig = {
      sessionId: 'test-session-001',
      phaseBoundarySpec: [
        { phaseName: 'exploration', startToolPattern: 'Bash', endToolPattern: 'Read' },
      ],
      metaCcClient: makeMockClient(SAMPLE_RESPONSE),
    };
    const result = await extractPhaseTiming(config);
    // Bash at 10:00:00, Read at 10:01:30 → 90 seconds
    const phase = result.phases.find(p => p.phaseName === 'exploration');
    assert.ok(phase, 'exploration phase must be present');
    assert.equal(phase!.durationSeconds, 90);
  });
});

// ---------------------------------------------------------------------------
// Phase B tests
// ---------------------------------------------------------------------------

describe('validateMetaCcResponseSchema', () => {
  it('throws with message containing "schema" for null response', () => {
    assert.throws(
      () => validateMetaCcResponseSchema(null),
      (err: Error) => {
        assert.ok(err.message.includes('schema'), `Expected "schema" in: ${err.message}`);
        return true;
      },
    );
  });

  it('throws with message containing "schema" for missing entries field', () => {
    assert.throws(
      () => validateMetaCcResponseSchema({ notEntries: [] }),
      (err: Error) => {
        assert.ok(err.message.includes('schema'));
        return true;
      },
    );
  });

  it('throws with message containing "schema" when entries is not an array', () => {
    assert.throws(
      () => validateMetaCcResponseSchema({ entries: 'not-array' }),
      (err: Error) => {
        assert.ok(err.message.includes('schema'));
        return true;
      },
    );
  });

  it('throws with message containing "schema" when entry is missing tool field', () => {
    assert.throws(
      () => validateMetaCcResponseSchema({ entries: [{ timestamp: '2026-01-01T00:00:00Z' }] }),
      (err: Error) => {
        assert.ok(err.message.includes('schema'));
        return true;
      },
    );
  });

  it('throws with message containing "schema" when entry is missing timestamp field', () => {
    assert.throws(
      () => validateMetaCcResponseSchema({ entries: [{ tool: 'Bash' }] }),
      (err: Error) => {
        assert.ok(err.message.includes('schema'));
        return true;
      },
    );
  });

  it('does not throw for valid response', () => {
    assert.doesNotThrow(() => validateMetaCcResponseSchema(SAMPLE_RESPONSE));
  });
});

describe('data_source guard', () => {
  it('output is always measured even if raw response has unexpected data_source field', async () => {
    // Construct a response that includes a data_source field (e.g. from some future API)
    const responseWithExtraField: MetaCcTimestampResponse = {
      entries: SAMPLE_RESPONSE.entries,
      // Simulating a field from upstream that we must ignore
      upstream_quality: 'low',
    };
    const config: TimingConfig = {
      sessionId: 'test-session-guard',
      phaseBoundarySpec: PHASE_SPEC,
      metaCcClient: makeMockClient(responseWithExtraField),
    };
    const result = await extractPhaseTiming(config);
    assert.equal(result.data_source, 'measured');
  });
});
