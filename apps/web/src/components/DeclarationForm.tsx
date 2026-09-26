'use client';

import { useActionState, useState } from 'react';
import { submitDeclarationAction } from '@/app/actions';
import { useCountdown } from '@/lib/useCountdown';
import { MEDICAL_CONDITIONS, type DeclarationFormState } from '@/lib/types';
import { CountdownTimer } from './CountdownTimer';
import { ExpiredBanner, FieldError, FormError, RecalculateLink } from './FormError';
import { SubmitButton } from './SubmitButton';
import { YesNoField } from './YesNoField';

type YesNo = 'yes' | 'no' | '';

interface DeclarationFormProps {
  quoteId: string;
  expiresAt: string;
  serverTime: string;
  initiallyExpired: boolean;
}

const initialState: DeclarationFormState = {};

export function DeclarationForm({
  quoteId,
  expiresAt,
  serverTime,
  initiallyExpired,
}: DeclarationFormProps) {
  const [state, formAction, isPending] = useActionState(submitDeclarationAction, initialState);
  const remainingMs = useCountdown(expiresAt, serverTime);
  const expired = initiallyExpired || remainingMs === 0 || state.expired === true;

  const [isSmoker, setIsSmoker] = useState<YesNo>('');
  const [hospitalized, setHospitalized] = useState<YesNo>('');
  const [criticalIllness, setCriticalIllness] = useState<YesNo>('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [details, setDetails] = useState('');

  // "None of these" is mutually exclusive with every other condition.
  const toggleCondition = (value: string, checked: boolean) => {
    if (value === 'NONE') {
      setConditions(checked ? ['NONE'] : []);
      return;
    }
    setConditions((current) =>
      checked
        ? [...current.filter((c) => c !== 'NONE'), value]
        : current.filter((c) => c !== value),
    );
  };

  const errors = state.fieldErrors ?? {};
  const conditionsError = errors.conditions;

  return (
    <section aria-labelledby="declaration-heading" className="space-y-4">
      <CountdownTimer remainingMs={initiallyExpired ? 0 : remainingMs} />
      {expired && <ExpiredBanner />}

      <h2 id="declaration-heading" className="text-lg font-semibold text-slate-900">
        Medical declaration
      </h2>
      <p className="text-sm text-slate-700">
        Answer honestly. Your answers decide whether we can offer cover.
      </p>

      {!expired && state.code === 'NOT_ELIGIBLE' && (
        <FormError message="We're sorry, we can't offer you CareShield Max.">
          <p className="mt-1">{state.message}</p>
        </FormError>
      )}
      {!expired && state.code === 'DECLARATION_INCONSISTENT' && (
        <FormError message={state.message}>
          <RecalculateLink />
        </FormError>
      )}
      {!expired &&
        state.message &&
        ![
          'NOT_ELIGIBLE',
          'DECLARATION_INCONSISTENT',
          'QUOTE_EXPIRED',
          'VALIDATION_FAILED',
        ].includes(state.code ?? '') && <FormError message={state.message} />}

      <form
        action={formAction}
        onSubmit={(event) => {
          if (expired) event.preventDefault();
        }}
        className="space-y-6"
      >
        <input type="hidden" name="quoteId" value={quoteId} />
        <fieldset disabled={expired || isPending} className="space-y-6">
          <YesNoField
            name="isSmoker"
            legend="Do you smoke or use tobacco?"
            value={isSmoker}
            onChange={setIsSmoker}
            error={errors.isSmoker}
          />
          <YesNoField
            name="hospitalizedLast24Months"
            legend="Have you been admitted to hospital in the last 24 months?"
            value={hospitalized}
            onChange={setHospitalized}
            error={errors.hospitalizedLast24Months}
          />
          <YesNoField
            name="hasCriticalIllnessDiagnosis"
            legend="Have you ever been diagnosed with a critical illness?"
            hint="For example stroke, organ failure or major organ transplant."
            value={criticalIllness}
            onChange={setCriticalIllness}
            error={errors.hasCriticalIllnessDiagnosis}
          />

          <fieldset
            aria-describedby={
              conditionsError ? 'conditions-hint conditions-error' : 'conditions-hint'
            }
            aria-invalid={conditionsError ? true : undefined}
          >
            <legend className="text-sm font-semibold text-slate-900">
              Which of these conditions do you have?
            </legend>
            <p id="conditions-hint" className="text-sm text-slate-600">
              Select all that apply, or &quot;None of these&quot;.
            </p>
            <div className="mt-2 grid gap-2">
              {[...MEDICAL_CONDITIONS, { value: 'NONE', label: 'None of these' }].map(
                (condition) => (
                  <label
                    key={condition.value}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm has-[:checked]:border-indigo-700 has-[:checked]:bg-indigo-50"
                  >
                    <input
                      type="checkbox"
                      name="conditions"
                      value={condition.value}
                      checked={conditions.includes(condition.value)}
                      onChange={(event) => toggleCondition(condition.value, event.target.checked)}
                      className="h-4 w-4 accent-indigo-700"
                    />
                    {condition.label}
                  </label>
                ),
              )}
            </div>
            <FieldError id="conditions-error" message={conditionsError} />
          </fieldset>

          <div>
            <label
              htmlFor="additionalDetails"
              className="block text-sm font-semibold text-slate-900"
            >
              Anything else we should know?{' '}
              <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <textarea
              id="additionalDetails"
              name="additionalDetails"
              rows={3}
              maxLength={500}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              aria-describedby={
                errors.additionalDetails ? 'details-count additionalDetails-error' : 'details-count'
              }
              aria-invalid={errors.additionalDetails ? true : undefined}
              className="input mt-2 w-full"
            />
            <p id="details-count" className="text-right text-xs text-slate-600">
              {details.length}/500
            </p>
            <FieldError id="additionalDetails-error" message={errors.additionalDetails} />
          </div>
        </fieldset>

        <SubmitButton pending={isPending} pendingLabel="Checking your answers…" disabled={expired}>
          Continue to payment
        </SubmitButton>
      </form>
    </section>
  );
}
