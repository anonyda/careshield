/** DI token for the active payment gateway implementation. */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface ChargeInput {
  /** Decimal string with two places, e.g. "15000.00". Never a float. */
  amount: string;
  currency: string;
  token: string;
  /** Repeating a charge with the same key returns the original charge instead of charging again. */
  idempotencyKey: string;
}

export interface PaymentGateway {
  charge(input: ChargeInput): Promise<{ reference: string }>;
  refund(reference: string): Promise<void>;
}

/** The card was declined. Deterministic: retrying the same token will fail the same way. */
export class PaymentDeclinedError extends Error {
  constructor() {
    super('Payment declined');
    this.name = 'PaymentDeclinedError';
  }
}

/** The gateway could not process the request. Transient: the charge did not happen and may be retried. */
export class GatewayUnavailableError extends Error {
  constructor() {
    super('Payment gateway unavailable');
    this.name = 'GatewayUnavailableError';
  }
}
