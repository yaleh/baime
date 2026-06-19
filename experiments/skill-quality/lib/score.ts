/**
 * Scoring utilities for skill-quality experiments.
 * Matches archguard format-encoding score patterns + 'partial' type.
 */

export function extractAnswer(response: string): unknown {
  // Try JSON object with "answer" key directly
  const jsonMatch = response.match(/\{[^{}]*"answer"\s*:[^{}]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]).answer; } catch {}
  }
  // Try code fence containing JSON
  const fenceMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]!).answer; } catch {}
  }
  return null;
}

function normalizeStr(s: unknown): string {
  if (typeof s !== 'string') return String(s ?? '');
  return s.trim().toLowerCase();
}

// Token-level Jaccard similarity for fuzzy invariant notation matching.
// Splits on non-alphanumeric/underscore, filters short tokens.
function tokenJaccard(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().split(/[^a-z0-9_]+/).filter(t => t.length > 2));
  const ta = tokenize(a);
  const tb = tokenize(b);
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : intersection / union;
}

export interface PartialGroundTruth {
  verdict: string;
  items: string[];
}

export function scoreResponse(
  answer: unknown,
  groundTruth: unknown,
  answerType: 'exact' | 'set' | 'partial',
): number {
  if (answer === null || answer === undefined) return 0;

  if (answerType === 'exact') {
    return normalizeStr(answer) === normalizeStr(groundTruth) ? 1 : 0;
  }

  if (answerType === 'set') {
    const gt = Array.isArray(groundTruth) ? groundTruth : [groundTruth];
    const gtNorm = gt.map(normalizeStr);
    if (gtNorm.includes(normalizeStr(answer))) return 1;
    if (Array.isArray(answer)) {
      const ansArr = answer.map(normalizeStr).sort();
      const gtArr = [...gtNorm].sort();
      return JSON.stringify(ansArr) === JSON.stringify(gtArr) ? 1 : 0;
    }
    return 0;
  }

  if (answerType === 'partial') {
    // groundTruth: { verdict: string, items: string[] }
    const gt = groundTruth as PartialGroundTruth;
    const ans = answer as { verdict?: string; items?: string[] };
    const n = gt.items.length;
    const verdictMatch = normalizeStr(ans.verdict) === normalizeStr(gt.verdict);

    // APPROVED with empty items: verdict match alone = full score
    if (n === 0) return verdictMatch ? 1 : 0;

    let score = verdictMatch ? 0.5 : 0;
    if (Array.isArray(ans.items)) {
      const hitItems = gt.items.filter(gtItem =>
        ans.items!.some(
          a => normalizeStr(a) === normalizeStr(gtItem) || tokenJaccard(a, gtItem) >= 0.3,
        ),
      );
      score += (hitItems.length / n) * 0.5;
    }
    return score;
  }

  return 0;
}
