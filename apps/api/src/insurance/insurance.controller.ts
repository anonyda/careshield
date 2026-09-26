import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { DeclarationResult, DeclarationService } from './declaration.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { DeclarationDto } from './dto/declaration.dto';
import { QuoteDetailView, QuoteService, QuoteView } from './quote.service';

@Controller('insurance')
export class InsuranceController {
  constructor(
    private readonly quotes: QuoteService,
    private readonly declarations: DeclarationService,
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
}
