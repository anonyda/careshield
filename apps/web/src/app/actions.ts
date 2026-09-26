'use server';

import { redirect } from 'next/navigation';
import { setTimeout as sleep } from 'node:timers/promises';
import { ApiError, checkout, createQuote, submitDeclaration } from '@/lib/api';
import type {
  CheckoutFormState,
  DeclarationFormState,
  FieldErrors,
  QuoteFormState,
} from '@/lib/types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firstFieldErrors(details: Record<string, string[]> | null): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, messages] of Object.entries(details ?? {})) errors[field] = messages[0];
  return errors;
}

function readYesNo(formData: FormData, name: string): boolean | null {
  const value = formData.get(name);
  return value === 'yes' ? true : value === 'no' ? false : null;
}

export async function createQuoteAction(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const ageText = String(formData.get('age') ?? '').trim();
  const hasPreExistingConditions = readYesNo(formData, 'hasPreExistingConditions');

  const fieldErrors: FieldErrors = {};
  const age = /^\d+$/.test(ageText) ? Number(ageText) : NaN;
  if (!Number.isInteger(age) || age < 18 || age > 99) {
    fieldErrors.age = 'Enter a whole number between 18 and 99.';
  }
  if (hasPreExistingConditions === null) {
    fieldErrors.hasPreExistingConditions = 'Tell us whether you have any pre-existing conditions.';
  }
  if (Object.keys(fieldErrors).length > 0 || hasPreExistingConditions === null) {
    return { fieldErrors };
  }

  let quoteId: string;
  try {
    ({ quoteId } = await createQuote({ age, hasPreExistingConditions }));
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { fieldErrors: firstFieldErrors(error.details), message: error.message };
  }
  redirect(`/quote/${quoteId}`);
}

export async function submitDeclarationAction(
  _prev: DeclarationFormState,
  formData: FormData,
): Promise<DeclarationFormState> {
  const quoteId = String(formData.get('quoteId') ?? '');
  const isSmoker = readYesNo(formData, 'isSmoker');
  const hospitalizedLast24Months = readYesNo(formData, 'hospitalizedLast24Months');
  const hasCriticalIllnessDiagnosis = readYesNo(formData, 'hasCriticalIllnessDiagnosis');
  const conditions = formData.getAll('conditions').map(String);
  const additionalDetails = String(formData.get('additionalDetails') ?? '').trim();

  const fieldErrors: FieldErrors = {};
  if (isSmoker === null) fieldErrors.isSmoker = 'Please answer this question.';
  if (hospitalizedLast24Months === null) {
    fieldErrors.hospitalizedLast24Months = 'Please answer this question.';
  }
  if (hasCriticalIllnessDiagnosis === null) {
    fieldErrors.hasCriticalIllnessDiagnosis = 'Please answer this question.';
  }
  if (conditions.length === 0) {
    fieldErrors.conditions = 'Select your conditions, or "None of these".';
  }
  if (additionalDetails.length > 500) {
    fieldErrors.additionalDetails = 'Keep additional details to 500 characters or fewer.';
  }
  if (
    !UUID_PATTERN.test(quoteId) ||
    Object.keys(fieldErrors).length > 0 ||
    isSmoker === null ||
    hospitalizedLast24Months === null ||
    hasCriticalIllnessDiagnosis === null
  ) {
    return { fieldErrors };
  }

  let repriced: boolean;
  try {
    ({ repriced } = await submitDeclaration({
      quoteId,
      isSmoker,
      hospitalizedLast24Months,
      hasCriticalIllnessDiagnosis,
      conditions,
      additionalDetails: additionalDetails || undefined,
    }));
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.code === 'INVALID_STATE') redirect(`/quote/${quoteId}`);
    return {
      code: error.code,
      message: error.message,
      expired: error.code === 'QUOTE_EXPIRED',
      fieldErrors: firstFieldErrors(error.details),
    };
  }
  // Re-render the quote page, which now shows the payment step (and a note if the price dropped).
  redirect(repriced ? `/quote/${quoteId}?repriced=1` : `/quote/${quoteId}`);
}

const IN_PROGRESS_RETRIES = 5;

/** Calls checkout, waiting out 409 REQUEST_IN_PROGRESS (another tab or a retry holds the key). */
async function checkoutWithRetry(quoteId: string, paymentToken: string, key: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await checkout({ quoteId, paymentToken }, key);
    } catch (error) {
      const inProgress = error instanceof ApiError && error.code === 'REQUEST_IN_PROGRESS';
      if (!inProgress || attempt >= IN_PROGRESS_RETRIES) throw error;
      await sleep((error.retryAfterSeconds ?? 1) * 1000);
    }
  }
}

export async function checkoutAction(
  _prev: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  const quoteId = String(formData.get('quoteId') ?? '');
  const paymentToken = String(formData.get('paymentToken') ?? '');
  const idempotencyKey = String(formData.get('idempotencyKey') ?? '');

  if (!UUID_PATTERN.test(quoteId) || !paymentToken || !idempotencyKey) {
    return { message: 'Something went wrong. Please try again.', rotateKey: true };
  }

  try {
    await checkoutWithRetry(quoteId, paymentToken, idempotencyKey);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    switch (error.code) {
      case 'INVALID_STATE':
        // Most likely already paid (e.g. in another tab): show whatever the quote is now.
        redirect(`/quote/${quoteId}`);
      case 'QUOTE_EXPIRED':
        return { code: error.code, message: error.message, expired: true, rotateKey: true };
      case 'PAYMENT_FAILED':
        return { code: error.code, message: error.message, rotateKey: true };
      default:
        // Transient (gateway down, network, still processing): retry with the same key.
        return { code: error.code, message: error.message, rotateKey: false };
    }
  }
  redirect(`/quote/${quoteId}`);
}
