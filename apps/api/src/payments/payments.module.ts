import { Module } from '@nestjs/common';
import { MockPaymentGateway } from './mock-payment-gateway';
import { PAYMENT_GATEWAY } from './payment-gateway.interface';

@Module({
  providers: [MockPaymentGateway, { provide: PAYMENT_GATEWAY, useExisting: MockPaymentGateway }],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
