import { existsSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_TEST_URL = 'postgresql://careshield:careshield@localhost:5432/careshield?schema=test';

/**
 * Points the app at the isolated `test` schema. Loads apps/api/.env when present;
 * explicit environment variables (e.g. in CI) take precedence.
 */
export function useTestDatabase(): void {
  const envFile = join(__dirname, '..', '..', '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? DEFAULT_TEST_URL;
  process.env.QUOTE_TTL_SECONDS = '900';
  process.env.MOCK_PAYMENT_LATENCY_MS = '50';
  process.env.IDEMPOTENCY_LOCK_TTL_SECONDS = '60';
}

useTestDatabase();
