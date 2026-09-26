import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { AppEnv } from '../config/env.validation';
import {
  ChargeInput,
  GatewayUnavailableError,
  PaymentDeclinedError,
  PaymentGateway,
} from './payment-gateway.interface';

export const MOCK_TOKENS = {
  success: 'tok_success',
  declined: 'tok_declined',
  error: 'tok_error',
} as const;

/**
 * In-process stand-in for a card gateway. Like real gateways (e.g. Stripe) it is idempotent
 * per key, and it records charges and refunds so tests can assert on them.
 */
@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(MockPaymentGateway.name);
  private readonly latencyMs: number;
  private readonly chargesByKey = new Map<string, string>();

  /** Number of real (non-replayed) successful charges. */
  chargeCount = 0;
  readonly refunds: string[] = [];

  constructor(config: ConfigService<AppEnv, true>) {
    this.latencyMs = config.get('MOCK_PAYMENT_LATENCY_MS', { infer: true });
  }

  async charge({
    amount,
    currency,
    token,
    idempotencyKey,
  }: ChargeInput): Promise<{ reference: string }> {
    await sleep(this.latencyMs);

    const existing = this.chargesByKey.get(idempotencyKey);
    if (existing) return { reference: existing };

    if (token === MOCK_TOKENS.error) throw new GatewayUnavailableError();
    if (token !== MOCK_TOKENS.success) throw new PaymentDeclinedError();

    const reference = `pay_${randomBytes(12).toString('hex')}`;
    this.chargesByKey.set(idempotencyKey, reference);
    this.chargeCount += 1;
    this.logger.log(`Charged ${amount} ${currency} (${reference})`);
    return { reference };
  }

  async refund(reference: string): Promise<void> {
    await sleep(this.latencyMs);
    this.refunds.push(reference);
    this.logger.log(`Refunded ${reference}`);
  }

  /** Test helper: forget all recorded activity. */
  reset(): void {
    this.chargesByKey.clear();
    this.chargeCount = 0;
    this.refunds.length = 0;
  }
}
