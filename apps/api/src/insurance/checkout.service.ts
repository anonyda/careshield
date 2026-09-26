import { Inject, Injectable, Logger } from '@nestjs/common';
import { Policy, Prisma, Quote, QuoteStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import {
  DomainError,
  InvalidStateError,
  PaymentFailedError,
  PaymentGatewayError,
  QuoteExpiredError,
  QuoteNotFoundError,
} from '../common/errors/domain-errors';
import { isUniqueViolation } from '../common/errors/prisma-errors';
import {
  GatewayUnavailableError,
  PAYMENT_GATEWAY,
  PaymentDeclinedError,
  PaymentGateway,
} from '../payments/payment-gateway.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutDto } from './dto/checkout.dto';
import { hashRequest, IdempotencyLock, IdempotencyService } from './idempotency.service';
import { formatMoney } from './premium.calculator';
import { isExpired } from './quote.service';
import { transitionQuote } from './quote-state-machine';

export interface CheckoutResponse {
  quoteId: string;
  status: QuoteStatus;
  policy: {
    id: string;
    policyNumber: string;
    premiumPaid: string;
    currency: string;
    issuedAt: string;
  };
  paymentReference: string;
}

export interface CheckoutOutcome {
  statusCode: number;
  body: unknown;
  replayed: boolean;
}

const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** CSM-<year>-<8 Crockford base32 chars from 40 random bits>, e.g. CSM-2026-7F3K9Q2M. */
export function generatePolicyNumber(now: Date): string {
  let bits = BigInt(`0x${randomBytes(5).toString('hex')}`);
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix = CROCKFORD_BASE32[Number(bits & 31n)] + suffix;
    bits >>= 5n;
  }
  return `CSM-${now.getUTCFullYear()}-${suffix}`;
}

/**
 * Checkout flow: acquire idempotency key -> pre-check quote -> charge (outside any DB
 * transaction) -> one transaction that issues the policy and stores the response ->
 * refund if that transaction fails and we still own the key.
 *
 * Deterministic failures (declined, expired, invalid state) are stored against the key and
 * replayed. Transient failures (gateway down, unexpected errors) release the key for retry.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async checkout(key: string, dto: CheckoutDto): Promise<CheckoutOutcome> {
    const requestHash = hashRequest({ quoteId: dto.quoteId, paymentToken: dto.paymentToken });
    const acquired = await this.idempotency.acquire(key, requestHash);
    if (acquired.kind === 'replay') {
      return { statusCode: acquired.statusCode, body: acquired.body, replayed: true };
    }

    try {
      return await this.process(acquired.lock, dto);
    } catch (error) {
      // Anything not handled below is transient or unexpected: free the key so a retry can run.
      await this.idempotency
        .release(acquired.lock)
        .catch((releaseError: unknown) =>
          this.logger.error(`Failed to release idempotency key ${key}`, String(releaseError)),
        );
      throw error;
    }
  }

  private async process(lock: IdempotencyLock, dto: CheckoutDto): Promise<CheckoutOutcome> {
    this.logger.log(`Checkout started for quote ${dto.quoteId} (key ${lock.key})`);

    // Pre-check: a fast fail before charging. The CAS in commit() is the authoritative check.
    let quote: Quote;
    try {
      quote = await this.loadPayableQuote(dto.quoteId, new Date());
    } catch (error) {
      if (error instanceof DomainError) return this.finishWithError(lock, error);
      throw error;
    }

    // Charge outside the transaction so no DB connection is held during the network call.
    let reference: string;
    try {
      ({ reference } = await this.gateway.charge({
        amount: formatMoney(quote.totalPremium),
        currency: quote.currency,
        token: dto.paymentToken,
        idempotencyKey: gatewayIdempotencyKey(lock),
      }));
    } catch (error) {
      if (error instanceof PaymentDeclinedError) {
        this.logger.log(`Payment declined for quote ${quote.id} (key ${lock.key})`);
        return this.finishWithError(lock, new PaymentFailedError());
      }
      if (error instanceof GatewayUnavailableError) throw new PaymentGatewayError();
      throw error;
    }

    try {
      const body = await this.commit(lock, quote, reference);
      this.logger.log(
        `Quote ${quote.id}: MEDICAL_DECLARED -> PREMIUM_PAID -> POLICY_ISSUED (${body.policy.policyNumber})`,
      );
      return { statusCode: 200, body, replayed: false };
    } catch (error) {
      // Only refund while we still own the key. If it was taken over, the new holder reuses
      // this same charge (same gateway key) and must not find it refunded. If the key is
      // already completed, the commit really succeeded and the charge backs a policy.
      const owned = await this.idempotency.renew(lock).catch(() => null);
      if (!owned) {
        this.logger.warn(
          `Not refunding payment ${reference} for quote ${quote.id}: key ${lock.key} is no longer ours or its state is unknown`,
        );
        throw error;
      }

      // The customer was charged but no policy exists: give the money back.
      await this.refund(quote.id, reference);
      if (error instanceof QuoteExpiredError || error instanceof InvalidStateError) {
        return this.finishWithError(owned, error);
      }
      // Transient: free the key (renewed above, so the caller's lock is stale) for a retry.
      await this.idempotency.release(owned);
      throw error;
    }
  }

  private async loadPayableQuote(quoteId: string, now: Date): Promise<Quote> {
    const quote = await this.prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote) throw new QuoteNotFoundError(quoteId);
    if (quote.status !== QuoteStatus.MEDICAL_DECLARED) {
      throw new InvalidStateError(
        quote.status === QuoteStatus.QUOTE_GENERATED
          ? 'Please complete the medical declaration before paying.'
          : 'A policy has already been issued for this quote.',
      );
    }
    if (isExpired(quote, now)) throw new QuoteExpiredError();
    return quote;
  }

  /** Issues the policy atomically. Retries once if the random policy number collides. */
  private async commit(
    lock: IdempotencyLock,
    quote: Quote,
    reference: string,
  ): Promise<CheckoutResponse> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const now = new Date();
          await transitionQuote(tx, {
            quoteId: quote.id,
            from: QuoteStatus.MEDICAL_DECLARED,
            to: QuoteStatus.PREMIUM_PAID,
            now,
          });
          const policy = await this.insertPolicy(tx, {
            quoteId: quote.id,
            policyNumber: generatePolicyNumber(now),
            premiumPaid: quote.totalPremium,
            paymentReference: reference,
            issuedAt: now,
          });
          await transitionQuote(tx, {
            quoteId: quote.id,
            from: QuoteStatus.PREMIUM_PAID,
            to: QuoteStatus.POLICY_ISSUED,
            now,
          });

          const body = toCheckoutResponse(quote, policy);
          // Same transaction: "policy exists" and "key completed" can never diverge.
          await this.idempotency.complete(tx, lock, 200, { ...body });
          return body;
        });
      } catch (error) {
        if (attempt === 1 && isUniqueViolation(error, 'policy_number')) continue;
        if (isUniqueViolation(error, 'quote_id')) {
          throw new InvalidStateError('A policy has already been issued for this quote.');
        }
        throw error;
      }
    }
  }

  /** Separate method so tests can inject a failure inside the transaction. */
  insertPolicy(
    tx: Prisma.TransactionClient,
    data: Prisma.PolicyUncheckedCreateInput,
  ): Promise<Policy> {
    return tx.policy.create({ data });
  }

  private async refund(quoteId: string, reference: string): Promise<void> {
    try {
      await this.gateway.refund(reference);
      this.logger.warn(`Refunded payment ${reference} for quote ${quoteId}`);
    } catch (error) {
      this.logger.error(
        `REFUND FAILED, needs reconciliation: quote ${quoteId}, payment ${reference}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async finishWithError(
    lock: IdempotencyLock,
    error: DomainError,
  ): Promise<CheckoutOutcome> {
    const envelope = { ...error.toEnvelope(), details: null };
    await this.idempotency.complete(this.prisma, lock, envelope.statusCode, envelope);
    this.logger.log(`Checkout for key ${lock.key} finished with ${envelope.code}`);
    return { statusCode: envelope.statusCode, body: envelope, replayed: false };
  }
}

/**
 * Key sent to the gateway. It stays the same when a stale lock is taken over (so a crashed
 * attempt's charge is reused, not repeated) but changes once our key is released and
 * re-created, so a retry after a refund makes a fresh charge instead of replaying the refunded one.
 */
function gatewayIdempotencyKey(lock: IdempotencyLock): string {
  return `${lock.key}:${lock.createdAt.getTime()}`;
}

function toCheckoutResponse(quote: Quote, policy: Policy): CheckoutResponse {
  return {
    quoteId: quote.id,
    status: QuoteStatus.POLICY_ISSUED,
    policy: {
      id: policy.id,
      policyNumber: policy.policyNumber,
      premiumPaid: formatMoney(policy.premiumPaid),
      currency: quote.currency,
      issuedAt: policy.issuedAt.toISOString(),
    },
    paymentReference: policy.paymentReference,
  };
}
