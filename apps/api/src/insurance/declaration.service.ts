import { Injectable, Logger } from '@nestjs/common';
import { Prisma, QuoteStatus } from '@prisma/client';
import {
  DeclarationInconsistentError,
  InvalidStateError,
  NotEligibleError,
  QuoteExpiredError,
  QuoteNotFoundError,
} from '../common/errors/domain-errors';
import { PrismaService } from '../prisma/prisma.service';
import { DeclarationDto } from './dto/declaration.dto';
import { isExpired } from './quote.service';
import { transitionQuote } from './quote-state-machine';

export interface DeclarationResult {
  quoteId: string;
  eligible: true;
  status: QuoteStatus;
  expiresAt: string;
  serverTime: string;
}

/** Returns a human-readable reason when the applicant cannot be covered, otherwise null. */
export function ineligibilityReason(declaration: DeclarationDto): string | null {
  if (declaration.hasCriticalIllnessDiagnosis) {
    return 'CareShield Max cannot be offered to applicants with a critical illness diagnosis.';
  }
  if (declaration.conditions.includes('CANCER')) {
    return 'CareShield Max cannot be offered to applicants with a history of cancer.';
  }
  if (declaration.conditions.includes('HEART_DISEASE')) {
    return 'CareShield Max cannot be offered to applicants with heart disease.';
  }
  return null;
}

@Injectable()
export class DeclarationService {
  private readonly logger = new Logger(DeclarationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async declare(dto: DeclarationDto): Promise<DeclarationResult> {
    const now = new Date();
    const quote = await this.prisma.quote.findUnique({ where: { id: dto.quoteId } });

    // Rule 1: state and expiry (the CAS below re-checks both authoritatively).
    if (!quote) throw new QuoteNotFoundError(dto.quoteId);
    if (quote.status !== QuoteStatus.QUOTE_GENERATED) {
      throw new InvalidStateError(`A medical declaration was already submitted for this quote.`);
    }
    if (isExpired(quote, now)) throw new QuoteExpiredError();

    // Rule 2: the premium was priced without conditions, so a declaration listing some is inconsistent.
    const declaresConditions = dto.conditions.some((condition) => condition !== 'NONE');
    if (!quote.hasPreExistingConditions && declaresConditions) {
      throw new DeclarationInconsistentError();
    }

    // Rule 3: eligibility. State is intentionally left unchanged.
    const reason = ineligibilityReason(dto);
    if (reason) {
      this.logger.log(`Quote ${quote.id} declaration not eligible`);
      throw new NotEligibleError(reason);
    }

    // Rule 4: store and move to MEDICAL_DECLARED in one compare-and-set update.
    const declaration: Prisma.InputJsonObject = {
      isSmoker: dto.isSmoker,
      hospitalizedLast24Months: dto.hospitalizedLast24Months,
      hasCriticalIllnessDiagnosis: dto.hasCriticalIllnessDiagnosis,
      conditions: dto.conditions,
      additionalDetails: dto.additionalDetails?.trim() || null,
    };
    await transitionQuote(this.prisma, {
      quoteId: quote.id,
      from: QuoteStatus.QUOTE_GENERATED,
      to: QuoteStatus.MEDICAL_DECLARED,
      now,
      data: { medicalDeclaration: declaration, declaredAt: now },
    });
    this.logger.log(`Quote ${quote.id}: QUOTE_GENERATED -> MEDICAL_DECLARED`);

    return {
      quoteId: quote.id,
      eligible: true,
      status: QuoteStatus.MEDICAL_DECLARED,
      expiresAt: quote.expiresAt.toISOString(),
      serverTime: new Date().toISOString(),
    };
  }
}
