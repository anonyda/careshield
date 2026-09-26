/**
 * Domain errors carry their own HTTP status and machine-readable code.
 * The global exception filter turns them into the standard error envelope.
 */
export abstract class DomainError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly details: unknown = null;
  readonly headers: Readonly<Record<string, string>> = {};

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class QuoteNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'QUOTE_NOT_FOUND';
  constructor(quoteId: string) {
    super(`Quote ${quoteId} was not found.`);
  }
}

export class QuoteExpiredError extends DomainError {
  readonly statusCode = 410;
  readonly code = 'QUOTE_EXPIRED';
  constructor() {
    super('This quote has expired. Please recalculate your premium.');
  }
}

export class InvalidStateError extends DomainError {
  readonly statusCode = 409;
  readonly code = 'INVALID_STATE';
}

export class InvalidStateTransitionError extends InvalidStateError {
  constructor(from: string, to: string) {
    super(`A quote cannot move from ${from} to ${to}.`);
  }
}

export class DeclarationInconsistentError extends DomainError {
  readonly statusCode = 422;
  readonly code = 'DECLARATION_INCONSISTENT';
  constructor() {
    super(
      'Your declaration lists conditions but the quote was calculated without them. Please recalculate your premium.',
    );
  }
}

export class NotEligibleError extends DomainError {
  readonly statusCode = 422;
  readonly code = 'NOT_ELIGIBLE';
}

export class IdempotencyKeyRequiredError extends DomainError {
  readonly statusCode = 400;
  readonly code = 'IDEMPOTENCY_KEY_REQUIRED';
  constructor() {
    super(
      'A valid Idempotency-Key header is required (8-128 characters: letters, digits, "_" or "-").',
    );
  }
}

export class IdempotencyKeyReusedError extends DomainError {
  readonly statusCode = 422;
  readonly code = 'IDEMPOTENCY_KEY_REUSED';
  constructor() {
    super('This Idempotency-Key was already used with a different request body.');
  }
}

export class RequestInProgressError extends DomainError {
  readonly statusCode = 409;
  readonly code = 'REQUEST_IN_PROGRESS';
  readonly headers = { 'Retry-After': '1' };
  constructor() {
    super('A request with this Idempotency-Key is already being processed. Please retry shortly.');
  }
}

export class PaymentFailedError extends DomainError {
  readonly statusCode = 402;
  readonly code = 'PAYMENT_FAILED';
  constructor() {
    super('Your payment was declined. No policy was issued.');
  }
}

export class PaymentGatewayError extends DomainError {
  readonly statusCode = 502;
  readonly code = 'PAYMENT_GATEWAY_ERROR';
  constructor() {
    super('The payment provider is unavailable. You have not been charged. Please try again.');
  }
}
