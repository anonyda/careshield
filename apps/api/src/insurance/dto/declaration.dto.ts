import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateBy,
  ValidationOptions,
} from 'class-validator';

export const MEDICAL_CONDITIONS = [
  'NONE',
  'DIABETES',
  'HYPERTENSION',
  'ASTHMA',
  'HEART_DISEASE',
  'CANCER',
] as const;
export type MedicalCondition = (typeof MEDICAL_CONDITIONS)[number];

/** "NONE" is only valid on its own. */
function NoneIsExclusive(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'noneIsExclusive',
      validator: {
        validate: (value: unknown) =>
          !Array.isArray(value) || !value.includes('NONE') || value.length === 1,
        defaultMessage: () => 'conditions cannot combine NONE with other conditions',
      },
    },
    options,
  );
}

export class DeclarationDto {
  @IsUUID('all', { message: 'quoteId must be a valid UUID' })
  quoteId: string;

  @IsBoolean({ message: 'isSmoker must be true or false' })
  isSmoker: boolean;

  @IsBoolean({ message: 'hospitalizedLast24Months must be true or false' })
  hospitalizedLast24Months: boolean;

  @IsBoolean({ message: 'hasCriticalIllnessDiagnosis must be true or false' })
  hasCriticalIllnessDiagnosis: boolean;

  @IsArray({ message: 'conditions must be a list' })
  @ArrayNotEmpty({ message: 'select at least one option (or NONE)' })
  @ArrayUnique({ message: 'conditions must not contain duplicates' })
  @IsIn(MEDICAL_CONDITIONS, {
    each: true,
    message: `each condition must be one of: ${MEDICAL_CONDITIONS.join(', ')}`,
  })
  @NoneIsExclusive()
  conditions: MedicalCondition[];

  @IsOptional()
  @IsString({ message: 'additionalDetails must be text' })
  @MaxLength(500, { message: 'additionalDetails must be at most 500 characters' })
  additionalDetails?: string;
}
