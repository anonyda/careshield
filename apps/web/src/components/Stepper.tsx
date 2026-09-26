export type StepId = 'quote' | 'declaration' | 'payment' | 'policy';

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'quote', label: 'Quote' },
  { id: 'declaration', label: 'Declaration' },
  { id: 'payment', label: 'Payment' },
  { id: 'policy', label: 'Policy' },
];

interface StepperProps {
  current: StepId;
  /** Shows the payment step as in progress (set optimistically while paying). */
  processing?: boolean;
}

export function Stepper({ current, processing = false }: StepperProps) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <nav aria-label="Progress" className="mb-6">
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const label =
            active && step.id === 'payment' && processing ? 'Payment processing…' : step.label;
          return (
            <li
              key={step.id}
              aria-current={active ? 'step' : undefined}
              className={`border-t-4 pt-2 text-xs font-medium sm:text-sm ${
                done
                  ? 'border-teal-700 text-teal-800'
                  : active
                    ? 'border-indigo-700 text-indigo-800'
                    : 'border-slate-300 text-slate-600'
              }`}
            >
              <span className="block">
                <span className="sr-only">
                  {done ? 'Completed: ' : active ? 'Current step: ' : 'Upcoming: '}
                </span>
                {done && <span aria-hidden="true">✓ </span>}
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
