import { Module } from '@nestjs/common';
import { InsuranceController } from './insurance.controller';
import { QuoteService } from './quote.service';

@Module({
  controllers: [InsuranceController],
  providers: [QuoteService],
})
export class InsuranceModule {}
