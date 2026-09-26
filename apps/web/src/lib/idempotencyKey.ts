/**
 * A fresh idempotency key for one checkout attempt.
 *
 * `crypto.randomUUID` only exists in secure contexts (HTTPS or localhost), so opening the dev
 * server over plain http on a LAN address would break checkout. `getRandomValues` works
 * everywhere and gives the same 122+ bits of randomness.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
