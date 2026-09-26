import { FieldError } from './FormError';

interface YesNoFieldProps {
  name: string;
  legend: string;
  hint?: string;
  value: 'yes' | 'no' | '';
  onChange: (value: 'yes' | 'no') => void;
  error?: string;
  disabled?: boolean;
}

/** A required Yes/No radio group with a visible legend and accessible error. */
export function YesNoField({
  name,
  legend,
  hint,
  value,
  onChange,
  error,
  disabled,
}: YesNoFieldProps) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
    >
      <legend className="text-sm font-semibold text-slate-900">{legend}</legend>
      {hint && (
        <p id={hintId} className="text-sm text-slate-600">
          {hint}
        </p>
      )}
      <div className="mt-2 flex gap-3">
        {(['yes', 'no'] as const).map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm has-[:checked]:border-indigo-700 has-[:checked]:bg-indigo-50"
          >
            <input
              type="radio"
              name={name}
              value={option}
              required
              checked={value === option}
              onChange={() => onChange(option)}
              className="h-4 w-4 accent-indigo-700"
            />
            {option === 'yes' ? 'Yes' : 'No'}
          </label>
        ))}
      </div>
      <FieldError id={`${name}-error`} message={error} />
    </fieldset>
  );
}
