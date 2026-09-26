import { Prisma } from '@prisma/client';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export const MIN_AGE = 18;
export const MAX_AGE = 99;
export const CURRENCY = 'INR';
export const BASE_PREMIUM = new Decimal('10000.00');
/** Loading applies strictly above this age (45 itself gets none). */
export const AGE_LOADING_THRESHOLD = 45;
/** Age loading is a percentage of the base premium only, never compounded. */
export const AGE_LOADING_RATE = new Decimal('0.5');
export const CONDITION_LOADING = new Decimal('5000.00');

export interface PremiumInput {
  age: number;
  hasPreExistingConditions: boolean;
}

export interface PremiumBreakdown {
  basePremium: Decimal;
  ageLoading: Decimal;
  conditionLoading: Decimal;
  totalPremium: Decimal;
  currency: typeof CURRENCY;
}

/** Pure and deterministic: no clock, randomness or I/O, and no floating-point money. */
export function calculatePremium({
  age,
  hasPreExistingConditions,
}: PremiumInput): PremiumBreakdown {
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
    throw new RangeError(`age must be an integer between ${MIN_AGE} and ${MAX_AGE}`);
  }

  const basePremium = BASE_PREMIUM;
  const ageLoading =
    age > AGE_LOADING_THRESHOLD ? basePremium.times(AGE_LOADING_RATE) : new Decimal(0);
  const conditionLoading = hasPreExistingConditions ? CONDITION_LOADING : new Decimal(0);
  const totalPremium = basePremium.plus(ageLoading).plus(conditionLoading);

  return { basePremium, ageLoading, conditionLoading, totalPremium, currency: CURRENCY };
}

/** Money leaves the API as a two-decimal string, e.g. "15000.00". */
export function formatMoney(value: Decimal): string {
  return value.toFixed(2);
}
