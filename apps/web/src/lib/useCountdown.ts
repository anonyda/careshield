'use client';

import { useEffect, useState } from 'react';

const TICK_MS = 250;

/**
 * Milliseconds left until `expiresAt`, measured on the server's clock.
 *
 * The client clock may be wrong, so on mount we record the skew between the server time
 * the page was rendered with and the local clock, then correct every tick by it.
 * Returns null until mounted so server and client render the same markup.
 */
export function useCountdown(expiresAt: string, serverTime: string): number | null {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const skew = Date.parse(serverTime) - Date.now();
    const expiry = Date.parse(expiresAt);

    const tick = () => {
      const remaining = Math.max(0, expiry - (Date.now() + skew));
      setRemainingMs(remaining);
      if (remaining === 0) clearInterval(interval);
    };
    const interval = setInterval(tick, TICK_MS);
    tick();

    return () => clearInterval(interval);
  }, [expiresAt, serverTime]);

  return remainingMs;
}
