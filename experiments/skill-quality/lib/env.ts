import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// Load .env from this experiment directory (no-op if already set via process.env)
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env'), override: false });

export function validateEnv(): void {
  const missing: string[] = [];

  if (!process.env['LLM_BASE_URL']) missing.push('LLM_BASE_URL');
  if (!process.env['LLM_API_KEY']) missing.push('LLM_API_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}.\n` +
        `Fill in experiments/skill-quality/.env or export them before running.\n` +
        `  LLM_BASE_URL  - Base URL for the LLM API endpoint\n` +
        `  LLM_API_KEY   - API key for authentication`,
    );
  }
}

export function getLLMBaseUrl(): string {
  const value = process.env['LLM_BASE_URL'];
  if (!value) throw new Error('LLM_BASE_URL not set. Call validateEnv() first.');
  return value;
}

export function getLLMApiKey(): string {
  const value = process.env['LLM_API_KEY'];
  if (!value) throw new Error('LLM_API_KEY not set. Call validateEnv() first.');
  return value;
}

export function getModelPrimary(): string {
  return process.env['MODEL_PRIMARY'] ?? 'claude-haiku-4-5-20251001';
}

export function getModelSecondary(): string {
  return process.env['MODEL_SECONDARY'] ?? 'glm-4.5-flash';
}
