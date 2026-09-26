import { formatCountdown } from '@/lib/format';

const MINUTE = 60_000;

/** Text for screen readers, changing only at meaningful thresholds rather than every second. */
function announcement(remainingMs: number): string {
  if (remainingMs <= 0) return 'Your quote has expired.';
  if (remainingMs <= MINUTE) return 'Less than 1 minute left to complete your purchase.';
  if (remainingMs <= 5 * MINUTE) return 'Less than 5 minutes left to complete your purchase.';
  return '';
}

/** Presentational: pass the remaining time from useCountdown (null before mount). */
export function CountdownTimer({ remainingMs }: { remainingMs: number | null }) {
  const urgency =
    remainingMs === null || remainingMs >= 2 * MINUTE
      ? { box: 'border-slate-200 bg-white text-slate-800', label: 'Price locked for' }
      : remainingMs >= MINUTE
        ? { box: 'border-amber-400 bg-amber-50 text-amber-900', label: 'Expiring soon' }
        : { box: 'border-red-400 bg-red-50 text-red-900', label: 'Less than a minute left' };

  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${urgency.box}`}>
      <span className="text-sm font-medium">{urgency.label}</span>
      <span
        role="timer"
        aria-label="Time left on this quote"
        className="font-mono text-lg font-semibold tabular-nums"
      >
        {remainingMs === null ? '--:--' : formatCountdown(remainingMs)}
      </span>
      <span aria-live="polite" className="sr-only">
        {remainingMs === null ? '' : announcement(remainingMs)}
      </span>
    </div>
  );
}
