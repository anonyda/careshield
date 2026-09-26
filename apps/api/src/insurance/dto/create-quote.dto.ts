import { IsBoolean, IsInt, Max, Min } from 'class-validator';
import { MAX_AGE, MIN_AGE } from '../premium.calculator';

export class CreateQuoteDto {
  @IsInt({ message: 'age must be a whole number' })
  @Min(MIN_AGE, { message: `age must be at least ${MIN_AGE}` })
  @Max(MAX_AGE, { message: `age must be at most ${MAX_AGE}` })
  age: number;

  @IsBoolean({ message: 'hasPreExistingConditions must be true or false' })
  hasPreExistingConditions: boolean;
}
