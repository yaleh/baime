/**
 * timing.ts — session-log timing extractor
 *
 * Project-agnostic module: contains no hard-coded project paths.
 * Suitable for future lift into plugin/.
 *
 * INVARIANT: `data_source` in output is ALWAYS 'measured'.
 * This module never produces estimated timing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhaseBoundary {
  phaseName: string;
  /** Regex pattern matched against tool name that starts this phase */
  startToolPattern: string;
  /** Regex pattern matched against tool name that ends this phase */
  endToolPattern: string;
}

export interface TimingConfig {
  sessionId: string;
  phaseBoundarySpec: PhaseBoundary[];
  /** Injectable meta-cc client; defaults to no-op that throws if not provided */
  metaCcClient?: MetaCcClient;
}

export interface TimestampEntry {
  tool: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface MetaCcTimestampResponse {
  entries: TimestampEntry[];
  [key: string]: unknown;
}

export interface MetaCcClient {
  queryTimestamps(sessionId: string): Promise<MetaCcTimestampResponse>;
}

export interface PhaseResult {
  phaseName: string;
  durationSeconds: number;
  startTs: string;
  endTs: string;
}

export interface PhaseTimingResult {
  phases: PhaseResult[];
  data_source: 'measured';
  sessionId: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

/**
 * Validates that the response from the meta-cc client has the expected shape.
 * Throws with a message containing "schema" on mismatch.
 */
export function validateMetaCcResponseSchema(response: unknown): asserts response is MetaCcTimestampResponse {
  if (response === null || typeof response !== 'object') {
    throw new Error('schema validation failed: response must be an object');
  }
  const obj = response as Record<string, unknown>;
  if (!('entries' in obj)) {
    throw new Error('schema validation failed: missing required field "entries"');
  }
  if (!Array.isArray(obj['entries'])) {
    throw new Error('schema validation failed: "entries" must be an array');
  }
  for (let i = 0; i < (obj['entries'] as unknown[]).length; i++) {
    const entry = (obj['entries'] as unknown[])[i];
    if (entry === null || typeof entry !== 'object') {
      throw new Error(`schema validation failed: entries[${i}] must be an object`);
    }
    const e = entry as Record<string, unknown>;
    if (typeof e['tool'] !== 'string') {
      throw new Error(`schema validation failed: entries[${i}].tool must be a string`);
    }
    if (typeof e['timestamp'] !== 'string') {
      throw new Error(`schema validation failed: entries[${i}].timestamp must be a string`);
    }
  }
}

// ---------------------------------------------------------------------------
// Core extractor
// ---------------------------------------------------------------------------

/**
 * Extract phase timing from a session log via the meta-cc client.
 *
 * @throws Error('session data unavailable: cannot produce measured timing')
 *         when the session has no timestamp entries.
 * @throws Error containing "schema" when the client response has unexpected shape.
 */
export async function extractPhaseTiming(config: TimingConfig): Promise<PhaseTimingResult> {
  const { sessionId, phaseBoundarySpec, metaCcClient } = config;

  if (!metaCcClient) {
    throw new Error('session data unavailable: cannot produce measured timing');
  }

  const raw = await metaCcClient.queryTimestamps(sessionId);

  // Validate schema before any further processing
  validateMetaCcResponseSchema(raw);

  const entries = raw.entries;

  if (entries.length === 0) {
    throw new Error('session data unavailable: cannot produce measured timing');
  }

  const phases: PhaseResult[] = [];

  for (const boundary of phaseBoundarySpec) {
    const startRe = new RegExp(boundary.startToolPattern, 'i');
    const endRe = new RegExp(boundary.endToolPattern, 'i');

    // Find first entry matching start pattern
    const startEntry = entries.find(e => startRe.test(e.tool));
    // Find last entry matching end pattern (after start, if found)
    const startIdx = startEntry ? entries.indexOf(startEntry) : -1;
    const endEntry = startIdx >= 0
      ? [...entries].slice(startIdx).reverse().find(e => endRe.test(e.tool))
      : entries.slice().reverse().find(e => endRe.test(e.tool));

    if (startEntry && endEntry) {
      const startMs = new Date(startEntry.timestamp).getTime();
      const endMs = new Date(endEntry.timestamp).getTime();
      const durationSeconds = (endMs - startMs) / 1000;
      phases.push({
        phaseName: boundary.phaseName,
        durationSeconds,
        startTs: startEntry.timestamp,
        endTs: endEntry.timestamp,
      });
    }
  }

  // data_source is always hard-coded to 'measured'; no inference from upstream fields
  const result: PhaseTimingResult = {
    phases,
    data_source: 'measured',
    sessionId,
    generatedAt: new Date().toISOString(),
  };

  return result;
}
