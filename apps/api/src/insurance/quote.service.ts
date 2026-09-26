import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Policy, Quote, QuoteStatus } from '@prisma/client';
import { QuoteNotFoundError } from '../common/errors/domain-errors';
import { AppEnv } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { calculatePremium, formatMoney } from './premium.calculator';

export interface QuoteView {
  quoteId: string;
  status: QuoteStatus;
  currency: string;
  premium: { base: string; ageLoading: string; conditionLoading: string; total: string };
  createdAt: string;
  expiresAt: string;
  serverTime: string;
}

export interface QuoteDetailView extends QuoteView {
  age: number;
  hasPreExistingConditions: boolean;
  policy: { policyNumber: string; issuedAt: string; premiumPaid: string } | null;
}

export function toQuoteView(quote: Quote, now: Date): QuoteView {
  return {
    quoteId: quote.id,
    status: quote.status,
    currency: quote.currency,
    premium: {
      base: formatMoney(quote.basePremium),
      ageLoading: formatMoney(quote.ageLoading),
      conditionLoading: formatMoney(quote.conditionLoading),
      total: formatMoney(quote.totalPremium),
    },
    createdAt: quote.createdAt.toISOString(),
    expiresAt: quote.expiresAt.toISOString(),
    serverTime: now.toISOString(),
  };
}

/** Expiry is derived from the timestamp, never stored as a status. */
export function isExpired(quote: Pick<Quote, 'expiresAt'>, now: Date): boolean {
  return quote.expiresAt.getTime() <= now.getTime();
}

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppEnv, true>,
  ) {
    this.ttlSeconds = config.get('QUOTE_TTL_SECONDS', { infer: true });
  }

  async createQuote(input: CreateQuoteDto): Promise<QuoteView> {
    const premium = calculatePremium(input);
    // One Date instance for both timestamps so the lock window is exact.
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);

    const quote = await this.prisma.quote.create({
      data: {
        age: input.age,
        hasPreExistingConditions: input.hasPreExistingConditions,
        basePremium: premium.basePremium,
        ageLoading: premium.ageLoading,
        conditionLoading: premium.conditionLoading,
        totalPremium: premium.totalPremium,
        currency: premium.currency,
        status: QuoteStatus.QUOTE_GENERATED,
        createdAt: now,
        expiresAt,
      },
    });

    this.logger.log(`Quote ${quote.id} generated: total ${formatMoney(quote.totalPremium)} INR`);
    return toQuoteView(quote, new Date());
  }

  async getQuote(quoteId: string): Promise<QuoteDetailView> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { policy: true },
    });
    if (!quote) throw new QuoteNotFoundError(quoteId);

    return {
      ...toQuoteView(quote, new Date()),
      age: quote.age,
      hasPreExistingConditions: quote.hasPreExistingConditions,
      policy: quote.policy ? toPolicySummary(quote.policy) : null,
    };
  }
}

function toPolicySummary(policy: Policy): NonNullable<QuoteDetailView['policy']> {
  return {
    policyNumber: policy.policyNumber,
    issuedAt: policy.issuedAt.toISOString(),
    premiumPaid: formatMoney(policy.premiumPaid),
  };
}
