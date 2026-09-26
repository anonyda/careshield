import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuoteDetailView, QuoteService, QuoteView } from './quote.service';

@Controller('insurance')
export class InsuranceController {
  constructor(private readonly quotes: QuoteService) {}

  @Post('quote')
  @HttpCode(201)
  createQuote(@Body() dto: CreateQuoteDto): Promise<QuoteView> {
    return this.quotes.createQuote(dto);
  }

  @Get('quote/:quoteId')
  getQuote(@Param('quoteId', ParseUUIDPipe) quoteId: string): Promise<QuoteDetailView> {
    return this.quotes.getQuote(quoteId);
  }
}
