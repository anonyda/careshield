export type QuoteStatus = 'QUOTE_GENERATED' | 'MEDICAL_DECLARED' | 'PREMIUM_PAID' | 'POLICY_ISSUED';

/** Money values arrive as two-decimal strings, e.g. "15000.00". */
export interface PremiumBreakdown {
  base: string;
  ageLoading: string;
  conditionLoading: string;
  total: string;
}

export interface Quote {
  quoteId: string;
  status: QuoteStatus;
  currency: string;
  premium: PremiumBreakdown;
  createdAt: string;
  expiresAt: string;
  serverTime: string;
  age: number;
  hasPreExistingConditions: boolean;
  policy: { policyNumber: string; issuedAt: string; premiumPaid: string } | null;
}

export const MEDICAL_CONDITIONS = [
  { value: 'DIABETES', label: 'Diabetes' },
  { value: 'HYPERTENSION', label: 'Hypertension (high blood pressure)' },
  { value: 'ASTHMA', label: 'Asthma' },
  { value: 'HEART_DISEASE', label: 'Heart disease' },
  { value: 'CANCER', label: 'Cancer' },
] as const;

export const PAYMENT_TOKENS = [
  { value: 'tok_success', label: 'Successful payment' },
  { value: 'tok_declined', label: 'Card declined' },
  { value: 'tok_error', label: 'Gateway error' },
] as const;

export type FieldErrors = Partial<Record<string, string>>;

export interface QuoteFormState {
  fieldErrors?: FieldErrors;
  message?: string;
}

export interface DeclarationFormState {
  fieldErrors?: FieldErrors;
  message?: string;
  code?: string;
  expired?: boolean;
}

export interface CheckoutFormState {
  message?: string;
  code?: string;
  expired?: boolean;
  /** True after a definitive result, so the next attempt uses a fresh idempotency key. */
  rotateKey?: boolean;
}
