export interface AppEnv {
  DATABASE_URL: string;
  PORT: number;
  QUOTE_TTL_SECONDS: number;
  MOCK_PAYMENT_LATENCY_MS: number;
  IDEMPOTENCY_LOCK_TTL_SECONDS: number;
}

function readInt(
  raw: Record<string, unknown>,
  name: string,
  fallback: number,
  min: number,
): number {
  const value = raw[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`Invalid env ${name}=${JSON.stringify(value)}: expected an integer >= ${min}`);
  }
  return parsed;
}

/** Validates process env at boot so misconfiguration fails fast with a clear message. */
export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const databaseUrl = raw.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error(
      'Missing or invalid env DATABASE_URL: expected a postgresql:// connection string',
    );
  }

  return {
    DATABASE_URL: databaseUrl,
    PORT: readInt(raw, 'PORT', 3001, 1),
    QUOTE_TTL_SECONDS: readInt(raw, 'QUOTE_TTL_SECONDS', 900, 1),
    MOCK_PAYMENT_LATENCY_MS: readInt(raw, 'MOCK_PAYMENT_LATENCY_MS', 800, 0),
    IDEMPOTENCY_LOCK_TTL_SECONDS: readInt(raw, 'IDEMPOTENCY_LOCK_TTL_SECONDS', 60, 1),
  };
}
