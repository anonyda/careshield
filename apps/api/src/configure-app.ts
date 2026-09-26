import {
  BadRequestException,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/** Flattens class-validator errors into `{ "field.path": ["message", ...] }`. */
function toFieldErrors(errors: ValidationError[], parent = ''): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) result[path] = Object.values(error.constraints);
    Object.assign(result, toFieldErrors(error.children ?? [], path));
  }
  return result;
}

/** Shared by main.ts and the e2e tests so both run the exact same pipeline. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // A string "52" must fail validation for a numeric field, not be coerced.
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'The request is invalid. Please check the highlighted fields.',
          details: toFieldErrors(errors),
        }),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
}
