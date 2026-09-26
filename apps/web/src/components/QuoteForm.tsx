'use client';

import { useActionState, useState } from 'react';
import { createQuoteAction } from '@/app/actions';
import type { QuoteFormState } from '@/lib/types';
import { FieldError, FormError } from './FormError';
import { SubmitButton } from './SubmitButton';
import { YesNoField } from './YesNoField';

const initialState: QuoteFormState = {};

export function QuoteForm() {
  const [state, formAction, isPending] = useActionState(createQuoteAction, initialState);
  // Controlled so values survive a failed submission (React resets uncontrolled forms).
  const [age, setAge] = useState('');
  const [hasConditions, setHasConditions] = useState<'yes' | 'no' | ''>('');
  const ageError = state.fieldErrors?.age;
  const hasFieldErrors = Object.keys(state.fieldErrors ?? {}).length > 0;

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={hasFieldErrors ? undefined : state.message} />

      <div>
        <label htmlFor="age" className="block text-sm font-semibold text-slate-900">
          Your age
        </label>
        <p id="age-hint" className="text-sm text-slate-600">
          Cover is available from 18 to 99.
        </p>
        <input
          id="age"
          name="age"
          type="number"
          inputMode="numeric"
          min={18}
          max={99}
          step={1}
          required
          value={age}
          onChange={(event) => setAge(event.target.value)}
          aria-invalid={ageError ? true : undefined}
          aria-describedby={ageError ? 'age-hint age-error' : 'age-hint'}
          className="input mt-2 w-32"
        />
        <FieldError id="age-error" message={ageError} />
      </div>

      <YesNoField
        name="hasPreExistingConditions"
        legend="Do you have any pre-existing medical conditions?"
        hint="For example diabetes, hypertension or asthma."
        value={hasConditions}
        onChange={setHasConditions}
        error={state.fieldErrors?.hasPreExistingConditions}
      />

      <SubmitButton pending={isPending} pendingLabel="Calculating…">
        Get my quote
      </SubmitButton>
    </form>
  );
}
