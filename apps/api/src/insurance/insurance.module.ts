import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { CheckoutService } from './checkout.service';
import { DeclarationService } from './declaration.service';
import { IdempotencyService } from './idempotency.service';
import { InsuranceController } from './insurance.controller';
import { QuoteService } from './quote.service';

@Module({
  imports: [PaymentsModule],
  controllers: [InsuranceController],
  providers: [QuoteService, DeclarationService, CheckoutService, IdempotencyService],
})
export class InsuranceModule {}
