import { Prisma, QuoteStatus } from '@prisma/client';
import {
  InvalidStateError,
  InvalidStateTransitionError,
  QuoteExpiredError,
  QuoteNotFoundError,
} from '../common/errors/domain-errors';

/** The allowed transitions: each status has exactly one successor, or none when terminal. */
export const NEXT_STATUS: Readonly<Record<QuoteStatus, QuoteStatus | null>> = {
  [QuoteStatus.QUOTE_GENERATED]: QuoteStatus.MEDICAL_DECLARED,
  [QuoteStatus.MEDICAL_DECLARED]: QuoteStatus.PREMIUM_PAID,
  [QuoteStatus.PREMIUM_PAID]: QuoteStatus.POLICY_ISSUED,
  [QuoteStatus.POLICY_ISSUED]: null,
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return NEXT_STATUS[from] === to;
}

export function assertTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}

export interface TransitionParams {
  quoteId: string;
  from: QuoteStatus;
  to: QuoteStatus;
  now: Date;
  /** Extra columns written atomically with the status change. */
  data?: Omit<Prisma.QuoteUpdateManyMutationInput, 'status'>;
}

/**
 * Compare-and-set transition. The update only applies while the quote is still in `from`
 * and unexpired, so two concurrent requests can never both move the same quote.
 * Accepts the root client or an interactive-transaction client.
 */
export async function transitionQuote(
  db: Prisma.TransactionClient,
  { quoteId, from, to, now, data }: TransitionParams,
): Promise<void> {
  assertTransition(from, to);

  const { count } = await db.quote.updateMany({
    where: { id: quoteId, status: from, expiresAt: { gt: now } },
    data: { ...data, status: to },
  });
  if (count === 1) return;

  // The CAS missed: work out why so the caller gets a precise error.
  const current = await db.quote.findUnique({ where: { id: quoteId }, select: { status: true } });
  if (!current) throw new QuoteNotFoundError(quoteId);
  if (current.status !== from) {
    throw new InvalidStateError(`This quote is ${current.status}; expected ${from}.`);
  }
  throw new QuoteExpiredError();
}
