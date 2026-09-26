import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdempotencyStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { IdempotencyKeyReusedError, RequestInProgressError } from '../common/errors/domain-errors';
import { isUniqueViolation } from '../common/errors/prisma-errors';
import { AppEnv } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/** Identifies one holder of a key. `lockedAt` changes on takeover, so a stale holder can't write. */
export interface IdempotencyLock {
  key: string;
  lockedAt: Date;
  createdAt: Date;
}

export type AcquireResult =
  | { kind: 'acquired'; lock: IdempotencyLock }
  | { kind: 'replay'; statusCode: number; body: Prisma.JsonValue };

/** sha256 over the request with keys in a fixed order, so equal payloads hash equally. */
export function hashRequest(payload: Record<string, string>): string {
  const canonical = JSON.stringify(
    Object.keys(payload)
      .sort()
      .map((key) => [key, payload[key]]),
  );
  return createHash('sha256').update(canonical).digest('hex');
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly lockTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppEnv, true>,
  ) {
    this.lockTtlMs = config.get('IDEMPOTENCY_LOCK_TTL_SECONDS', { infer: true }) * 1000;
  }

  /**
   * Claims the key, or explains why not: replay a finished response, reject a reused key,
   * or report that another request holds it. A lock older than the TTL (a crashed holder)
   * can be taken over, guarded by compare-and-set on `lockedAt`.
   */
  async acquire(key: string, requestHash: string): Promise<AcquireResult> {
    // Two passes cover the rare case where the row is released between our insert and read.
    for (let attempt = 0; attempt < 2; attempt++) {
      const now = new Date();
      try {
        await this.prisma.idempotencyKey.create({
          data: {
            key,
            requestHash,
            status: IdempotencyStatus.IN_PROGRESS,
            lockedAt: now,
            createdAt: now,
          },
        });
        return { kind: 'acquired', lock: { key, lockedAt: now, createdAt: now } };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }

      const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });
      if (!existing) continue;

      if (existing.requestHash !== requestHash) throw new IdempotencyKeyReusedError();

      if (existing.status === IdempotencyStatus.COMPLETED) {
        this.logger.log(`Idempotency key ${key}: replaying stored response`);
        return {
          kind: 'replay',
          statusCode: existing.responseStatus ?? 200,
          body: existing.responseBody,
        };
      }

      if (now.getTime() - existing.lockedAt.getTime() <= this.lockTtlMs) {
        throw new RequestInProgressError();
      }

      const { count } = await this.prisma.idempotencyKey.updateMany({
        where: { key, status: IdempotencyStatus.IN_PROGRESS, lockedAt: existing.lockedAt },
        data: { lockedAt: now },
      });
      if (count !== 1) throw new RequestInProgressError();

      this.logger.warn(`Idempotency key ${key}: took over a stale lock`);
      return { kind: 'acquired', lock: { key, lockedAt: now, createdAt: existing.createdAt } };
    }
    throw new RequestInProgressError();
  }

  /**
   * Stores the final response. Pass the transaction client so the stored response commits
   * (or rolls back) together with the business writes. Throws if the lock was lost.
   */
  async complete(
    db: Prisma.TransactionClient,
    lock: IdempotencyLock,
    statusCode: number,
    body: Prisma.InputJsonValue,
  ): Promise<void> {
    const { count } = await db.idempotencyKey.updateMany({
      where: { key: lock.key, status: IdempotencyStatus.IN_PROGRESS, lockedAt: lock.lockedAt },
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseStatus: statusCode,
        responseBody: body,
        completedAt: new Date(),
      },
    });
    if (count !== 1) {
      throw new Error(`Idempotency lock for key ${lock.key} was lost before completion`);
    }
  }

  /**
   * Confirms we still hold the key and restarts its TTL, so nobody can take it over while we
   * act on that answer (e.g. refund). Returns the renewed lock, or null if the key was taken
   * over or already completed.
   */
  async renew(lock: IdempotencyLock): Promise<IdempotencyLock | null> {
    const lockedAt = new Date();
    const { count } = await this.prisma.idempotencyKey.updateMany({
      where: { key: lock.key, status: IdempotencyStatus.IN_PROGRESS, lockedAt: lock.lockedAt },
      data: { lockedAt },
    });
    return count === 1 ? { ...lock, lockedAt } : null;
  }

  /** Frees the key after a transient failure so the client may retry with it. */
  async release(lock: IdempotencyLock): Promise<void> {
    const { count } = await this.prisma.idempotencyKey.deleteMany({
      where: { key: lock.key, status: IdempotencyStatus.IN_PROGRESS, lockedAt: lock.lockedAt },
    });
    if (count > 0) this.logger.log(`Idempotency key ${lock.key}: released`);
  }
}
