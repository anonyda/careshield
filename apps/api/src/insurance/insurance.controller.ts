import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { CheckoutService } from './checkout.service';
import { DeclarationResult, DeclarationService } from './declaration.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { DeclarationDto } from './dto/declaration.dto';
import { IdempotencyKey } from './idempotency-key.decorator';
import { QuoteDetailView, QuoteService, QuoteView } from './quote.service';

@Controller('insurance')
export class InsuranceController {
  constructor(
    private readonly quotes: QuoteService,
    private readonly declarations: DeclarationService,
    private readonly checkouts: CheckoutService,
  ) {}

  @Post('quote')
  @HttpCode(201)
  createQuote(@Body() dto: CreateQuoteDto): Promise<QuoteView> {
    return this.quotes.createQuote(dto);
  }

  @Get('quote/:quoteId')
  getQuote(@Param('quoteId', ParseUUIDPipe) quoteId: string): Promise<QuoteDetailView> {
    return this.quotes.getQuote(quoteId);
  }

  @Post('declaration')
  @HttpCode(200)
  submitDeclaration(@Body() dto: DeclarationDto): Promise<DeclarationResult> {
    return this.declarations.declare(dto);
  }

  /** Status varies: stored outcomes (200, 402, 409, 410) are returned and replayed verbatim. */
  @Post('checkout')
  async checkout(
    @IdempotencyKey() key: string,
    @Body() dto: CheckoutDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const outcome = await this.checkouts.checkout(key, dto);
    res.status(outcome.statusCode);
    if (outcome.replayed) res.setHeader('Idempotent-Replayed', 'true');
    return outcome.body;
  }
}
