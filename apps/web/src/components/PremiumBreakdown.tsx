import { formatINR } from '@/lib/format';
import type { PremiumBreakdown as Premium } from '@/lib/types';

interface PremiumBreakdownProps {
  premium: Premium;
  age: number;
  hasPreExistingConditions: boolean;
}

export function PremiumBreakdown({
  premium,
  age,
  hasPreExistingConditions,
}: PremiumBreakdownProps) {
  const rows = [
    { label: 'Base premium', value: premium.base },
    { label: `Age loading (age ${age}${age > 45 ? ', over 45' : ''})`, value: premium.ageLoading },
    {
      label: `Pre-existing conditions${hasPreExistingConditions ? '' : ' (none declared)'}`,
      value: premium.conditionLoading,
    },
  ];

  return (
    <section
      aria-labelledby="premium-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="premium-heading" className="text-base font-semibold text-slate-900">
        Your annual premium
      </h2>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-slate-700">{row.label}</dt>
            <dd className="font-medium tabular-nums text-slate-900">{formatINR(row.value)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base">
          <dt className="font-semibold text-slate-900">Total</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{formatINR(premium.total)}</dd>
        </div>
      </dl>
    </section>
  );
}
