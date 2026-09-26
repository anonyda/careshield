import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { IdempotencyKeyRequiredError } from '../common/errors/domain-errors';
import { IDEMPOTENCY_KEY_PATTERN } from './idempotency.service';

/**
 * Reads the idempotency key from `Idempotency-Key`, falling back to the `idempotency_key`
 * alias. The canonical header wins when both are sent. Missing or malformed keys are a 400.
 */
export const IdempotencyKey = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const key = request.header('idempotency-key') ?? request.header('idempotency_key');
  if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) throw new IdempotencyKeyRequiredError();
  return key;
});
