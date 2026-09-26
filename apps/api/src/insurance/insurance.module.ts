import { Module } from '@nestjs/common';
import { DeclarationService } from './declaration.service';
import { InsuranceController } from './insurance.controller';
import { QuoteService } from './quote.service';

@Module({
  controllers: [InsuranceController],
  providers: [QuoteService, DeclarationService],
})
export class InsuranceModule {}
