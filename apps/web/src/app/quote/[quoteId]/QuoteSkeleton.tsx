export function QuoteSkeleton() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-4">
      <span className="sr-only">Loading your quote…</span>
      <div className="h-8 rounded bg-slate-200" />
      <div className="h-40 rounded-lg bg-slate-200" />
      <div className="h-14 rounded-lg bg-slate-200" />
      <div className="h-64 rounded-lg bg-slate-200" />
    </div>
  );
}
