'use client';

import { startTransition, useActionState, useEffect, useOptimistic, useRef, useState } from 'react';
import { checkoutAction } from '@/app/actions';
import { formatINR } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotencyKey';
import { useCountdown } from '@/lib/useCountdown';
import { PAYMENT_TOKENS, type CheckoutFormState } from '@/lib/types';
import { CountdownTimer } from './CountdownTimer';
import { ExpiredBanner, FormError } from './FormError';
import { Stepper } from './Stepper';
import { SubmitButton } from './SubmitButton';

interface PaymentPanelProps {
  quoteId: string;
  total: string;
  expiresAt: string;
  serverTime: string;
  initiallyExpired: boolean;
  /** Server-rendered premium summary, shown between the stepper and the payment form. */
  summary: React.ReactNode;
}

const initialState: CheckoutFormState = {};

export function PaymentPanel({
  quoteId,
  total,
  expiresAt,
  serverTime,
  initiallyExpired,
  summary,
}: PaymentPanelProps) {
  const [state, formAction, isPending] = useActionState(checkoutAction, initialState);
  const [processing, setProcessing] = useOptimistic(false);
  const [token, setToken] = useState<string>(PAYMENT_TOKENS[0].value);
  const remainingMs = useCountdown(expiresAt, serverTime);
  const expired = initiallyExpired || remainingMs === 0 || state.expired === true;

  // `disabled` only applies after a re-render, so a fast double-click could submit twice.
  // This ref is checked synchronously on submit and released when the request settles.
  const submitLock = useRef(false);
  // One key per checkout attempt, reused across retries of the same intent.
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isPending) submitLock.current = false;
  }, [isPending]);

  useEffect(() => {
    // A definitive answer (declined, expired) ends this attempt: the next one gets a new key.
    if (state.rotateKey) idempotencyKey.current = null;
  }, [state]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLock.current || expired) return;
    submitLock.current = true;

    idempotencyKey.current ??= newIdempotencyKey();
    const formData = new FormData(event.currentTarget);
    formData.set('idempotencyKey', idempotencyKey.current);

    startTransition(() => {
      setProcessing(true);
      formAction(formData);
    });
  };

  return (
    <>
      <Stepper current="payment" processing={processing} />
      <div className="space-y-4">
        {summary}
        <CountdownTimer remainingMs={initiallyExpired ? 0 : remainingMs} />
        {expired && <ExpiredBanner />}
        {!expired && <FormError message={state.message} />}

        <form onSubmit={handleSubmit} aria-labelledby="payment-heading" className="space-y-6">
          <h2 id="payment-heading" className="text-lg font-semibold text-slate-900">
            Payment
          </h2>
          <input type="hidden" name="quoteId" value={quoteId} />

          <fieldset disabled={expired || isPending}>
            <legend className="text-sm font-semibold text-slate-900">
              Choose a test payment method
            </legend>
            <p className="text-sm text-slate-600">
              This is a sandbox. No real card is charged and no card details are collected.
            </p>
            <div className="mt-2 grid gap-2">
              {PAYMENT_TOKENS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm has-[:checked]:border-indigo-700 has-[:checked]:bg-indigo-50"
                >
                  <input
                    type="radio"
                    name="paymentToken"
                    value={option.value}
                    checked={token === option.value}
                    onChange={() => {
                      setToken(option.value);
                      idempotencyKey.current = null; // a different intent needs a different key
                    }}
                    className="h-4 w-4 accent-indigo-700"
                  />
                  <span>
                    {option.label}{' '}
                    <code className="rounded bg-slate-100 px-1 text-xs text-slate-800">
                      {option.value}
                    </code>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <SubmitButton pending={isPending} pendingLabel="Processing payment…" disabled={expired}>
            Pay {formatINR(total)}
          </SubmitButton>
        </form>
      </div>
    </>
  );
}
