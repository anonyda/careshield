import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CheckoutDto {
  @IsUUID('all', { message: 'quoteId must be a valid UUID' })
  quoteId: string;

  @IsString({ message: 'paymentToken must be a string' })
  @IsNotEmpty({ message: 'paymentToken is required' })
  @MaxLength(100, { message: 'paymentToken must be at most 100 characters' })
  paymentToken: string;
}
