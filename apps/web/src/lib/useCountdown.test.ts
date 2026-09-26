import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountdown } from './useCountdown';

const NOW = Date.parse('2026-09-26T12:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down on a 250 ms tick', () => {
    const { result } = renderHook(() => useCountdown(iso(NOW + 15 * 60_000), iso(NOW)));
    expect(result.current).toBe(15 * 60_000);

    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe(15 * 60_000 - 1_000);

    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBe(15 * 60_000 - 1_250);
  });

  it('corrects for a client clock that is behind the server', () => {
    // Server says it is 2 minutes later than the client thinks.
    const serverNow = NOW + 2 * 60_000;
    const { result } = renderHook(() => useCountdown(iso(serverNow + 10 * 60_000), iso(serverNow)));
    expect(result.current).toBe(10 * 60_000);
  });

  it('corrects for a client clock that is ahead of the server', () => {
    const serverNow = NOW - 5 * 60_000;
    const { result } = renderHook(() => useCountdown(iso(serverNow + 60_000), iso(serverNow)));
    expect(result.current).toBe(60_000);
  });

  it('clamps at zero and stops ticking', () => {
    const { result } = renderHook(() => useCountdown(iso(NOW + 1_000), iso(NOW)));

    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is zero immediately for an already expired quote', () => {
    const { result } = renderHook(() => useCountdown(iso(NOW - 1_000), iso(NOW)));
    expect(result.current).toBe(0);
  });

  it('clears its interval on unmount', () => {
    const { unmount } = renderHook(() => useCountdown(iso(NOW + 60_000), iso(NOW)));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
