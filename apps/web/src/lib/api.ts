import 'server-only';
import type { Quote } from './types';

const TIMEOUT_MS = 10_000;

/** Read per request (not at import) so `next build` works without it; production must set it. */
function apiBaseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('API_BASE_URL is not set');
  }
  return 'http://localhost:3001';
}

/** A failed API call, carrying the API's error envelope. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, string[]> | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
}

async function apiFetch<T>(
  path: string,
  { method = 'GET', body, headers }: RequestOptions = {},
): Promise<T> {
  const url = `${apiBaseUrl()}/api/v1${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(503, 'NETWORK_ERROR', "We couldn't reach our servers. Please try again.");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) return payload as T;

  const envelope = (payload ?? {}) as Partial<{ code: string; message: string; details: unknown }>;
  const retryAfter = Number(response.headers.get('Retry-After'));
  throw new ApiError(
    response.status,
    envelope.code ?? 'UNKNOWN_ERROR',
    envelope.message ?? 'Something went wrong. Please try again.',
    isFieldDetails(envelope.details) ? envelope.details : null,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  );
}

function isFieldDetails(value: unknown): value is Record<string, string[]> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createQuote(input: { age: number; hasPreExistingConditions: boolean }) {
  return apiFetch<Pick<Quote, 'quoteId'>>('/insurance/quote', { method: 'POST', body: input });
}

/** Returns null when the quote does not exist (or the id is malformed). */
export async function getQuote(quoteId: string): Promise<Quote | null> {
  try {
    return await apiFetch<Quote>(`/insurance/quote/${encodeURIComponent(quoteId)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export interface DeclarationInput {
  quoteId: string;
  isSmoker: boolean;
  hospitalizedLast24Months: boolean;
  hasCriticalIllnessDiagnosis: boolean;
  conditions: string[];
  additionalDetails?: string;
}

export function submitDeclaration(input: DeclarationInput) {
  return apiFetch<{ status: string; repriced: boolean }>('/insurance/declaration', {
    method: 'POST',
    body: input,
  });
}

export function checkout(input: { quoteId: string; paymentToken: string }, idempotencyKey: string) {
  return apiFetch<{ status: string }>('/insurance/checkout', {
    method: 'POST',
    body: input,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}
