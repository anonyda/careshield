const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

/** Formats an API money string for display. The string is passed through as an exact decimal. */
export function formatINR(amount: string): string {
  return inr.format(amount as Intl.StringNumericLiteral);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

/** Milliseconds to mm:ss, rounding up so "00:00" only shows once time has truly run out. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
