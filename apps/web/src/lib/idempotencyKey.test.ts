import { afterEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from './idempotencyKey';

// Must satisfy the API's Idempotency-Key format.
const API_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

describe('newIdempotencyKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when available', () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(API_KEY_PATTERN);
    expect(newIdempotencyKey()).not.toBe(key);
  });

  it('falls back to getRandomValues outside a secure context', () => {
    // Insecure contexts expose getRandomValues but not randomUUID.
    const { getRandomValues } = crypto;
    vi.stubGlobal('crypto', { getRandomValues: getRandomValues.bind(crypto) });

    const key = newIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toMatch(API_KEY_PATTERN);
    expect(newIdempotencyKey()).not.toBe(key);
  });
});
